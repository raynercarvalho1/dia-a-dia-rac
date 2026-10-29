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

test("prontidão: dia normal fica no meio, dia ruim cai e gera alertas", () => {
  const dias = [];
  for (let i = 60; i >= 1; i--) dias.push({ data: N.somaDiasISO("2026-10-28", -i), dados: { vfc: { noite: 54 + (i % 5) - 2 }, fcRepouso: 50 + (i % 3) - 1, sono: { total: 7.5 * 3600, nota: 80 }, bbMax: 75, estresse: 30 + (i % 7) - 3 } });
  const normal = N.prontidao(dias.concat([{ data: "2026-10-28", dados: { vfc: { noite: 54 }, fcRepouso: 50, sono: { total: 7.5 * 3600, nota: 80 }, bbMax: 75, estresse: 30 } }]), "2026-10-28");
  assert.ok(normal.nota >= 55 && normal.nota <= 80, "nota normal: " + normal.nota);
  assert.deepEqual(normal.alertas, []);
  const ruim = N.prontidao(dias.slice(0, -1).concat([{ data: "2026-10-27", dados: { sono: { total: 5 * 3600 } } }, { data: "2026-10-28", dados: { vfc: { noite: 40, faixaMin: 47 }, fcRepouso: 58, sono: { total: 5.5 * 3600, nota: 50 }, bbMax: 30, estresse: 60 } }]), "2026-10-28");
  assert.ok(ruim.nota < 45, "nota ruim: " + ruim.nota);
  assert.equal(ruim.rotulo, "Dia de recuperação");
  assert.equal(ruim.alertas.length, 4);
  assert.ok(Math.abs(N.correlacao([1, 2, 3, 4, 5, 6, 7, 8], [2, 4, 6, 8, 10, 12, 14, 16]) - 1) < 1e-9);
});

test("chuva: acha a primeira hora com chuva provável e ignora garoa improvável", () => {
  const time = Array.from({ length: 24 }, (_, i) => "2026-10-29T" + String(i).padStart(2, "0") + ":00");
  const prob = time.map((_, i) => (i >= 15 && i <= 17 ? 80 : i === 10 ? 45 : 10)), mm = time.map((_, i) => (i >= 15 && i <= 17 ? 2.4 : 0.2));
  const a = N.chuvaAviso({ time, precipitation_probability: prob, precipitation: mm }, "2026-10-29T08:00");
  assert.equal(a.inicio, "2026-10-29T15:00");
  assert.equal(a.prob, 80);
  assert.match(a.texto, /a partir das 15h, até umas 18h/);
  assert.equal(N.chuvaAviso({ time, precipitation_probability: prob, precipitation: mm }, "2026-10-29T00:00", 9), null);
  assert.ok(N.chuvaAviso({ time, precipitation_probability: prob, precipitation: mm }, "2026-10-29T16:00").agora);
});

test("compras: prevê o que está acabando e respeita o 'ainda tem'", () => {
  const l = [];
  ["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22"].forEach((d) => l.push({ data: d, produto: "Leite Integral", quantidade: 6, valor: 30 }));
  ["2026-07-01", "2026-08-01", "2026-09-01"].forEach((d) => l.push({ data: d, produto: "Papel Higiênico", quantidade: 1, valor: 25 }));
  l.push({ data: "2026-08-10", produto: "Vinho", quantidade: 1, valor: 80 });
  const p = N.previsaoCompras(l, "2026-08-29");
  assert.equal(p[0].produto, "Leite Integral");
  assert.equal(p[0].status, "acabando"); // a cada 7 dias, última há 7
  assert.equal(p.find((x) => x.produto === "Papel Higiênico").status, "ok"); // a última compra (01/09) é depois desta data
  assert.ok(!p.some((x) => x.produto === "Vinho")); // só uma compra
  assert.equal(N.previsaoCompras(l, "2026-08-29", { "leite integral": "2026-09-02" }).some((x) => x.produto === "Leite Integral"), false);
  assert.equal(N.previsaoCompras(l, "2026-12-30").some((x) => x.produto === "Leite Integral"), false); // parou de comprar
  const pd = N.padraoCompras(l);
  assert.equal(pd.mais[0].produto, "Leite Integral");
  assert.equal(pd.menos[0].produto, "Vinho");
  assert.ok(N.itemBate("pão de forma", "Pão de Forma Pullman 480g"));
  assert.ok(!N.itemBate("filtro café", "Café Pilão 500g"));
});
test("nota do iPhone e o que é ditado viram itens da lista", () => {
  const nota = "Lista de compras\nDiabo verde\nPão de forma\nFiltro café\n\nDemais itens\n\nFarmácia:\nAnti inflamatório: ibuprofeno ou naproxeno\n✓ Sabonete";
  const it = N.notaItens(nota);
  assert.deepEqual(it.map((x) => x.item), ["Diabo verde", "Pão de forma", "Filtro café", "Anti inflamatório: ibuprofeno ou naproxeno"]);
  assert.equal(it[3].secao, "Farmácia");
  assert.deepEqual(N.notaItens("◦ Leite\n☑ Ovos\n- [ ] Café").map((x) => x.item), ["Leite", "Café"]);
  assert.deepEqual(N.dividirItens("leite, pão de forma e café."), ["Leite", "Pão de forma", "Café"]);
});

