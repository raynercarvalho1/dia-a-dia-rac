// Teste de fumaça num navegador de verdade (Chromium, pelo Playwright): o site abre, mostra a tela de entrada,
// todos os módulos de js/ carregam e nada dá erro no console. Pega o que os testes de Node não veem
// (erro que só acontece no navegador, módulo que não carrega, biblioteca de CDN fora do ar).
// Roda no GitHub (testes.yml instala o Playwright); no computador, sem o Playwright instalado, é pulado.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../", import.meta.url));
let pw = null;
try { pw = await import("playwright"); } catch (_) { /* sem Playwright: pula */ }
const pular = !pw ? "Playwright não instalado (roda no GitHub)" : false;
/* no GitHub o Playwright tem que estar lá: se faltar, o teste falha em vez de ser pulado sem ninguém ver */
test("no GitHub, o navegador do teste está instalado", { skip: !process.env.CI }, () => assert.ok(pw, "Playwright não foi instalado no testes.yml"));
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };

test("o site abre no navegador, todos os módulos carregam e nada dá erro", { skip: pular, timeout: 90000 }, async () => {
  const servidor = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(raiz, p);
    if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const nav = await pw.chromium.launch();
  try {
    const pag = await nav.newPage(), erros = [];
    pag.on("pageerror", (e) => erros.push("erro: " + e.message));
    /* falha de rede de sites de fora (CDN, APIs) não é defeito do site; erro do próprio site é */
    pag.on("console", (m) => { if (m.type() === "error" && (m.location().url || base).startsWith(base)) erros.push("console: " + m.text()); });
    await pag.goto(base + "/");
    await pag.waitForSelector("#gate", { state: "visible", timeout: 20000 });
    const mods = fs.readdirSync(path.join(raiz, "js")).filter((f) => f.endsWith(".js") && f !== "app.js").map((f) => f.slice(0, -3));
    const r = await pag.evaluate((l) => precisa(l).then(() => "ok", (e) => "falhou: " + e.message), mods);
    assert.equal(r, "ok", "todos os módulos de js/ carregam");
    await pag.waitForTimeout(1500);
    assert.deepEqual(erros, [], "nenhum erro no navegador");
  } finally {
    await nav.close();
    servidor.close();
  }
});

// Interface do RAC Intelligence na fase só de demonstração, num navegador de verdade. O teste não tem login: as respostas
// do servidor (DEMO) e do banco (só leitura) são simuladas dentro da página, só para conferir o que a tela faz com elas.
test("IA em demonstração: botão mostra só a prévia, nunca chega ao salvar, e o Sistema não oferece o modo REAL", { skip: pular, timeout: 90000 }, async () => {
  const servidor = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(raiz, p);
    if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const nav = await pw.chromium.launch();
  try {
    const pag = await nav.newPage(), erros = [];
    pag.on("pageerror", (e) => erros.push("erro: " + e.message));
    await pag.goto(base + "/");
    await pag.waitForSelector("#gate", { state: "visible", timeout: 20000 });
    const r = await pag.evaluate(async () => {
      const espera = (ms) => new Promise((ok) => setTimeout(ok, ms)), out = { ligada: iaLigada(), soDemo: IA_SO_DEMO };
      let realChamado = false;
      SB = { functions: { invoke: () => Promise.resolve({ error: null, data: { ok: true, versao: 1, modo: "DEMO", estado: "demo", mensagem: "DEMONSTRAÇÃO", avisos: [],
        resultado: { veiculo: "moto", km: 0, litros: 1, total: 1, posto: "POSTO DEMONSTRAÇÃO", _demo: true } } }) } };
      const el = iaBotao({ modulo: "abastecimento", acao: "abastecimento.interpretar", texto: "x", real: () => { realChamado = true; } });
      document.body.appendChild(el);
      el.querySelector("input[type=text]").value = "1 litro a 1,00";
      el.querySelector("button").click();
      await espera(400);
      Object.assign(out, { previa: !!el.querySelector(".iaprevia"), botoesNaPrevia: el.querySelectorAll(".iaprevia button").length, realChamado, textoBotao: el.textContent });
      await precisa(["sistema"]);
      const tabela = (d) => { const q = { select: () => q, in: () => q, order: () => q, limit: () => q, eq: () => q, maybeSingle: () => q, then: (ok, no) => Promise.resolve({ data: d, error: null }).then(ok, no) }; return q; };
      const dados = { ia_config: { modo: "DEMO", limite_brl: 50, cambio_brl_usd: 6, margem_impostos: 0.12, margem_seguranca: 0.1 }, ia_precos: [], ia_uso: [], ia_cobranca: [] };
      SB = { rpc: () => Promise.resolve({ error: null, data: { mes: "2026-10-01", teto_usd: 6.696429, comprometido_usd: 0, estimado_usd: 0, reservado_aberto_usd: 0, por_modulo: {}, por_estado: {} } }), from: (t) => tabela(dados[t]) };
      PAPEL = "dono"; EU = { id: "teste" };
      const painel = sisIA(); document.body.appendChild(painel);
      await espera(400);
      return Object.assign(out, { painel: painel.textContent, botoesPainel: [...painel.querySelectorAll("button")].map((b) => b.textContent) });
    });
    assert.equal(r.ligada, true); assert.equal(r.soDemo, true);
    assert.ok(r.previa, "a resposta DEMO aparece na prévia"); assert.equal(r.botoesNaPrevia, 0, "a prévia não tem botão (nem de salvar)");
    assert.equal(r.realChamado, false, "resposta DEMO nunca chega à conferência que salva");
    assert.match(r.textoBotao, /demonstração/i); assert.match(r.textoBotao, /nada foi cobrado nem salvo/);
    assert.match(r.painel, /Fase de demonstração/); assert.match(r.painel, /Teto interno/); assert.match(r.painel, /Modo\s*DEMO/);
    assert.ok(!r.botoesPainel.some((b) => /modo REAL|Voltar para DEMO/i.test(b)) && !/Ligar o modo REAL/.test(r.painel), "nenhum botão de trocar o modo: " + r.botoesPainel.join(", "));
    assert.deepEqual(erros, [], "nenhum erro no navegador");
  } finally {
    await nav.close();
    servidor.close();
  }
});
