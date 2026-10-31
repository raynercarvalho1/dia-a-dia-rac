// RAC Intelligence: o caminho de um pedido, do login já conferido até a resposta. Banco e provedor chegam de fora
// (index.ts liga no Supabase e na Anthropic; os testes usam versões falsas), então o fluxo inteiro é testado sem rede.
//
// Ordem: valida o contrato → papel e casa (do banco) → permissão da ação → modo (do banco, da ação e do papel + chave) → DEMO responde sem
// gravar nada; REAL: preço → contagem oficial (ou estimativa por excesso) → reserva no banco (trava, idempotência,
// limites, orçamento) → marca envio → UMA chamada, com tempo máximo → concluído ou incerto → valida a resposta.

import { ACOES, caracteresDoPedido, montarPedido } from "./acoes.ts";
import { respostaErro, validarPedido, type Consumo, type Resposta } from "./contrato.ts";
import { respostaDemo } from "./demo.ts";
import {
  codigoDoErro, configDe, custoUsd, decidirModo, destinoAposErro, LIMITES, nivelAlerta, reservaUsd, tokensEntradaPorExcesso,
  type Config, type ErroProvedor, type Preco,
} from "./orcamento.ts";
import type { ProvedorIA } from "./provedores.ts";

export type Reserva = { ok: boolean; id?: string; codigo?: string; comprometido_usd?: number; teto_usd?: number };
export type Banco = {
  papelEDono(userId: string): Promise<{ papel: "dono" | "casa"; dono: string }>;
  config(dono: string): Promise<Partial<Config> | null>;
  preco(modelo: string): Promise<Preco | null>;
  reservar(a: { dono: string; user: string; idempotencia: string; modulo: string; acao: string; modelo: string; reservado_usd: number; tokens_contados: number; contagem_oficial: boolean }): Promise<Reserva>;
  marcarEnvio(id: string): Promise<boolean>;
  falhouSemEnvio(id: string, erro: string): Promise<boolean>;
  concluir(id: string, tokensEntrada: number, tokensSaida: number, estimadoUsd: number, ms: number, erro: string | null): Promise<boolean>;
  marcarIncerto(id: string, erro: string, ms: number): Promise<boolean>;
};
export type Dependencias = {
  banco: Banco;
  provedor: ProvedorIA | null; // null = sem chave no servidor
  agora?: () => number;
  log?: (o: Record<string, unknown>) => void;
  tempoChamadaMs?: number;
};
export type Saida = { status: number; corpo: Resposta };

const ok = (corpo: Resposta): Saida => ({ status: 200, corpo });

