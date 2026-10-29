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
  27: "Abdominal (sit-up)", 28: "Agachamento", 29: "Corpo inteiro", 30: "Tríceps", 31: "Aquecimento", 32: "Corrida", 65534: "Musculação" };

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
    return { exercicio: cat != null ? EXERC[cat] ?? "Musculação" : "Musculação", reps: num(m[3]) ?? undefined, peso: num(m[4]) != null ? r2(num(m[4])! / 16, 10) : undefined,
      tempo: r2(num(m[0]) != null ? num(m[0])! / 1000 : null) };
  });
  const piscinas = (msgs[101] ?? []).filter((m) => m[12] === 1).length || undefined;
  return { inicio: t0 ? new Date((t0 + EPOCA) * 1000).toISOString() : undefined, serie, rota, voltas, series, piscinas };
}

/* ---------- sincronização (usada pelo site e pela rotina diária) ---------- */
type Sb = ReturnType<typeof createClient>;
/* atividades em páginas de 100, da mais nova para a mais antiga; para quando acha uma página toda conhecida */
/* antes desta data o relógio era de outra pessoa: não entra, e o que tiver ficado no banco sai */
const GARMIN_DESDE = "2025-11-01";
async function sincAtiv(sb: Sb, tok: string, uid: string | null, corpo: Record<string, unknown>) {
  let inicio = Number(corpo.inicio ?? 0), salvas = 0, mais = false;
  if (!inicio) { let d = sb.from("garmin_ativ").delete().lt("inicio", GARMIN_DESDE); if (uid) d = d.eq("user_id", uid); await d; }
  for (let i = 0; i < 6; i++) {
    const l = await garmin(tok, `/activitylist-service/activities/search/activities?start=${inicio}&limit=100`);
    if (!Array.isArray(l) || !l.length) { mais = false; break; }
    const ids = l.map((a: any) => a.activityId);
    let q = sb.from("garmin_ativ").select("id").in("id", ids); if (uid) q = q.eq("user_id", uid);
    const { data: ja } = await q;
    const linhas = l.map((a: any) => (uid ? { user_id: uid, ...ativ(a) } : ativ(a))).filter((a: any) => a.inicio >= GARMIN_DESDE);
    if (linhas.length) { const { error } = await sb.from("garmin_ativ").upsert(linhas); if (error) throw error; }
    salvas += linhas.length; inicio += l.length;
    /* a lista vem da mais nova para a mais antiga: chegou antes do corte, para */
    mais = l.length === 100 && linhas.length === l.length && !(corpo.completo !== true && (ja?.length ?? 0) === ids.length);
    if (!mais) break;
  }
  return { salvas, mais, inicio };
}
/* dias: continua de onde parou (refaz os 2 últimos dias, que ainda mudam); a 1ª vez volta um ano */
async function sincDias(sb: Sb, tok: string, uid: string | null, corpo: Record<string, unknown>, hoje: string, blocos = 4) {
  let q = sb.from("garmin_dia").select("data").order("data", { ascending: false }).limit(1); if (uid) q = q.eq("user_id", uid);
  const { data: ult } = await q;
  let ini = (corpo.desde as string) ?? (ult?.[0]?.data ? somaDias(ult[0].data, -2) : somaDias(hoje, -364));
  let salvos = 0;
  for (let i = 0; i < blocos && ini <= hoje; i++) {
    let fim = somaDias(ini, 27); if (fim > hoje) fim = hoje;
    const dias = await bloco(tok, ini, fim);
    if (fim === hoje) {
      const f = await garmin(tok, `/fitnessage-service/fitnessage/v2/${hoje}`).catch(() => null);
      if (f?.fitnessAge) (dias[hoje] = dias[hoje] || {}).idadeFitness = limpa({ fitness: n(f.fitnessAge), real: n(f.chronologicalAge), possivel: n(f.achievableFitnessAge) });
    }
    const linhas = Object.entries(dias).filter(([, d]) => Object.keys(d).length)
      .map(([data, dados]) => ({ ...(uid ? { user_id: uid } : {}), data, dados, atualizado: new Date().toISOString() }));
    if (linhas.length) { const { error } = await sb.from("garmin_dia").upsert(linhas); if (error) throw error; }
    salvos += linhas.length; ini = somaDias(fim, 1);
  }
  return { salvos, mais: ini <= hoje, desde: ini };
}

