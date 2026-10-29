// Testes das funções puras do site (nucleo.js): abastecimento pela foto, temas das Conexões, links e importação.
// Rodar: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

createRequire(import.meta.url)("../nucleo.js");
const N = globalThis.RACnucleo;

test("abastecimento: JSON dentro de bloco de código, com vírgula decimal", () => {
  const r = N.lerAbast('Aqui está:\n```json\n{"veiculo":"moto","data":"2026-10-28","km":15890,"litros":"6,12","preco_litro":6.29,"total":38.49,"combustivel":"Gasolina comum","posto":"Shell"}\n```');
  assert.equal(r.veiculo, "moto");
  assert.equal(r.data, "2026-10-28");
  assert.equal(r.km, 15890);
  assert.equal(r.litros, 6.12);
  assert.equal(r.total, 38.49);
  assert.match(r.combustivel, /gasolina/);
});

test("abastecimento: texto livre e total calculado", () => {
  const r = N.lerAbast("Veículo: carro\nKm: 104.308\nLitros: 40,5\nPreço por litro: R$ 6,19\nEtanol");
  assert.equal(r.veiculo, "civic");
  assert.equal(r.km, 104308);
  assert.equal(r.litros, 40.5);
  assert.equal(r.total, Math.round(40.5 * 6.19 * 100) / 100);
  assert.equal(r.combustivel, "etanol");
});

test("abastecimento: resposta sem números não inventa valores", () => {
  const r = N.lerAbast("não consegui ler a foto");
  assert.equal(r.km, null);
  assert.equal(r.litros, null);
  assert.equal(r.total, null);
});

test("temas das Conexões: reconhece tecnologias e não confunde palavras parecidas", () => {
  assert.deepEqual(N.temasDe("Vaga: Analista de Dados Pleno (Python e SQL)").sort(), ["analytics", "python", "sql"]);
  assert.ok(N.temasDe("Dashboard em Power BI").includes("bi"));
  assert.deepEqual(N.temasDe("Biblioteca municipal abre inscrições"), []);
  assert.deepEqual(N.temasDe("Banana nanica em promoção"), []);
});

test("links digitados sem https não viram página do próprio site", () => {
  assert.equal(N.urlAbs("newdashboard.mbx.academy/classes"), "https://newdashboard.mbx.academy/classes");
  assert.equal(N.urlAbs("https://a.com"), "https://a.com");
  assert.equal(N.urlAbs("#mba"), "#mba");
  assert.equal(N.urlAbs("mailto:x@y.com"), "mailto:x@y.com");
  assert.equal(N.urlAbs(""), "");
});

test("importação com juntar: completa sem duplicar e sem apagar", () => {
  const velho = { custo: 80, meds: [{ nome: "Bravecto" }], clinica: "Vet A" };
  const novo = { custo: 99, meds: [{ nome: "bravecto" }, { nome: "Simparic" }], diagnostico: "ok" };
  const r = N.juntarDados(velho, novo);
  assert.equal(r.custo, 80, "valor que já existe não é trocado");
  assert.deepEqual(r.meds.map((m) => m.nome), ["Bravecto", "Simparic"], "lista é unida sem repetir (ignora maiúsculas)");
  assert.equal(r.diagnostico, "ok", "campo que faltava entra");
  assert.equal(r.clinica, "Vet A");
  assert.equal(N.juntarDados(velho, { custo: 1, meds: [{ nome: "Bravecto" }] }), null, "nada novo: devolve null");
});

test("compatibilidade da vaga: o que pede, o que tem e o que falta", () => {
  const r = N.compatVaga("Analista de Dados Pleno — SQL avançado, Power BI (DAX), Python desejável, levantamento de requisitos com stakeholders", ["sql", "powerbi", "negocio"]);
  assert.deepEqual(r.pede.sort(), ["negocio", "powerbi", "python", "sql"]);
  assert.deepEqual(r.falta, ["python"]);
  assert.equal(r.nota, 75);
  assert.equal(N.compatVaga("Vaga de motorista", ["sql"]).nota, null, "sem competência de dados: sem nota");
});