test("e-mails de vagas: confirmação, etapa, entrevista, retorno, cancelada e alertas", () => {
  const L = (de, assunto, trecho = "") => N.lerEmailVaga({ de, assunto, trecho });
  let x = L("no-reply@gupy.com.br", "Candidatura recebida com sucesso!", "Tauste Supermercados ANALISTA DE DADOS (INOVAÇÃO E MELHORIA) Olá, Rayner Carvalho Obrigado pelo seu interesse em participar do processo seletivo na Tauste Supermercados. Gostaríamos");
  assert.deepEqual([x.tipo, x.vaga, x.empresa, x.plataforma], ["candidatura", "ANALISTA DE DADOS (INOVAÇÃO E MELHORIA)", "Tauste Supermercados", "Gupy"]);
  x = L("naoresponda@burh.com.br", "Sua candidatura foi confirmada! 💙🚀", "Você se candidatou na(s) vaga(s) Assitente de Suporte de TI. Ir para vaga Agradecemos a sua candidatura!");
  assert.deepEqual([x.tipo, x.vaga], ["candidatura", "Assitente de Suporte de TI"]);
  x = L("avisos@jobbol.com.br", "Sua candidatura para Analista de Suporte de TI - nºUK7934982", "Recebemos sua candidatura");
  assert.deepEqual([x.tipo, x.vaga], ["candidatura", "Analista de Suporte de TI"]);
  assert.equal(L("noreply@mailquickin.com", "Confirmação de inscrição - Captativa").empresa, "Captativa");
  assert.equal(L("system@solides.com", "Candidatura efetuada em ANALISTA DE SUPORTE DE TI").vaga, "ANALISTA DE SUPORTE DE TI");
  x = L("no-reply@gupy.com.br", "Etapa Redação desbloqueada para a vaga ANALISTA DE DADOS (INOVAÇÃO E MELHORIA)");
  assert.deepEqual([x.tipo, x.etapa, x.vaga], ["etapa", "Redação", "ANALISTA DE DADOS (INOVAÇÃO E MELHORIA)"]);
  assert.equal(L("reply@reply.gupy.com.br", "Agendamento de Entrevista para a vaga Especialista em Recuperação de Crédito").tipo, "entrevista");
  x = L("no-reply@gupy.com.br", "Obrigada pelo interesse em fazer parte do nosso time!", "Bancorbrás - ANALISTA DE INFRAESTRUTURA JUNIOR Nova mensagem referente à vaga ANALISTA DE INFRAESTRUTURA JUNIOR: Olá, Rayner! Agradecemos sua participação");
  assert.deepEqual([x.tipo, x.vaga, x.empresa], ["retorno", "ANALISTA DE INFRAESTRUTURA JUNIOR", "Bancorbrás"]);
  x = L("no-reply@gupy.com.br", "Stefanini Group | ANALISTA SUPORTE I - Vaga Cancelada");
  assert.deepEqual([x.tipo, x.vaga, x.empresa], ["cancelada", "ANALISTA SUPORTE I", "Stefanini Group"]);
  x = L("jobalerts-noreply@linkedin.com", "A empresa Bridger está contratando: Analista de TI Júnior");
  assert.deepEqual([x.tipo, x.vaga, x.empresa], ["alerta", "Analista de TI Júnior", "Bridger"]);
  x = L("donotreply@match.indeed.com", "Analista de Suporte Técnico Sênior na empresa Clicksign");
  assert.deepEqual([x.tipo, x.vaga, x.empresa], ["alerta", "Analista de Suporte Técnico Sênior", "Clicksign"]);
  assert.equal(L("resposta-automatica-sac@oficial.nike.com.br", "Recebemos seu pedido 1001371153"), null);
  assert.ok(N.vagaParecida({ vaga: "ANALISTA DE DADOS (INOVAÇÃO E MELHORIA)", empresa: "Tauste Supermercados" }, { t: "Analista de Dados - Inovação e Melhoria", e: "Tauste" }));
  assert.ok(!N.vagaParecida({ vaga: "Analista de Suporte de TI", empresa: "" }, { t: "Analista de Dados", e: "Tauste" }));
});
