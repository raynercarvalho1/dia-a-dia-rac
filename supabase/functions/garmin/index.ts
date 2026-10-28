// Busca os dados do relógio na Garmin (API pessoal oficial) e guarda no Supabase, em nome de quem chamou.
// A chave fica só no segredo GARMIN_PERSONAL_API_KEY do projeto (Edge Functions → Secrets); nunca vai para o site.
// O site chama com { tipo: "dias" } e { tipo: "ativ" } até a resposta trazer mais: false.
import { createClient } from "npm:@supabase/supabase-js@2";

const BASE = "https://personal.connectapi.garmin.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function token(): Promise<string> {
  const key = (Deno.env.get("GARMIN_PERSONAL_API_KEY") ?? "").trim();
  if (!key) throw new Error("falta o segredo GARMIN_PERSONAL_API_KEY");
  const r = await fetch(BASE + "/personalapitoken-service/personal-api/personal-api-key/token", {
    method: "POST", headers: { Accept: "*/*", Authorization: "ApiKey " + key },
  });
  if (r.status === 401) throw new Error("a Garmin recusou a chave (expirou ou foi apagada?)");
  if (!r.ok) throw new Error("Garmin respondeu " + r.status + " ao pedir o token");
  return (await r.text()).trim();
}
async function garmin(tok: string, path: string) {
  const r = await fetch(BASE + path, { headers: { Accept: "application/json", Authorization: "Bearer " + tok } });
  if (!r.ok) throw new Error("Garmin respondeu " + r.status + " em " + path.split("?")[0]);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const somaDias = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const limpa = (o: Record<string, unknown>) => { for (const k of Object.keys(o)) if (o[k] == null || (typeof o[k] === "object" && !Object.keys(o[k] as object).length)) delete o[k]; return o; };
const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.round(v * 100) / 100 : undefined);

/* um bloco de até 28 dias (limite da Garmin): resumo do dia + sono + VFC, num objeto compacto por data */
async function bloco(tok: string, ini: string, fim: string) {
  const [res, sono, vfc] = await Promise.all([
    garmin(tok, `/usersummary-service/v2/dailysummaries?startDate=${ini}&endDate=${fim}`),
    garmin(tok, `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${ini}&endDate=${fim}`),
    garmin(tok, `/hrv-service/hrv/daily/${ini}/${fim}`),
  ]);
  const dias: Record<string, Record<string, unknown>> = {};
  const dia = (d: string) => (dias[d] = dias[d] || {});
  for (const r of (res?.data ?? [])) {
    const m = r.movement ?? {}, s = m.steps ?? {}, st = r.stress ?? {}, bb = r.bodyBattery ?? {}, hr = r.heartRate ?? {}, im = r.intensityMinutes ?? {}, cal = r.calories ?? {};
    Object.assign(dia(r.calendarDate), limpa({
      passos: n(s.value), metaPassos: n(s.goal), distancia: n(s.distanceInMeters), andares: n(m.floorsAscended?.value),
      fcRepouso: n(hr.restingValue), fcMin: n(hr.minValue), fcMax: n(hr.maxValue),
      estresse: n(st.avgLevel), estresseMax: n(st.maxLevel), estresseAlto: n(st.highStressProportion), descanso: n(st.restProportion),
      bbMin: n(bb.minValue), bbMax: n(bb.maxValue), bbCarga: n(bb.chargedValue), bbGasto: n(bb.drainedValue),
      minModerados: n(im.moderate), minVigorosos: n(im.vigorous), metaMinutos: n(im.goal),
      calorias: n(cal.burnedTotal), caloriasAtivas: n(cal.burnedActive),
      respiracao: n(r.respiration?.avgValue), spo2: n(r.pulseOx?.avgValue),
    }));
  }
  for (const s of (Array.isArray(sono) ? sono : [])) {
    if (s.sleepTimeSeconds == null) continue;
    const sc = s.sleepScores ?? {};
    dia(s.calendarDate).sono = limpa({
      total: n(s.sleepTimeSeconds), profundo: n(s.deepSleepSeconds), leve: n(s.lightSleepSeconds), rem: n(s.remSleepSeconds), acordado: n(s.awakeSleepSeconds),
      nota: n(sc.overall?.value), qualidade: sc.overall?.qualifierKey, despertares: n(s.awakeCount), estresse: n(s.avgSleepStress),
      respiracao: n(s.averageRespirationValue), spo2: n(s.averageSpO2Value),
      inicio: s.sleepStartTimestampLocal ? new Date(s.sleepStartTimestampLocal).toISOString().slice(11, 16) : undefined,
      fim: s.sleepEndTimestampLocal ? new Date(s.sleepEndTimestampLocal).toISOString().slice(11, 16) : undefined,
    });
  }
  for (const v of (vfc?.hrvSummaries ?? [])) {
    dia(v.calendarDate).vfc = limpa({
      noite: n(v.lastNightAvg), semana: n(v.weeklyAvg), pico: n(v.lastNight5MinHigh), status: v.status,
      faixaMin: n(v.baseline?.balancedLow), faixaMax: n(v.baseline?.balancedUpper),
    });
  }
  return dias;
}

