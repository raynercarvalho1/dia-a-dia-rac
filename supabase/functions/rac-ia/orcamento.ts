// RAC Intelligence: contas do orçamento, decisão de modo e destino de cada erro na máquina de estados.
// Funções puras (sem Deno, sem rede, sem banco): testadas em tests/ia.test.mjs. O banco (supabase/015_ia.sql) é a fonte
// de verdade da reserva; comprometidoUsd() abaixo espelha ia_comprometido_usd() para os testes e a documentação.

export type Config = {
  modo: "DEMO" | "REAL";
  limite_brl: number;
  cambio_brl_usd: number;
  margem_impostos: number;
  margem_seguranca: number;
  margem_contagem: number;
  fator_correcao: number;
  acoes_casa: string[];
};

/* padrão aprovado: R$ 50, R$ 6,00 por dólar, 12% de impostos, 10% de margem de segurança → teto de US$ 6,70 */
export const CONFIG_PADRAO: Config = {
  modo: "DEMO", limite_brl: 50, cambio_brl_usd: 6, margem_impostos: 0.12, margem_seguranca: 0.1,
  margem_contagem: 0.15, fator_correcao: 1, acoes_casa: ["abastecimento.interpretar", "mercado.nota"],
};

export const LIMITES = {
  emAndamentoPorPessoa: 2,
  porMinutoPorPessoa: 10,
  porDiaPorCasa: 150,
  tempoChamadaMs: 60_000,
  tempoContagemMs: 10_000,
  corpoMaxBytes: 8_000_000,
};

export type Preco = { entrada_usd_mtok: number; saida_usd_mtok: number; max_entrada_tokens: number; conferido_em?: string };

/* junta a linha de ia_config (ou nada) com o padrão, sem aceitar valores fora das faixas do banco */
export function configDe(linha: Partial<Config> | null | undefined): Config {
  const c = { ...CONFIG_PADRAO, ...(linha ?? {}) } as Config;
  const num = (v: unknown, p: number) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && isFinite(+v) ? +v : p);
  return {
    modo: c.modo === "REAL" ? "REAL" : "DEMO",
    limite_brl: num(c.limite_brl, 50), cambio_brl_usd: num(c.cambio_brl_usd, 6), margem_impostos: num(c.margem_impostos, 0.12),
    margem_seguranca: num(c.margem_seguranca, 0.1), margem_contagem: num(c.margem_contagem, 0.15),
    fator_correcao: Math.max(1, num(c.fator_correcao, 1)), acoes_casa: Array.isArray(c.acoes_casa) ? c.acoes_casa.map(String) : [],
  };
}

const arred = (v: number) => Math.ceil(v * 1e6) / 1e6;

/* teto mensal em USD: limite ÷ (câmbio × (1 + impostos)) × (1 − margem de segurança) */
export function tetoUsd(c: Config): number {
  return Math.round(c.limite_brl / (c.cambio_brl_usd * (1 + c.margem_impostos)) * (1 - c.margem_seguranca) * 1e6) / 1e6;
}

/* quanto um valor em USD custa em reais, já com a margem de impostos (só para exibir) */
export function emReais(usd: number, c: Config): number {
  return Math.round(usd * c.cambio_brl_usd * (1 + c.margem_impostos) * 100) / 100;
}

export function custoUsd(p: Preco, tokensEntrada: number, tokensSaida: number): number {
  return arred((tokensEntrada * p.entrada_usd_mtok + tokensSaida * p.saida_usd_mtok) / 1e6);
}

/* sem a contagem oficial: estimativa por excesso. 2 caracteres por token (português conta mais que inglês),
   4.784 tokens por imagem (o máximo documentado para imagens grandes) e 1.500 de folga para o formato JSON */
export const TOKENS_POR_IMAGEM_MAX = 4784;
export function tokensEntradaPorExcesso(caracteres: number, imagens: number): number {
  return Math.ceil(caracteres / 2) + imagens * TOKENS_POR_IMAGEM_MAX + 1500;
}

/* reserva: entrada contada (a contagem oficial também é estimativa) + saída máxima (o raciocínio conta como saída),
   com a margem de contagem e o fator de correção da conferência mensal; arredonda para cima */
export function reservaUsd(p: Preco, tokensEntrada: number, maxTokensSaida: number, c: Config): number {
  return arred(custoUsd(p, tokensEntrada, maxTokensSaida) * (1 + c.margem_contagem) * c.fator_correcao);
}

/* modo decidido só aqui, com dados do servidor: REAL exige o dono ter ligado e a chave existir */
export function decidirModo(c: Config, temChave: boolean): { modo: "DEMO" | "REAL"; motivo: string } {
  if (c.modo !== "REAL") return { modo: "DEMO", motivo: "O modo REAL está desligado no Sistema." };
  if (!temChave) return { modo: "DEMO", motivo: "A chave da Anthropic não está configurada no servidor." };
  return { modo: "REAL", motivo: "" };
}

export function nivelAlerta(percentual: number): 0 | 50 | 80 | 100 {
  return percentual >= 100 ? 100 : percentual >= 80 ? 80 : percentual >= 50 ? 50 : 0;
}

export type ErroProvedor = { tipo: "http"; status: number } | { tipo: "tempo" } | { tipo: "rede" } | { tipo: "desconhecido" };
export type Destino = "falhou_sem_envio" | "concluido_sem_custo" | "incerto";

/* para onde vai a chamada quando dá erro. Antes do envio: libera. Depois do envio, só uma recusa explícita da API
   (4xx de pedido inválido, chave ou limite) é certeza de que nada foi processado; tempo esgotado, rede, 408, 409 e
   5xx podem ter gerado cobrança, então ficam "incerto" com a reserva cheia até o dono reconciliar */
export function destinoAposErro(fase: "antes_do_envio" | "depois_do_envio", e: ErroProvedor): Destino {
  if (fase === "antes_do_envio") return "falhou_sem_envio";
  if (e.tipo === "http" && [400, 401, 403, 404, 413, 422, 429].includes(e.status)) return "concluido_sem_custo";
  return "incerto";
}

export function codigoDoErro(e: ErroProvedor): string {
  if (e.tipo === "tempo") return "tempo_esgotado";
  if (e.tipo === "rede") return "rede";
  if (e.tipo === "http") return e.status === 429 ? "provedor_ocupado" : e.status >= 500 ? "provedor_indisponivel" : "provedor_recusou_pedido";
  return "desconhecido";
}

export type LinhaUso = {
  estado: "reservado" | "enviando" | "concluido" | "falhou_sem_envio" | "incerto" | "reconciliado";
  reservado_usd: number; estimado_usd?: number | null; reconciliado_cobrado?: boolean | null; reconciliado_usd?: number | null;
};

/* espelho de ia_comprometido_usd(): o que já está comprometido no mês */
export function comprometidoUsd(linhas: LinhaUso[], c: Config): number {
  let s = 0;
  for (const u of linhas) {
    if (u.estado === "concluido") s += (u.estimado_usd ?? u.reservado_usd) * c.fator_correcao;
    else if (u.estado === "reservado" || u.estado === "enviando" || u.estado === "incerto") s += u.reservado_usd;
    else if (u.estado === "reconciliado") s += u.reconciliado_cobrado ? (u.reconciliado_usd ?? u.reservado_usd) : 0;
  }
  return Math.round(s * 1e6) / 1e6;
}

/* espelho da decisão de ia_reservar(): cabe ou não */
export function cabeNoOrcamento(linhas: LinhaUso[], novaReserva: number, c: Config): boolean {
  return comprometidoUsd(linhas, c) + novaReserva <= tetoUsd(c);
}
