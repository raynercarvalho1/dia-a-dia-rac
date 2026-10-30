// O banco de verdade tem tudo o que os arquivos de supabase/ criam? Sem login, o Supabase responde de dois jeitos:
// "permission denied" (42501) quando a tabela, view ou função existe e está fechada para estranhos, e
// PGRST205/PGRST202 quando ela não existe. Este teste exige o primeiro para tudo o que os .sql criam,
// e assim pega um arquivo SQL que ficou sem rodar (o site pediria uma tabela que não existe).
// Limite: sem login não dá para conferir colunas nem buckets do Storage. Pule com SEM_REDE=1.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const raiz = new URL("../", import.meta.url);
const pular = process.env.SEM_REDE === "1";
/* endereço e chave pública lidos do próprio site, para não ter duas cópias */
const site = fs.readFileSync(new URL("mercado.js", raiz), "utf8");
const URL_SB = /https:\/\/[a-z0-9]+\.supabase\.co/.exec(site)[0], CHAVE = /sb_publishable_[\w-]+/.exec(site)[0];
const H = { apikey: CHAVE, Authorization: "Bearer " + CHAVE, "Content-Type": "application/json" };

/* um .sql que começa com "-- status: pendente" ainda não foi rodado no banco (ex.: 015 antes da Fase B do RAC Intelligence):
   o que ele cria aparece como TODO no relatório, em vez de falhar. Depois de rodar o arquivo, tire essa linha dele. */
const arquivosSql = fs.readdirSync(new URL("supabase/", raiz)).filter((f) => f.endsWith(".sql")).map((f) => fs.readFileSync(new URL("supabase/" + f, raiz), "utf8"));
const sql = arquivosSql.filter((t) => !/^-- status: pendente/.test(t)).join("\n");
const sqlPendente = arquivosSql.filter((t) => /^-- status: pendente/.test(t)).join("\n");
const achar = (re) => [...new Set([...sql.matchAll(re)].map((m) => m[1]))];
const tabelas = achar(/create (?:or replace )?(?:table|view)(?: if not exists)? public\.([a-z_]+)/gi);
const funcoes = achar(/create or replace function public\.([a-z_]+)/gi);
const pendentes = [...new Set([...sqlPendente.matchAll(/create (?:or replace )?(?:table|view|function)(?: if not exists)? public\.([a-z_]+)/gi)].map((m) => m[1]))]
  .filter((n) => !tabelas.includes(n) && !funcoes.includes(n));
for (const n of pendentes) test(`${n} ainda não existe no banco (arquivo SQL marcado como pendente)`, { todo: "rodar o .sql pendente no SQL Editor" }, () => {});

test("os arquivos SQL criam tabelas e funções (a leitura dos .sql funcionou)", () => {
  assert.ok(tabelas.length >= 15 && funcoes.length >= 2, `achei ${tabelas.length} tabelas/views e ${funcoes.length} funções`);
});

for (const t of tabelas) {
  test(`a tabela/view ${t} existe no banco e está fechada sem login`, { skip: pular }, async () => {
    const r = await fetch(`${URL_SB}/rest/v1/${t}?select=*&limit=1`, { headers: H });
    const j = await r.json().catch(() => null);
    assert.notEqual(j && j.code, "PGRST205", `${t} não existe no banco: falta rodar o .sql que a cria`);
    assert.ok(j && j.code === "42501", `${t} deveria recusar quem não fez login (respondeu ${r.status}: ${JSON.stringify(j).slice(0, 120)})`);
  });
}

for (const f of funcoes) {
  test(`a função ${f} existe no banco`, { skip: pular }, async () => {
    /* rac_rotina_ok pede um argumento; com argumento errado ela continua fechada, o que basta para provar que existe */
    const r = await fetch(`${URL_SB}/rest/v1/rpc/${f}`, { method: "POST", headers: H, body: f === "rac_rotina_ok" ? '{"segredo":"x"}' : "{}" });
    const j = await r.json().catch(() => null);
    assert.notEqual(j && j.code, "PGRST202", `${f} não existe no banco: falta rodar o .sql que a cria`);
    if (f === "ping") assert.equal(r.status, 200, "ping responde sem login (mantém o banco acordado)");
    else assert.ok(j && j.code === "42501", `${f} deveria recusar quem não fez login (respondeu ${r.status}: ${JSON.stringify(j).slice(0, 120)})`);
  });
}
