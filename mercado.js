/* Aba Mercado do Dia a Dia RAC: controle de compras do mercado, privado.
   Os dados ficam no Supabase do Rayner; só quem faz login vê alguma coisa (RLS no banco).
   A chave abaixo é a publicável, feita para ficar no site; a segurança vem das regras do banco.
   Bibliotecas (supabase-js e SheetJS) só carregam quando a aba é aberta. */
(function () {
  var SB_URL = "https://hofnhbxnfebfnncwxrds.supabase.co";
  var SB_KEY = "sb_publishable_kpEqdxunDeIbStJrgxrngg_tNPv6VTL";
  var SUPA_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
  var XLSX_JS = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var PCT = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

  var sb = null, user = null, rows = null, loadingRows = null;
  var st = { mes: null, q: "", prod: null, sort: "alta" };

  /* ---------- utilidades ---------- */
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) { add(c); return; }
        e.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
      });
    })(Array.prototype.slice.call(arguments, 2));
    return e;
  }
  function panel(title, sub) {
    var p = h("div", { class: "panel" });
    if (title) p.appendChild(h("h2", { text: title }));
    if (sub) p.appendChild(h("p", { class: "sub", style: "margin:-6px 0 12px", text: sub }));
    return p;
  }
  function norm(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function money(v) { return BRL.format(v || 0); }
  function mesKey(iso) { return iso.slice(0, 7); }
  function mesNome(k) { var p = k.split("-"); return MESES[+p[1] - 1] + " " + p[0]; }
  function mesCurto(k) { var p = k.split("-"); return MESES[+p[1] - 1].slice(0, 3) + "/" + p[0].slice(2); }
  function dataBR(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function sum(arr, f) { return arr.reduce(function (a, x) { return a + (f ? f(x) : x); }, 0); }
  function groupBy(arr, f) { var m = {}; arr.forEach(function (x) { var k = f(x); (m[k] = m[k] || []).push(x); }); return m; }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("não carregou " + src)); };
      document.head.appendChild(s);
    });
  }
  function client() {
    if (sb) return Promise.resolve(sb);
    return (window.supabase ? Promise.resolve() : loadScript(SUPA_JS)).then(function () {
      sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "rac-mercado-auth" } });
      return sb;
    });
  }
  function root() { return document.getElementById("mercado-view"); }
  function msg(text) { var r = root(); r.innerHTML = ""; r.appendChild(h("div", { class: "panel" }, h("p", { class: "empty", text: text }))); }

  /* ---------- entrada: chamada pelo roteador do site ---------- */
  function render(sub) {
    msg("Carregando…");
    client().then(function (c) { return c.auth.getSession(); }).then(function (r) {
      user = r.data && r.data.session && r.data.session.user;
      if (!user) { drawLogin(sub); return; }
      return loadRows().then(function () { drawApp(sub); });
    }).catch(function (e) { msg("Não consegui abrir o controle de mercado agora (" + (e.message || e) + ")."); });
  }

  function drawLogin(sub) {
    var r = root(); r.innerHTML = "";
    var f = h("form", { class: "panel lockbox", autocomplete: "on" },
      h("div", { class: "lockic mk" }, svgCart()),
      h("h2", { text: "Controle de mercado" }),
      h("p", { class: "sub", text: "Entre com a sua conta para ver as suas compras." }),
      h("input", { type: "email", id: "mk-email", placeholder: "E-mail", "aria-label": "E-mail", autocomplete: "username", required: "" }),
      h("input", { type: "password", id: "mk-pw", placeholder: "Senha", "aria-label": "Senha", autocomplete: "current-password", required: "" }),
      h("button", { type: "submit", id: "mk-enter", text: "Entrar" }),
      h("p", { class: "sub", id: "mk-msg", role: "status" }));
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = document.getElementById("mk-enter"), m = document.getElementById("mk-msg");
      b.disabled = true; m.textContent = "Entrando…";
      sb.auth.signInWithPassword({ email: document.getElementById("mk-email").value.trim(), password: document.getElementById("mk-pw").value })
        .then(function (res) {
          b.disabled = false;
          if (res.error) { m.textContent = /invalid/i.test(res.error.message) ? "E-mail ou senha incorretos." : "Não consegui entrar: " + res.error.message; return; }
          render(sub);
        });
    });
    r.appendChild(f);
  }

  /* Todas as linhas da visão "compras" (um item por linha), em páginas de 1000 */
  function loadRows(force) {
    if (rows && !force) return Promise.resolve(rows);
    if (loadingRows && !force) return loadingRows;
    var out = [];
    function page(from) {
      return sb.from("compras").select("id,data,mes,mercado,numero,forma_pagamento,categoria,descricao,produto,produto_id,quantidade,unidade,valor_unitario,valor_total,desconto,observacao")
        .order("data", { ascending: true }).range(from, from + 999)
        .then(function (r) {
          if (r.error) throw new Error(r.error.message);
          out = out.concat(r.data || []);
          return (r.data || []).length === 1000 ? page(from + 1000) : out;
        });
    }
    loadingRows = page(0).then(function (d) {
      d.forEach(function (x) { x.valor_total = +x.valor_total; x.valor_unitario = +x.valor_unitario; x.quantidade = +x.quantidade; x.desconto = +x.desconto; x.mk = mesKey(x.data); x.nota = x.data + "|" + x.mercado + "|" + (x.numero || ""); });
      rows = d; loadingRows = null; return rows;
    });
    return loadingRows;
  }

  /* ---------- casca: abas internas e sair ---------- */
  var VIEWS = [["painel", "Painel"], ["precos", "Preços"], ["notas", "Notas"], ["produtos", "Produtos"], ["importar", "Adicionar nota"]];
  function drawApp(sub) {
    var v = VIEWS.some(function (x) { return x[0] === sub; }) ? sub : (rows.length ? "painel" : "importar");
    var r = root(); r.innerHTML = "";
    var bar = h("div", { class: "mkbar" });
    var tabs = h("div", { class: "pills mkpills", "aria-label": "Mercado" });
    VIEWS.forEach(function (x) { tabs.appendChild(h("a", { href: "#mercado/" + x[0], "aria-current": x[0] === v ? "page" : null, text: x[1] })); });
    var out = h("button", { type: "button", class: "ghostbtn", text: "Sair" });
    out.onclick = function () { sb.auth.signOut().then(function () { rows = null; render(v); }); };
    bar.appendChild(tabs); bar.appendChild(h("div", { class: "mkuser" }, h("span", { class: "sub", text: user.email }), out));
    r.appendChild(bar);
    var body = h("div", { class: "stack" }); r.appendChild(body);
    if (!rows.length && v !== "importar") {
      body.appendChild(h("div", { class: "panel" }, h("p", { class: "empty" }, "Ainda não há compras na sua conta. ", h("a", { class: "link", href: "#mercado/importar", text: "Importe o seu Excel" }), " para começar.")));
      return;
    }
    ({ painel: viewPainel, precos: viewPrecos, notas: viewNotas, produtos: viewProdutos, importar: viewImportar })[v](body);
  }

  /* ---------- Painel ---------- */
  function viewPainel(body) {
    var meses = Object.keys(groupBy(rows, function (x) { return x.mk; })).sort();
    if (!st.mes || meses.indexOf(st.mes) < 0) st.mes = meses[meses.length - 1];
    var doMes = rows.filter(function (x) { return x.mk === st.mes; });
    var i = meses.indexOf(st.mes), ant = i > 0 ? rows.filter(function (x) { return x.mk === meses[i - 1]; }) : [];
    var total = sum(doMes, function (x) { return x.valor_total; }), totAnt = sum(ant, function (x) { return x.valor_total; });
    var notas = Object.keys(groupBy(doMes, function (x) { return x.nota; })).length;
    var desc = sum(doMes, function (x) { return x.desconto || 0; });

    var seg = h("div", { class: "seg mkmeses", role: "group", "aria-label": "Mês" });
    meses.slice(-12).forEach(function (k) {
      var b = h("button", { type: "button", "aria-pressed": k === st.mes ? "true" : "false", text: mesCurto(k) });
      b.onclick = function () { st.mes = k; drawApp("painel"); };
      seg.appendChild(b);
    });
    body.appendChild(seg);

    var delta = totAnt ? (total - totAnt) / totAnt : null;
    body.appendChild(h("div", { class: "kpis" },
      kpi("Gasto em " + mesNome(st.mes), money(total), delta === null ? "primeiro mês registrado" : (delta >= 0 ? "▲ " : "▼ ") + PCT.format(Math.abs(delta)) + " vs " + MESES[+meses[i - 1].slice(5) - 1], delta === null ? "" : delta > 0 ? "up" : "down"),
      kpi("Compras no mês", String(notas), notas ? "média de " + money(total / notas) + " por compra" : ""),
      kpi("Itens comprados", String(doMes.length), desc ? money(desc) + " em descontos" : "sem descontos registrados"),
      kpi("Total desde " + mesNome(meses[0]).split(" ")[0], money(sum(rows, function (x) { return x.valor_total; })), meses.length + (meses.length === 1 ? " mês" : " meses"))));

    var grid = h("div", { class: "mkgrid" });
    var porCat = Object.entries(groupBy(doMes, function (x) { return x.categoria; })).map(function (e) { return [e[0], sum(e[1], function (x) { return x.valor_total; })]; }).sort(function (a, b) { return b[1] - a[1]; });
    var pc = panel("Por categoria", "Gasto em " + mesNome(st.mes));
    pc.appendChild(hbars(porCat, total));
    grid.appendChild(pc);

    var porMes = meses.map(function (k) { return [k, sum(rows.filter(function (x) { return x.mk === k; }), function (x) { return x.valor_total; })]; });
    var pm = panel("Mês a mês", "Total gasto em cada mês");
    pm.appendChild(vbars(porMes.slice(-12), st.mes));
    grid.appendChild(pm);

    var porMerc = Object.entries(groupBy(doMes, function (x) { return x.mercado; })).map(function (e) { return [e[0].replace(/\s*\(.*\)$/, ""), sum(e[1], function (x) { return x.valor_total; })]; }).sort(function (a, b) { return b[1] - a[1]; });
    var pmk = panel("Por mercado", mesNome(st.mes));
    pmk.appendChild(hbars(porMerc, total));
    grid.appendChild(pmk);

    var porProd = Object.entries(groupBy(doMes, function (x) { return x.produto; })).map(function (e) { return { p: e[0], t: sum(e[1], function (x) { return x.valor_total; }), q: sum(e[1], function (x) { return x.quantidade; }), u: e[1][0].unidade, c: e[1][0].categoria }; }).sort(function (a, b) { return b.t - a.t; }).slice(0, 10);
    var pp = panel("O que mais pesou", "Os 10 produtos com maior gasto no mês");
    pp.appendChild(tabela(["Produto", "Qtd", "Total"], porProd.map(function (x) {
      return [h("span", null, h("b", { text: x.p }), h("span", { class: "sub", text: " · " + x.c })), fmtQtd(x.q, x.u), money(x.t)];
    }), 1));
    grid.appendChild(pp);
    body.appendChild(grid);
  }
  function kpi(label, value, note, cls) {
    return h("div", { class: "panel kpi" }, h("span", { class: "kl", text: label }), h("b", { class: "kv", text: value }), note ? h("span", { class: "kn " + (cls || ""), text: note }) : null);
  }
  function fmtQtd(q, u) { return u === "kg" ? q.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " kg" : Math.round(q * 1000) / 1000 + (u === "l" ? " L" : " un"); }
  /* Barras horizontais de uma série só: rótulo, barra proporcional ao maior valor, valor e % do total */
  function hbars(list, total) {
    var max = Math.max.apply(null, list.map(function (x) { return x[1]; }).concat([1]));
    return h("div", { class: "hbars" }, list.map(function (x) {
      return h("div", { class: "hb", title: x[0] + ": " + money(x[1]) + " (" + PCT.format(x[1] / (total || 1)) + ")" },
        h("span", { class: "hbl", text: x[0] }),
        h("span", { class: "hbt" }, h("span", { class: "hbf", style: "width:" + (x[1] / max * 100).toFixed(1) + "%" })),
        h("span", { class: "hbv" }, money(x[1]), h("small", { text: " " + PCT.format(x[1] / (total || 1)) })));
    }));
  }
  /* Colunas por mês; o mês escolhido fica destacado e cada coluna mostra o valor ao passar o mouse */
  function vbars(list, sel) {
    var max = Math.max.apply(null, list.map(function (x) { return x[1]; }).concat([1]));
    return h("div", { class: "vbars" }, list.map(function (x) {
      return h("button", { type: "button", class: "vb" + (x[0] === sel ? " on" : ""), title: mesNome(x[0]) + ": " + money(x[1]), "aria-label": mesNome(x[0]) + ": " + money(x[1]) },
        h("span", { class: "vbv", text: Math.round(x[1]).toLocaleString("pt-BR") }),
        h("span", { class: "vbt" }, h("span", { class: "vbf", style: "height:" + Math.max(2, x[1] / max * 100).toFixed(1) + "%" })),
        h("span", { class: "vbl", text: mesCurto(x[0]) }));
    }).map(function (b, i) { b.onclick = function () { st.mes = list[i][0]; drawApp("painel"); }; return b; }));
  }
  function tabela(cols, linhas, nf) {
    return h("div", { class: "tblwrap" }, h("table", { class: "tbl" },
      h("thead", null, h("tr", null, cols.map(function (c, i) { return h("th", { class: i >= nf ? "num" : "", text: c }); }))),
      h("tbody", null, linhas.map(function (r) { return h("tr", null, r.map(function (c, i) { return h("td", { class: i >= nf ? "num" : "" }, c); })); }))));
  }

  /* ---------- Preços: histórico por produto ---------- */
  function produtos() {
    return Object.entries(groupBy(rows, function (x) { return x.produto; })).map(function (e) {
      var l = e[1].slice().sort(function (a, b) { return a.data.localeCompare(b.data); });
      var ult = l[l.length - 1], pri = l[0], pen = l.length > 1 ? l[l.length - 2] : null;
      var precos = l.map(function (x) { return x.valor_unitario; });
      return { nome: e[0], cat: ult.categoria, u: ult.unidade, compras: l, ult: ult, pri: pri,
        varTotal: pri.valor_unitario ? (ult.valor_unitario - pri.valor_unitario) / pri.valor_unitario : 0,
        varUlt: pen && pen.valor_unitario ? (ult.valor_unitario - pen.valor_unitario) / pen.valor_unitario : 0,
        min: Math.min.apply(null, precos), max: Math.max.apply(null, precos),
        mercados: Object.keys(groupBy(l, function (x) { return x.mercado; })).length };
    });
  }
  function viewPrecos(body) {
    var all = produtos();
    var top = h("div", { class: "panel" },
      h("h2", { text: "Preços ao longo do tempo" }),
      h("p", { class: "sub", text: "Preço por unidade (ou por kg) em cada compra. Clique num produto para ver o gráfico e onde saiu mais barato." }));
    var tools = h("div", { class: "vfil" });
    var q = h("input", { type: "search", placeholder: "Buscar produto", "aria-label": "Buscar produto", value: st.q, autocomplete: "off" });
    var sort = h("select", { "aria-label": "Ordenar" },
      [["alta", "Mais subiram"], ["baixa", "Mais baixaram"], ["compras", "Mais comprados"], ["nome", "Nome"]].map(function (o) { return h("option", { value: o[0], selected: st.sort === o[0] ? "" : null, text: o[1] }); }));
    tools.appendChild(q); tools.appendChild(sort); top.appendChild(tools);
    body.appendChild(top);
    var detail = h("div"); body.appendChild(detail);
    var list = h("div", { class: "panel" }); body.appendChild(list);
    function draw() {
      var nq = norm(st.q);
      var l = all.filter(function (p) { return !nq || norm(p.nome + " " + p.cat).indexOf(nq) >= 0; });
      var ord = { alta: function (a, b) { return b.varTotal - a.varTotal; }, baixa: function (a, b) { return a.varTotal - b.varTotal; }, compras: function (a, b) { return b.compras.length - a.compras.length; }, nome: function (a, b) { return a.nome.localeCompare(b.nome); } }[st.sort];
      l.sort(ord);
      list.innerHTML = "";
      list.appendChild(h("p", { class: "sub", text: l.length + " produtos" }));
      list.appendChild(tabela(["Produto", "Último preço", "1º preço", "Variação", "Compras"], l.map(function (p) {
        var b = h("button", { type: "button", class: "mkprod", text: p.nome }); b.onclick = function () { st.prod = p.nome; showProd(); window.scrollTo({ top: 0, behavior: "smooth" }); };
        return [h("span", null, b, h("span", { class: "sub", text: " · " + p.cat })), money(p.ult.valor_unitario) + (p.u === "kg" ? "/kg" : ""), money(p.pri.valor_unitario), varTag(p.compras.length > 1 ? p.varTotal : null), String(p.compras.length)];
      }), 1));
    }
    function showProd() {
      detail.innerHTML = "";
      var p = all.filter(function (x) { return x.nome === st.prod; })[0];
      if (!p) return;
      var d = panel(p.nome, p.cat + " · " + p.compras.length + (p.compras.length === 1 ? " compra" : " compras") + " · preço " + (p.u === "kg" ? "por kg" : "por unidade"));
      d.appendChild(lineChart(p));
      var porMerc = Object.entries(groupBy(p.compras, function (x) { return x.mercado; })).map(function (e) {
        var l = e[1].slice().sort(function (a, b) { return a.data.localeCompare(b.data); }), u = l[l.length - 1];
        return [e[0].replace(/\s*\(.*\)$/, ""), Math.min.apply(null, l.map(function (x) { return x.valor_unitario; })), u.valor_unitario, dataBR(u.data)];
      }).sort(function (a, b) { return a[2] - b[2]; });
      if (porMerc.length > 1) {
        d.appendChild(h("h3", { class: "dayh", text: "Onde saiu mais barato" }));
        d.appendChild(tabela(["Mercado", "Menor preço", "Último preço", "Última compra"], porMerc.map(function (m) { return [m[0], money(m[1]), money(m[2]), m[3]]; }), 1));
      }
      var fechar = h("button", { type: "button", class: "ghostbtn", text: "Fechar gráfico" }); fechar.onclick = function () { st.prod = null; detail.innerHTML = ""; };
      d.appendChild(h("div", { class: "vfoot" }, fechar));
      detail.appendChild(d);
    }
    q.addEventListener("input", function () { st.q = q.value; draw(); });
    sort.addEventListener("change", function () { st.sort = sort.value; draw(); });
    draw(); showProd();
  }
  function varTag(v) {
    if (v === null) return h("span", { class: "sub", text: "—" });
    var cls = v > 0.005 ? "up" : v < -0.005 ? "down" : "flat";
    return h("span", { class: "vt " + cls, text: (v > 0.005 ? "▲ " : v < -0.005 ? "▼ " : "= ") + PCT.format(Math.abs(v)) });
  }
  /* Linha do preço unitário no tempo: uma série, eixo de valores em R$, pontos com o valor e o mercado no hover */
  function lineChart(p) {
    var W = 640, H = 240, L = 58, R = 16, T = 16, B = 30;
    var pts = p.compras.map(function (x) { return { t: new Date(x.data + "T12:00:00").getTime(), v: x.valor_unitario, x: x }; });
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t; if (t1 === t0) { t0 -= 86400000 * 3; t1 += 86400000 * 3; }
    var vmin = Math.min.apply(null, pts.map(function (q) { return q.v; })), vmax = Math.max.apply(null, pts.map(function (q) { return q.v; }));
    var pad = (vmax - vmin) * 0.15 || vmax * 0.1 || 1; vmin = Math.max(0, vmin - pad); vmax = vmax + pad;
    function X(t) { return L + (t - t0) / (t1 - t0) * (W - L - R); }
    function Y(v) { return T + (1 - (v - vmin) / (vmax - vmin)) * (H - T - B); }
    var NS = "http://www.w3.org/2000/svg";
    function s(tag, a, txt) { var e = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); if (txt) e.textContent = txt; return e; }
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "lchart", role: "img", "aria-label": "Preço de " + p.nome + " ao longo do tempo" });
    for (var g = 0; g <= 3; g++) {
      var v = vmin + (vmax - vmin) * g / 3, y = Y(v);
      svg.appendChild(s("line", { x1: L, x2: W - R, y1: y, y2: y, class: "lgrid" }));
      svg.appendChild(s("text", { x: L - 8, y: y + 4, "text-anchor": "end", class: "lax" }, money(v)));
    }
    svg.appendChild(s("text", { x: L, y: H - 8, class: "lax" }, dataBR(p.compras[0].data)));
    svg.appendChild(s("text", { x: W - R, y: H - 8, "text-anchor": "end", class: "lax" }, dataBR(p.compras[p.compras.length - 1].data)));
    if (pts.length > 1) svg.appendChild(s("polyline", { points: pts.map(function (q) { return X(q.t).toFixed(1) + "," + Y(q.v).toFixed(1); }).join(" "), class: "lline" }));
    pts.forEach(function (q, i) {
      var c = s("circle", { cx: X(q.t), cy: Y(q.v), r: 5, class: "lpt" });
      c.appendChild(s("title", null, dataBR(q.x.data) + " · " + money(q.v) + (p.u === "kg" ? "/kg" : "") + " · " + q.x.mercado.replace(/\s*\(.*\)$/, "")));
      svg.appendChild(c);
      if (i === pts.length - 1) svg.appendChild(s("text", { x: Math.min(X(q.t), W - R - 4), y: Y(q.v) - 12, "text-anchor": "end", class: "llab" }, money(q.v)));
    });
    return h("div", { class: "lwrap" }, svg);
  }

  /* ---------- Notas ---------- */
  function viewNotas(body) {
    var g = Object.values(groupBy(rows, function (x) { return x.nota; })).map(function (l) {
      return { data: l[0].data, mercado: l[0].mercado, numero: l[0].numero, pag: l[0].forma_pagamento, itens: l, total: sum(l, function (x) { return x.valor_total; }) };
    }).sort(function (a, b) { return b.data.localeCompare(a.data); });
    var p = panel("Notas", g.length + " compras registradas");
    g.forEach(function (n) {
      var d = h("details", { class: "mknota" },
        h("summary", null, h("span", { class: "when", text: dataBR(n.data) }), h("span", { class: "mkn" }, h("b", { text: n.mercado.replace(/\s*\(.*\)$/, "") }), h("span", { class: "sub", text: " · " + n.itens.length + " itens" + (n.numero ? " · NF " + n.numero.replace(/^0+/, "") : "") })), h("b", { class: "mkt", text: money(n.total) })),
        tabela(["Item", "Categoria", "Qtd", "Unit.", "Total"], n.itens.map(function (x) { return [x.descricao, x.categoria, fmtQtd(x.quantidade, x.unidade), money(x.valor_unitario), money(x.valor_total)]; }), 2),
        n.pag ? h("p", { class: "sub", text: "Pagamento: " + n.pag }) : null);
      p.appendChild(d);
    });
    body.appendChild(p);
  }

  /* ---------- Produtos: renomear, juntar repetidos e trocar categoria ---------- */
  function viewProdutos(body) {
    var p = panel("Produtos", "Junte nomes diferentes do mesmo produto para o histórico de preços ficar num lugar só. A categoria escolhida aqui vale para todas as compras do produto.");
    var tools = h("div", { class: "vfil" });
    var q = h("input", { type: "search", placeholder: "Buscar produto", "aria-label": "Buscar produto", autocomplete: "off" });
    var juntar = h("button", { type: "button", class: "ghostbtn pri", disabled: "", text: "Juntar selecionados" });
    tools.appendChild(q); tools.appendChild(juntar); p.appendChild(tools);
    var form = h("div", { class: "mkmerge", hidden: "" }); p.appendChild(form);
    var info = h("p", { class: "sub", role: "status" }); p.appendChild(info);
    var list = h("div", { class: "mkplist" }); p.appendChild(list);
    body.appendChild(p);
    var prods = [], sel = {};
    var cats = Object.keys(groupBy(rows, function (x) { return x.categoria; })).sort();
    var stats = groupBy(rows, function (x) { return x.produto_id || ""; });
    function carregar() {
      info.textContent = "Carregando…";
      return sb.from("produtos").select("id,nome,categoria,unidade").order("nome").then(ok).then(function (d) {
        prods = d; info.textContent = d.length + " produtos"; draw();
      }).catch(function (e) { info.textContent = "Não consegui carregar os produtos: " + e.message; });
    }
    function selecionados() { return prods.filter(function (x) { return sel[x.id]; }); }
    function atualizarBotao() { var n = selecionados().length; juntar.disabled = n < 2; juntar.textContent = n >= 2 ? "Juntar " + n + " selecionados" : "Juntar selecionados"; }
    function salvar(promessa, okMsg) {
      info.textContent = "Salvando…";
      return promessa.then(ok).then(function () { info.textContent = okMsg; return loadRows(true); })
        .then(function () { stats = groupBy(rows, function (x) { return x.produto_id || ""; }); return carregar(); })
        .catch(function (e) { info.textContent = /duplicate|unique/i.test(e.message) ? "Já existe um produto com esse nome. Para juntar os dois, marque ambos e use “Juntar selecionados”." : "Não consegui salvar: " + e.message; draw(); });
    }
    function draw() {
      var nq = norm(q.value);
      list.innerHTML = "";
      prods.filter(function (x) { return !nq || norm(x.nome + " " + x.categoria).indexOf(nq) >= 0; }).forEach(function (x) {
        var compras = stats[x.id] || [];
        var cb = h("input", { type: "checkbox", "aria-label": "Selecionar " + x.nome, checked: sel[x.id] ? "" : null });
        cb.onchange = function () { if (cb.checked) sel[x.id] = 1; else delete sel[x.id]; atualizarBotao(); };
        var nome = h("input", { type: "text", value: x.nome, "aria-label": "Nome do produto", class: "mkpname" });
        nome.onchange = function () { var v = nome.value.trim(); if (!v || v === x.nome) { nome.value = x.nome; return; } salvar(sb.from("produtos").update({ nome: v }).eq("id", x.id), "Nome atualizado."); };
        var cat = h("select", { "aria-label": "Categoria" }, cats.concat(cats.indexOf(x.categoria) < 0 ? [x.categoria] : []).map(function (c) { return h("option", { value: c, selected: c === x.categoria ? "" : null, text: c }); }));
        cat.onchange = function () { salvar(sb.from("produtos").update({ categoria: cat.value }).eq("id", x.id), "Categoria atualizada."); };
        list.appendChild(h("div", { class: "mkprow" }, cb, nome, cat,
          h("span", { class: "sub", text: compras.length + (compras.length === 1 ? " compra" : " compras") + (compras.length ? " · " + money(compras[compras.length - 1].valor_unitario) + (x.unidade === "kg" ? "/kg" : "") : "") })));
      });
      atualizarBotao();
    }
    juntar.onclick = function () {
      var l = selecionados(); if (l.length < 2) return;
      var mais = l.slice().sort(function (a, b) { return (stats[b.id] || []).length - (stats[a.id] || []).length; })[0];
      form.innerHTML = ""; form.hidden = false;
      var nome = h("input", { type: "text", value: mais.nome, "aria-label": "Nome final" });
      var cat = h("select", { "aria-label": "Categoria final" }, cats.map(function (c) { return h("option", { value: c, selected: c === mais.categoria ? "" : null, text: c }); }));
      var go = h("button", { type: "button", text: "Juntar" }), cancel = h("button", { type: "button", class: "ghostbtn", text: "Cancelar" });
      cancel.onclick = function () { form.hidden = true; };
      go.onclick = function () {
        var alvo = mais, outros = l.filter(function (x) { return x.id !== alvo.id; }).map(function (x) { return x.id; });
        var novoNome = nome.value.trim() || alvo.nome;
        form.hidden = true;
        info.textContent = "Juntando…";
        var conflito = prods.filter(function (x) { return x.nome === novoNome && x.id !== alvo.id && outros.indexOf(x.id) < 0; })[0];
        if (conflito) { info.textContent = "Já existe outro produto chamado “" + novoNome + "”. Marque ele também para juntar todos."; return; }
        var passo = sb.from("itens").update({ produto_id: alvo.id }).in("produto_id", outros).then(ok)
          .then(function () { return sb.from("produtos").delete().in("id", outros).then(ok); })
          .then(function () { return sb.from("produtos").update({ nome: novoNome, categoria: cat.value }).eq("id", alvo.id); });
        sel = {};
        salvar(passo, l.length + " produtos juntados em “" + novoNome + "”.");
      };
      form.appendChild(h("p", { class: "sub", text: "Juntar " + l.length + " produtos em um só. As compras de todos passam para ele." }));
      form.appendChild(h("div", { class: "vfil" }, nome, cat, go, cancel));
      nome.focus();
    };
    q.addEventListener("input", draw);
    carregar();
  }

  /* ---------- Nota pelo QR Code (NFC-e) ----------
     A Fazenda de SP não deixa robôs lerem a página da nota, então o fluxo usa o navegador do próprio Rayner:
     o site lê o QR, abre a nota na Fazenda, ele copia o texto da página e cola aqui; o site monta a nota.
     O texto colado fica só na memória da página: CPF e demais dados do consumidor são ignorados. */
  var JSQR_JS = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  var ABREV = { refrig: "refrigerante", min: "mineral", fgo: "frango", frgo: "frango", ling: "linguica", tosc: "toscana", rep: "refil", liq: "liquido", cong: "congelado", choc: "chocolate", bisc: "biscoito", qj: "queijo", mus: "mussarela", mussar: "mussarela", pres: "presunto", sab: "sabonete", amac: "amaciante", deterg: "detergente", lav: "lava", pao: "pao", fr: "frances", trad: "tradicional", integ: "integral", desn: "desnatado", sach: "sache", bov: "bovino", sui: "suino", peit: "peito", file: "file", agua: "agua", cerv: "cerveja", lt: "lata" };
  var CATS_PALAVRAS = [
    ["Bebidas", /refrig|coca|guarana|agua|suco|cerveja|cerv|energet|cha |sprite|pepsi|schweppes/],
    ["Açougue/Frios", /carne|bov|acem|miolo|frango|fgo|peito|coxa|lingui|ling\.|presunto|pres\.|mussarela|queijo|salsicha|mortadela|bacon|suin|bisteca|fraldinha|picanha|patinho/],
    ["Peixaria", /peixe|tilapia|salmao|corvina|bacalhau|camarao/],
    ["Hortifruti", /banana|tomate|cebola|batata|alface|limao|uva|maca |mamao|cenoura|abobr|pepino|pimentao|alho|mandioca|laranja|morango|berinjela|couve|kg\)?$/],
    ["Padaria", /pao |pao$|paes|bisnag|salgado|coxinha|empada|rosca|pao de queijo/],
    ["Chocolates/Doces", /chocolate|choc|bombom|doce|bolo|torta|pudim|biscoito wafer|trident|nutella|petit/],
    ["Limpeza", /detergente|deterg|amaciante|sabao|desinfet|agua sanit|limpador|veja|cif|omo|lava |raid|inseticida/],
    ["Higiene Pessoal", /sabonete|shampoo|condicionador|creme dental|escova|desodor|papel hig|absorvente|listerine|fio d(ental)?[ .]/],
    ["Limpeza/Descartáveis", /guardanapo|papel toalha|toalha de papel|esponja|saco lixo|hastes/],
    ["Mercearia", /arroz|feijao|macarrao|oleo|azeite|acucar|cafe|leite|manteiga|margarina|molho|maionese|biscoito|farinha|sal |tempero|atum|milho|requeij|creme de leite/]
  ];
  function tokens(t) {
    /* "REFRIG.COCA COLA 200ML" -> refrigerante coca cola 200ml; o decimal (32,9g) vira "p" para não quebrar o número */
    return norm(t).replace(/(\d)[.,](\d)/g, "$1p$2").split(/[^a-z0-9]+/).map(function (w) { return ABREV[w] || w; })
      .filter(function (w) { return w && w.length > 1 && !/^(un|kg|de|da|do|com|c|s|e)$/.test(w); });
  }
  function semelhanca(a, b) {
    var A = tokens(a), B = tokens(b); if (!A.length || !B.length) return 0;
    var hits = A.filter(function (w) { return B.some(function (v) { return v === w || (w.length >= 4 && v.indexOf(w) === 0) || (v.length >= 4 && w.indexOf(v) === 0); }); }).length;
    var nota = hits / Math.max(A.length, Math.min(B.length, A.length + 1));
    /* tamanho de embalagem diferente (200ml x 1,5L) é outro produto */
    function tam(l) { return l.filter(function (w) { return /^\d+(p\d+)?(ml|l|g|kg)$/.test(w); }); }
    var ta = tam(A), tb = tam(B);
    if (ta.length && tb.length && !ta.some(function (x) { return tb.indexOf(x) >= 0; })) nota *= 0.5;
    return nota;
  }
  /* Nome legível para produto novo: tira o "kg" da balança, expande abreviações comuns do cupom e capitaliza */
  var EXPANDE = { refrig: "Refrigerante", min: "Mineral", fgo: "Frango", frgo: "Frango", ling: "Linguiça", tosc: "Toscana", rep: "Refil", liq: "Líquido", cong: "Congelado", agua: "Água", file: "Filé", pao: "Pão", choc: "Chocolate", bisc: "Biscoito", qj: "Queijo", pres: "Presunto", sab: "Sabonete", amac: "Amaciante", deterg: "Detergente", bov: "Bovino", sui: "Suíno", feijao: "Feijão", acucar: "Açúcar", cafe: "Café", limao: "Limão", macarrao: "Macarrão", oleo: "Óleo", sabao: "Sabão", trad: "Tradicional", integ: "Integral" };
  function nomeBonito(t) {
    return String(t).replace(/[\s.]*kg$/i, "").replace(/(\D)\.(?=\S)/g, "$1 ").replace(/\s+/g, " ").trim().split(" ").map(function (w) {
      var k = norm(w).replace(/[^a-z0-9]/g, "");
      if (EXPANDE[k]) return EXPANDE[k];
      if (/^\d/.test(w)) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(" ");
  }
  function categoriaPalpite(t) { var n = norm(t); for (var i = 0; i < CATS_PALAVRAS.length; i++) if (CATS_PALAVRAS[i][1].test(n)) return CATS_PALAVRAS[i][0]; return "Mercearia"; }

  /* Lê o texto copiado da página "Consulta Resumida NFC-e" */
  function lerTextoNota(txt) {
    var t = String(txt || "").replace(/\r/g, "").replace(/\u00a0/g, " ");
    var nota = { itens: [] };
    var ini = t.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var iDoc = ini.findIndex(function (l) { return /DOCUMENTO AUXILIAR/i.test(l); });
    nota.mercado = iDoc >= 0 && ini[iDoc + 1] ? ini[iDoc + 1] : "";
    var cnpj = /CNPJ:\s*([\d./-]+)/i.exec(t); nota.cnpj = cnpj ? cnpj[1].replace(/\D/g, "") : "";
    var end = iDoc >= 0 && ini[iDoc + 3] ? ini[iDoc + 3] : ""; nota.endereco = end.replace(/&#\d+;/g, function (m) { return String.fromCharCode(+m.slice(2, -1)); });
    var re = /([^\n]+?)\s*\(C[óo]digo:\s*([^)]+?)\s*\)\s*\n?\s*Qtde\.?:\s*([\d.,]+)\s*UN:\s*(\w+)\s*Vl\.\s*Unit\.?:\s*([\d.,]+)\s*Vl\.\s*Total\s*\n?\s*([\d.,]+)/gi, m;
    while ((m = re.exec(t))) {
      var u = m[4].toLowerCase(); u = u === "kg" ? "kg" : (u === "l" || u === "lt") ? "l" : "un";
      nota.itens.push({ desc: m[1].trim(), codigo: m[2].trim(), qtd: num(m[3]), un: u, vu: num(m[5]), vt: num(m[6]) });
    }
    function campo(re2) { var x = re2.exec(t); return x ? x[1].trim() : ""; }
    nota.valorTotal = num(campo(/Valor total R\$:?\s*\n?\s*([\d.,]+)/i));
    nota.desconto = num(campo(/Descontos R\$:?\s*\n?\s*([\d.,]+)/i));
    nota.pago = num(campo(/Valor a pagar R\$:?\s*\n?\s*([\d.,]+)/i)) || nota.valorTotal;
    var fp = /Valor pago R\$:?\s*\n?\s*([^\n\d][^\n]*)/i.exec(t); nota.pagamento = fp ? fp[1].trim() : "";
    nota.numero = campo(/N[úu]mero:\s*(\d+)/i); nota.serie = campo(/S[ée]rie:\s*(\d+)/i);
    var em = /Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(t); nota.data = em ? em[3] + "-" + em[2] + "-" + em[1] : "";
    var ch = /Chave de acesso:?\s*\n?\s*([\d\s]{44,60})/i.exec(t); nota.chave = ch ? ch[1].replace(/\D/g, "").slice(0, 44) : "";
    return nota;
  }
  /* Espalha o desconto da nota entre os itens, proporcional ao valor de cada um, para a soma bater com o que foi pago */
  function ratearDesconto(nota) {
    var soma = sum(nota.itens, function (x) { return x.vt; }), d = Math.round((nota.desconto || 0) * 100) / 100;
    nota.itens.forEach(function (x) { x.desc_rateio = 0; });
    if (!d || !soma) return;
    var usado = 0;
    nota.itens.forEach(function (x) { x.desc_rateio = Math.floor(d * x.vt / soma * 100) / 100; usado += x.desc_rateio; });
    var resto = Math.round((d - usado) * 100) / 100, maior = nota.itens.slice().sort(function (a, b) { return b.vt - a.vt; })[0];
    maior.desc_rateio = Math.round((maior.desc_rateio + resto) * 100) / 100;
  }
  function chaveDoLink(link) {
    var m = /[?&]p=(\d{44})/.exec(decodeURIComponent(link || "")) || /(\d{44})/.exec(String(link || "").replace(/\s/g, ""));
    return m ? m[1] : "";
  }

  function painelQR(body) {
    var p = panel("Nota pelo QR Code", "Para notas fiscais de mercado (NFC-e) de São Paulo.");
    var passo1 = h("div", { class: "qrstep" }, h("b", { text: "1. Leia o QR Code da nota" }));
    var cam = h("button", { type: "button", text: "Abrir a câmera" });
    var fotoLab = h("label", { class: "ghostbtn", for: "qr-foto", text: "Ler de uma foto" });
    var foto = h("input", { type: "file", id: "qr-foto", accept: "image/*", capture: "environment", hidden: "" });
    var link = h("input", { type: "url", placeholder: "…ou cole aqui o link do QR Code", "aria-label": "Link do QR Code", autocomplete: "off" });
    var video = h("video", { class: "qrvideo", playsinline: "", muted: "", hidden: "" });
    var qmsg = h("p", { class: "sub", role: "status" });
    passo1.appendChild(h("div", { class: "vfil" }, cam, fotoLab, foto, link));
    passo1.appendChild(video); passo1.appendChild(qmsg);
    var passo2 = h("div", { class: "qrstep", hidden: "" });
    var passo3 = h("div", { class: "qrstep", hidden: "" });
    p.appendChild(passo1); p.appendChild(passo2); p.appendChild(passo3);
    body.appendChild(p);
    var stream = null, url = "";

    function pararCamera() { if (stream) { stream.getTracks().forEach(function (tr) { tr.stop(); }); stream = null; } video.hidden = true; }
    function achou(texto) {
      pararCamera();
      var chave = chaveDoLink(texto);
      if (!/^https?:\/\//.test(texto) || !chave) { qmsg.textContent = "Esse QR Code não parece ser de uma nota fiscal (NFC-e)."; return; }
      url = texto; link.value = texto;
      qmsg.textContent = "QR Code lido: nota " + chave.slice(25, 34).replace(/^0+/, "") + ".";
      mostrarPasso2(chave);
    }
    function decodificar(canvas) {
      var ctx = canvas.getContext("2d"), img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
      return r && r.data;
    }
    cam.onclick = function () {
      qmsg.textContent = "Abrindo a câmera…";
      Promise.all([loadScript(JSQR_JS), navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })]).then(function (r) {
        stream = r[1]; video.srcObject = stream; video.hidden = false; video.play();
        qmsg.textContent = "Aponte para o QR Code da nota.";
        var c = document.createElement("canvas");
        (function loop() {
          if (!stream) return;
          if (video.readyState >= 2) {
            c.width = video.videoWidth; c.height = video.videoHeight; c.getContext("2d").drawImage(video, 0, 0);
            var d = decodificar(c); if (d) { achou(d); return; }
          }
          requestAnimationFrame(loop);
        })();
      }).catch(function () { qmsg.textContent = "Não consegui abrir a câmera. Use “Ler de uma foto” ou cole o link do QR Code."; });
    };
    foto.onchange = function () {
      var f = foto.files && foto.files[0]; if (!f) return;
      qmsg.textContent = "Lendo a foto…";
      loadScript(JSQR_JS).then(function () { return createImageBitmap(f); }).then(function (bmp) {
        var c = document.createElement("canvas"), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        var d = decodificar(c); foto.value = "";
        if (d) achou(d); else qmsg.textContent = "Não achei um QR Code nessa foto. Tente uma foto mais de perto e bem iluminada.";
      }).catch(function () { qmsg.textContent = "Não consegui ler essa foto."; });
    };
    link.addEventListener("change", function () { if (link.value.trim()) achou(link.value.trim()); });

    function mostrarPasso2(chave) {
      passo2.innerHTML = ""; passo2.hidden = false; passo3.hidden = true;
      passo2.appendChild(h("b", { text: "2. Abra a nota e copie o texto da página" }));
      passo2.appendChild(h("ol", { class: "how" },
        h("li", null, "Toque em ", h("b", { text: "Abrir a nota na Fazenda" }), "."),
        h("li", null, "Na página da nota, selecione tudo (no computador ", h("b", { text: "Ctrl+A" }), "; no celular, segure o dedo no texto e toque em ", h("b", { text: "Selecionar tudo" }), ") e copie."),
        h("li", null, "Volte para esta aba e cole no quadro abaixo.")));
      var abrir = h("a", { class: "ghostbtn pri", href: url, target: "_blank", rel: "noopener", text: "Abrir a nota na Fazenda" });
      var area = h("textarea", { class: "qrpaste", rows: "4", placeholder: "Cole aqui o texto da página da nota", "aria-label": "Texto da nota" });
      passo2.appendChild(h("div", { class: "vfil" }, abrir));
      passo2.appendChild(area);
      var aviso = h("p", { class: "sub", role: "status" }); passo2.appendChild(aviso);
      function tentar() {
        var nota = lerTextoNota(area.value);
        if (!nota.itens.length) { aviso.textContent = area.value.trim() ? "Não encontrei os itens nesse texto. Confira se copiou a página inteira da nota." : ""; return; }
        if (nota.chave && chave && nota.chave !== chave) { aviso.textContent = "O texto colado é de outra nota (a chave não bate com o QR Code lido)."; return; }
        nota.chave = nota.chave || chave; area.value = ""; aviso.textContent = "";
        conferir(nota);
      }
      area.addEventListener("paste", function () { setTimeout(tentar, 30); });
      area.addEventListener("input", tentar);
    }

    function conferir(nota) {
      ratearDesconto(nota);
      passo3.innerHTML = ""; passo3.hidden = false;
      passo3.appendChild(h("b", { text: "3. Confira e salve" }));
      var info = h("p", { class: "sub", text: "Carregando seus produtos…" }); passo3.appendChild(info);
      Promise.all([sb.from("mercados").select("id,nome,cnpj").then(ok), sb.from("produtos").select("id,nome,categoria,unidade").order("nome").then(ok),
        sb.from("notas").select("id").eq("chave_nfce", nota.chave).then(ok), sb.from("itens").select("descricao,produto_id").then(ok)]).then(function (r) {
        var mercs = r[0], prods = r[1], jaExiste = r[2].length > 0, apelidos = {};
        r[3].forEach(function (x) { if (x.produto_id) apelidos[norm(x.descricao)] = x.produto_id; });
        info.textContent = "";
        if (jaExiste) { passo3.appendChild(h("p", { class: "qrwarn", text: "Essa nota já está cadastrada na sua conta." })); return; }
        var cats = Object.keys(groupBy(prods, function (x) { return x.categoria; })).sort();
        CATS_PALAVRAS.forEach(function (c) { if (cats.indexOf(c[0]) < 0) cats.push(c[0]); }); cats.sort();
        /* mercado: pelo CNPJ guardado, senão pelo nome parecido */
        var merc = mercs.filter(function (m) { return m.cnpj && m.cnpj === nota.cnpj; })[0] ||
          mercs.map(function (m) { return [m, semelhanca(nota.mercado, m.nome)]; }).sort(function (a, b) { return b[1] - a[1]; }).filter(function (x) { return x[1] >= 0.5; }).map(function (x) { return x[0]; })[0];
        var selMerc = h("select", { "aria-label": "Mercado" }, mercs.map(function (m) { return h("option", { value: m.id, selected: merc && merc.id === m.id ? "" : null, text: m.nome }); }),
          h("option", { value: "novo", selected: merc ? null : "", text: "Novo mercado: " + nomeBonito(nota.mercado) }));
        var soma = Math.round(sum(nota.itens, function (x) { return x.vt; }) * 100) / 100;
        var bate = Math.abs(soma - nota.valorTotal) < 0.02;
        passo3.appendChild(h("div", { class: "qrhead" },
          h("div", null, h("span", { class: "sub", text: "Mercado" }), selMerc),
          h("div", null, h("span", { class: "sub", text: "Data" }), h("b", { text: nota.data ? dataBR(nota.data) : "—" })),
          h("div", null, h("span", { class: "sub", text: "Nota" }), h("b", { text: (nota.numero || "—") + (nota.serie ? " (série " + nota.serie + ")" : "") })),
          h("div", null, h("span", { class: "sub", text: "Pago" }), h("b", { text: money(nota.pago) }), nota.desconto ? h("span", { class: "sub", text: " desconto " + money(nota.desconto) }) : null)));
        passo3.appendChild(h("p", { class: bate ? "qrok" : "qrwarn", text: bate ? "✓ A soma dos " + nota.itens.length + " itens bate com o total da nota (" + money(nota.valorTotal) + ")." : "A soma dos itens (" + money(soma) + ") não bate com o total da nota (" + money(nota.valorTotal) + "). Confira se o texto foi copiado inteiro." }));
        var dl = h("datalist", { id: "qr-prods" }, prods.map(function (x) { return h("option", { value: x.nome }); }));
        passo3.appendChild(dl);
        var linhas = nota.itens.map(function (it) {
          var pid = apelidos[norm(it.desc)], prod = pid && prods.filter(function (x) { return x.id === pid; })[0];
          if (!prod) {
            var best = prods.filter(function (x) { return x.unidade === it.un || it.un === "un"; }).map(function (x) { return [x, semelhanca(it.desc, x.nome)]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
            if (best && best[1] >= 0.6) prod = best[0];
          }
          it.prodNome = prod ? prod.nome : nomeBonito(it.desc);
          it.cat = prod ? prod.categoria : categoriaPalpite(it.desc);
          var inp = h("input", { type: "text", list: "qr-prods", value: it.prodNome, "aria-label": "Produto para " + it.desc });
          var cat = h("select", { "aria-label": "Categoria" }, cats.map(function (c) { return h("option", { value: c, selected: c === it.cat ? "" : null, text: c }); }));
          var tag = h("span", { class: "qrtag" });
          function marcar() {
            var p2 = prods.filter(function (x) { return x.nome === inp.value.trim(); })[0];
            tag.textContent = p2 ? "existente" : "novo"; tag.className = "qrtag " + (p2 ? "old" : "new");
            if (p2) { cat.value = p2.categoria; cat.disabled = true; } else cat.disabled = false;
          }
          inp.addEventListener("input", marcar); marcar();
          it.inp = inp; it.sel = cat;
          return h("div", { class: "qritem" },
            h("div", { class: "qrdesc" }, h("span", { class: "sub", text: it.desc }), h("span", { class: "sub", text: fmtQtd(it.qtd, it.un) + " × " + money(it.vu) + " = " + money(it.vt) })),
            h("div", { class: "qrprod" }, inp, tag), cat);
        });
        passo3.appendChild(h("div", { class: "qrlist" }, linhas));
        passo3.appendChild(h("p", { class: "sub", text: "Produto “existente” entra no histórico de preços dele; “novo” cria um produto. Pode trocar escrevendo outro nome ou escolhendo da lista." }));
        var salvarB = h("button", { type: "button", text: "Salvar nota" }), st3 = h("p", { class: "sub", role: "status" });
        passo3.appendChild(h("div", { class: "vfil" }, salvarB)); passo3.appendChild(st3);
        salvarB.onclick = function () {
          salvarB.disabled = true; st3.textContent = "Salvando…";
          salvarNotaQR(nota, selMerc.value, prods).then(function () {
            st3.textContent = "Nota salva."; return loadRows(true);
          }).then(function () { setTimeout(function () { location.hash = "#mercado/notas"; }, 700); })
            .catch(function (e) { salvarB.disabled = false; st3.textContent = "Não consegui salvar: " + (e.message || e); });
        };
      }).catch(function (e) { info.textContent = "Não consegui carregar seus produtos: " + e.message; });
    }
  }

  function salvarNotaQR(nota, mercadoId, prods) {
    var porNome = {}; prods.forEach(function (x) { porNome[x.nome] = x; });
    var p = Promise.resolve(mercadoId);
    if (mercadoId === "novo") p = sb.from("mercados").insert({ nome: nomeBonito(nota.mercado), cnpj: nota.cnpj || null, cidade: (/,\s*([^,]+?)\s*,\s*([A-Z]{2})\s*$/.exec(nota.endereco) || []).slice(1).join("/") || null }).select("id").single().then(ok).then(function (m) { return m.id; });
    else if (nota.cnpj) p = sb.from("mercados").update({ cnpj: nota.cnpj }).eq("id", mercadoId).is("cnpj", null).then(function () { return mercadoId; });
    var novos = {};
    nota.itens.forEach(function (it) { var n = it.inp.value.trim() || nomeBonito(it.desc); it.prodNome = n; if (!porNome[n] && !novos[n]) novos[n] = { nome: n, categoria: it.sel.value, unidade: it.un }; });
    return p.then(function (mid) {
      mercadoId = mid;
      var lista = Object.values(novos);
      return lista.length ? sb.from("produtos").insert(lista).select("id,nome,categoria,unidade").then(ok).then(function (d) { d.forEach(function (x) { porNome[x.nome] = x; }); }) : null;
    }).then(function () {
      return sb.from("notas").insert({ mercado_id: mercadoId, data: nota.data, numero: nota.numero || null, serie: nota.serie || null, chave_nfce: nota.chave || null,
        forma_pagamento: nota.pagamento || null, total: nota.pago, fonte: "qr", observacao: nota.desconto ? "Desconto de " + money(nota.desconto) + " na nota" : null }).select("id").single().then(ok);
    }).then(function (n) {
      return sb.from("itens").insert(nota.itens.map(function (it) {
        var pr = porNome[it.prodNome];
        return { nota_id: n.id, produto_id: pr ? pr.id : null, descricao: it.desc, categoria: pr ? pr.categoria : it.sel.value, quantidade: it.qtd, unidade: it.un,
          valor_unitario: it.vu, valor_total: Math.round((it.vt - (it.desc_rateio || 0)) * 100) / 100, desconto: it.desc_rateio || 0,
          observacao: it.desc_rateio ? "Desconto da nota rateado: " + money(it.desc_rateio) : null };
      })).then(ok);
    });
  }

  /* ---------- Importar o Excel (aba "Compras") ---------- */
  function viewImportar(body) {
    painelQR(body);
    var p = panel("Importar planilha", "Use o seu controle_mercado.xlsx. Só a aba “Compras” é lida; notas que já estão na conta são puladas, então pode importar de novo sem duplicar.");
    var lab = h("label", { class: "filebtn", for: "mk-file", text: "Escolher o arquivo .xlsx" });
    var inp = h("input", { type: "file", id: "mk-file", accept: ".xlsx,.xls", hidden: "" });
    var out = h("div", { class: "mkimp" });
    p.appendChild(h("div", { class: "vfil" }, lab, inp));
    p.appendChild(out);
    body.appendChild(p);
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      out.innerHTML = ""; out.appendChild(h("p", { class: "sub", text: "Lendo " + f.name + "…" }));
      loadScript(XLSX_JS).then(function () { return f.arrayBuffer(); }).then(function (buf) {
        var wb = window.XLSX.read(buf, { type: "array", cellDates: true });
        var ws = wb.Sheets["Compras"] || wb.Sheets[wb.SheetNames[0]];
        var linhas = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        return planejar(linhas);
      }).then(function (plano) { mostrarPlano(out, plano); inp.value = ""; })
        .catch(function (e) { out.innerHTML = ""; out.appendChild(h("p", { class: "sub", text: "Não consegui ler a planilha: " + (e.message || e) })); inp.value = ""; });
    });
  }
  function isoData(v) {
    if (v instanceof Date) return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0");
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v || "").trim());
    return m ? m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0") : null;
  }
  function num(v) { if (typeof v === "number") return v; var s = String(v || "").replace(/[R$\s]/g, ""); if (/,\d{1,3}$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); return parseFloat(s) || 0; }
  function descontoDe(obs) {
    var t = String(obs || ""), m = /\(R\$\s?([\d.,]+)\s*total\)/i.exec(t) || /Desconto de R\$\s?([\d.,]+)/i.exec(t);
    return m ? num(m[1]) : 0;
  }
  /* Lê as linhas, agrupa por nota e descobre o que ainda não existe na conta */
  function planejar(linhas) {
    var head = (linhas[0] || []).map(function (x) { return norm(x).trim(); });
    function col(re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; }
    var C = { data: col(/^data$/), merc: col(/^mercado/), nf: col(/nota/), cat: col(/^categoria/), item: col(/^item|descri/), qtd: col(/^quantidade|^qtd/), un: col(/^unidade|^unid/), vu: col(/unit/), vt: col(/total/), pag: col(/pagamento/), obs: col(/observ|^obs/) };
    if (C.data < 0 || C.merc < 0 || C.item < 0 || C.vt < 0) throw new Error("não achei as colunas Data, Mercado, Item e Valor Total");
    var itens = [];
    linhas.slice(1).forEach(function (r) {
      var d = isoData(r[C.data]); if (!d || !r[C.item]) return;
      var u = String(r[C.un] || "un").toLowerCase().trim(); if (u !== "kg" && u !== "l") u = "un";
      itens.push({ data: d, mercado: String(r[C.merc]).trim(), nf: r[C.nf] != null ? String(r[C.nf]).trim() : null, categoria: String(r[C.cat] || "Outros").trim(),
        item: String(r[C.item]).trim(), qtd: num(r[C.qtd]) || 1, un: u, vu: num(r[C.vu]), vt: num(r[C.vt]), pag: r[C.pag] ? String(r[C.pag]).trim() : null, obs: r[C.obs] ? String(r[C.obs]).trim() : null });
    });
    var notas = Object.values(groupBy(itens, function (x) { return x.data + "|" + x.mercado + "|" + (x.nf || ""); }));
    return Promise.all([sb.from("mercados").select("id,nome"), sb.from("notas").select("id,mercado_id,numero,data")]).then(function (r) {
      if (r[0].error) throw new Error(r[0].error.message); if (r[1].error) throw new Error(r[1].error.message);
      var mercs = {}; r[0].data.forEach(function (m) { mercs[m.nome] = m.id; });
      var existe = {}; r[1].data.forEach(function (n) { existe[n.mercado_id + "|" + (n.numero || "") + "|" + n.data] = 1; });
      var novas = notas.filter(function (l) { var id = mercs[l[0].mercado]; return !id || !existe[id + "|" + (l[0].nf || "") + "|" + l[0].data]; });
      return { itens: itens, notas: notas, novas: novas, mercs: mercs };
    });
  }
  function mostrarPlano(out, plano) {
    out.innerHTML = "";
    var nItens = sum(plano.novas, function (l) { return l.length; }), total = sum(plano.novas, function (l) { return sum(l, function (x) { return x.vt; }); });
    out.appendChild(h("p", null, h("b", { text: plano.notas.length + " notas " }), "na planilha (" + plano.itens.length + " itens). ",
      plano.novas.length ? h("b", { text: plano.novas.length + " novas" }) : "Nenhuma nova", plano.novas.length ? " para importar: " + nItens + " itens, " + money(total) + "." : ": tudo já está na sua conta."));
    if (!plano.novas.length) return;
    var b = h("button", { type: "button", text: "Importar " + plano.novas.length + " notas" });
    var st2 = h("p", { class: "sub", role: "status" });
    b.onclick = function () {
      b.disabled = true; st2.textContent = "Importando…";
      importar(plano, function (t) { st2.textContent = t; }).then(function (n) {
        st2.textContent = "Pronto: " + n + " notas importadas."; return loadRows(true);
      }).then(function () { setTimeout(function () { location.hash = "#mercado/painel"; }, 900); })
        .catch(function (e) { b.disabled = false; st2.textContent = "Parou com erro: " + (e.message || e) + ". O que já entrou fica salvo; pode tentar de novo que ele pula o que já existe."; });
    };
    out.appendChild(b); out.appendChild(st2);
  }
  function chunks(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
  function ok(r) { if (r.error) throw new Error(r.error.message); return r.data; }
  function importar(plano, status) {
    var novasMercs = Object.keys(groupBy(plano.novas.map(function (l) { return l[0]; }), function (x) { return x.mercado; })).filter(function (m) { return !plano.mercs[m]; });
    var p = Promise.resolve();
    if (novasMercs.length) p = p.then(function () {
      status("Cadastrando mercados…");
      return sb.from("mercados").insert(novasMercs.map(function (m) { var c = /\(([^)]+)\)\s*$/.exec(m); return { nome: m, cidade: c ? c[1] : null }; })).select("id,nome").then(ok)
        .then(function (d) { d.forEach(function (m) { plano.mercs[m.nome] = m.id; }); });
    });
    var prods = {};
    p = p.then(function () { return sb.from("produtos").select("id,nome").then(ok); }).then(function (d) {
      d.forEach(function (x) { prods[x.nome] = x.id; });
      var faltam = {}; plano.novas.forEach(function (l) { l.forEach(function (x) { if (!prods[x.item] && !faltam[x.item]) faltam[x.item] = { nome: x.item, categoria: x.categoria, unidade: x.un }; }); });
      var lista = Object.values(faltam);
      status("Cadastrando " + lista.length + " produtos…");
      return chunks(lista, 400).reduce(function (q, c) { return q.then(function () { return sb.from("produtos").insert(c).select("id,nome").then(ok).then(function (d2) { d2.forEach(function (x) { prods[x.nome] = x.id; }); }); }); }, Promise.resolve());
    });
    var feitas = 0;
    plano.novas.forEach(function (l) {
      p = p.then(function () {
        var f = l[0];
        status("Importando nota " + (feitas + 1) + " de " + plano.novas.length + "…");
        return sb.from("notas").insert({ mercado_id: plano.mercs[f.mercado], data: f.data, numero: f.nf, forma_pagamento: f.pag, total: Math.round(sum(l, function (x) { return x.vt; }) * 100) / 100, fonte: "excel" }).select("id").single().then(ok)
          .then(function (n) {
            return sb.from("itens").insert(l.map(function (x) { return { nota_id: n.id, produto_id: prods[x.item] || null, descricao: x.item, categoria: x.categoria, quantidade: x.qtd, unidade: x.un, valor_unitario: x.vu, valor_total: x.vt, desconto: descontoDe(x.obs), observacao: x.obs }; })).then(ok);
          }).then(function () { feitas++; });
      });
    });
    return p.then(function () { return feitas; });
  }

  function svgCart() {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>';
    return s;
  }

  window.RACmercado = { render: render };
})();
