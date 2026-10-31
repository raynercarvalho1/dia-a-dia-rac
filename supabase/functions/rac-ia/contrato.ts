// RAC Intelligence: contrato v1 entre o site e a função rac-ia (documentado em docs/rac-intelligence.md).
// Valida a requisição (versão, módulo, ação, chave de idempotência, entrada, contexto e tamanhos) e monta as respostas.
// Puro (testado em tests/ia.test.mjs). Quem chama, o papel e o modo NUNCA vêm daqui: vêm do login e do banco.

import type { Acao, Entrada, Imagem } from "./acoes.ts";

export const VERSAO_CONTRATO = 1;

export const ERROS: Record<string, { status: number; mensagem: string }> = {
  metodo: { status: 405, mensagem: "Use POST." },
  nao_autenticado: { status: 401, mensagem: "Entre no RAC para usar a IA." },
  sem_permissao: { status: 403, mensagem: "Esta função de IA não está liberada para o seu acesso." },
  entrada_invalida: { status: 400, mensagem: "Pedido inválido." },
  muito_grande: { status: 413, mensagem: "O pedido é grande demais. Mande menos fotos ou fotos menores." },
  em_andamento: { status: 409, mensagem: "Este pedido já está sendo processado." },
  repetida: { status: 409, mensagem: "Este pedido já foi processado. Para ler de novo, toque em Tentar de novo." },
  limite_de_uso: { status: 429, mensagem: "Muitos pedidos seguidos. Espere um pouco e tente de novo." },
  orcamento_esgotado: { status: 402, mensagem: "O limite mensal da IA foi atingido. Use o jeito manual até o mês virar." },
  configuracao: { status: 503, mensagem: "A IA ainda não está configurada no servidor (preços ou tabelas)." },
  /* recusas do próprio banco (ia_reservar), a segunda camada: a casa sem configuração ou fora do modo REAL */
  configuracao_ausente: { status: 503, mensagem: "A configuração da IA desta casa não existe. Nada foi reservado nem cobrado." },
  modo_demo: { status: 409, mensagem: "O modo REAL está desligado para esta casa. Nada foi reservado nem cobrado." },
  tempo_esgotado: { status: 504, mensagem: "A IA não respondeu a tempo. A chamada ficou marcada como incerta e não será repetida sozinha." },
  provedor_indisponivel: { status: 502, mensagem: "O serviço de IA está fora do ar. Tente mais tarde ou use o jeito manual." },
  provedor_ocupado: { status: 503, mensagem: "O serviço de IA está ocupado agora. Tente de novo em alguns minutos." },
  provedor_recusou_pedido: { status: 502, mensagem: "O serviço de IA recusou o pedido." },
  resposta_invalida: { status: 502, mensagem: "A resposta da IA veio incompleta ou fora do formato. Nada foi preenchido." },
  recusado: { status: 422, mensagem: "A IA não quis ler este conteúdo." },
  interno: { status: 500, mensagem: "Erro interno do RAC Intelligence." },
};

export type Pedido = {
  versao: 1;
  modulo: string;
  acao: string;
  idempotencia: string;
  entrada: Entrada;
  contexto: Record<string, unknown>;
};
export type ResultadoValidacao = { ok: true; pedido: Pedido; avisos: string[] } | { ok: false; codigo: string; mensagem: string };

const CAMPOS = ["versao", "modulo", "acao", "idempotencia", "entrada", "contexto"];
const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp"];
export const IMAGEM_MAX_CARACTERES = 6_000_000; // base64 de ~4,5 MB
export const IMAGENS_TOTAL_CARACTERES = 8_000_000;

const falha = (codigo: string, detalhe: string): ResultadoValidacao => ({ ok: false, codigo, mensagem: (ERROS[codigo]?.mensagem ?? "") + " " + detalhe });

