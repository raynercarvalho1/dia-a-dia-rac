// RAC Intelligence: a única porta do RAC para a IA (docs/rac-intelligence.md). Este é o único arquivo que usa Deno,
// o Supabase e o SDK da Anthropic; o resto da pasta é lógica pura e testada (tests/ia.test.mjs).
// Segredos: ANTHROPIC_API_KEY só em Edge Functions → Secrets (sem ela, tudo responde em DEMO). A chave de servidor do
// Supabase é usada só para as funções de orçamento e para ler configuração, papel e preço; nunca sai daqui.
// Publicar pela CLI (README da pasta docs): npx supabase@<versão> functions deploy rac-ia --use-api --project-ref <projeto>
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { respostaErro } from "./contrato.ts";
import { LIMITES, type ErroProvedor } from "./orcamento.ts";
import { classificarPorFormato, provedorAnthropic, type ClienteMensagens } from "./provedores.ts";
import { atenderPedido, type Banco } from "./servico.ts";

/* CORS: mesma lista da função garmin (copiada, para não mexer nela) */
const ORIGENS = ["https://raynercarvalho.com.br", "https://www.raynercarvalho.com.br", "https://raynercarvalho1.github.io"];
const origemPermitida = (o: string | null) =>
  o && (ORIGENS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) ? o : ORIGENS[0];
const cabecalhos = (req: Request) => ({
  "Access-Control-Allow-Origin": origemPermitida(req.headers.get("Origin")),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
});

/* chaves do próprio Supabase: formato novo (JSON por nome) ou antigo (texto) */
const chaveSb = (nova: string, antiga: string) => {
  try { const j = JSON.parse(Deno.env.get(nova) ?? ""); if (j?.default) return j.default as string; } catch (_) { /* formato antigo */ }
  return Deno.env.get(antiga) ?? "";
};

/* erros do SDK pelas classes dele; o resto pelo formato */
function classificar(e: unknown): ErroProvedor {
  if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError) return { tipo: "tempo" };
  if (e instanceof Anthropic.APIConnectionError) return { tipo: "rede" };
  if (e instanceof Anthropic.APIError && typeof e.status === "number") return { tipo: "http", status: e.status };
  return classificarPorFormato(e);
}

function bancoSupabase(admin: ReturnType<typeof createClient>): Banco {
  const rpc = async (nome: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(nome, args);
    if (error) throw new Error(nome + ": " + error.code);
    return data;
  };
  return {
    async papelEDono(userId) {
      const { data, error } = await admin.from("membros").select("dono").eq("membro", userId).maybeSingle();
      if (error) throw new Error("membros: " + error.code);
      return data ? { papel: "casa", dono: data.dono as string } : { papel: "dono", dono: userId };
    },
    async config(dono) {
      const { data, error } = await admin.from("ia_config").select("modo,limite_brl,cambio_brl_usd,margem_impostos,margem_seguranca,margem_contagem,fator_correcao,acoes_casa").eq("dono", dono).maybeSingle();
      if (error) throw new Error("ia_config: " + error.code);
      return data;
    },
    async preco(modelo) {
      const { data, error } = await admin.from("ia_precos").select("entrada_usd_mtok,saida_usd_mtok,max_entrada_tokens,conferido_em").eq("modelo", modelo).maybeSingle();
      if (error || !data) return null;
      return { entrada_usd_mtok: +data.entrada_usd_mtok, saida_usd_mtok: +data.saida_usd_mtok, max_entrada_tokens: +data.max_entrada_tokens, conferido_em: data.conferido_em };
    },
    async reservar(a) {
      const d = await rpc("ia_reservar", { p_dono: a.dono, p_user: a.user, p_idempotencia: a.idempotencia, p_modulo: a.modulo, p_acao: a.acao, p_modelo: a.modelo, p_reservado_usd: a.reservado_usd, p_tokens_contados: a.tokens_contados, p_contagem_oficial: a.contagem_oficial });
      return { ok: !!d?.ok, id: d?.id, codigo: d?.codigo, comprometido_usd: d?.comprometido_usd != null ? +d.comprometido_usd : undefined, teto_usd: d?.teto_usd != null ? +d.teto_usd : undefined };
    },
    marcarEnvio: (id) => rpc("ia_marcar_envio", { p_id: id }).then((x) => x === true),
    falhouSemEnvio: (id, erro) => rpc("ia_falhou_sem_envio", { p_id: id, p_erro: erro }).then((x) => x === true),
    concluir: (id, te, ts, est, ms, erro) => rpc("ia_concluir", { p_id: id, p_tokens_entrada: te, p_tokens_saida: ts, p_estimado_usd: est, p_ms: ms, p_erro: erro }).then((x) => x === true),
    marcarIncerto: (id, erro, ms) => rpc("ia_marcar_incerto", { p_id: id, p_erro: erro, p_ms: ms }).then((x) => x === true),
  };
}

Deno.serve(async (req) => {
  const h = cabecalhos(req);
  const json = (s: { status: number; corpo: unknown }) => new Response(JSON.stringify(s.corpo), { status: s.status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json(respostaErro("metodo", {}));
  try {
    if (Number(req.headers.get("content-length") ?? 0) > LIMITES.corpoMaxBytes) return json(respostaErro("muito_grande", {}));
    /* quem chama: só do login (nunca do corpo) */
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json(respostaErro("nao_autenticado", {}));
    const url = Deno.env.get("SUPABASE_URL")!;
    const publico = createClient(url, chaveSb("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
    const { data: u, error: eu } = await publico.auth.getUser(jwt);
    if (eu || !u?.user?.id) return json(respostaErro("nao_autenticado", {}));

    const texto = await req.text();
    if (texto.length > LIMITES.corpoMaxBytes) return json(respostaErro("muito_grande", {}));
    let corpo: unknown;
    try { corpo = JSON.parse(texto); } catch (_) { return json(respostaErro("entrada_invalida", { detalhe: "O corpo não é JSON." })); }

    const admin = createClient(url, chaveSb("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const chave = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim();
    /* uma tentativa só: sem repetição automática do SDK; o tempo máximo também vale aqui */
    const cliente = chave ? new Anthropic({ apiKey: chave, maxRetries: 0, timeout: LIMITES.tempoChamadaMs }) : null;
    const provedor = cliente ? provedorAnthropic(cliente as unknown as ClienteMensagens, classificar) : null;
    /* registro técnico sem conteúdo: id, ação, estado, código, tempo e modelo */
    const log = (o: Record<string, unknown>) => console.log("rac-ia", JSON.stringify(o));
    return json(await atenderPedido(u.user.id, corpo, { banco: bancoSupabase(admin), provedor, log }));
  } catch (e) {
    console.error("rac-ia interno", (e as Error)?.name ?? "erro");
    return json(respostaErro("interno", {}));
  }
});