const CAMPOS_ATIV: Record<string, string> = {
  distance: "distancia", duration: "duracao", movingDuration: "emMovimento", averageSpeed: "velocidade", maxSpeed: "velocidadeMax",
  averageHR: "fc", maxHR: "fcMax", calories: "calorias", elevationGain: "subida", steps: "passos", lapCount: "voltas",
  activityTrainingLoad: "carga", aerobicTrainingEffect: "efeitoAerobico", anaerobicTrainingEffect: "efeitoAnaerobico",
  vO2MaxValue: "vo2max", averageRunningCadenceInStepsPerMinute: "cadencia", avgStrideLength: "passada", avgPower: "potencia",
  poolLength: "piscina", averageSwolf: "swolf", totalSets: "series", totalReps: "repeticoes",
  moderateIntensityMinutes: "minModerados", vigorousIntensityMinutes: "minVigorosos",
};
function ativ(a: Record<string, any>) {
  const d: Record<string, unknown> = { nome: a.activityName, local: a.locationName, efeito: a.trainingEffectLabel };
  for (const [k, v] of Object.entries(CAMPOS_ATIV)) { const x = n(a[k]); if (x != null) d[v] = x; }
  const z = [1, 2, 3, 4, 5].map((i) => Math.round(a["hrTimeInZone_" + i] ?? 0));
  if (z.some(Boolean)) d.zonas = z;
  if (a.pr) d.recorde = true;
  return { id: a.activityId, inicio: String(a.startTimeLocal).replace(" ", "T"), tipo: a.activityType?.typeKey ?? "outro", dados: limpa(d) };
}

/* ---------- leitor do arquivo .FIT (o formato que o relógio grava), sem dependências ---------- */

/* o .zip que a Garmin entrega tem um único .fit dentro (deflate) */
async function unzipFit(zip: Uint8Array): Promise<Uint8Array> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = zip.length - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("zip inválido");
  const cd = dv.getUint32(eocd + 16, true);
  const metodo = dv.getUint16(cd + 10, true), tamanho = dv.getUint32(cd + 20, true), local = dv.getUint32(cd + 42, true);
  const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
  const dados = zip.subarray(ini, ini + tamanho);
  if (metodo === 0) return dados;
  const ds = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(ds).arrayBuffer());
}

type Campo = { num: number; size: number; base: number };
type Def = { global: number; le: boolean; campos: Campo[]; dev: number };
const INVALIDO: Record<number, number> = { 0x00: 0xff, 0x01: 0x7f, 0x02: 0xff, 0x83: 0x7fff, 0x84: 0xffff, 0x85: 0x7fffffff, 0x86: 0xffffffff, 0x0a: 0, 0x8b: 0, 0x8c: 0, 0x07: 0, 0x0d: 0xff };

