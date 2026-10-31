// RAC Intelligence: qual chave do próprio Supabase usar, no mesmo padrão da função garmin (supabase/functions/garmin/index.ts).
// Formato novo: um JSON por nome ({"default": "sb_..."}); formato antigo: um texto só. A pública ainda tem um terceiro
// fallback, SUPABASE_PUBLISHABLE_KEY (texto), igual ao da garmin. As variáveis chegam de fora (index.ts passa as do
// servidor), então este arquivo é puro e testado em tests/ia.test.mjs.

export type LerAmbiente = (nome: string) => string | undefined;

export function chaveSb(ler: LerAmbiente, nova: string, antiga: string): string {
  try { const j = JSON.parse(ler(nova) ?? ""); if (j?.default) return j.default as string; } catch (_) { /* formato antigo */ }
  return ler(antiga) ?? "";
}

export const chaveServidor = (ler: LerAmbiente): string => chaveSb(ler, "SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
export const chavePublica = (ler: LerAmbiente): string =>
  chaveSb(ler, "SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY") || (ler("SUPABASE_PUBLISHABLE_KEY") ?? "");