export function validarPedido(corpo: unknown, acoes: Record<string, Acao>): ResultadoValidacao {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return falha("entrada_invalida", "O corpo precisa ser um objeto JSON.");
  const c = corpo as Record<string, unknown>, avisos: string[] = [];
  /* modo, modelo, usuário, papel, preço…: decididos pelo servidor; se vierem, são ignorados e avisados */
  for (const k of Object.keys(c)) if (!CAMPOS.includes(k)) avisos.push(`O campo "${k.slice(0, 30)}" foi ignorado: é decidido pelo servidor.`);
  if (c.versao !== VERSAO_CONTRATO) return falha("entrada_invalida", "Versão do contrato não suportada.");
  if (typeof c.acao !== "string" || !Object.prototype.hasOwnProperty.call(acoes, c.acao)) return falha("entrada_invalida", "Ação desconhecida.");
  const a = acoes[c.acao];
  if (c.modulo !== a.modulo) return falha("entrada_invalida", "O módulo não corresponde à ação.");
  if (typeof c.idempotencia !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(c.idempotencia)) return falha("entrada_invalida", "Chave de idempotência inválida.");

  const e = c.entrada;
  if (!e || typeof e !== "object" || Array.isArray(e)) return falha("entrada_invalida", "Falta a entrada.");
  const ent = e as Record<string, unknown>;
  for (const k of Object.keys(ent)) if (k !== "texto" && k !== "imagens") return falha("entrada_invalida", "Campo de entrada desconhecido.");
  const texto = ent.texto === undefined ? "" : ent.texto;
  if (typeof texto !== "string") return falha("entrada_invalida", "O texto precisa ser texto.");
  if (texto.length > a.textoMax) return falha("muito_grande", `Texto acima de ${a.textoMax} caracteres.`);
  const imgs = ent.imagens === undefined ? [] : ent.imagens;
  if (!Array.isArray(imgs)) return falha("entrada_invalida", "As imagens precisam ser uma lista.");
  if (imgs.length > a.imagensMax) return falha("muito_grande", `No máximo ${a.imagensMax} imagens.`);
  let total = 0;
  const imagens: Imagem[] = [];
  for (const im of imgs) {
    if (!im || typeof im !== "object") return falha("entrada_invalida", "Imagem inválida.");
    const { tipo, base64 } = im as Record<string, unknown>;
    if (typeof tipo !== "string" || !TIPOS_IMAGEM.includes(tipo)) return falha("entrada_invalida", "Tipo de imagem não aceito (use JPEG, PNG ou WebP).");
    if (typeof base64 !== "string" || !base64.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return falha("entrada_invalida", "Imagem não está em base64.");
    if (base64.length > IMAGEM_MAX_CARACTERES) return falha("muito_grande", "Uma das imagens é grande demais.");
    total += base64.length;
    imagens.push({ tipo: tipo as Imagem["tipo"], base64 });
  }
  if (total > IMAGENS_TOTAL_CARACTERES) return falha("muito_grande", "As imagens juntas são grandes demais.");
  if (!texto.trim() && !imagens.length) return falha("entrada_invalida", "Mande um texto ou pelo menos uma foto.");

  /* contexto: só as chaves que a ação declara, com o tipo certo; o resto é descartado */
  const contexto: Record<string, unknown> = {};
  if (c.contexto !== undefined) {
    if (!c.contexto || typeof c.contexto !== "object" || Array.isArray(c.contexto)) return falha("entrada_invalida", "O contexto precisa ser um objeto.");
    if (JSON.stringify(c.contexto).length > 2000) return falha("muito_grande", "Contexto grande demais.");
    for (const [k, v] of Object.entries(c.contexto as Record<string, unknown>)) {
      const t = a.contexto[k];
      if (t === "texto" && typeof v === "string") contexto[k] = v.slice(0, 60);
      else if (t === "numero" && typeof v === "number" && isFinite(v)) contexto[k] = v;
      else avisos.push(`O contexto "${k.slice(0, 30)}" foi ignorado.`);
    }
  }
  return { ok: true, avisos, pedido: { versao: 1, modulo: a.modulo, acao: a.id, idempotencia: c.idempotencia, entrada: { texto, imagens }, contexto } };
}

export type Consumo = {
  modelo: string;
  uso_api: { tokens_entrada: number; tokens_saida: number } | null;
  reservado_usd: number | null;
  estimado_rac_usd: number | null;
  cobranca_efetiva: null;
  observacao: string;
  mes?: { comprometido_usd: number; teto_usd: number; percentual: number; alerta: number };
};

export type Resposta = {
  ok: boolean;
  versao: 1;
  id: string | null;
  modulo: string | null;
  acao: string | null;
  modo: "DEMO" | "REAL";
  estado?: string;
  resultado?: Record<string, unknown>;
  mensagem: string;
  avisos: string[];
  consumo?: Consumo;
  erro?: { codigo: string; mensagem: string };
};

export function respostaErro(codigo: string, base: { modulo?: string | null; acao?: string | null; modo?: "DEMO" | "REAL"; id?: string | null; estado?: string; detalhe?: string; avisos?: string[]; consumo?: Consumo }): { status: number; corpo: Resposta } {
  const e = ERROS[codigo] ?? ERROS.interno;
  const mensagem = base.detalhe ? e.mensagem + " " + base.detalhe : e.mensagem;
  return {
    status: e.status,
    corpo: { ok: false, versao: 1, id: base.id ?? null, modulo: base.modulo ?? null, acao: base.acao ?? null, modo: base.modo ?? "DEMO", estado: base.estado, mensagem, avisos: base.avisos ?? [], consumo: base.consumo, erro: { codigo: ERROS[codigo] ? codigo : "interno", mensagem } },
  };
}
