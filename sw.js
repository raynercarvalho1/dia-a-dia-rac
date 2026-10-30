/* Service worker do Dia a Dia RAC: deixa o site instalável como app, funcionando também sem internet.
   - Arquivos do site (páginas e módulos): rede primeiro; sem internet, a última versão guardada.
   - Dados que os robôs atualizam (notícias, vagas, tecnologia): abre na hora com a cópia guardada e atualiza por trás.
   - Bibliotecas de CDN (mapa, gráficos de PDF, Supabase): guardadas na primeira vez, porque o endereço já tem a versão.
   - Notificações push: mostra o aviso e, ao tocar, abre a página certa.
   A cada publicação, VERSAO muda: os caches velhos do site são apagados na ativação. */
const VERSAO = "2026-10-30.6";
const APP = "rac-app-" + VERSAO, DADOS = "rac-dados", LIBS = "rac-libs";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./nucleo.js", "./mercado.js", "./js/app.js", "./js/esportes.js", "./js/familia.js", "./js/mba.js", "./js/saude.js", "./js/conexoes.js", "./js/sistema.js", "./js/lista.js", "./js/carreira.js", "./js/bebe.js", "./js/oms.js", "./js/resumo.js", "./js/rede.js", "./icons/icon-192.png", "./icons/icon-512.png"];
const LIB_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => ![APP, DADOS, LIBS].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* "no-cache": sempre pergunta ao servidor se o arquivo mudou (o GitHub deixa guardar por 10 minutos e a correção demorava a chegar) */
function redePrimeiro(req) {
  return fetch(req, { cache: "no-cache" }).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(APP).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined)));
}
function guardadoEAtualiza(req, chave) {
  return caches.open(DADOS).then(c => c.match(chave).then(guardado => {
    const rede = fetch(req).then(res => { if (res.ok) c.put(chave, res.clone()); return res; }).catch(() => guardado);
    return guardado || rede;
  }));
}
function guardadoPrimeiro(req) {
  return caches.open(LIBS).then(c => c.match(req).then(r => r || fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; })));
}

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === self.location.origin) {
    if (/\.json$/.test(url.pathname) && !/manifest/.test(url.pathname)) { e.respondWith(guardadoEAtualiza(req, url.origin + url.pathname)); return; }
    e.respondWith(redePrimeiro(req));
    return;
  }
  if (LIB_HOSTS.includes(url.hostname)) e.respondWith(guardadoPrimeiro(req));
  /* o resto (Supabase, MLB, ESPN, Garmin, mapas) sempre ao vivo */
});

/* ---------- notificações ---------- */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Dia a Dia RAC", {
    body: d.corpo || "", icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", tag: d.tag || undefined, data: { url: d.url || "./#agenda" },
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const alvo = new URL(e.notification.data && e.notification.data.url || "./", self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => {
    for (const c of l) if (c.url.startsWith(self.location.origin)) { c.navigate(alvo); return c.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