test("OMS: mediana do peso ao nascer é o percentil 50, e o z volta para a mesma medida", () => {
  const lms = [0.3809, 3.2322, 0.14171];
  assert.ok(Math.abs(N.omsZ(lms, 3.2322)) < 1e-9);
  assert.equal(N.percentilDeZ(0), 50);
  assert.ok(Math.abs(N.omsValor(lms, N.omsZ(lms, 4.1)) - 4.1) < 1e-9);
  assert.ok(Math.abs(N.percentilDeZ(1.881) - 97) < 0.2, "z = 1,88 é o percentil 97");
});

test("Napper: CSV com aspas e vírgulas vira eventos com chave única, e o resumo por dia soma certo", () => {
  const csv = "start,end,category,diaperContent,breastLeftSeconds,breastRightSeconds,feedingAmount,bottleFeedingType,comment,createdAt\n" +
    "2026-07-19T02:33:00.000-03:00,2026-07-19T03:10:00.000-03:00,NURSING,,600,600,,,,a\n" +
    "2026-07-19T13:25:00.000-03:00,2026-07-19T13:25:00.000-03:00,BOTTLE,,,,50,FORMULA,,b\n" +
    "2026-07-19T14:00:00.000-03:00,2026-07-19T14:00:00.000-03:00,CHANGED_DIAPER,MIXED,,,,,,c\n" +
    "2026-07-19T10:05:00.000-03:00,2026-07-19T11:17:00.000-03:00,NAP,,,,,,\"soneca, no colo\",d\n";
  const ev = N.napperLer(csv);
  assert.equal(ev.length, 4);
  assert.equal(new Set(ev.map((e) => e.chave)).size, 4);
  assert.equal(ev[3].dados.obs, "soneca, no colo");
  const [d] = N.bebeDias(ev);
  assert.deepEqual([d.peito, d.peitoMin, d.mamadeira, d.mlFormula, d.fraldas, d.xixi, d.coco, d.sonoMin], [1, 20, 1, 50, 1, 1, 1, 72]);
  assert.throws(() => N.napperLer("a,b\n1,2"), /Napper/);
});

test("vacinas do SUS: datas previstas pela idade e doses contadas em ordem", () => {
  const c = N.vacinasCalendario("2026-06-01", ["Vacinas de 2 meses: Rotavirus, Pentavalente e Poliomielite", "BCG e Hepatite B"]);
  const ver = (n) => c.find((x) => x.nome === n);
  assert.equal(ver("Pentavalente (1ª dose)").prevista, "2026-08-01");
  assert.equal(ver("Pentavalente (1ª dose)").tomada, true);
  assert.equal(ver("Pentavalente (2ª dose)").tomada, false, "uma menção cobre só a 1ª dose");
  assert.equal(ver("BCG").tomada, true);
  assert.equal(ver("Pneumocócica 10 (1ª dose)").tomada, false);
});

test("Napper: noite da hora de dormir até acordar, sem contar despertares nem soneca dentro da noite", () => {
  const ev = [
    { tipo: "dormir", inicio: "2026-10-27T21:00:00-03:00", fim: "2026-10-27T21:00:00-03:00" },
    { tipo: "despertar", inicio: "2026-10-28T02:00:00-03:00", fim: "2026-10-28T02:30:00-03:00" },
    { tipo: "sono", inicio: "2026-10-27T21:00:00-03:00", fim: "2026-10-28T02:00:00-03:00" },
    { tipo: "acordar", inicio: "2026-10-28T06:00:00-03:00", fim: "2026-10-28T06:00:00-03:00" },
    { tipo: "sono", inicio: "2026-10-28T10:00:00-03:00", fim: "2026-10-28T11:00:00-03:00" },
  ];
  const d = Object.fromEntries(N.bebeDias(ev).map((x) => [x.data, x]));
  assert.equal(d["2026-10-27"].noiteMin, 9 * 60 - 30, "21h às 6h, menos 30 min acordada");
  assert.equal(d["2026-10-27"].sonecas, 0, "o trecho de sono dentro da noite não vira soneca");
  assert.equal(d["2026-10-28"].sonecaMin, 60);
});
