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
