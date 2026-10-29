// Testes da leitura da nota fiscal pela foto (resposta do Claude colada no Mercado).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

globalThis.window = globalThis.window || {};
createRequire(import.meta.url)("../mercado.js");
const T = globalThis.window.RACmercado._teste;

test("nota completa em JSON", () => {
  const n = T.lerResposta('{"mercado":"Confiança","cnpj":"12.345.678/0001-90","data":"2026-10-20","total_pago":31.5,"desconto_nota":0,' +
    '"itens":[["ARROZ 5KG",1,"un",20.5,20.5,0],["LEITE 1L",2,"un",5.5,11,0]]}');
  assert.equal(n.mercado, "Confiança");
  assert.equal(n.cnpj, "12345678000190");
  assert.equal(n.itens.length, 2);
  assert.equal(n.itens[1].qtd, 2);
  assert.equal(n.pago, 31.5);
  assert.equal(n.cortado, false);
});

test("aspas curvas, vírgula decimal e vírgula sobrando", () => {
  const n = T.lerResposta("{“mercado”:“Pão de Açúcar”,“itens”:[{“descricao”:“CAFÉ 500G”,“qtd”:1,“valor_unitario”:22,68,“valor_total”:22,68},]}");
  assert.ok(n, "a resposta é lida");
  assert.equal(n.itens.length, 1);
  assert.equal(n.itens[0].vt, 22.68);
});

test("resposta cortada no meio: salva os itens inteiros e avisa", () => {
  const n = T.lerResposta('{"mercado":"X","data":"2026-10-21","itens":[{"descricao":"A","qtd":1,"valor_total":2},{"descricao":"B","qtd":2,"valor_tot');
  assert.ok(n.cortado, "marca como cortada");
  assert.equal(n.itens.length, 1);
  assert.equal(n.itens[0].desc, "A");
});

test("texto que não é nota não vira nota", () => {
  assert.equal(T.lerResposta("Não consegui ler a foto, pode mandar outra?"), null);
});