function ler(dv: DataView, p: number, c: Campo, le: boolean): number | number[] | null {
  const b = c.base & 0x1f, tam = [1, 1, 1, 2, 2, 4, 4, 1, 4, 8, 1, 2, 4, 1, 8, 8, 8][b] ?? 1;
  const um = (q: number): number | null => {
    let v: number;
    switch (b) {
      case 1: v = dv.getInt8(q); break;
      case 3: v = dv.getInt16(q, le); break;
      case 4: case 11: v = dv.getUint16(q, le); break;
      case 5: v = dv.getInt32(q, le); break;
      case 6: case 12: v = dv.getUint32(q, le); break;
      case 8: v = dv.getFloat32(q, le); return isFinite(v) ? v : null;
      default: if (tam === 1) v = dv.getUint8(q); else return null;
    }
    return v === INVALIDO[c.base] ? null : v;
  };
  if (c.size <= tam) return um(p);
  const l: number[] = [];
  for (let q = 0; q + tam <= c.size; q += tam) { const v = um(p + q); if (v != null) l.push(v); }
  return l;
}

function lerFit(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const hl = buf[0], fim = hl + dv.getUint32(4, true);
  const defs: Record<number, Def> = {};
  const msgs: Record<number, Record<number, unknown>[]> = {};
  let p = hl, ultimoTs = 0;
  while (p < fim && p < buf.length) {
    const h = buf[p++];
    if (h & 0x80) { // timestamp comprimido
      const def = defs[(h >> 5) & 3]; if (!def) break;
      const off = h & 0x1f, ts = (ultimoTs & ~0x1f) + off + ((off < (ultimoTs & 0x1f)) ? 0x20 : 0); ultimoTs = ts;
      const m: Record<number, unknown> = { 253: ts };
      for (const c of def.campos) { m[c.num] = ler(dv, p, c, def.le); p += c.size; }
      p += def.dev; (msgs[def.global] ||= []).push(m); continue;
    }
    const local = h & 0x0f;
    if (h & 0x40) { // definição
      const le = buf[p + 1] === 0, global = dv.getUint16(p + 2, le), n = buf[p + 4];
      const campos: Campo[] = []; let q = p + 5;
      for (let i = 0; i < n; i++, q += 3) campos.push({ num: buf[q], size: buf[q + 1], base: buf[q + 2] });
      let dev = 0;
      if (h & 0x20) { const nd = buf[q++]; for (let i = 0; i < nd; i++, q += 3) dev += buf[q + 1]; }
      defs[local] = { global, le, campos, dev }; p = q; continue;
    }
    const def = defs[local]; if (!def) break;
    const m: Record<number, unknown> = {};
    for (const c of def.campos) { m[c.num] = ler(dv, p, c, def.le); p += c.size; }
    p += def.dev;
    if (typeof m[253] === "number") ultimoTs = m[253] as number;
    (msgs[def.global] ||= []).push(m);
  }
  return msgs;
}

const SEMI = 180 / 2 ** 31, EPOCA = 631065600; // FIT conta os segundos a partir de 31/12/1989
const num = (v: unknown) => (typeof v === "number" ? v : null);
const r2 = (v: number | null, d = 1) => (v == null ? undefined : Math.round(v * d) / d);
const EXERC: Record<number, string> = { 0: "Supino", 1: "Panturrilha", 2: "Cardio", 3: "Carregamento", 4: "Chop", 5: "Core", 6: "Abdominal", 7: "Rosca", 8: "Levantamento terra", 9: "Crucifixo",
  10: "Elevação de quadril", 11: "Estabilidade de quadril", 12: "Swing", 13: "Hiperextensão", 14: "Elevação lateral", 15: "Flexora", 16: "Elevação de pernas", 17: "Avanço",
  18: "Levantamento olímpico", 19: "Prancha", 20: "Pliometria", 21: "Barra fixa", 22: "Flexão", 23: "Remada", 24: "Desenvolvimento", 25: "Estabilidade de ombro", 26: "Encolhimento",
  27: "Abdominal (sit-up)", 28: "Agachamento", 29: "Corpo inteiro", 30: "Tríceps", 31: "Aquecimento", 32: "Corrida", 65534: "Exercício" };