/* ---------- notificações push (Web Push: VAPID + aes128gcm, RFC 8291/8292), só com WebCrypto ---------- */
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const junta = (...l: Uint8Array[]) => { const o = new Uint8Array(l.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of l) { o.set(x, i); i += x.length; } return o; };
const txt = (s: string) => new TextEncoder().encode(s);
async function hmac(chave: Uint8Array, dados: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dados));
}
/* corpo cifrado para uma inscrição {p256dh, auth} */
async function cifrar(texto: string, p256dh: string, auth: string) {
  const ua = deB64u(p256dh), seg = deB64u(auth);
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const as = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const uaK = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaK }, par.privateKey, 256));
  const ikm = await hmac(await hmac(seg, ecdh), junta(txt("WebPush: info\0"), ua, as, new Uint8Array([1])));
  const sal = crypto.getRandomValues(new Uint8Array(16)), prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, txt("Content-Encoding: aes128gcm\0\x01"))).slice(0, 16);
  const nonce = (await hmac(prk, txt("Content-Encoding: nonce\0\x01"))).slice(0, 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cif = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, junta(txt(texto), new Uint8Array([2]))));
  return junta(sal, new Uint8Array([0, 0, 16, 0, 65]), as, cif);
}
/* chaves VAPID: {publica (base64url, 65 bytes), jwk (privada)} */
async function novasChavesVapid(): Promise<Vapid> {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { publica: b64u(await crypto.subtle.exportKey("raw", par.publicKey)), jwk: await crypto.subtle.exportKey("jwk", par.privateKey) as JsonWebKey };
}
type Vapid = { publica: string; jwk: JsonWebKey };
async function vapid(endpoint: string, ch: Vapid) {
  const aud = new URL(endpoint).origin, agora = Math.floor(Date.now() / 1000);
  const corpo = b64u(txt(JSON.stringify({ typ: "JWT", alg: "ES256" }))) + "." + b64u(txt(JSON.stringify({ aud, exp: agora + 12 * 3600, sub: "https://raynercarvalho.com.br" })));
  const k = await crypto.subtle.importKey("jwk", ch.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const ass = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, txt(corpo));
  return `vapid t=${corpo}.${b64u(ass)}, k=${ch.publica}`;
}
/* manda para uma inscrição; devolve o status (404/410 = inscrição morta) */
async function enviarPush(insc: { endpoint: string; p256dh: string; auth: string }, msg: unknown, ch: Vapid) {
  const corpo = await cifrar(JSON.stringify(msg), insc.p256dh, insc.auth);
  const r = await fetch(insc.endpoint, { method: "POST", body: corpo, headers: {
    Authorization: await vapid(insc.endpoint, ch), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal" } });
  return r.status;
}
/* as chaves VAPID são criadas na primeira vez e ficam na tabela privada rac_segredos (só o servidor lê) */
async function chavesVapid(adm: Sb): Promise<Vapid> {
  const { data } = await adm.from("rac_segredos").select("valor").eq("chave", "vapid").maybeSingle();
  if (data?.valor) return data.valor as Vapid;
  const ch = await novasChavesVapid();
  const { error } = await adm.from("rac_segredos").insert({ chave: "vapid", valor: ch });
  if (error) { const { data: d2 } = await adm.from("rac_segredos").select("valor").eq("chave", "vapid").single(); if (d2?.valor) return d2.valor as Vapid; throw error; }
  return ch;
}
/* manda para todos os aparelhos inscritos de uma pessoa; apaga os que o serviço de push diz que não existem mais */
async function pushPara(adm: Sb, uid: string, msg: { titulo: string; corpo: string; url?: string; tag?: string }) {
  const { data: l } = await adm.from("push_inscricoes").select("id,endpoint,p256dh,auth").eq("user_id", uid);
  if (!l?.length) return "nenhum aparelho com notificações ativas";
  const ch = await chavesVapid(adm), res: number[] = [];
  for (const x of l as { id: number; endpoint: string; p256dh: string; auth: string }[]) {
    const st = await enviarPush(x, msg, ch).catch(() => 0);
    res.push(st);
    if (st === 404 || st === 410) await adm.from("push_inscricoes").delete().eq("id", x.id);
  }
  return `${res.filter((c) => c >= 200 && c < 300).length} de ${l.length} aparelhos`;
}
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/* ---------- chuva em Sorocaba hoje (Open-Meteo, previsão por hora, das 6h em diante) ---------- */
async function chuvaHoje(hoje: string) {
  const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-23.50&longitude=-47.46&hourly=precipitation_probability,precipitation&timezone=America%2FSao_Paulo&forecast_days=1");
  if (!r.ok) throw new Error("Open-Meteo respondeu " + r.status);
  const h = (await r.json()).hourly as { time: string[]; precipitation_probability: number[]; precipitation: number[] };
  let ini = -1, fim = -1, max = 0, mm = 0;
  for (let i = 0; i < h.time.length; i++) {
    const hr = +h.time[i].slice(11, 13); if (h.time[i].slice(0, 10) !== hoje || hr < 6) continue;
    const p = h.precipitation_probability[i] ?? 0, m = h.precipitation[i] ?? 0;
    if (p >= 60 || (p >= 40 && m >= 1)) { if (ini < 0) ini = hr; fim = hr; }
    max = Math.max(max, p); mm += m;
  }
  return ini < 0 ? null : `☔ Chuva em Sorocaba hoje, das ${ini}h às ${fim + 1}h (até ${max}%${mm >= 1 ? ", ~" + Math.round(mm) + " mm" : ""}).`;
}

/* ---------- resumo da semana (vai no domingo) ---------- */
const hm = (seg: number) => `${Math.floor(seg / 3600)}h${String(Math.round(seg % 3600 / 60)).padStart(2, "0")}`;
async function resumoSemana(adm: Sb, uid: string, hoje: string) {
  const ini = somaDias(hoje, -6), l: string[] = [];
  const { data: at } = await adm.from("garmin_ativ").select("tipo,inicio,dados").eq("user_id", uid).gte("inicio", ini);
  if (at?.length) {
    const km = at.reduce((s, a: any) => s + (a.dados?.distancia ?? 0), 0) / 1000, seg = at.reduce((s, a: any) => s + (a.dados?.duracao ?? 0), 0);
    l.push(`🏃 ${at.length} treino${at.length > 1 ? "s" : ""}${km >= 1 ? ", " + km.toFixed(1).replace(".", ",") + " km" : ""}, ${hm(seg)}`);
  } else l.push("🏃 nenhum treino na semana");
  const { data: dias } = await adm.from("garmin_dia").select("dados").eq("user_id", uid).gte("data", ini).lte("data", hoje);
  const med = (f: (d: any) => number | undefined) => { const v = (dias ?? []).map((x: any) => f(x.dados ?? {})).filter((x): x is number => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const sono = med((d) => d.sono?.total), passos = med((d) => d.passos), vfc = med((d) => d.vfc?.noite);
  if (sono) l.push(`😴 sono médio ${hm(sono)}${vfc ? " · VFC " + Math.round(vfc) + " ms" : ""}`);
  if (passos) l.push(`👟 ${Math.round(passos).toLocaleString("pt-BR")} passos por dia`);
  const { data: nt } = await adm.from("notas").select("total").eq("user_id", uid).gte("data", ini).lte("data", hoje);
  if (nt?.length) l.push(`🛒 mercado: R$ ${nt.reduce((s, x: any) => s + Number(x.total || 0), 0).toFixed(2).replace(".", ",")} em ${nt.length} compra${nt.length > 1 ? "s" : ""}`);
  return l;
}

/* ---------- rotina diária (chamada pelo agendamento do banco, sem ninguém com o site aberto) ---------- */
const NOMES: Record<string, string> = { eddie: "Eddie", olivia: "Olivia", civic: "Civic", moto: "Moto", c3: "C3" };
const dBR = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7);
/* o que vence (ou passou) perto de hoje, nas mesmas fontes da página Agenda */
async function agendaServidor(adm: Sb, uid: string, hoje: string) {
  const ev: { data: string; t: string }[] = [];
  const { data: regs } = await adm.from("registros").select("quem,tipo,data,titulo,proxima,dados").eq("user_id", uid).order("data", { ascending: false });
  const visto: Record<string, boolean> = {};
  for (const r of regs ?? []) {
    const k = r.quem + "|" + r.tipo, quem = NOMES[r.quem] ?? r.quem;
    /* vale só o registro mais novo de cada tipo (um mais novo sem "próxima" substitui o aviso do anterior) */
    if (!visto[k + "|p"]) { visto[k + "|p"] = true; if (r.proxima) ev.push({ data: r.proxima, t: `${quem}: ${r.titulo}` }); }
    const d = (r.dados ?? {}) as Record<string, string>;
    if (d.vigenciaFim && !visto[k + "|v"]) { visto[k + "|v"] = true; ev.push({ data: d.vigenciaFim, t: `${quem}: fim da vigência de ${r.titulo}` }); }
  }
  const { data: pes } = await adm.from("pessoal").select("chave,valor").eq("user_id", uid);
  const P: Record<string, any> = {}; for (const x of pes ?? []) P[x.chave] = x.valor;
  const feito = P.mbaFeito ?? {};
  for (const a of P.mba?.avaliacoes ?? []) if (!feito["av:" + a.id]) ev.push({ data: a.ate, t: `MBA: responder ${a.t}${a.disc ? " (" + a.disc + ")" : ""}` });
  for (const q of P.mba?.financeiro?.parcelas ?? []) if (!feito["pg:" + q.k]) ev.push({ data: q.venc, t: `MBA: boleto ${q.n} (R$ ${Number(q.v).toFixed(2).replace(".", ",")})` });
  for (const a of P.mba?.aulas ?? []) ev.push({ data: a.data, t: `MBA: aula ${a.t} às ${a.hora}` });
  for (const l of P.lembretes ?? []) if (!l.feito) ev.push({ data: l.data, t: l.t });
  for (const c of P.candidaturas ?? []) { const d = c.datas?.candidatei; if (c.coluna === "candidatei" && d && !c.followup) ev.push({ data: somaDias(d, 5), t: `Follow-up da candidatura: ${c.t}${c.e ? " (" + c.e + ")" : ""}` }); }
  const ano = +hoje.slice(0, 4);
  for (const b of P.aniversarios ?? []) {
    let d = `${ano}-${String(b.mes).padStart(2, "0")}-${String(b.dia).padStart(2, "0")}`; if (d < hoje) d = `${ano + 1}` + d.slice(4);
    if (d <= somaDias(hoje, 1)) ev.push({ data: d, t: `Aniversário de ${b.nome}` });
  }
  if (!P.ultimoBackup || P.ultimoBackup < somaDias(hoje, -30)) ev.push({ data: hoje, t: "Baixar um backup do site (Sistema → Exportar tudo)" });
  /* janela do aviso: até 7 dias atrasado e os próximos 3 dias */
  return ev.filter((e) => e.data && e.data >= somaDias(hoje, -7) && e.data <= somaDias(hoje, 3)).sort((a, b) => a.data.localeCompare(b.data));
}
async function telegram(texto: string) {
  const bot = Deno.env.get("TELEGRAM_BOT_TOKEN"), chat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!bot || !chat) return "sem Telegram configurado";
  const r = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }) });
  return r.ok ? "enviado" : "Telegram respondeu " + r.status;
}
/* backup semanal (domingo): todas as tabelas da conta num JSON, no cofre privado "backups"; ficam os 8 mais novos */
async function backupSemanal(adm: Sb, uid: string, hoje: string) {
  const out: Record<string, unknown[]> = {};
  for (const t of ["pessoal", "registros", "garmin_dia", "garmin_ativ", "mercados", "produtos", "notas", "itens", "orcamentos"]) {
    const linhas: unknown[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await adm.from(t).select("*").eq("user_id", uid).range(de, de + 999);
      if (error) break; linhas.push(...(data ?? [])); if ((data ?? []).length < 1000) break;
    }
    out[t] = linhas;
  }
  const corpo = new Blob([JSON.stringify({ versao: 1, criado: new Date().toISOString(), dono: uid, tabelas: out })], { type: "application/json" });
  const { error } = await adm.storage.from("backups").upload(`${uid}/${hoje}.json`, corpo, { upsert: true, contentType: "application/json" });
  if (error) throw error;
  const { data: l } = await adm.storage.from("backups").list(uid, { sortBy: { column: "name", order: "desc" } });
  const velhos = (l ?? []).slice(8).map((f) => `${uid}/${f.name}`);
  if (velhos.length) await adm.storage.from("backups").remove(velhos);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
}
async function rotina(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!, chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adm = createClient(url, chave, { auth: { persistSession: false } });
  const { data: autorizado } = await adm.rpc("rac_rotina_ok", { segredo: req.headers.get("x-rac-rotina") ?? "" });
  if (autorizado !== true) return responder({ erro: "rotina não autorizada" }, 401);
  /* de quem é o site: quem tem dados pessoais e não é membro da casa */
  const { data: membros } = await adm.from("membros").select("membro");
  const naoDono = new Set((membros ?? []).map((m: any) => m.membro));
  const { data: pes } = await adm.from("pessoal").select("user_id").limit(50);
  const uid = (pes ?? []).map((x: any) => x.user_id).find((u: string) => !naoDono.has(u));
  if (!uid) return responder({ erro: "dono não encontrado" }, 404);
  const hoje = iso(new Date(Date.now() - 3 * 3600e3)), res: Record<string, unknown> = {};
  let tudoOk = true;
  const passo = async (nome: string, f: () => Promise<unknown>) => {
    try { res[nome] = await f(); } catch (e) {
      tudoOk = false; res[nome] = { erro: (e as Error).message ?? String(e) };
      await adm.from("erros").insert({ user_id: uid, origem: "rotina: " + nome, mensagem: (e as Error).message ?? String(e), aparelho: "servidor" });
    }
  };
  let tok: string | null = null;
  await passo("garmin_token", async () => { tok = await token(); return "ok"; });
  if (tok) {
    await passo("garmin_dias", () => sincDias(adm, tok!, uid, {}, hoje, 13));
    await passo("garmin_treinos", () => sincAtiv(adm, tok!, uid, {}));
  }
  const domingo = new Date(hoje + "T12:00:00Z").getUTCDay() === 0;
  let chuva: string | null = null, semana: string[] = [];
  await passo("chuva", async () => { chuva = await chuvaHoje(hoje); return chuva ?? "sem chuva"; });
  if (domingo) await passo("resumo_semana", async () => { semana = await resumoSemana(adm, uid, hoje); return semana.length; });
  await passo("alertas", async () => {
    const ev = await agendaServidor(adm, uid, hoje);
    const linhas = ev.map((e) => (e.data < hoje ? "⚠ atrasado: " : e.data === hoje ? "• hoje: " : "• " + dBR(e.data) + ": ") + e.t);
    const partes = [chuva, semana.length ? "Sua semana\n" + semana.join("\n") : null, linhas.length ? "Próximos dias\n" + linhas.join("\n") : null].filter(Boolean) as string[];
    if (!partes.length) return { itens: 0 };
    /* push: o essencial em poucas linhas; ao tocar, abre a Agenda (ou o Resumo, no domingo) */
    const corpoPush = [chuva, semana.length ? "Sua semana: " + semana.join(" · ") : null, linhas.length ? linhas.length + (linhas.length > 1 ? " itens" : " item") + " na agenda: " + ev[0].t : null].filter(Boolean).join("\n");
    return { itens: ev.length, telegram: await telegram("Dia a Dia RAC\n\n" + partes.join("\n\n")),
      push: await pushPara(adm, uid, { titulo: domingo ? "Dia a Dia RAC — resumo da semana" : "Dia a Dia RAC — hoje", corpo: corpoPush, url: domingo && semana.length ? "./#resumo" : "./#agenda", tag: "rotina" }) };
  });
  if (domingo) await passo("backup", () => backupSemanal(adm, uid, hoje));
  await adm.from("rotina_log").insert({ user_id: uid, ok: tudoOk, resumo: res });
  return responder({ ok: tudoOk, ...res });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.headers.get("x-rac-rotina")) return await rotina(req);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return responder({ erro: "faça login no site" }, 401);
    const corpo = await req.json().catch(() => ({}));
    /* notificações: a chave pública para o aparelho se inscrever, e um teste para os aparelhos de quem chamou */
    if (corpo.tipo === "push_chave") return responder({ ok: true, publica: (await chavesVapid(admin())).publica });
    if (corpo.tipo === "push_teste") return responder({ ok: true, resultado: await pushPara(admin(), u.user.id, { titulo: "Dia a Dia RAC", corpo: "Notificações funcionando neste aparelho ✓", url: "./#sistema", tag: "teste" }) });
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

    if (corpo.tipo === "ativ") return responder({ ok: true, ...(await sincAtiv(sb, tok, null, corpo)) });
    return responder({ ok: true, ...(await sincDias(sb, tok, null, corpo, hoje)) });
  } catch (e) {
    return responder({ erro: (e as Error).message ?? String(e) }, 500);
  }
});
