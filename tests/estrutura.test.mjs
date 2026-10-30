// Testes da estrutura do site: como os módulos dividem o mesmo escopo global, dois com a mesma função
// de topo fariam um sobrescrever o outro sem erro (foi o que aconteceu com "hm": a da Saúde trocou o horário dos jogos).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const raiz = new URL("../", import.meta.url);
const arquivos = fs.readdirSync(new URL("js/", raiz)).filter((f) => f.endsWith(".js")).map((f) => "js/" + f);

function topo(txt) {
  const nomes = [...txt.matchAll(/^  function ([A-Za-z_$][\w$]*)\(/gm)].map((m) => m[1]);
  for (const m of txt.matchAll(/^  var ([A-Za-z_$][\w$]*)\s*=/gm)) nomes.push(m[1]);
  return nomes;
}

test("nenhuma função ou variável de topo repetida entre os arquivos do site", () => {
  const visto = {};
  const repetidos = [];
  for (const a of arquivos) {
    for (const n of topo(fs.readFileSync(new URL(a, raiz), "utf8"))) {
      if (visto[n] && visto[n] !== a) repetidos.push(`${n} (${visto[n]} e ${a})`);
      else if (visto[n] === a) repetidos.push(`${n} (duas vezes em ${a})`);
      visto[n] = a;
    }
  }
  assert.deepEqual(repetidos, []);
});

test("toda seção carregada sob demanda tem o seu arquivo", () => {
  const app = fs.readFileSync(new URL("js/app.js", raiz), "utf8");
  const mods = new Set([...app.matchAll(/ROTA_MODS=\{([\s\S]*?)\};/g)].flatMap((m) => [...m[1].matchAll(/"([\w-]+)"/g)].map((x) => x[1])));
  for (const m of app.matchAll(/MOD_DEPS=\{([\s\S]*?)\};/g)) for (const x of m[1].matchAll(/"([\w-]+)"/g)) mods.add(x[1]);
  for (const m of app.matchAll(/wLazy\(\[([^\]]*)\]/g)) for (const x of m[1].matchAll(/"([\w-]+)"/g)) mods.add(x[1]);
  assert.ok(mods.size >= 5, "achou os módulos");
  for (const m of mods) assert.ok(fs.existsSync(new URL(`js/${m}.js`, raiz)), `falta js/${m}.js`);
});

test("o service worker guarda todos os arquivos do site para uso sem internet", () => {
  const sw = fs.readFileSync(new URL("sw.js", raiz), "utf8");
  for (const a of arquivos) assert.ok(sw.includes(`"./${a}"`), `${a} fora do SHELL do sw.js`);
  const vSw = /VERSAO = "([^"]+)"/.exec(sw)[1], vApp = /MOD_VERSAO="([^"]+)"/.exec(fs.readFileSync(new URL("js/app.js", raiz), "utf8"))[1];
  assert.equal(vApp, vSw, "MOD_VERSAO (js/app.js) igual à VERSAO do sw.js");
});

test("nenhum dado pessoal no código público", () => {
  const proibidos = [/@gmail\.com/i, /@icloud\.com/i, /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, /class\.mbx\.academy\/\?t=/, /AIza[\w-]{30,}/];
  const todos = ["index.html", "nucleo.js", "mercado.js", "sw.js", ...arquivos, ...fs.readdirSync(new URL("supabase/", raiz)).filter((f) => f.endsWith(".sql")).map((f) => "supabase/" + f),
    "README.md", "CLAUDE.md", "supabase/functions/garmin/index.ts",
    ...fs.readdirSync(new URL("scripts/", raiz)).map((f) => "scripts/" + f), ...fs.readdirSync(new URL(".github/workflows/", raiz)).map((f) => ".github/workflows/" + f)];
  for (const a of todos) {
    const t = fs.readFileSync(new URL(a, raiz), "utf8");
    for (const p of proibidos) assert.ok(!p.test(t), `${a} tem algo que parece dado pessoal (${p})`);
  }
});

test("nenhum caractere de controle escondido no código (ex.: \b virando backspace)", () => {
  for (const a of ["index.html", "nucleo.js", "mercado.js", "sw.js", ...arquivos]) {
    const t = fs.readFileSync(new URL(a, raiz), "utf8");
    assert.ok(!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(t), `${a} tem caractere de controle`);
  }
});

// Padrão do site: todo gráfico é clicável e mostra o cartão destacado (racDica). Quem desenhar gráfico sem ele quebra este teste.
test("todo gráfico usa a dica padrão (racDica): clicável, com o valor em destaque", () => {
  const marcas = /class:\s*"(?:vbars|prontserie|sonol|hbars|tzonas)|class=\?"tgraf|class:\s*"lchart"/;
  for (const a of ["mercado.js", ...arquivos]) {
    const t = fs.readFileSync(new URL(a, raiz), "utf8");
    if (marcas.test(t)) assert.ok(/racDica\.(ligar|em)\(/.test(t), `${a} desenha gráfico sem a dica padrão (racDica.ligar/racDica.em)`);
  }
  const app = fs.readFileSync(new URL("js/app.js", raiz), "utf8");
  assert.ok(/var racDica=/.test(app) && /\.racdica\{/.test(fs.readFileSync(new URL("index.html", raiz), "utf8")), "o componente racDica e o seu visual existem");
});

// Um erro de sintaxe num módulo só aparece quando a seção abre; aqui todos são lidos de uma vez (sem executar nada).
test("todo arquivo de código do site e a Edge Function têm sintaxe válida", async () => {
  const vm = await import("node:vm");
  for (const a of ["nucleo.js", "mercado.js", "sw.js", ...arquivos]) {
    const t = fs.readFileSync(new URL(a, raiz), "utf8");
    assert.doesNotThrow(() => new vm.Script(t, { filename: a }), `${a} tem erro de sintaxe`);
  }
  const mod = await import("node:module");
  if (typeof mod.stripTypeScriptTypes === "function") {
    const ts = fs.readFileSync(new URL("supabase/functions/garmin/index.ts", raiz), "utf8");
    const js = mod.stripTypeScriptTypes(ts).replace(/^import .*$/gm, "");
    assert.doesNotThrow(() => new vm.Script("(async()=>{" + js + "\n})", { filename: "garmin/index.ts" }), "a Edge Function tem erro de sintaxe");
  }
});
