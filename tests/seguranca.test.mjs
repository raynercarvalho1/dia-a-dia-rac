// Testes de autenticação e permissões no Supabase de verdade: sem login, nada pessoal pode ser lido,
// a função "garmin" recusa quem não entrou e a rotina recusa quem não tem a senha dela.
// Usa só a chave pública (a mesma que está no site). Pule com SEM_REDE=1.
import { test } from "node:test";
import assert from "node:assert/strict";

const URL_SB = "https://hofnhbxnfebfnncwxrds.supabase.co", CHAVE = "sb_publishable_kpEqdxunDeIbStJrgxrngg_tNPv6VTL";
const H = { apikey: CHAVE, Authorization: "Bearer " + CHAVE };
const pular = process.env.SEM_REDE === "1";

for (const t of ["pessoal", "registros", "garmin_dia", "garmin_ativ", "erros", "rotina_log", "notas", "itens", "produtos", "mercados", "membros", "lista", "bebe", "push_inscricoes", "rac_segredos"]) {
  test(`sem login não lê a tabela ${t}`, { skip: pular }, async () => {
    const r = await fetch(`${URL_SB}/rest/v1/${t}?select=*&limit=1`, { headers: H });
    const corpo = await r.json().catch(() => null);
    const bloqueado = r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(corpo) && corpo.length === 0);
    assert.ok(bloqueado, `${t} respondeu ${r.status}: ${JSON.stringify(corpo).slice(0, 120)}`);
  });
}

test("sem login não grava nada", { skip: pular }, async () => {
  const r = await fetch(`${URL_SB}/rest/v1/pessoal`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ chave: "teste", valor: {} }) });
  assert.ok(r.status >= 400, "inserção sem login foi recusada (" + r.status + ")");
});

test("sem login não lista os anexos", { skip: pular }, async () => {
  const r = await fetch(`${URL_SB}/storage/v1/object/list/familia`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 5 }) });
  const corpo = await r.json().catch(() => null);
  assert.ok(r.status >= 400 || (Array.isArray(corpo) && corpo.length === 0), "cofre de anexos fechado (" + r.status + ")");
});

test("função garmin recusa quem não fez login", { skip: pular }, async () => {
  const r = await fetch(`${URL_SB}/functions/v1/garmin`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: '{"tipo":"dias"}' });
  assert.equal(r.status, 401);
});

test("rotina recusa senha errada", { skip: pular }, async () => {
  const r = await fetch(`${URL_SB}/functions/v1/garmin`, { method: "POST", headers: { "Content-Type": "application/json", "x-rac-rotina": "senha-errada" }, body: '{"tipo":"rotina"}' });
  assert.ok(r.status === 401 || r.status === 500, "rotina não rodou (" + r.status + ")");
  const j = await r.json().catch(() => ({}));
  assert.ok(!j.ok, "não executou");
});

test("a função só libera o navegador do próprio site (CORS)", { skip: pular }, async () => {
  const origem = async (o) => (await fetch(`${URL_SB}/functions/v1/garmin`, { method: "OPTIONS", headers: { Origin: o, "Access-Control-Request-Method": "POST" } })).headers.get("access-control-allow-origin");
  assert.notEqual(await origem("https://site-estranho.example"), "https://site-estranho.example", "outro site não pode chamar a função pelo navegador");
  assert.notEqual(await origem("https://site-estranho.example"), "*", "sem liberar para qualquer site");
  assert.equal(await origem("https://raynercarvalho.com.br"), "https://raynercarvalho.com.br", "o site continua podendo chamar");
});
