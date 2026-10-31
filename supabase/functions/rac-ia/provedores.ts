// RAC Intelligence: interface de provedor de IA e o adaptador da Anthropic. O cliente (SDK oficial) é recebido de fora
// (index.ts cria com maxRetries: 0), então este arquivo não importa nada e é testado com um cliente falso.
// Trocar de provedor = escrever outro adaptador com a mesma interface; os módulos do site não mudam.

import type { PedidoProvedor } from "./acoes.ts";
import type { ErroProvedor } from "./orcamento.ts";

export type RespostaProvedor = {
  tipo: "ok" | "recusa" | "cortada" | "sem_texto";
  texto: string;
  uso: { entrada: number; saida: number };
  modelo: string;
};

export interface ProvedorIA {
  nome: string;
  /* contagem oficial de tokens de entrada (estimativa do provedor; pode diferir um pouco do uso faturado) */
  contarTokens(p: PedidoProvedor, sinal: AbortSignal): Promise<number>;
  /* uma única tentativa, sem repetição automática */
  gerar(p: PedidoProvedor, sinal: AbortSignal): Promise<RespostaProvedor>;
}

/* o mínimo do SDK que o adaptador usa */
export type ClienteMensagens = {
  messages: {
    create(params: Record<string, unknown>, opcoes?: { signal?: AbortSignal; maxRetries?: number }): Promise<Record<string, unknown>>;
    countTokens(params: Record<string, unknown>, opcoes?: { signal?: AbortSignal; maxRetries?: number }): Promise<{ input_tokens: number }>;
  };
};

/* sem as classes do SDK (testes): pelo status e pelo nome da classe do erro */
export function classificarPorFormato(e: unknown): ErroProvedor {
  const x = e as { status?: unknown; name?: unknown } | null;
  const nome = typeof x?.name === "string" ? x.name : "";
  if (nome === "AbortError" || nome === "TimeoutError" || nome === "APIUserAbortError" || nome === "APIConnectionTimeoutError") return { tipo: "tempo" };
  if (typeof x?.status === "number") return { tipo: "http", status: x.status };
  if (nome === "APIConnectionError" || nome === "TypeError") return { tipo: "rede" };
  return { tipo: "desconhecido" };
}

function params(p: PedidoProvedor, comSaida: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    model: p.modelo,
    system: p.sistema,
    messages: [{ role: "user", content: p.conteudo }],
    output_config: { format: { type: "json_schema", schema: p.esquema } },
  };
  /* sem "thinking" (Haiku 5.5 e Sonnet 5.5 decidem sozinhos), sem "fallbacks" (decisão do dono: nada de trocar de modelo) */
  if (comSaida) { base.max_tokens = p.maxTokens; (base.output_config as Record<string, unknown>).effort = p.esforco; }
  return base;
}

export function provedorAnthropic(cliente: ClienteMensagens, classificar: (e: unknown) => ErroProvedor = classificarPorFormato): ProvedorIA {
  return {
    nome: "anthropic",
    async contarTokens(p, sinal) {
      try {
        const r = await cliente.messages.countTokens(params(p, false), { signal: sinal, maxRetries: 0 });
        if (typeof r?.input_tokens !== "number" || !(r.input_tokens > 0)) throw { name: "RespostaEstranha" };
        return r.input_tokens;
      } catch (e) { throw classificar(e); }
    },
    async gerar(p, sinal) {
      let r: Record<string, unknown>;
      try { r = await cliente.messages.create(params(p, true), { signal: sinal, maxRetries: 0 }); } catch (e) { throw classificar(e); }
      const u = (r.usage ?? {}) as Record<string, unknown>;
      const n = (v: unknown) => (typeof v === "number" && v > 0 ? v : 0);
      /* cache não é usado; se aparecer, conta como entrada cheia (por excesso) */
      const uso = { entrada: n(u.input_tokens) + n(u.cache_creation_input_tokens) + n(u.cache_read_input_tokens), saida: n(u.output_tokens) };
      const modelo = typeof r.model === "string" ? r.model : p.modelo;
      const blocos = Array.isArray(r.content) ? r.content as Record<string, unknown>[] : [];
      const texto = blocos.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text as string).join("");
      if (r.stop_reason === "refusal") return { tipo: "recusa", texto: "", uso, modelo };
      if (r.stop_reason === "max_tokens") return { tipo: "cortada", texto, uso, modelo };
      if (!texto.trim()) return { tipo: "sem_texto", texto: "", uso, modelo };
      return { tipo: "ok", texto, uso, modelo };
    },
  };
}
