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