export async function atenderPedido(userId: string, corpoBruto: unknown, d: Dependencias): Promise<Saida> {
  const agora = d.agora ?? Date.now, log = d.log ?? (() => {});
  const v = validarPedido(corpoBruto, ACOES);
  if (!v.ok) return respostaErro(v.codigo, { detalhe: v.mensagem.replace(/^.*?\. /, "") });
  const p = v.pedido, a = ACOES[p.acao], base = { modulo: p.modulo, acao: p.acao, avisos: v.avisos };

  let papel: "dono" | "casa", dono: string, cfg: Config, temConfig: boolean;
  try {
    ({ papel, dono } = await d.banco.papelEDono(userId));
    const linha = await d.banco.config(dono);
    /* sem linha em ia_config (conta nova ou casa ainda não configurada): só DEMO, nunca REAL */
    temConfig = !!linha;
    cfg = configDe(linha);
  } catch (_) { return respostaErro("configuracao", base); }
  if (!a.papeis.includes(papel) || (papel === "casa" && !cfg.acoes_casa.includes(a.id))) return respostaErro("sem_permissao", base);

  const { modo, motivo } = temConfig ? decidirModo(cfg, !!d.provedor, a, papel) : { modo: "DEMO" as const, motivo: "A configuração da IA desta casa ainda não foi criada." };
  if (modo === "DEMO" || !d.provedor) return ok(respostaDemo(a.id, p.contexto, motivo, v.avisos));

  /* ---------- REAL ---------- */
  const preco = await d.banco.preco(a.modelo).catch(() => null);
  if (!preco) return respostaErro("configuracao", { ...base, modo, detalhe: "Sem preço cadastrado para " + a.modelo + "." });
  const pedido = montarPedido(a, p.entrada, p.contexto);

  let tokens: number, oficial = true;
  try { tokens = await d.provedor.contarTokens(pedido, AbortSignal.timeout(LIMITES.tempoContagemMs)); }
  catch (_) { tokens = tokensEntradaPorExcesso(caracteresDoPedido(pedido), p.entrada.imagens.length); oficial = false; }
  if (tokens > preco.max_entrada_tokens) return respostaErro("muito_grande", { ...base, modo });
  const reservado = reservaUsd(preco, tokens, a.maxTokens, cfg);

  const r = await d.banco.reservar({ dono, user: userId, idempotencia: p.idempotencia, modulo: a.modulo, acao: a.id, modelo: a.modelo, reservado_usd: reservado, tokens_contados: tokens, contagem_oficial: oficial })
    .catch(() => ({ ok: false, codigo: "interno" } as Reserva));
  if (!r.ok || !r.id) return respostaErro(r.codigo ?? "interno", { ...base, modo, id: r.id ?? null });
  const id = r.id;

  const enviou = await d.banco.marcarEnvio(id).catch(() => false);
  if (!enviou) { await d.banco.falhouSemEnvio(id, "interno").catch(() => {}); return respostaErro("interno", { ...base, modo, id }); }

  const t0 = agora();
  let resp;
  try {
    resp = await d.provedor.gerar(pedido, AbortSignal.timeout(d.tempoChamadaMs ?? LIMITES.tempoChamadaMs));
  } catch (e) {
    const erro = (e && typeof e === "object" && "tipo" in e ? e : { tipo: "desconhecido" }) as ErroProvedor;
    const ms = agora() - t0, codigo = codigoDoErro(erro), destino = destinoAposErro("depois_do_envio", erro);
    if (destino === "concluido_sem_custo") {
      await d.banco.concluir(id, 0, 0, 0, ms, codigo).catch(() => d.banco.marcarIncerto(id, codigo, ms).catch(() => {}));
      log({ id, acao: a.id, estado: "concluido", erro: codigo, ms });
      return respostaErro(codigo, { ...base, modo, id, estado: "concluido" });
    }
    /* pode ter havido cobrança: fica incerto, com a reserva cheia, e NÃO é repetido */
    await d.banco.marcarIncerto(id, codigo, ms).catch(() => {});
    log({ id, acao: a.id, estado: "incerto", erro: codigo, ms });
    return respostaErro(codigo === "tempo_esgotado" ? "tempo_esgotado" : codigo, { ...base, modo, id, estado: "incerto", detalhe: "Id da chamada: " + id + "." });
  }

  const ms = agora() - t0, estimado = custoUsd(preco, resp.uso.entrada, resp.uso.saida);
  const codigoResp = resp.tipo === "recusa" ? "recusado" : resp.tipo === "ok" ? null : "resposta_invalida";
  const registrado = await d.banco.concluir(id, resp.uso.entrada, resp.uso.saida, estimado, ms, codigoResp).catch(() => false);
  if (!registrado) await d.banco.marcarIncerto(id, "registro_falhou", ms).catch(() => {});
  log({ id, acao: a.id, estado: registrado ? "concluido" : "incerto", erro: codigoResp, ms, modelo: resp.modelo });

  const comprometido = (r.comprometido_usd ?? 0) - reservado + (registrado ? estimado * cfg.fator_correcao : reservado);
  const teto = r.teto_usd ?? 0, pct = teto > 0 ? Math.round(comprometido / teto * 100) : 100;
  const consumo: Consumo = {
    modelo: resp.modelo,
    uso_api: { tokens_entrada: resp.uso.entrada, tokens_saida: resp.uso.saida },
    reservado_usd: reservado,
    estimado_rac_usd: estimado,
    cobranca_efetiva: null,
    observacao: "Estimativa do RAC (uso informado pela API × tabela de preços de " + (preco.conferido_em ?? "data desconhecida") + "). Não é a fatura: a cobrança efetiva está no Console da Anthropic." + (oficial ? "" : " A reserva usou estimativa por excesso (contagem oficial indisponível)."),
    mes: { comprometido_usd: Math.round(comprometido * 1e6) / 1e6, teto_usd: teto, percentual: pct, alerta: nivelAlerta(pct) },
  };
  if (codigoResp) return respostaErro(codigoResp, { ...base, modo, id, estado: "concluido", consumo });

  let bruto: unknown;
  try { bruto = JSON.parse(resp.texto); } catch (_) { return respostaErro("resposta_invalida", { ...base, modo, id, estado: "concluido", consumo }); }
  const val = a.validar(bruto, p.contexto);
  if (!val.ok) return respostaErro("resposta_invalida", { ...base, modo, id, estado: "concluido", consumo, detalhe: val.motivo + "." });
  return ok({
    ok: true, versao: 1, id, modulo: a.modulo, acao: a.id, modo: "REAL", estado: "concluido",
    resultado: val.resultado, mensagem: "Confira os dados antes de salvar.", avisos: [...v.avisos, ...val.avisos], consumo,
  });
}
