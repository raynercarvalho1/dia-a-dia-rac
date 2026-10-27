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
  var st = { mes: null, q: "", prod: null, ord: { k: "var", d: -1 }, pmes: "" };

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
    /* redesenhar não pode pular a rolagem: senão o 2º clique cai em outro quadro */
    var y = window.scrollY, r = root(); r.innerHTML = "";
    var bar = h("div", { class: "mkbar" });
    var tabs = h("div", { class: "pills mkpills", "aria-label": "Mercado" });
    /* "Adicionar nota" fica fora das abas, como botão de destaque no topo */
    VIEWS.forEach(function (x) { if (x[0] !== "importar") tabs.appendChild(h("a", { href: "#mercado/" + x[0], "aria-current": x[0] === v ? "page" : null, text: x[1] })); });
    var add = h("a", { class: "mkadd", href: "#mercado/importar", "aria-current": v === "importar" ? "page" : null }, h("span", { "aria-hidden": "true", text: "+" }), " Adicionar nota");
    var out = h("button", { type: "button", class: "ghostbtn", text: "Sair" });
    out.onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
    bar.appendChild(add); bar.appendChild(tabs); bar.appendChild(h("div", { class: "mkuser" }, h("span", { class: "sub", text: user.email }), out));
    r.appendChild(bar);
    var body = h("div", { class: "stack" }); r.appendChild(body);
    if (!rows.length && v !== "importar") {
      body.appendChild(h("div", { class: "panel" }, h("p", { class: "empty" }, "Ainda não há compras na sua conta. ", h("a", { class: "link", href: "#mercado/importar", text: "Importe o seu Excel" }), " para começar.")));
      return;
    }
    ({ painel: viewPainel, precos: viewPrecos, notas: viewNotas, produtos: viewProdutos, importar: viewImportar })[v](body);
    window.scrollTo(0, y);
  }

  /* ---------- Painel ---------- */
  function semCidade(n) { return String(n || "").replace(/\s*\(.*\)$/, ""); }
  function viewPainel(body) {
    var meses = Object.keys(groupBy(rows, function (x) { return x.mk; })).sort();
    if (!st.mes || meses.indexOf(st.mes) < 0) st.mes = meses[meses.length - 1];
    var doMes = rows.filter(function (x) { return x.mk === st.mes; });
    var i = meses.indexOf(st.mes), ant = i > 0 ? rows.filter(function (x) { return x.mk === meses[i - 1]; }) : [];
    var total = sum(doMes, function (x) { return x.valor_total; }), totAnt = sum(ant, function (x) { return x.valor_total; });
    var notasMes = groupBy(doMes, function (x) { return x.nota; }), notas = Object.keys(notasMes).length;
    var desc = sum(doMes, function (x) { return x.desconto || 0; });
    if (st.pick && st.pick.mes !== st.mes) st.pick = null;

    var seg = h("div", { class: "seg mkmeses", role: "group", "aria-label": "Mês" });
    meses.slice(-12).forEach(function (k) {
      var b = h("button", { type: "button", "aria-pressed": k === st.mes ? "true" : "false", text: mesCurto(k) });
      b.onclick = function () { st.mes = k; st.kpiNota = null; drawApp("painel"); };
      seg.appendChild(b);
    });
    body.appendChild(seg);

    /* compras do mês por mercado (quantas e quanto), usadas no número de compras e no quadro "Por mercado" */
    var porMercado = Object.entries(groupBy(Object.values(notasMes).map(function (l) { return l[0]; }), function (x) { return x.mercado; }))
      .map(function (e) { var its = doMes.filter(function (x) { return x.mercado === e[0]; }); return { m: e[0], n: e[1].length, t: sum(its, function (x) { return x.valor_total; }) }; })
      .sort(function (a, b) { return b.t - a.t; });

    var delta = totAnt ? (total - totAnt) / totAnt : null;
    /* os quadros do topo abrem o detalhe: os três do mês mostram as compras do mês; o total mostra mês a mês */
    /* abre e fecha no lugar, sem redesenhar a página: redesenhar mexia na rolagem e o 2º clique caía em outro quadro */
    var kdet = h("div"), kbtns = [];
    function mostrarKpi() {
      kbtns.forEach(function (x) { x[0].setAttribute("aria-pressed", String(st.kpi === x[1])); });
      kdet.innerHTML = "";
      if (st.kpi === "mes") kdet.appendChild(comprasDoMes(notasMes, total, function () { st.kpi = null; mostrarKpi(); }));
      if (st.kpi === "total") kdet.appendChild(totalPorMes(meses, function () { st.kpi = null; mostrarKpi(); }));
    }
    function abrir(qual) { return function () { st.kpi = st.kpi === qual ? null : qual; st.kpiNota = null; mostrarKpi(); }; }
    var kCompras = kpi("Compras no mês", String(notas), notas ? "média de " + money(total / notas) + " por compra" : "", "", abrir("mes"), st.kpi === "mes");
    kCompras.appendChild(h("div", { class: "kmerc" }, porMercado.map(function (x) { return h("span", { text: semCidade(x.m).split(" ")[0] + " " + x.n }); })));
    body.appendChild(h("div", { class: "kpis" },
      kpi("Gasto em " + mesNome(st.mes), money(total), delta === null ? "primeiro mês registrado" : (delta >= 0 ? "▲ " : "▼ ") + PCT.format(Math.abs(delta)) + " vs " + MESES[+meses[i - 1].slice(5) - 1], delta === null ? "" : delta > 0 ? "up" : "down", abrir("mes"), st.kpi === "mes"),
      kCompras,
      kpi("Itens comprados", String(doMes.length), desc ? money(desc) + " em descontos" : "sem descontos registrados", "", abrir("mes"), st.kpi === "mes"),
      kpi("Total desde " + mesNome(meses[0]).split(" ")[0], money(sum(rows, function (x) { return x.valor_total; })), meses.length + (meses.length === 1 ? " mês" : " meses"), "", abrir("total"), st.kpi === "total")));
    body.querySelectorAll(".kbtn").forEach(function (b, n) { kbtns.push([b, n === 3 ? "total" : "mes"]); });
    body.appendChild(kdet); mostrarKpi();

    body.appendChild(ultimaCompra());

    /* linha 1: onde foram as compras + mês a mês */
    var g1 = h("div", { class: "mkgrid" });
    var pmk = panel("Por mercado", "Clique num mercado para ver as compras de " + MESES[+st.mes.slice(5) - 1]);
    pmk.appendChild(hbars(porMercado.map(function (x) { return [x.m, x.t, semCidade(x.m), x.n + (x.n === 1 ? " compra" : " compras")]; }), total, "mercado"));
    /* o detalhe abre logo abaixo do quadro clicado, na mesma coluna */
    g1.appendChild(h("div", { class: "mkcol" }, pmk, st.pick && st.pick.tipo === "mercado" ? detalhe(doMes) : null));
    var porMes = meses.map(function (k) { return [k, sum(rows.filter(function (x) { return x.mk === k; }), function (x) { return x.valor_total; })]; });
    var pm = panel("Mês a mês", "Clique numa coluna para ver o mês");
    pm.appendChild(vbars(porMes.slice(-12), st.mes));
    g1.appendChild(pm);
    body.appendChild(g1);

    /* linha 2: categorias + produtos que mais pesaram */
    var g2 = h("div", { class: "mkgrid" });
    var porCat = Object.entries(groupBy(doMes, function (x) { return x.categoria; })).map(function (e) { return [e[0], sum(e[1], function (x) { return x.valor_total; })]; }).sort(function (a, b) { return b[1] - a[1]; });
    var pc = panel("Por categoria", "Clique numa categoria para ver os itens");
    pc.appendChild(hbars(porCat, total, "categoria"));
    g2.appendChild(h("div", { class: "mkcol" }, pc, st.pick && st.pick.tipo === "categoria" ? detalhe(doMes) : null));
    var porProd = agruparProdutos(doMes).slice(0, 10);
    var pp = panel("O que mais pesou", "Os 10 produtos com maior gasto no mês. Clique para ver o histórico de preço.");
    pp.appendChild(listaProdutos(porProd));
    g2.appendChild(pp);
    body.appendChild(g2);
    /* voltando do gráfico de um produto: volta para o mesmo ponto do painel */
    if (st.voltarY != null) { var y = st.voltarY; st.voltarY = null; setTimeout(function () { window.scrollTo(0, y); }, 0); }
  }
  function agruparProdutos(l) {
    return Object.entries(groupBy(l, function (x) { return x.produto; })).map(function (e) {
      return { p: e[0], t: sum(e[1], function (x) { return x.valor_total; }), q: sum(e[1], function (x) { return x.quantidade; }), n: e[1].length, u: e[1][0].unidade, c: e[1][0].categoria };
    }).sort(function (a, b) { return b.t - a.t; });
  }
  /* Lista de produtos (nome, quantidade e total) que quebra linha em vez de cortar; cada um abre o histórico de preço */
  function listaProdutos(l) {
    return h("div", { class: "plst" }, l.map(function (x) {
      var b = h("button", { type: "button", class: "plr", title: "Ver o histórico de preço de " + x.p },
        h("span", { class: "pln" }, h("b", { text: x.p }), h("span", { class: "sub", text: x.c })),
        h("span", { class: "plq", text: fmtQtd(x.q, x.u) }),
        h("span", { class: "plt", text: money(x.t) }));
      b.onclick = function () { st.prod = x.p; st.q = ""; st.voltar = true; st.voltarY = window.scrollY; location.hash = "#mercado/precos"; };
      return b;
    }));
  }
  /* Quadro com a compra mais recente: mercado, data, total e todos os itens do mais caro para o mais barato */
  function ultimaCompra() {
    var porNota = groupBy(rows, function (x) { return x.nota; });
    var ult = Object.values(porNota).sort(function (a, b) { return b[0].data.localeCompare(a[0].data) || (b[0].id < a[0].id ? -1 : 1); })[0];
    var p = h("div", { class: "panel" });
    if (!ult) return p;
    var f = ult[0], tot = sum(ult, function (x) { return x.valor_total; });
    p.appendChild(h("div", { class: "ulhead" },
      h("div", null, h("h2", { text: "Última compra" }), h("p", { class: "sub", text: semCidade(f.mercado) + " · " + dataBR(f.data) + " · " + ult.length + " itens" + (f.forma_pagamento ? " · " + f.forma_pagamento : "") })),
      h("b", { class: "ultot", text: money(tot) })));
    p.appendChild(listaProdutos(agruparProdutos(ult)));
    return p;
  }
  /* Detalhe aberto ao clicar numa barra de mercado ou de categoria */
  function detalhe(doMes) {
    var k = st.pick, mesTxt = MESES[+st.mes.slice(5) - 1];
    var fechar = h("button", { type: "button", class: "ghostbtn", text: "Fechar" });
    fechar.onclick = function () { st.pick = null; drawApp("painel"); };
    var p = h("div", { class: "panel mkdet" });
    if (k.tipo === "categoria") {
      var its = doMes.filter(function (x) { return x.categoria === k.valor; });
      p.appendChild(h("div", { class: "ulhead" }, h("div", null, h("h2", { text: k.valor + " em " + mesTxt }), h("p", { class: "sub", text: its.length + " itens · " + money(sum(its, function (x) { return x.valor_total; })) })), fechar));
      p.appendChild(listaProdutos(agruparProdutos(its)));
    } else {
      var lm = doMes.filter(function (x) { return x.mercado === k.valor; });
      var compras = Object.values(groupBy(lm, function (x) { return x.nota; })).sort(function (a, b) { return b[0].data.localeCompare(a[0].data); });
      p.appendChild(h("div", { class: "ulhead" }, h("div", null, h("h2", { text: semCidade(k.valor) + " em " + mesTxt }), h("p", { class: "sub", text: compras.length + (compras.length === 1 ? " compra" : " compras") + " · " + money(sum(lm, function (x) { return x.valor_total; })) })), fechar));
      compras.forEach(function (l) {
        var d = h("details", { class: "mknota" },
          h("summary", null, h("span", { class: "when", text: dataBR(l[0].data) }), h("span", { class: "mkn" }, h("span", { class: "sub", text: l.length + " itens" })), h("b", { class: "mkt", text: money(sum(l, function (x) { return x.valor_total; })) })),
          listaProdutos(agruparProdutos(l)));
        p.appendChild(d);
      });
    }
    return p;
  }
  function kpi(label, value, note, cls, onclick, ativo) {
    var k = h(onclick ? "button" : "div", { class: "panel kpi" + (onclick ? " kbtn" : ""), type: onclick ? "button" : null, "aria-pressed": onclick ? String(!!ativo) : null },
      h("span", { class: "kl", text: label }), h("b", { class: "kv", text: value }), note ? h("span", { class: "kn " + (cls || ""), text: note }) : null);
    if (onclick) k.onclick = onclick;
    return k;
  }
  /* Detalhe dos quadros do mês: cada compra num bloco (data, mercado, itens, desconto, total); clicar no bloco mostra os itens */
  function comprasDoMes(notasMes, total, aoFechar) {
    var mesTxt = MESES[+st.mes.slice(5) - 1];
    var compras = Object.values(notasMes).sort(function (a, b) { return b[0].data.localeCompare(a[0].data) || (b[0].id < a[0].id ? -1 : 1); });
    var fechar = h("button", { type: "button", class: "ghostbtn", text: "Fechar" });
    fechar.onclick = function () { st.kpiNota = null; aoFechar(); };
    var p = h("div", { class: "panel mkdet" });
    p.appendChild(h("div", { class: "ulhead" }, h("div", null, h("h2", { text: "Compras de " + mesTxt }), h("p", { class: "sub", text: compras.length + (compras.length === 1 ? " compra" : " compras") + " · " + money(total) + " · clique numa compra para ver os itens" })), fechar));
    var grade = h("div", { class: "kblocos" }), itens = h("div"), blocos = [];
    /* mostra os itens da compra escolhida logo abaixo dos blocos, sem redesenhar */
    function mostrarItens() {
      blocos.forEach(function (x) { x[0].setAttribute("aria-pressed", String(x[1] === st.kpiNota)); });
      itens.innerHTML = "";
      var aberta = compras.filter(function (l) { return l[0].nota === st.kpiNota; })[0];
      if (!aberta) return;
      itens.appendChild(h("h3", { class: "dayh", text: semCidade(aberta[0].mercado) + " · " + dataBR(aberta[0].data) }));
      itens.appendChild(listaProdutos(agruparProdutos(aberta)));
    }
    compras.forEach(function (l) {
      var f = l[0], tot = sum(l, function (x) { return x.valor_total; }), dsc = sum(l, function (x) { return x.desconto || 0; });
      var b = h("button", { type: "button", class: "kbloco", "aria-pressed": "false" },
        h("span", { class: "kbd", text: dataBR(f.data) }),
        h("b", { class: "kbm", text: semCidade(f.mercado) }),
        h("b", { class: "kbt", text: money(tot) }),
        h("span", { class: "sub", text: l.length + (l.length === 1 ? " item" : " itens") + (dsc ? " · " + money(dsc) + " de desconto" : "") + (f.forma_pagamento ? " · " + f.forma_pagamento : "") }));
      b.onclick = function () { st.kpiNota = st.kpiNota === f.nota ? null : f.nota; mostrarItens(); };
      blocos.push([b, f.nota]);
      grade.appendChild(b);
    });
    p.appendChild(grade); p.appendChild(itens); mostrarItens();
    return p;
  }
  /* Detalhe do total acumulado: um bloco por mês; clicar leva ao painel daquele mês já com as compras abertas */
  function totalPorMes(meses, aoFechar) {
    var fechar = h("button", { type: "button", class: "ghostbtn", text: "Fechar" });
    fechar.onclick = aoFechar;
    var p = h("div", { class: "panel mkdet" });
    p.appendChild(h("div", { class: "ulhead" }, h("div", null, h("h2", { text: "Mês a mês desde " + mesNome(meses[0]) }), h("p", { class: "sub", text: "Clique num mês para ver as compras dele" })), fechar));
    var grade = h("div", { class: "kblocos" });
    meses.slice().reverse().forEach(function (k) {
      var l = rows.filter(function (x) { return x.mk === k; }), n = Object.keys(groupBy(l, function (x) { return x.nota; })).length, t = sum(l, function (x) { return x.valor_total; });
      var b = h("button", { type: "button", class: "kbloco", "aria-pressed": String(k === st.mes) },
        h("b", { class: "kbm", text: mesNome(k) }),
        h("b", { class: "kbt", text: money(t) }),
        h("span", { class: "sub", text: n + (n === 1 ? " compra" : " compras") + " · " + l.length + " itens · média de " + money(n ? t / n : 0) }));
      b.onclick = function () { st.mes = k; st.kpi = "mes"; st.kpiNota = null; drawApp("painel"); };
      grade.appendChild(b);
    });
    p.appendChild(grade);
    return p;
  }
  function fmtQtd(q, u) { return u === "kg" ? q.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " kg" : Math.round(q * 1000) / 1000 + (u === "l" ? " L" : " un"); }
  /* Barras horizontais de uma série só: rótulo, barra proporcional ao maior valor, valor e % do total.
     Cada barra é um botão: abre o detalhe daquele mercado/categoria no mês (clicar de novo fecha). */
  function hbars(list, total, tipo) {
    var max = Math.max.apply(null, list.map(function (x) { return x[1]; }).concat([1]));
    return h("div", { class: "hbars" }, list.map(function (x) {
      var on = st.pick && st.pick.tipo === tipo && st.pick.valor === x[0];
      var b = h("button", { type: "button", class: "hb" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false", title: (x[2] || x[0]) + ": " + money(x[1]) + " (" + PCT.format(x[1] / (total || 1)) + ")" },
        h("span", { class: "hbl" }, x[2] || x[0], x[3] ? h("small", { text: x[3] }) : null),
        h("span", { class: "hbt" }, h("span", { class: "hbf", style: "width:" + (x[1] / max * 100).toFixed(1) + "%" })),
        h("span", { class: "hbv" }, money(x[1]), h("small", { text: " " + PCT.format(x[1] / (total || 1)) })));
      b.onclick = function () { st.pick = on ? null : { tipo: tipo, valor: x[0], mes: st.mes }; drawApp("painel"); };
      return b;
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
  /* rs: as compras consideradas (todas, ou só as de um mês) */
  function produtos(rs) {
    return Object.entries(groupBy(rs || rows, function (x) { return x.produto; })).map(function (e) {
      var l = e[1].slice().sort(function (a, b) { return a.data.localeCompare(b.data); });
      var ult = l[l.length - 1], pri = l[0], pen = l.length > 1 ? l[l.length - 2] : null;
      var precos = l.map(function (x) { return x.valor_unitario; });
      return { nome: e[0], cat: ult.categoria, u: ult.unidade, compras: l, ult: ult, pri: pri,
        varTotal: pri.valor_unitario ? (ult.valor_unitario - pri.valor_unitario) / pri.valor_unitario : 0,
        varUlt: pen && pen.valor_unitario ? (ult.valor_unitario - pen.valor_unitario) / pen.valor_unitario : 0,
        min: Math.min.apply(null, precos), max: Math.max.apply(null, precos),
        mercados: Object.keys(groupBy(l, function (x) { return x.mercado; })).length,
        /* quanto já foi gasto nesse produto desde a primeira compra (valor pago, já sem desconto) */
        gasto: sum(l, function (x) { return x.valor_total; }), qtd: sum(l, function (x) { return x.quantidade; }) };
    });
  }
  /* Ordenação da lista: clicando no cabeçalho (como no Excel) ou pelos atalhos do seletor. d: 1 = menor para maior, -1 = maior para menor */
  var ATALHOS = [["alta", "Mais subiram", "var", -1], ["baixa", "Mais baixaram", "var", 1], ["gasto", "Mais gasto", "gasto", -1], ["compras", "Mais comprados", "compras", -1], ["nome", "Nome (A a Z)", "nome", 1]];
  var COLS = [["nome", "Produto"], ["ult", "Último preço"], ["min", "Menor preço"], ["var", "Variação"], ["compras", "Compras"], ["gasto", "Total gasto"]];
  function valorCol(p, k) { return k === "ult" ? p.ult.valor_unitario : k === "pri" ? p.pri.valor_unitario : k === "min" ? p.min : k === "var" ? (p.compras.length > 1 ? p.varTotal : null) : k === "compras" ? p.compras.length : k === "gasto" ? p.gasto : p.nome; }
  /* menor preço já pago; passando o mouse mostra quando e onde */
  function menorPreco(p) {
    var x = p.compras.filter(function (c) { return c.valor_unitario === p.min; }).sort(function (a, b) { return b.data.localeCompare(a.data); })[0];
    return h("span", { title: x ? dataBR(x.data) + " · " + x.mercado.replace(/\s*\(.*\)$/, "") : null, text: money(p.min) + (p.u === "kg" ? "/kg" : "") });
  }
  function viewPrecos(body) {
    /* "all" é sempre o histórico inteiro (gráfico); a lista usa o período escolhido */
    var all = produtos(), meses = Object.keys(groupBy(rows, function (x) { return x.mk; })).sort().reverse();
    if (st.pmes && meses.indexOf(st.pmes) < 0) st.pmes = "";
    var top = h("div", { class: "panel" },
      h("h2", { text: "Preços ao longo do tempo" }),
      h("p", { class: "sub", text: "Preço por unidade (ou por kg) em cada compra. Clique num produto para ver o gráfico e onde saiu mais barato." }));
    var tools = h("div", { class: "vfil" });
    var q = h("input", { type: "search", placeholder: "Buscar produto", "aria-label": "Buscar produto", value: st.q, autocomplete: "off" });
    var sort = h("select", { "aria-label": "Ordenar" },
      [["", "Pela coluna escolhida"]].concat(ATALHOS).map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
    function marcarAtalho() { var a = ATALHOS.filter(function (o) { return o[2] === st.ord.k && o[3] === st.ord.d; })[0]; sort.value = a ? a[0] : ""; sort.options[0].hidden = !!a; }
    marcarAtalho();
    var per = h("select", { "aria-label": "Período" }, h("option", { value: "", text: "Desde o início" }),
      meses.map(function (k) { return h("option", { value: k, selected: st.pmes === k ? "" : null, text: mesNome(k).charAt(0).toUpperCase() + mesNome(k).slice(1) }); }));
    tools.appendChild(q); tools.appendChild(per); tools.appendChild(sort); top.appendChild(tools);
    body.appendChild(top);
    var detail = h("div"); body.appendChild(detail);
    var list = h("div", { class: "panel" }); body.appendChild(list);
    function draw() {
      var nq = norm(st.q), base = st.pmes ? produtos(rows.filter(function (x) { return x.mk === st.pmes; })) : all;
      var l = base.filter(function (p) { return !nq || norm(p.nome + " " + p.cat).indexOf(nq) >= 0; });
      var k = st.ord.k, d = st.ord.d;
      /* quem não tem valor (variação de produto comprado uma vez só) fica sempre no fim */
      l.sort(function (a, b) {
        var x = valorCol(a, k), y = valorCol(b, k);
        if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * d || a.nome.localeCompare(b.nome);
      });
      list.innerHTML = "";
      list.appendChild(h("p", { class: "sub", text: l.length + (l.length === 1 ? " produto" : " produtos") + (!l.length ? "" : " · " + money(sum(l, function (p) { return p.gasto; })) + " gastos" + (nq ? " nesses produtos" : "") + (st.pmes ? " em " + mesNome(st.pmes) : " desde " + dataBR(l.reduce(function (m, p) { return p.pri.data < m ? p.pri.data : m; }, "9999-12-31")))) }));
      var tb = tabela(COLS.map(function (c) { return c[0] === "gasto" && st.pmes ? "Gasto no mês" : c[1]; }), l.map(function (p) {
        var b = h("button", { type: "button", class: "mkprod", text: p.nome }); b.onclick = function () { st.prod = p.nome; st.voltar = false; st.voltarY = null; showProd(); window.scrollTo({ top: 0, behavior: "smooth" }); };
        return [h("span", null, b, h("span", { class: "sub", text: " · " + p.cat })), money(p.ult.valor_unitario) + (p.u === "kg" ? "/kg" : ""), menorPreco(p), varTag(p.compras.length > 1 ? p.varTotal : null), String(p.compras.length), h("b", { text: money(p.gasto) })];
      }), 1);
      /* cabeçalhos clicáveis: 1º clique do menor para o maior (nome de A a Z), o 2º inverte */
      tb.querySelectorAll("th").forEach(function (th, i) {
        var c = COLS[i][0], ativo = c === k;
        th.classList.add("ordcol"); if (ativo) th.classList.add("on");
        th.setAttribute("aria-sort", ativo ? (d === 1 ? "ascending" : "descending") : "none");
        th.tabIndex = 0; th.title = "Ordenar por " + th.textContent.toLowerCase() +
          (c === "var" ? ". Variação do 1º ao último preço " + (st.pmes ? "de " + mesNome(st.pmes) : "desde a primeira compra") : "");
        th.appendChild(h("span", { class: "ordseta", "aria-hidden": "true", text: ativo ? (d === 1 ? " ▲" : " ▼") : " ↕" }));
        function ordenar() { st.ord = { k: c, d: ativo ? -d : 1 }; marcarAtalho(); draw(); }
        th.onclick = ordenar; th.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ordenar(); } };
      });
      tb.classList.add("tblprec");
      list.appendChild(tb);
    }
    function showProd() {
      detail.innerHTML = "";
      var p = all.filter(function (x) { return x.nome === st.prod; })[0];
      if (!p) return;
      var d = panel(p.nome, p.cat + " · " + p.compras.length + (p.compras.length === 1 ? " compra" : " compras") + " · preço " + (p.u === "kg" ? "por kg" : "por unidade"));
      d.appendChild(h("div", { class: "kgasto" },
        h("div", null, h("span", { class: "kl", text: "Total gasto desde " + dataBR(p.pri.data) }), h("b", { class: "kv", text: money(p.gasto) })),
        h("div", null, h("span", { class: "kl", text: "Quantidade comprada" }), h("b", { class: "kv", text: fmtQtd(p.qtd, p.u) })),
        h("div", null, h("span", { class: "kl", text: "Média por compra" }), h("b", { class: "kv", text: money(p.gasto / p.compras.length) })),
        st.pmes ? h("div", null, h("span", { class: "kl", text: "Gasto em " + mesNome(st.pmes) }), h("b", { class: "kv", text: money(sum(p.compras.filter(function (x) { return x.mk === st.pmes; }), function (x) { return x.valor_total; })) })) : null));
      d.appendChild(lineChart(p));
      var porMerc = Object.entries(groupBy(p.compras, function (x) { return x.mercado; })).map(function (e) {
        var l = e[1].slice().sort(function (a, b) { return a.data.localeCompare(b.data); }), u = l[l.length - 1];
        return [e[0].replace(/\s*\(.*\)$/, ""), Math.min.apply(null, l.map(function (x) { return x.valor_unitario; })), u.valor_unitario, dataBR(u.data)];
      }).sort(function (a, b) { return a[2] - b[2]; });
      if (porMerc.length > 1) {
        d.appendChild(h("h3", { class: "dayh", text: "Onde saiu mais barato" }));
        d.appendChild(tabela(["Mercado", "Menor preço", "Último preço", "Última compra"], porMerc.map(function (m) { return [m[0], money(m[1]), money(m[2]), m[3]]; }), 1));
      }
      /* quem veio do painel volta para o painel ao fechar */
      var fechar = h("button", { type: "button", class: "ghostbtn", text: st.voltar ? "Fechar e voltar ao painel" : "Fechar gráfico" });
      fechar.onclick = function () {
        st.prod = null; detail.innerHTML = "";
        if (st.voltar) { st.voltar = false; location.hash = "#mercado/painel"; } else st.voltarY = null;
      };
      d.appendChild(h("div", { class: "vfoot" }, fechar));
      detail.appendChild(d);
    }
    /* pesquisar fecha o gráfico aberto (ex.: o que veio do painel) para a lista ficar logo abaixo da busca */
    q.addEventListener("input", function () {
      st.q = q.value;
      if (st.prod) { st.prod = null; st.voltar = false; st.voltarY = null; detail.innerHTML = ""; }
      draw();
    });
    sort.addEventListener("change", function () { var a = ATALHOS.filter(function (o) { return o[0] === sort.value; })[0]; if (a) { st.ord = { k: a[2], d: a[3] }; marcarAtalho(); draw(); } });
    per.addEventListener("change", function () { st.pmes = per.value; draw(); showProd(); });
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
    /* balão com o dia e o detalhe da compra: aparece ao passar o mouse e fica fixo ao tocar/clicar */
    var wrap = h("div", { class: "lwrap" }, svg), dica = h("div", { class: "ldica", hidden: true }), fixo = null;
    wrap.appendChild(dica);
    function mostrar(q, c) {
      dica.innerHTML = "";
      dica.appendChild(h("b", { text: dataBR(q.x.data) }));
      dica.appendChild(h("span", { text: money(q.v) + (p.u === "kg" ? "/kg" : "") + " · " + q.x.mercado.replace(/\s*\(.*\)$/, "") }));
      dica.hidden = false;
      var rw = wrap.getBoundingClientRect(), rc = c.getBoundingClientRect();
      var x = rc.left + rc.width / 2 - rw.left + wrap.scrollLeft, y = rc.top - rw.top;
      dica.style.left = Math.max(4, Math.min(x - dica.offsetWidth / 2, wrap.scrollWidth - dica.offsetWidth - 4)) + "px";
      dica.style.top = (y - dica.offsetHeight - 10 < 0 ? y + rc.height + 10 : y - dica.offsetHeight - 10) + "px";
    }
    function esconder() { if (fixo) mostrar(fixo.q, fixo.c); else dica.hidden = true; }
    pts.forEach(function (q, i) {
      var c = s("circle", { cx: X(q.t), cy: Y(q.v), r: 5, class: "lpt" });
      /* área de toque maior que a bolinha, para o dedo acertar no celular */
      var alvo = s("circle", { cx: X(q.t), cy: Y(q.v), r: 16, class: "lhit", tabindex: 0, role: "button", "aria-label": dataBR(q.x.data) + ", " + money(q.v) + ", " + q.x.mercado });
      alvo.addEventListener("mouseenter", function () { c.classList.add("on"); mostrar(q, c); });
      alvo.addEventListener("mouseleave", function () { if (!fixo || fixo.c !== c) c.classList.remove("on"); esconder(); });
      alvo.addEventListener("click", function (e) {
        e.stopPropagation();
        if (fixo) fixo.c.classList.remove("on");
        if (fixo && fixo.c === c) { fixo = null; dica.hidden = true; return; }
        fixo = { q: q, c: c }; c.classList.add("on"); mostrar(q, c);
      });
      alvo.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alvo.dispatchEvent(new MouseEvent("click")); } });
      svg.appendChild(c);
      if (i === pts.length - 1) svg.appendChild(s("text", { x: Math.min(X(q.t), W - R - 4), y: Y(q.v) - 12, "text-anchor": "end", class: "llab" }, money(q.v)));
      svg.appendChild(alvo);
    });
    /* tocar fora das bolinhas solta o balão */
    svg.addEventListener("click", function () { if (fixo) { fixo.c.classList.remove("on"); fixo = null; dica.hidden = true; } });
    return wrap;
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

  /* ---------- Nota pela foto do cupom ----------
     A Fazenda de SP não deixa robôs nem outros sites abrirem a nota, e ler a letra de matriz do cupom no navegador
     erra demais. Então a pessoa manda a foto para o Claude, cola a resposta aqui e confere.
     CPF e demais dados do consumidor são ignorados. */
  var ABREV = { refrig: "refrigerante", min: "mineral", fgo: "frango", frgo: "frango", ling: "linguica", tosc: "toscana", rep: "refil", liq: "liquido", cong: "congelado", choc: "chocolate", bisc: "biscoito", qj: "queijo", mus: "mussarela", mussar: "mussarela", pres: "presunto", sab: "sabonete", amac: "amaciante", deterg: "detergente", lav: "lava", pao: "pao", fr: "frances", trad: "tradicional", integ: "integral", desn: "desnatado", sach: "sache", bov: "bovino", sui: "suino", peit: "peito", file: "file", agua: "agua", cerv: "cerveja", lt: "lata" };
  var CATS_PALAVRAS = [
    ["Bebidas", /refrig|coca|guarana|agua|suco|cerveja|cerv|energet|cha |sprite|pepsi|schweppes/],
    ["Açougue/Frios", /carne|bov|acem|miolo|frango|fgo|peito|coxa|lingui|ling\.|presunto|pres\.|mussarela|queijo|salsicha|mortadela|bacon|suin|bisteca|fraldinha|picanha|patinho/],
    ["Peixaria", /peixe|tilapia|salmao|corvina|bacalhau|camarao/],
    ["Hortifruti", /banana|tomate|cebola|batata|alface|limao|uva|maca |mamao|cenoura|abobr|pepino|pimentao|alho|mandioca|laranja|morango|berinjela|couve|\Dkg\)?$/],
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
    return String(t).replace(/(\D)[\s.]*kg$/i, "$1").replace(/(\D)\.(?=\S)/g, "$1 ").replace(/\s+/g, " ").trim().split(" ").map(function (w) {
      var k = norm(w).replace(/[^a-z0-9]/g, "");
      if (EXPANDE[k]) return EXPANDE[k];
      if (/^\d/.test(w)) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(" ");
  }
  function categoriaPalpite(t) { var n = norm(t); for (var i = 0; i < CATS_PALAVRAS.length; i++) if (CATS_PALAVRAS[i][1].test(n)) return CATS_PALAVRAS[i][0]; return "Mercearia"; }

  /* Espalha o desconto da nota entre os itens, proporcional ao valor de cada um, para a soma bater com o que foi pago */
  function ratearDesconto(nota) {
    var soma = sum(nota.itens, function (x) { return x.vt; }), d = Math.round((nota.desconto || 0) * 100) / 100;
    /* desconto que o cupom já diz de qual item é fica nele; o resto é espalhado */
    nota.itens.forEach(function (x) { x.desc_rateio = Math.round((x.descItem || 0) * 100) / 100; });
    d = Math.round((d - sum(nota.itens, function (x) { return x.desc_rateio; })) * 100) / 100;
    if (d <= 0 || !soma) return;
    var usado = 0;
    nota.itens.forEach(function (x) { var k = Math.floor(d * x.vt / soma * 100) / 100; x.desc_rateio = Math.round((x.desc_rateio + k) * 100) / 100; usado += k; });
    var resto = Math.round((d - usado) * 100) / 100, maior = nota.itens.slice().sort(function (a, b) { return b.vt - a.vt; })[0];
    maior.desc_rateio = Math.round((maior.desc_rateio + resto) * 100) / 100;
  }

  /* Pedido que a pessoa cola no Claude junto com a foto; a resposta (JSON) é colada de volta aqui */
  /* itens em lista curta ([descrição, qtd, un, unitário, total, desconto]): resposta menor, que o app termina rápido e copia inteira */
  var PEDIDO = "Leia a foto deste cupom fiscal de supermercado e responda SOMENTE com um bloco de código JSON, sem comentários, neste formato:\n" +
    '{"mercado":"nome do mercado","cnpj":"só números","data":"AAAA-MM-DD","numero":"","serie":"","chave":"44 dígitos da chave de acesso, sem espaços","pagamento":"forma de pagamento","total_pago":0.00,"desconto_nota":0.00,' +
    '"itens":[["descrição como está no cupom",qtd,"un ou kg",valor_unitario,valor_total,desconto]]}\n' +
    "Regras: uma lista por item, na ordem do cupom, sem espaços extras. valor_total é o total da linha antes de desconto. Linha \"Desconto Item\" vai no desconto do item dela (0 se não houver). " +
    "desconto_nota é só desconto geral da nota (0 se não houver). Use ponto como separador decimal. Não inclua CPF nem dados do consumidor. Se não conseguir ler um número, use null.";
  /* JSON que o app devolve nem sempre é perfeito: aspas curvas, vírgula decimal (22,68), vírgula sobrando no fim.
     Se mesmo assim não abrir, pega item por item ({...} com "descricao"). */
  function jsonTolerante(t) {
    t = t.replace(/[\u201C\u201D\u201E\u2033]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u00A0/g, " ");
    function tentar(x) {
      try { return JSON.parse(x); } catch (e) { }
      x = x.replace(/,\s*([}\]])/g, "$1").replace(/:\s*(-?\d+),(\d+)(?=\s*[,}\]])/g, ":$1.$2").replace(/:\s*(?:NaN|undefined)\b/g, ":null");
      try { return JSON.parse(x); } catch (e) { return null; }
    }
    var a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0) return null;
    var j = b > a ? tentar(t.slice(a, b + 1)) : null;
    if (j) return j;
    /* resposta cortada ou com defeito: salva os itens que estiverem inteiros */
    var itens = (t.match(/\{[^{}]*"descri[^{}]*\}/g) || []).map(tentar).filter(Boolean);
    if (!itens.length) itens = (t.match(/\[\s*"[^"]*"\s*,[^\[\]"]*"[^"]*"[^\[\]"]*\]/g) || []).map(tentar).filter(Boolean);
    if (!itens.length) return { cortado: true };
    j = { itens: itens, cortado: true };
    ["mercado", "cnpj", "data", "numero", "serie", "chave", "pagamento"].forEach(function (k) { var m = new RegExp('"' + k + '"\\s*:\\s*"([^"]*)"').exec(t); if (m) j[k] = m[1]; });
    ["total_pago", "desconto_nota"].forEach(function (k) { var m = new RegExp('"' + k + '"\\s*:\\s*(-?\\d+(?:[.,]\\d+)?)').exec(t); if (m) j[k] = num(m[1]); });
    return j;
  }
  function lerResposta(txt) {
    var j = jsonTolerante(String(txt || ""));
    if (!j) return null;
    /* nomes de campo que o app às vezes troca */
    var lista = j.itens || j.items || j.produtos;
    if (!Array.isArray(lista)) return j.cortado ? { cortado: true, itens: [] } : null;
    j.itens = lista.map(function (x) {
      if (Array.isArray(x)) return { descricao: x[0], qtd: x[1], un: x[2], valor_unitario: x[3], valor_total: x[4], desconto: x[5] };
      return { descricao: x.descricao || x["descrição"] || x.nome || x.item || x.produto, qtd: x.qtd != null ? x.qtd : x.quantidade, un: x.un || x.unidade,
        valor_unitario: x.valor_unitario != null ? x.valor_unitario : x.preco_unitario, valor_total: x.valor_total != null ? x.valor_total : x.total, desconto: x.desconto };
    });
    function n2(v) { return v == null ? 0 : typeof v === "number" ? v : num(v); }
    var nota = { fonte: "foto", mercado: String(j.mercado || ""), cnpj: String(j.cnpj || "").replace(/\D/g, ""), numero: String(j.numero || "").replace(/^0+/, ""), serie: String(j.serie || ""),
      chave: String(j.chave || "").replace(/\D/g, ""), pagamento: String(j.pagamento || ""), data: /^\d{4}-\d{2}-\d{2}$/.test(j.data) ? j.data : (isoData(j.data) || "") };
    if (nota.cnpj.length !== 14) nota.cnpj = "";
    if (!/^\d{44}$/.test(nota.chave)) nota.chave = "";
    nota.itens = j.itens.map(function (x) {
      var u = norm(x.un); u = /^k/.test(u) ? "kg" : /^l/.test(u) ? "l" : "un";
      var it = { desc: String(x.descricao || "").trim(), qtd: n2(x.qtd) || 1, un: u, vu: n2(x.valor_unitario), vt: n2(x.valor_total), descItem: Math.abs(n2(x.desconto)) };
      if (!it.vt && it.vu) it.vt = Math.round(it.qtd * it.vu * 100) / 100;
      it.duvida = !it.vt || (it.vu && Math.abs(it.qtd * it.vu - it.vt) > 0.05);
      return it;
    });
    nota.desconto = Math.round((Math.abs(n2(j.desconto_nota)) + sum(nota.itens, function (x) { return x.descItem; })) * 100) / 100;
    nota.pago = n2(j.total_pago) || Math.round((sum(nota.itens, function (x) { return x.vt; }) - nota.desconto) * 100) / 100;
    nota.cortado = !!j.cortado;
    return nota;
  }

  /* Tabela em markdown (| Item | Qtd | Unit. | Total |): acha as colunas pelo cabeçalho, seja qual for a ordem.
     Linha "Desconto no item" vai para o item de cima. */
  function itensDaTabela(txt) {
    var linhas = String(txt || "").replace(/\r/g, "").split("\n").map(function (l) { return l.trim(); });
    var itens = [], col = null;
    function celulas(l) { return l.replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.replace(/\*\*/g, "").trim(); }); }
    function achar(cab, re, menos) { for (var i = 0; i < cab.length; i++) if (re.test(norm(cab[i])) && !(menos && menos.test(norm(cab[i])))) return i; return -1; }
    linhas.forEach(function (l) {
      if (!/^\|.*\|$/.test(l)) { col = null; return; }
      var c = celulas(l);
      if (c.every(function (x) { return /^:?-+:?$/.test(x) || !x; })) return;
      if (!col) {
        var cab = c.map(norm);
        var ci = achar(cab, /item|descri|produto/);
        if (ci < 0) return;
        col = { item: ci, qtd: achar(cab, /qtd|quant/), unit: achar(cab, /unit|preco|pre\. ?un|vl\.? ?un/), total: -1 };
        for (var i = cab.length - 1; i >= 0; i--) if (i !== col.unit && /total|valor/.test(cab[i])) { col.total = i; break; }
        return;
      }
      var nome = c[col.item] || "", tot = col.total >= 0 ? c[col.total] || "" : "";
      if (/desconto/i.test(nome) || (!nome && /desconto/i.test(l))) {
        var dv = /(\d+[.,]\d{2})/.exec(tot || l);
        if (dv && itens.length) itens[itens.length - 1].descItem = (itens[itens.length - 1].descItem || 0) + num(dv[1]);
        return;
      }
      if (!nome || /^(subtotal|total)/i.test(nome)) return;
      var qc = col.qtd >= 0 ? c[col.qtd] || "" : "";
      var qm = /(\d+(?:[.,]\d+)?)\s*(un|und|unid|kg|l|lt|g)?\b(?:\s*[x×*]\s*(?:R\$\s*)?(\d+[.,]\d{2,3}))?/i.exec(qc);
      var u = qm && qm[2] ? qm[2].toLowerCase() : (/kg/i.test(c[col.unit] || "") ? "kg" : "un");
      u = /^k/.test(u) ? "kg" : /^l/.test(u) ? "l" : "un";
      var it = { desc: nome, qtd: qm ? num(qm[1]) || 1 : 1, un: u, vu: num(((col.unit >= 0 ? c[col.unit] : "") || (qm && qm[3]) || "").replace(/\/.*$/, "")), vt: num(tot.replace(/\(.*$/, "")) };
      var dm = /desconto[^\d]{0,15}(\d+[.,]\d{2})/i.exec(tot); if (dm) it.descItem = num(dm[1]);
      if (!it.vt && it.vu) it.vt = Math.round(it.qtd * it.vu * 100) / 100;
      if (!it.vu && it.vt) it.vu = Math.round(it.vt / it.qtd * 100) / 100;
      var bruto = Math.round(it.qtd * it.vu * 100) / 100;
      if (it.descItem && Math.abs(bruto - it.descItem - it.vt) < 0.05) it.vt = bruto;
      it.duvida = !it.vt || Math.abs(bruto - it.vt) > 0.05;
      itens.push(it);
    });
    return itens;
  }
  /* Resposta "normal" do Claude ou do ChatGPT (tabela ou lista), quando a pessoa manda só a foto sem o pedido.
     Cada item tem "qtd un × preço" e, na mesma linha ou na seguinte, o total; a descrição vem antes. */
  function lerTextoLivre(txt) {
    var ls = String(txt || "").replace(/\r/g, "").split("\n").map(function (l) {
      return l.replace(/\*\*/g, "").replace(/\|/g, "  ").replace(/\s+/g, " ").trim();
    }).filter(function (l) { return l && !/^[-:\s]+$/.test(l); });
    var QX = /(\d+(?:[.,]\d+)?)\s*(un|und|unid|kg|l|lt)\.?\s*[x×*]\s*(?:R\$\s*)?(\d+[.,]\d{2,3})/i, DIN = /(\d+[.,]\d{2})(?!\d)/;
    var nota = { itens: itensDaTabela(txt), fonte: "foto" }, usada = {};
    if (!nota.itens.length) ls.forEach(function (l, i) {
      var m = QX.exec(l); if (!m) return;
      var desc = l.slice(0, m.index).replace(/^\d{1,3}[.)]?\s+/, "").replace(/[-–—:]\s*$/, "").trim();
      if (desc.replace(/[^A-Za-zÀ-ú]/g, "").length < 3 && i > 0 && !usada[i - 1] && !QX.test(ls[i - 1])) { desc = ls[i - 1].replace(/^\d{1,3}[.)]?\s+/, "").trim(); usada[i - 1] = 1; }
      usada[i] = 1;
      var resto = l.slice(m.index + m[0].length), tot = DIN.exec(resto.replace(/desconto.*$/i, ""));
      var linhaDesc = resto;
      if (!tot && ls[i + 1] && !QX.test(ls[i + 1])) { tot = DIN.exec(ls[i + 1].replace(/desconto.*$/i, "")); linhaDesc = ls[i + 1]; usada[i + 1] = 1; }
      var u = m[2].toLowerCase(); u = /^k/.test(u) ? "kg" : /^l/.test(u) ? "l" : "un";
      var it = { desc: desc, qtd: num(m[1]) || 1, un: u, vu: num(m[3]) };
      var bruto = Math.round(it.qtd * it.vu * 100) / 100, v = tot ? num(tot[1]) : bruto;
      var dm = /desconto[^\d]{0,15}(\d+[.,]\d{2})/i.exec(linhaDesc), d = dm ? num(dm[1]) : 0;
      /* o total pode vir antes ou depois do desconto: fica o que fechar com qtd × preço */
      if (d && Math.abs(bruto - d - v) < 0.05) v = bruto;
      it.vt = v; it.descItem = d;
      it.duvida = !desc || Math.abs(bruto - v) > 0.05;
      nota.itens.push(it);
    });
    /* lista curta, sem quantidade: "1. Uva Verde 500g — R$ 12,98 (desconto R$ 1,68)". Cada item entra como 1 unidade
       e o valor da lista é o que foi pago (o desconto, se vier, é somado de volta para o total da linha) */
    if (!nota.itens.length) ls.forEach(function (l) {
      var m = /^(?:\d{1,3}[.)]|[-•*])\s*(.+?)\s*(?:[—–:]|\s-)\s*R\$\s*(\d+(?:\.\d{3})*[.,]\d{2})(.*)$/.exec(l);
      if (!m || /^(sub)?total|^desconto|^troco|^valor pago/i.test(m[1])) return;
      var pago = num(m[2]), dm = /desconto[^\d]{0,15}(\d+[.,]\d{2})/i.exec(m[3]), d = dm ? num(dm[1]) : 0;
      var vt = Math.round((pago + d) * 100) / 100;
      nota.itens.push({ desc: m[1].trim(), qtd: 1, un: "un", vu: vt, vt: vt, descItem: d, semQtd: true });
    });
    nota.semQtd = nota.itens.some(function (x) { return x.semQtd; });
    var t = ls.join("\n");
    var em = /(\d{2})\/(\d{2})\/(20\d{2})/.exec(t); nota.data = em ? em[3] + "-" + em[2] + "-" + em[1] : "";
    /* "nota de 25/10", sem o ano: este ano (ou o passado, se a data ainda não chegou) */
    var ed = !em && /\b([0-3]\d)\/([01]\d)\b(?!\/)/.exec(t);
    if (ed) { var ano = new Date().getFullYear(), d0 = ano + "-" + ed[2] + "-" + ed[1]; nota.data = d0 > new Date().toISOString().slice(0, 10) ? (ano - 1) + d0.slice(4) : d0; }
    var tp = /total\s*(?:de|pago|:)?\s*R\$\s*(\d+[.,]\d{2})/i.exec(t) || /total[^R\n]{0,30}\(?R\$\s*(\d+[.,]\d{2})/i.exec(t);
    nota.desconto = Math.round(sum(nota.itens, function (x) { return x.descItem || 0; }) * 100) / 100;
    nota.pago = tp ? num(tp[1]) : Math.round((sum(nota.itens, function (x) { return x.vt; }) - nota.desconto) * 100) / 100;
    var mm = /((?:[Ss]uper|[Hh]iper)?[Mm]ercados?|[Aa]tacad[ãa]o|[Aa]tacarejo)\s+([A-ZÀ-Ú][\wÀ-ú'&-]+(?:\s+[A-ZÀ-Ú][\wÀ-ú'&-]+)?)/.exec(t);
    nota.mercado = mm ? mm[1] + " " + mm[2] : "";
    var cn = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})|CNPJ\D{0,6}(\d{14})/.exec(t); nota.cnpj = cn ? (cn[1] || cn[2]).replace(/\D/g, "") : "";
    var pg = /(cart[ãa]o de cr[ée]dito|cart[ãa]o de d[ée]bito|pix|dinheiro|vale[- ]alimenta[çc][ãa]o)/i.exec(t); nota.pagamento = pg ? pg[1] : "";
    var nn = /(?:n[úu]mero|n[º°o])\.?[:\s]*0*(\d{3,9})/i.exec(t); nota.numero = nn ? nn[1] : "";
    var se = /s[ée]rie[:\s]*0*(\d{1,3})/i.exec(t);
    var ch = /((?:\d{4}\s?){11})/.exec(t.replace(/\n/g, " ")); nota.chave = ch ? ch[1].replace(/\D/g, "") : "";
    if (!/^35\d{42}$/.test(nota.chave)) nota.chave = "";
    nota.serie = se ? se[1] : ""; nota.texto = t;
    return nota;
  }

  function painelFoto(body) {
    var p = panel("Nota pela foto", "O Claude lê a foto do cupom; você cola a resposta aqui e confere antes de salvar.");
    var ia = h("div", { class: "qrstep" });
    var cmsg = h("p", { class: "sub", role: "status" });
    var pedTxt = h("textarea", { class: "qrpaste", rows: "4", readonly: "", hidden: "", "aria-label": "Pedido para copiar" }); pedTxt.value = PEDIDO;
    /* o botão abre a conversa (ou projeto) do Claude que a pessoa usa para as notas, guardada neste aparelho,
       e no mesmo toque copia o pedido: lá é só anexar a foto e colar */
    var CH_LINK = "rac-claude-notas";
    function linkClaude() { try { return localStorage.getItem(CH_LINK) || ""; } catch (e) { return ""; } }
    var abrir = h("a", { class: "filebtn", target: "_blank", rel: "noopener", text: "Abrir o Claude" });
    abrir.onclick = function () {
      try { navigator.clipboard.writeText(PEDIDO).then(function () { cmsg.textContent = "✓ Pedido copiado. No Claude: anexe a foto do cupom, cole o pedido e envie."; }, function () { pedTxt.hidden = false; }); } catch (e) { pedTxt.hidden = false; }
    };
    var trocar = h("button", { type: "button", class: "ghostbtn" });
    var lform = h("div", { class: "vfil", hidden: "" }), lin = h("input", { type: "url", placeholder: "https://claude.ai/project/… ou /chat/…", "aria-label": "Link da conversa do Claude", autocomplete: "off" });
    var lok = h("button", { type: "button", text: "Salvar" }), lmsg = h("p", { class: "sub", role: "status" });
    function mostrarLink() {
      var l = linkClaude();
      abrir.href = l || "https://claude.ai/new";
      abrir.textContent = l ? "Abrir o Claude (sua conversa das notas)" : "Abrir o Claude";
      trocar.textContent = l ? "Trocar a conversa" : "Usar a minha conversa das notas";
    }
    trocar.onclick = function () { lform.hidden = !lform.hidden; lin.value = linkClaude(); lmsg.textContent = ""; if (!lform.hidden) lin.focus(); };
    lok.onclick = function () {
      var v = lin.value.trim();
      if (/claude\.ai\/share\//.test(v)) { lmsg.textContent = "Esse é o link de compartilhar, que abre só uma cópia para leitura. Abra a conversa (ou o projeto) no claude.ai pelo navegador e copie o endereço da barra: começa com claude.ai/chat/ ou claude.ai/project/."; return; }
      if (v && !/^https:\/\/claude\.ai\/(chat|project)\/[\w-]+/.test(v)) { lmsg.textContent = "O link precisa começar com https://claude.ai/chat/ ou https://claude.ai/project/."; return; }
      try { if (v) localStorage.setItem(CH_LINK, v); else localStorage.removeItem(CH_LINK); } catch (e) { }
      lform.hidden = true; lmsg.textContent = v ? "✓ Pronto: o botão agora abre a sua conversa das notas." : "Voltou a abrir uma conversa nova.";
      mostrarLink();
    };
    lform.appendChild(lin); lform.appendChild(lok);
    mostrarLink();
    var resp = h("textarea", { class: "qrpaste", rows: "3", placeholder: "…ou cole aqui a resposta", "aria-label": "Resposta do Claude" });
    var colar = h("button", { type: "button", text: "Colar a resposta" });
    colar.onclick = function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { resp.focus(); return; }
      navigator.clipboard.readText().then(function (t) { resp.value = t; tentarResp(); }, function () { rmsg.textContent = "Toque no quadro abaixo e cole."; resp.focus(); });
    };
    var rmsg = h("p", { class: "sub", role: "status" });
    ia.appendChild(h("ol", { class: "how" },
      h("li", null, "Toque em Abrir o Claude. O pedido já vai copiado."),
      h("li", null, "No app, anexe a foto do cupom, cole o pedido e envie."),
      h("li", null, "Copie a resposta inteira (ícone de copiar logo abaixo dela), volte aqui e toque em ", h("b", { text: "Colar a resposta" }), ".")));
    ia.appendChild(h("div", { class: "vfil" }, abrir, trocar));
    ia.appendChild(lform); ia.appendChild(lmsg);
    ia.appendChild(cmsg); ia.appendChild(pedTxt);
    ia.appendChild(h("div", { class: "vfil" }, colar)); ia.appendChild(resp); ia.appendChild(rmsg);
    /* antes de tudo, a chave de acesso: se essa nota já está na conta, avisa e para aqui (mesmo com a resposta cortada) */
    var vez = 0;
    function tentarResp() {
      var minha = ++vez, ch = /(?:^|\D)(35\d{42})(?!\d)/.exec(resp.value.replace(/(\d)\s+(?=\d)/g, "$1"));
      if (!resp.value.trim()) { rmsg.textContent = ""; return; }
      if (!ch) { lerEConferir(); return; }
      rmsg.textContent = "Conferindo se a nota já foi lançada…";
      sb.from("notas").select("data,total").eq("chave_nfce", ch[1]).then(ok).then(function (l) {
        if (minha !== vez) return;
        if (l.length) {
          passo2.hidden = true; passo2.innerHTML = "";
          rmsg.innerHTML = "";
          rmsg.appendChild(h("span", { class: "qrwarn", text: "Essa nota já foi lançada" + (l[0].data ? " (compra de " + dataBR(l[0].data) + (l[0].total != null ? ", " + money(+l[0].total) : "") + ")" : "") + ". Não precisa adicionar de novo. " }));
          rmsg.appendChild(h("a", { class: "link", href: "#mercado/notas", text: "Ver em Notas" }));
          return;
        }
        lerEConferir();
      }, function () { if (minha === vez) lerEConferir(); });
    }
    function lerEConferir() {
      var nota = lerResposta(resp.value), cortado = nota && nota.cortado;
      if (!nota || !nota.itens.length) nota = lerTextoLivre(resp.value);
      if (!nota || !nota.itens.length) {
        rmsg.textContent = cortado ? "O código veio cortado, sem os itens. Espere o app terminar de responder (aparece o ícone de copiar embaixo), toque nesse ícone e cole de novo."
          : "Não achei os itens nesse texto. Copie a resposta inteira (ícone de copiar logo abaixo dela) e tente de novo.";
        return;
      }
      rmsg.textContent = "✓ Resposta lida: " + nota.itens.length + " itens. Confira abaixo e toque em Salvar nota no fim da lista." +
        (cortado ? " Atenção: o código veio cortado (copiado antes de o app terminar?), então faltam itens. Espere a resposta terminar, copie pelo ícone e cole de novo." : "") +
        (nota.semQtd ? " A resposta não trouxe quantidade nem preço por kg, então os itens entram como 1 unidade. Para o preço por kg sair certo, use o pedido do botão (ele já vai copiado)." : "");
      conferir(nota);
      passo2.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    resp.addEventListener("paste", function () { setTimeout(tentarResp, 30); });
    resp.addEventListener("input", tentarResp);
    p.appendChild(ia);
    var passo2 = h("div", { class: "qrstep", hidden: "" });
    p.appendChild(passo2);
    body.appendChild(p);

    function conferir(nota) {
      passo2.innerHTML = ""; passo2.hidden = false;
      passo2.appendChild(h("b", { text: "Confira e salve" }));
      var info = h("p", { class: "sub", text: "Carregando seus produtos…" }); passo2.appendChild(info);
      Promise.all([sb.from("mercados").select("id,nome,cnpj").then(ok), sb.from("produtos").select("id,nome,categoria,unidade").order("nome").then(ok),
        nota.chave ? sb.from("notas").select("id").eq("chave_nfce", nota.chave).then(ok) : Promise.resolve([]),
        sb.from("itens").select("descricao,produto_id").then(ok),
        nota.data ? sb.from("notas").select("id,mercado_id,total").eq("data", nota.data).then(ok) : Promise.resolve([])]).then(function (r) {
        var mercs = r[0], prods = r[1], apelidos = {};
        r[3].forEach(function (x) { if (x.produto_id) apelidos[norm(x.descricao)] = x.produto_id; });
        info.textContent = "";
        if (r[2].length) { passo2.appendChild(h("p", { class: "qrwarn", text: "Essa nota já está cadastrada na sua conta." })); return; }
        var cats = Object.keys(groupBy(prods, function (x) { return x.categoria; })).sort();
        CATS_PALAVRAS.forEach(function (c) { if (cats.indexOf(c[0]) < 0) cats.push(c[0]); }); cats.sort();
        /* mercado: pelo CNPJ guardado, senão pelo nome parecido */
        var merc = mercs.filter(function (m) { return m.cnpj && m.cnpj === nota.cnpj; })[0] ||
          mercs.map(function (m) { return [m, semelhanca(nota.mercado, m.nome)]; }).sort(function (a, b) { return b[1] - a[1]; }).filter(function (x) { return x[1] >= 0.5; }).map(function (x) { return x[0]; })[0] ||
          /* senão, o primeiro nome do mercado aparece em algum lugar do texto colado ("Confiança", "Reinaldo") */
          mercs.filter(function (m) { var w = norm(semCidade(m.nome)).split(" ")[0]; return w.length > 3 && norm(nota.texto || nota.mercado).indexOf(w) >= 0; })[0];
        var selMerc = h("select", { "aria-label": "Mercado" }, mercs.map(function (m) { return h("option", { value: m.id, selected: merc && merc.id === m.id ? "" : null, text: m.nome }); }),
          h("option", { value: "novo", selected: merc ? null : "", text: "Novo mercado" + (nota.mercado ? ": " + nomeBonito(nota.mercado) : "") }));
        var novoNome = h("input", { type: "text", value: nomeBonito(nota.mercado || ""), placeholder: "Nome do mercado", "aria-label": "Nome do novo mercado", hidden: merc ? "" : null });
        selMerc.addEventListener("change", function () { novoNome.hidden = selMerc.value !== "novo"; });
        var dataI = h("input", { type: "date", value: nota.data || new Date().toISOString().slice(0, 10), "aria-label": "Data da compra" });
        var pagoI = h("input", { type: "text", inputmode: "decimal", value: nota.pago ? nota.pago.toFixed(2).replace(".", ",") : "", "aria-label": "Total pago" });
        var descI = h("input", { type: "text", inputmode: "decimal", value: nota.desconto ? nota.desconto.toFixed(2).replace(".", ",") : "", placeholder: "0,00", "aria-label": "Desconto" });
        passo2.appendChild(h("div", { class: "qrhead" },
          h("div", null, h("span", { class: "sub", text: "Mercado" }), selMerc, novoNome),
          h("div", null, h("span", { class: "sub", text: "Data" }), dataI),
          h("div", null, h("span", { class: "sub", text: "Total pago (R$)" }), pagoI),
          h("div", null, h("span", { class: "sub", text: "Desconto da nota (R$)" }), descI)));
        var igual = (r[4] || []).filter(function (n) { return Math.abs(+n.total - nota.pago) < 0.02 && (!merc || n.mercado_id === merc.id); });
        if (igual.length) passo2.appendChild(h("p", { class: "qrwarn", text: "Atenção: já existe uma compra de " + money(nota.pago) + " em " + dataBR(nota.data) + (merc ? " nesse mercado" : "") + ". Se for a mesma, não salve de novo." }));
        var conta = h("p", { role: "status" }); passo2.appendChild(conta);
        var dl = h("datalist", { id: "nf-prods" }, prods.map(function (x) { return h("option", { value: x.nome }); }));
        passo2.appendChild(dl);
        var lista = h("div", { class: "qrlist" }); passo2.appendChild(lista);

        function linha(it) {
          var pid = apelidos[norm(it.desc)], prod = pid && prods.filter(function (x) { return x.id === pid; })[0];
          if (!prod && it.desc) {
            var best = prods.filter(function (x) { return x.unidade === it.un || it.un === "un"; }).map(function (x) { return [x, semelhanca(it.desc, x.nome)]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
            if (best && best[1] >= 0.6) prod = best[0];
          }
          var inp = h("input", { type: "text", list: "nf-prods", value: prod ? prod.nome : (it.desc ? nomeBonito(it.desc) : ""), placeholder: "Produto", "aria-label": "Produto" });
          var cat = h("select", { "aria-label": "Categoria" }, cats.map(function (c) { return h("option", { value: c, selected: c === (prod ? prod.categoria : categoriaPalpite(it.desc || "")) ? "" : null, text: c }); }));
          var qtd = h("input", { type: "text", inputmode: "decimal", class: "nfnum", value: String(it.qtd).replace(".", ","), "aria-label": "Quantidade" });
          var un = h("select", { class: "nfun", "aria-label": "Unidade" }, [["un", "un"], ["kg", "kg"], ["l", "L"]].map(function (u) { return h("option", { value: u[0], selected: u[0] === it.un ? "" : null, text: u[1] }); }));
          var vt = h("input", { type: "text", inputmode: "decimal", class: "nfnum", value: it.vt ? it.vt.toFixed(2).replace(".", ",") : "", placeholder: "0,00", "aria-label": "Valor do item" });
          var tag = h("span", { class: "qrtag" });
          var tira = h("button", { type: "button", class: "ghostbtn nfx", title: "Tirar este item", "aria-label": "Tirar este item", text: "×" });
          function marcar() {
            var p2 = prods.filter(function (x) { return x.nome === inp.value.trim(); })[0];
            tag.textContent = p2 ? "existente" : "novo"; tag.className = "qrtag " + (p2 ? "old" : "new");
            if (p2) { cat.value = p2.categoria; cat.disabled = true; } else cat.disabled = false;
          }
          inp.addEventListener("input", marcar); marcar();
          var row = h("div", { class: "qritem nfitem" + (it.duvida ? " duvida" : "") },
            h("div", { class: "qrdesc" }, h("span", { class: "sub", text: it.desc || "Item adicionado à mão" }),
              h("span", { class: "sub", text: it.duvida ? "Confira: quantidade × preço não bate com o total lido" : fmtQtd(it.qtd, it.un) + " × " + money(it.vu) + (it.descItem ? " · desconto de " + money(it.descItem) : "") })),
            h("div", { class: "qrprod" }, inp, tag), cat,
            h("div", { class: "nfvals" }, qtd, un, h("span", { class: "sub", text: "R$" }), vt, tira));
          var reg = { it: it, inp: inp, sel: cat, qtd: qtd, un: un, vt: vt, row: row };
          tira.onclick = function () { row.remove(); regs.splice(regs.indexOf(reg), 1); somar(); };
          [qtd, vt].forEach(function (x) { x.addEventListener("input", somar); });
          return reg;
        }
        var regs = nota.itens.map(linha);
        regs.forEach(function (g) { lista.appendChild(g.row); });
        var mais = h("button", { type: "button", class: "ghostbtn", text: "+ Adicionar item" });
        mais.onclick = function () { var g = linha({ desc: "", qtd: 1, un: "un", vu: 0, vt: 0 }); regs.push(g); lista.appendChild(g.row); g.inp.focus(); somar(); };
        passo2.appendChild(h("div", { class: "vfil" }, mais));

        function somar() {
          var soma = Math.round(sum(regs, function (g) { return num(g.vt.value); }) * 100) / 100, d = num(descI.value), pago = num(pagoI.value);
          var bate = pago && Math.abs(soma - d - pago) < 0.02;
          conta.className = bate ? "qrok" : "qrwarn";
          conta.textContent = !pago ? "Itens somam " + money(soma) + ". Preencha o total pago para conferir." :
            bate ? "✓ Os " + regs.length + " itens (" + money(soma) + (d ? " − desconto " + money(d) : "") + ") batem com o total pago (" + money(pago) + ")." :
            "Os itens somam " + money(soma - d) + (d ? " já com desconto" : "") + ", mas o total pago é " + money(pago) + ". Diferença de " + money(Math.abs(soma - d - pago)) + ": confira os valores (os itens em amarelo são os mais suspeitos).";
        }
        [pagoI, descI].forEach(function (x) { x.addEventListener("input", somar); });
        somar();

        var salvarB = h("button", { type: "button", text: "Salvar nota" }), st3 = h("p", { class: "sub", role: "status" });
        passo2.appendChild(h("div", { class: "qrsave" }, salvarB, st3));
        salvarB.onclick = function () {
          var vazios = regs.filter(function (g) { return !g.inp.value.trim() || !(num(g.vt.value) > 0); });
          if (!regs.length) { st3.textContent = "Não há itens para salvar."; return; }
          if (vazios.length) { st3.textContent = "Preencha o produto e o valor de todos os itens (ou tire com ×)."; vazios[0].inp.focus(); return; }
          if (!dataI.value) { st3.textContent = "Preencha a data da compra."; dataI.focus(); return; }
          if (selMerc.value === "novo" && !novoNome.value.trim()) { st3.textContent = "Escreva o nome do mercado."; novoNome.focus(); return; }
          var final = { mercado: selMerc.value === "novo" ? novoNome.value.trim() : "", cnpj: nota.cnpj, endereco: "", data: dataI.value, numero: nota.numero, serie: nota.serie,
            chave: nota.chave, pagamento: nota.pagamento, fonte: "foto", desconto: num(descI.value),
            itens: regs.map(function (g) {
              var q = num(g.qtd.value) || 1, v = Math.round(num(g.vt.value) * 100) / 100;
              var vu = g.it.vu && Math.abs(g.it.vu * q - v) < 0.05 ? g.it.vu : Math.round(v / q * 100) / 100;
              return { desc: g.it.desc || g.inp.value.trim(), qtd: q, un: g.un.value, vt: v, vu: vu, descItem: g.it.descItem || 0, inp: g.inp, sel: g.sel };
            }) };
          final.pago = num(pagoI.value) || Math.round((sum(final.itens, function (x) { return x.vt; }) - final.desconto) * 100) / 100;
          ratearDesconto(final);
          salvarB.disabled = true; st3.textContent = "Salvando…";
          var nomeMerc = selMerc.value === "novo" ? final.mercado : selMerc.options[selMerc.selectedIndex].text;
          salvarNota(final, selMerc.value, prods).then(function () { return loadRows(true); }).then(function () {
            /* troca o quadro inteiro por uma confirmação clara do que entrou */
            p.innerHTML = "";
            var outra = h("button", { type: "button", class: "ghostbtn", text: "Adicionar outra nota" });
            outra.onclick = function () { drawApp("importar"); };
            p.appendChild(h("div", { class: "qrdone" },
              h("div", { class: "qrcheck", "aria-hidden": "true", text: "✓" }),
              h("h2", { text: "Nota salva" }),
              h("p", { text: semCidade(nomeMerc) + " · " + dataBR(final.data) + " · " + final.itens.length + " itens · " + money(final.pago) }),
              h("p", { class: "sub", text: "Ela já aparece no painel como a última compra e entrou no histórico de preços." }),
              h("div", { class: "vfil" },
                h("a", { class: "ghostbtn pri", href: "#mercado/painel", text: "Ver no painel" }),
                h("a", { class: "ghostbtn", href: "#mercado/notas", text: "Ver notas" }), outra)));
            p.scrollIntoView({ behavior: "smooth", block: "start" });
          }).catch(function (e) { salvarB.disabled = false; st3.textContent = "Não consegui salvar: " + (e.message || e); });
        };
      }).catch(function (e) { info.textContent = "Não consegui carregar seus produtos: " + e.message; });
    }
  }

  function salvarNota(nota, mercadoId, prods) {
    var porNome = {}; prods.forEach(function (x) { porNome[x.nome] = x; });
    var p = Promise.resolve(mercadoId);
    if (mercadoId === "novo") p = sb.from("mercados").insert({ nome: nota.mercado, cnpj: nota.cnpj || null, cidade: (/,\s*([^,]+?)\s*,\s*([A-Z]{2})\s*$/.exec(nota.endereco) || []).slice(1).join("/") || null }).select("id").single().then(ok).then(function (m) { return m.id; });
    else if (nota.cnpj) p = sb.from("mercados").update({ cnpj: nota.cnpj }).eq("id", mercadoId).is("cnpj", null).then(function () { return mercadoId; });
    var novos = {};
    nota.itens.forEach(function (it) { var n = it.inp.value.trim() || nomeBonito(it.desc); it.prodNome = n; if (!porNome[n] && !novos[n]) novos[n] = { nome: n, categoria: it.sel.value, unidade: it.un }; });
    return p.then(function (mid) {
      mercadoId = mid;
      var lista = Object.values(novos);
      return lista.length ? sb.from("produtos").insert(lista).select("id,nome,categoria,unidade").then(ok).then(function (d) { d.forEach(function (x) { porNome[x.nome] = x; }); }) : null;
    }).then(function () {
      return sb.from("notas").insert({ mercado_id: mercadoId, data: nota.data, numero: nota.numero || null, serie: nota.serie || null, chave_nfce: nota.chave || null,
        forma_pagamento: nota.pagamento || null, total: nota.pago, fonte: nota.fonte, observacao: nota.desconto ? "Desconto de " + money(nota.desconto) + " na nota" : null }).select("id").single().then(ok);
    }).then(function (n) {
      return sb.from("itens").insert(nota.itens.map(function (it) {
        var pr = porNome[it.prodNome];
        return { nota_id: n.id, produto_id: pr ? pr.id : null, descricao: it.desc, categoria: pr ? pr.categoria : it.sel.value, quantidade: it.qtd, unidade: it.un,
          valor_unitario: it.vu, valor_total: Math.round((it.vt - (it.desc_rateio || 0)) * 100) / 100, desconto: it.desc_rateio || 0,
          observacao: it.desc_rateio ? (it.descItem ? "Desconto no item: " : "Desconto da nota rateado: ") + money(it.desc_rateio) : null };
      })).then(ok);
    });
  }

  /* ---------- Importar o Excel (aba "Compras") ---------- */
  function viewImportar(body) {
    painelFoto(body);
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

  /* Resumo para a tela inicial: gasto e compras do mês atual e a última compra */
  function resumo() {
    return client().then(function () { return loadRows(); }).then(function (l) {
      var mk = new Date().toISOString().slice(0, 7), doMes = l.filter(function (x) { return x.mk === mk; });
      var notas = groupBy(l, function (x) { return x.nota; }), ult = Object.values(notas).sort(function (a, b) { return b[0].data.localeCompare(a[0].data); })[0];
      return { mes: mesNome(mk), total: sum(doMes, function (x) { return x.valor_total; }), compras: Object.keys(groupBy(doMes, function (x) { return x.nota; })).length,
        ultima: ult ? { mercado: String(ult[0].mercado).replace(/\s*\(.*\)$/, ""), data: dataBR(ult[0].data), total: sum(ult, function (x) { return x.valor_total; }), itens: ult.length } : null };
    });
  }
  /* O login do Mercado é o login do site todo: a página inteira usa este mesmo cliente */
  window.RACmercado = { render: render, client: client, resumo: resumo, money: money };
})();
