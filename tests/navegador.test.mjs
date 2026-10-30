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
