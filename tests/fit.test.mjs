// Testes do leitor de arquivos do relógio (.FIT dentro de .zip), usado pela função "garmin" do Supabase.
// O arquivo de teste é montado aqui mesmo (dados inventados), sem nenhum treino de verdade.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

/* tira o leitor de dentro da função (que roda no Deno) e importa no Node */
const fonte = fs.readFileSync(new URL("../supabase/functions/garmin/index.ts", import.meta.url), "utf8");
const ini = fonte.indexOf("/* ---------- leitor do arquivo .FIT"), fim = fonte.indexOf("/* ---------- sincronização");
assert.ok(ini > 0 && fim > ini, "trecho do leitor encontrado");
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "racfit-")), "fit.mts");
fs.writeFileSync(tmp, fonte.slice(ini, fim) + "\nexport { unzipFit, lerFit, resumirFit };\n");
const { unzipFit, lerFit, resumirFit } = await import(pathToFileURL(tmp).href);

/* ---------- montagem de um .FIT mínimo ---------- */
const B = { u8: 0x02, u16: 0x84, s32: 0x85, u32: 0x86 }, TAM = { [B.u8]: 1, [B.u16]: 2, [B.s32]: 4, [B.u32]: 4 };
function fit(mensagens) {
  const partes = [];
  for (const m of mensagens) {
    if (m.def) {
      const b = Buffer.alloc(6 + m.def.campos.length * 3);
      b[0] = 0x40 | m.local; b[2] = 0; b.writeUInt16LE(m.def.global, 3); b[5] = m.def.campos.length;
      m.def.campos.forEach(([num, tipo], i) => { b[6 + i * 3] = num; b[7 + i * 3] = TAM[tipo]; b[8 + i * 3] = tipo; });
      partes.push(b);
    } else {
      const b = Buffer.alloc(1 + m.campos.reduce((s, [, t]) => s + TAM[t], 0)); b[0] = m.local; let p = 1;
      for (const [v, t] of m.campos) { if (t === B.u8) b.writeUInt8(v, p); else if (t === B.u16) b.writeUInt16LE(v, p); else if (t === B.s32) b.writeInt32LE(v, p); else b.writeUInt32LE(v, p); p += TAM[t]; }
      partes.push(b);
    }
  }
  const dados = Buffer.concat(partes), cab = Buffer.alloc(14);
  cab[0] = 14; cab[1] = 0x20; cab.writeUInt16LE(2132, 2); cab.writeUInt32LE(dados.length, 4); cab.write(".FIT", 8, "ascii");
  return Buffer.concat([cab, dados, Buffer.alloc(2)]);
}
function zip(nome, conteudo) {
  const comp = zlib.deflateRawSync(conteudo), n = Buffer.from(nome);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(conteudo.length, 22); lh.writeUInt16LE(n.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(conteudo.length, 24); cd.writeUInt16LE(n.length, 28); cd.writeUInt32LE(0, 42);
  const off = 30 + n.length + comp.length, eo = Buffer.alloc(22);
  eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(1, 8); eo.writeUInt16LE(1, 10); eo.writeUInt32LE(46 + n.length, 12); eo.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([lh, n, comp, cd, n, eo]));
}
const graus = (g) => Math.round(g * 2 ** 31 / 180);
const T0 = 1100000000;
const msgs = [
  { local: 0, def: { global: 20, campos: [[253, B.u32], [0, B.s32], [1, B.s32], [3, B.u8], [6, B.u16], [5, B.u32]] } },
  ...[0, 1, 2, 3].map((i) => ({ local: 0, campos: [[T0 + i * 10, B.u32], [graus(-23.49 + i * 0.0001), B.s32], [graus(-47.43), B.s32], [100 + i * 5, B.u8], [2500, B.u16], [i * 2500, B.u32]] })),
  { local: 1, def: { global: 19, campos: [[253, B.u32], [7, B.u32], [8, B.u32], [9, B.u32], [15, B.u8], [16, B.u8]] } },
  { local: 1, campos: [[T0 + 30, B.u32], [30000, B.u32], [30000, B.u32], [7500, B.u32], [107, B.u8], [115, B.u8]] },
  { local: 2, def: { global: 225, campos: [[0, B.u32], [3, B.u16], [5, B.u8], [7, B.u16]] } },
  { local: 2, campos: [[45000, B.u32], [12, B.u16], [1, B.u8], [28, B.u16]] },
  { local: 2, campos: [[60000, B.u32], [0, B.u16], [0, B.u8], [65534, B.u16]] },
  { local: 2, campos: [[40000, B.u32], [10, B.u16], [1, B.u8], [65534, B.u16]] },
];

test("lê o .FIT de dentro do .zip: pontos, rota, voltas e séries", async () => {
  const r = resumirFit(lerFit(await unzipFit(zip("1_ACTIVITY.fit", fit(msgs)))));
  assert.equal(r.serie.length, 4);
  assert.deepEqual(r.serie.map((p) => p.fc), [100, 105, 110, 115]);
  assert.equal(r.serie[3].t, 30, "tempo desde o início, em segundos");
  assert.equal(r.serie[0].vel, 2.5, "velocidade em m/s");
  assert.equal(r.rota.length, 4);
  assert.ok(Math.abs(r.rota[0][0] - -23.49) < 1e-5 && Math.abs(r.rota[0][1] - -47.43) < 1e-5, "coordenadas em graus");
  assert.equal(r.voltas.length, 1);
  assert.equal(r.voltas[0].dist, 75);
  assert.equal(r.voltas[0].fc, 107);
  assert.equal(r.series.length, 2, "descanso não conta como série");
  assert.deepEqual(r.series.map((s) => [s.exercicio, s.reps]), [["Agachamento", 12], ["Musculação", 10]]);
});

test("arquivo que não é zip dá erro claro", async () => {
  await assert.rejects(() => unzipFit(new Uint8Array([1, 2, 3, 4])), /zip/);
});