/* o que a página do treino mostra: série reduzida (até ~600 pontos), rota (até ~1500), voltas, séries e piscinas */
function resumirFit(msgs: Record<number, Record<number, unknown>[]>) {
  const rec = msgs[20] ?? [];
  const t0 = num(rec[0]?.[253]) ?? 0;
  const pts = rec.map((m) => {
    const vel = num(m[73]) ?? num(m[6]), alt = num(m[78]) ?? num(m[2]);
    return {
      t: (num(m[253]) ?? t0) - t0,
      lat: num(m[0]) != null ? num(m[0])! * SEMI : null, lon: num(m[1]) != null ? num(m[1])! * SEMI : null,
      fc: num(m[3]), vel: vel != null ? vel / 1000 : null, alt: alt != null ? alt / 5 - 500 : null,
      cad: num(m[4]), dist: num(m[5]) != null ? num(m[5])! / 100 : null, temp: num(m[13]),
    };
  });
  const passoS = Math.max(1, Math.ceil(pts.length / 600));
  const serie = pts.filter((_, i) => i % passoS === 0 || i === pts.length - 1).map((x) => {
    const o: Record<string, number | undefined> = { t: x.t, fc: r2(x.fc), vel: r2(x.vel, 100), alt: r2(x.alt, 10), cad: r2(x.cad), dist: r2(x.dist), temp: r2(x.temp) };
    for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
    return o;
  });
  const geo = pts.filter((x) => x.lat != null && x.lon != null && Math.abs(x.lat!) > 0.0001);
  const passoR = Math.max(1, Math.ceil(geo.length / 1500));
  const rota = geo.filter((_, i) => i % passoR === 0 || i === geo.length - 1).map((x) => [r2(x.lat, 1e6), r2(x.lon, 1e6), r2(x.vel, 100) ?? null]);
  const voltas = (msgs[19] ?? []).map((m) => {
    const vel = num(m[110]) ?? num(m[13]);
    return { tempo: r2(num(m[8]) != null ? num(m[8])! / 1000 : null), total: r2(num(m[7]) != null ? num(m[7])! / 1000 : null), dist: r2(num(m[9]) != null ? num(m[9])! / 100 : null),
      vel: r2(vel != null ? vel / 1000 : null, 100), fc: num(m[15]) ?? undefined, fcMax: num(m[16]) ?? undefined, cal: num(m[11]) ?? undefined, subida: num(m[21]) ?? undefined };
  });
  const series = (msgs[225] ?? []).filter((m) => m[5] === 1).map((m) => {
    const cat = Array.isArray(m[7]) ? (m[7] as number[])[0] : num(m[7]);
    return { exercicio: cat != null ? EXERC[cat] ?? "Exercício" : "Exercício", reps: num(m[3]) ?? undefined, peso: num(m[4]) != null ? r2(num(m[4])! / 16, 10) : undefined,
      tempo: r2(num(m[0]) != null ? num(m[0])! / 1000 : null) };
  });
  const piscinas = (msgs[101] ?? []).filter((m) => m[12] === 1).length || undefined;
  return { inicio: t0 ? new Date((t0 + EPOCA) * 1000).toISOString() : undefined, serie, rota, voltas, series, piscinas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return responder({ erro: "faça login no site" }, 401);
    const corpo = await req.json().catch(() => ({}));
    const tok = await token();
    const hoje = iso(new Date(Date.now() - 3 * 3600e3)); // horário de Brasília

    if (corpo.tipo === "detalhe") {
      /* um treino aberto no site: resumo completo, gráficos (FC, ritmo, altitude, cadência, temperatura) e a rota */
      const id = Number(corpo.id);
      if (!id) return responder({ erro: "falta o id do treino" }, 400);
      const { data: meu } = await sb.from("garmin_ativ").select("id").eq("id", id).limit(1);
      if (!meu?.length) return responder({ erro: "treino não encontrado" }, 404);
      /* o resumo vem da Garmin; gráficos, rota, voltas e séries vêm do arquivo original do relógio (.FIT), que existe para todos os treinos */
      const [a, zip] = await Promise.all([
        garmin(tok, `/activity-service/activity/${id}`),
        fetch(BASE + `/download-service/files/activity/${id}`, { headers: { Authorization: "Bearer " + tok } }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
      ]);
      const resumo: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(a?.summaryDTO ?? {})) if (typeof v === "number" || typeof v === "string") resumo[k] = typeof v === "number" ? n(v) : v;
      let fit: ReturnType<typeof resumirFit> | null = null;
      try { if (zip) fit = resumirFit(lerFit(await unzipFit(new Uint8Array(zip)))); } catch (_) { fit = null; }
      return responder({ ok: true, nome: a?.activityName, local: a?.locationName, tipo: a?.activityTypeDTO?.typeKey, resumo, ...(fit ?? { serie: [], rota: [], voltas: [], series: [] }) });
    }

    if (corpo.tipo === "ativ") {
      /* atividades em páginas de 100, da mais nova para a mais antiga; para quando acha uma página toda conhecida */
      let inicio = Number(corpo.inicio ?? 0), salvas = 0, mais = false;
      for (let i = 0; i < 6; i++) {
        const l = await garmin(tok, `/activitylist-service/activities/search/activities?start=${inicio}&limit=100`);
        if (!Array.isArray(l) || !l.length) { mais = false; break; }
        const ids = l.map((a: any) => a.activityId);
        const { data: ja } = await sb.from("garmin_ativ").select("id").in("id", ids);
        const linhas = l.map(ativ);
        const { error } = await sb.from("garmin_ativ").upsert(linhas);
        if (error) throw error;
        salvas += linhas.length; inicio += l.length;
        mais = l.length === 100 && !(corpo.completo !== true && (ja?.length ?? 0) === ids.length);
        if (!mais) break;
      }
      return responder({ ok: true, salvas, mais, inicio });
    }

    /* dias: continua de onde parou (refaz os 2 últimos dias, que ainda mudam); a 1ª vez volta um ano */
    const { data: ult } = await sb.from("garmin_dia").select("data").order("data", { ascending: false }).limit(1);
    let ini = corpo.desde ?? (ult?.[0]?.data ? somaDias(ult[0].data, -2) : somaDias(hoje, -364));
    let salvos = 0;
    for (let i = 0; i < 4 && ini <= hoje; i++) {
      let fim = somaDias(ini, 27); if (fim > hoje) fim = hoje;
      const dias = await bloco(tok, ini, fim);
      if (fim === hoje) {
        const f = await garmin(tok, `/fitnessage-service/fitnessage/v2/${hoje}`).catch(() => null);
        if (f?.fitnessAge) (dias[hoje] = dias[hoje] || {}).idadeFitness = limpa({ fitness: n(f.fitnessAge), real: n(f.chronologicalAge), possivel: n(f.achievableFitnessAge) });
      }
      const linhas = Object.entries(dias).filter(([, d]) => Object.keys(d).length).map(([data, dados]) => ({ data, dados, atualizado: new Date().toISOString() }));
      if (linhas.length) { const { error } = await sb.from("garmin_dia").upsert(linhas); if (error) throw error; }
      salvos += linhas.length; ini = somaDias(fim, 1);
    }
    return responder({ ok: true, salvos, mais: ini <= hoje, desde: ini });
  } catch (e) {
    return responder({ erro: (e as Error).message ?? String(e) }, 500);
  }
});
