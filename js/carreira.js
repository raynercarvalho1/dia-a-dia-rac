/* Dia a Dia RAC — módulo carregado quando a seção abre. Carreira: funil de candidaturas (com follow-up na Agenda),
   compatibilidade com as vagas, perfil de competências, banco de histórias STAR, prática de SQL com os seus dados
   (sql.js no navegador) e estudo de caso anonimizado para o portfólio.
   Dados em PESSOAL.candidaturas, PESSOAL.perfilCarreira e PESSOAL.historias. Usa as funções do núcleo (js/app.js). */
  var CAR_COLS=[["salva","Salvas"],["candidatei","Candidatei"],["entrevista","Entrevista"],["resposta","Resposta"]];
  var CAR_ABAS=[["funil","Funil"],["compat","Compatibilidade"],["star","Histórias STAR"],["sql","Praticar SQL"],["portfolio","Portfólio"]];
  function carCands(){return PESSOAL.candidaturas||[]}
  function carSkillNome(k){return (NUCLEO.SKILLS.filter(function(s){return s[0]===k})[0]||[k,k])[1]}
  function carMeus(){return ((PESSOAL.perfilCarreira||{}).skills)||["sql","powerbi","excel","negocio","estat"]}
  function renderCarreira(sub,arg){
    var root=$("#carreira-view");root.innerHTML="";var aba=CAR_ABAS.some(function(a){return a[0]===sub})?sub:"funil";
    root.appendChild(h("div",{class:"seg famseg"},CAR_ABAS.map(function(a){return h("a",{href:"#carreira/"+a[0],"aria-pressed":String(a[0]===aba),text:a[1]})})));
    ({funil:carFunil,compat:carCompat,star:carStar,sql:carSql,portfolio:carPortfolio})[aba](root,arg)}

  /* ---------- funil ---------- */
  function carSalvar(l){pessoalGravar("candidaturas",l)}
  function carMover(id,col){var hj=hojeISO();carSalvar(carCands().map(function(c){if(c.id!==id)return c;var d=Object.assign({},c.datas||{});d[col]=d[col]||hj;return Object.assign({},c,{coluna:col,datas:d})}))}
  function carFunil(root){
    var l=carCands(),meus=carMeus();
    var topo=panel("Funil de candidaturas","Salve vagas da página Vagas (ou cadastre aqui), avance pelas colunas e, 5 dias depois de se candidatar sem resposta, o follow-up aparece na Agenda.");
    var nv=h("button",{type:"button",class:"ghostbtn pri",text:"+ Vaga de fora do portal"});nv.onclick=function(){carEditar(null)};
    topo.appendChild(h("div",{class:"vfil"},nv,h("a",{href:"#vagas",class:"ghostbtn",text:"Ver vagas abertas"})));
    var tot=CAR_COLS.map(function(c){return c[1]+": "+l.filter(function(x){return x.coluna===c[0]}).length});topo.appendChild(h("p",{class:"sub",text:tot.join(" · ")}));
    root.appendChild(topo);
    var kb=h("div",{class:"kanban"});
    CAR_COLS.forEach(function(col,ci){
      var cards=l.filter(function(x){return x.coluna===col[0]}).sort(function(a,b){return String((b.datas||{})[col[0]]||"").localeCompare(String((a.datas||{})[col[0]]||""))});
      var c=h("div",{class:"kcol"},h("h3",{class:"mbag",text:col[1]+" ("+cards.length+")"}));
      cards.forEach(function(x){
        var cp=NUCLEO.compatVaga([x.t,x.desc].join(" "),meus),desde=(x.datas||{})[col[0]],dias=desde?Math.round((new Date(hojeISO()+"T12:00:00")-new Date(desde+"T12:00:00"))/864e5):null;
        var fu=col[0]==="candidatei"&&dias>=5&&!x.followup;
        var k=h("div",{class:"kcard"+(fu?" alerta":"")},h("b",{text:x.t}),h("span",{class:"sub",text:[x.e,dias!=null?"há "+dias+(dias===1?" dia":" dias"):""].filter(Boolean).join(" · ")}),
          cp.nota!=null?h("span",{class:"kcompat",title:"Pede: "+cp.pede.map(carSkillNome).join(", "),text:cp.nota+"% compatível"+(cp.falta.length?" · falta "+cp.falta.map(carSkillNome).join(", "):"")}):null,
          x.resultado?h("span",{class:"sub",text:"Resultado: "+x.resultado}):null,fu?h("span",{class:"qrwarn",text:"Fazer follow-up"}):null);
        var bt=h("div",{class:"vfil"});
        if(ci>0){var e=h("button",{type:"button",class:"ghostbtn",text:"◀"});e.onclick=function(){carMover(x.id,CAR_COLS[ci-1][0]);renderCarreira("funil")};bt.appendChild(e)}
        if(ci<CAR_COLS.length-1){var d=h("button",{type:"button",class:"ghostbtn",text:"▶ "+CAR_COLS[ci+1][1]});d.onclick=function(){carMover(x.id,CAR_COLS[ci+1][0]);renderCarreira("funil")};bt.appendChild(d)}
        var ed=h("button",{type:"button",class:"ghostbtn",text:"Abrir"});ed.onclick=function(){carEditar(x)};bt.appendChild(ed);
        if(x.link)bt.appendChild(ext(x.link,"Vaga","ghostbtn"));
        k.appendChild(bt);c.appendChild(k)});
      kb.appendChild(c)});
    root.appendChild(kb)}
  /* uma candidatura: dados, descrição colada (deixa a compatibilidade precisa), notas, follow-up e histórias ao lado */
  function carEditar(x){
    var root=$("#carreira-view");root.innerHTML="";var novo=!x;x=x||{id:"c"+Date.now().toString(36),coluna:"salva",datas:{salva:hojeISO()}};
    var p=panel(novo?"Nova candidatura":x.t),f=h("div",{class:"wform"});
    var t=h("input",{type:"text",value:x.t||"",placeholder:"Cargo"}),e=h("input",{type:"text",value:x.e||"",placeholder:"Empresa"}),lk=h("input",{type:"url",value:x.link||"",placeholder:"https://…"});
    var col=h("select",null,CAR_COLS.map(function(c){return h("option",{value:c[0],selected:c[0]===x.coluna?"":null,text:c[1]})}));
    var res=h("select",null,["","aprovado","recusado","sem retorno","desisti"].map(function(r){return h("option",{value:r,selected:r===(x.resultado||"")?"":null,text:r||"(sem resultado ainda)"})}));
    var desc=h("textarea",{rows:"6",placeholder:"Cole aqui a descrição da vaga: a compatibilidade passa a usar o texto completo"});desc.value=x.desc||"";
    var notas=h("textarea",{rows:"3",placeholder:"Contato, salário combinado, próximos passos…"});notas.value=x.notas||"";
    var fu=h("input",{type:"checkbox"});fu.checked=!!x.followup;
    f.appendChild(h("div",{class:"two"},h("label",null,"Cargo",t),h("label",null,"Empresa",e)));
    f.appendChild(h("div",{class:"two"},h("label",null,"Etapa",col),h("label",null,"Resultado",res)));
    f.appendChild(h("label",null,"Link da vaga",lk));f.appendChild(h("label",null,"Descrição da vaga",desc));f.appendChild(h("label",null,"Notas",notas));
    f.appendChild(h("label",{class:"chk"},fu," Follow-up feito"));
    var cpBox=h("div");f.appendChild(cpBox);
    function atualizaCompat(){var cp=NUCLEO.compatVaga([t.value,desc.value].join(" "),carMeus());cpBox.innerHTML="";
      if(cp.nota==null){cpBox.appendChild(h("p",{class:"sub",text:"Cole a descrição para ver a compatibilidade."}));return}
      cpBox.appendChild(h("div",{class:"kgasto"},h("div",null,h("span",{class:"kl",text:"Compatibilidade"}),h("b",{class:"kv "+(cp.nota>=70?"bom":cp.nota<40?"ruim":""),text:cp.nota+"%"})),
        h("div",null,h("span",{class:"kl",text:"Você tem"}),h("b",{class:"kv",text:cp.tem.map(carSkillNome).join(", ")||"—"})),h("div",null,h("span",{class:"kl",text:"Falta"}),h("b",{class:"kv",text:cp.falta.map(carSkillNome).join(", ")||"nada 🎉"}))));
      /* histórias STAR que usam o que a vaga pede: para preparar a entrevista com a vaga ao lado */
      var hs=(PESSOAL.historias||[]).filter(function(s){var sk=NUCLEO.compatVaga([s.titulo,s.s,s.t,s.a,s.r,s.tags].join(" "),cp.pede).tem;return sk.length});
      if(hs.length)cpBox.appendChild(h("details",{class:"famvals",open:""},h("summary",{text:"Histórias STAR para esta vaga ("+hs.length+")"}),h("ul",{class:"wl"},hs.map(function(s){return h("li",null,h("span",{class:"grow"},h("b",{text:s.titulo}),h("span",{class:"sub",text:"R: "+(s.r||"")})))}))))}
    desc.addEventListener("input",atualizaCompat);t.addEventListener("input",atualizaCompat);atualizaCompat();
    var ok=h("button",{type:"button",text:"Salvar"}),volta=h("a",{href:"#carreira/funil",class:"ghostbtn",text:"Voltar"}),del=novo?null:h("button",{type:"button",class:"ghostbtn",text:"Apagar"});
    ok.onclick=function(){if(!t.value.trim())return t.focus();var d=Object.assign({},x.datas||{});d[col.value]=d[col.value]||hojeISO();
      var o=Object.assign({},x,{t:t.value.trim(),e:e.value.trim(),link:urlAbs(lk.value),coluna:col.value,resultado:res.value||null,desc:desc.value.trim(),notas:notas.value.trim(),followup:fu.checked?(x.followup||hojeISO()):null,datas:d});
      var l=carCands().filter(function(c){return c.id!==x.id});l.unshift(o);carSalvar(l);location.hash="#carreira/funil";renderCarreira("funil")};
    if(del){var arm=false;del.onclick=function(){if(!arm){arm=true;del.textContent="Toque de novo para apagar";return}carSalvar(carCands().filter(function(c){return c.id!==x.id}));renderCarreira("funil")}}
    f.appendChild(h("div",{class:"vfil"},ok,volta,del));p.appendChild(f);root.appendChild(p)}

  /* ---------- compatibilidade: perfil + ranking das vagas abertas ---------- */
  function carCompat(root){
    var meus=carMeus(),pp=panel("Suas competências","Marque o que você domina. A nota de cada vaga é a parte do que ela pede que você já tem.");
    var g=h("div",{class:"skillgrid"});NUCLEO.SKILLS.forEach(function(k){var cb=h("input",{type:"checkbox"});cb.checked=meus.indexOf(k[0])>=0;
      cb.onchange=function(){var s=carMeus().filter(function(x){return x!==k[0]});if(cb.checked)s.push(k[0]);pessoalGravar("perfilCarreira",Object.assign({},PESSOAL.perfilCarreira||{},{skills:s}));renderCarreira("compat")};
      g.appendChild(h("label",{class:"chk"},cb," "+k[1]))});pp.appendChild(g);root.appendChild(pp);
    var pv=panel("Vagas abertas por compatibilidade","Pelo título e nível (o portal não traz a descrição). Para a nota exata, salve no funil e cole a descrição."),ul=h("ul",{class:"wl"},h("li",null,h("span",{class:"sub",text:"Carregando…"})));pv.appendChild(ul);root.appendChild(pv);
    /* o que mais aparece nas vagas: onde vale a pena estudar */
    var pf=panel("O que o mercado mais pede (e você ainda não marcou)");root.appendChild(pf);
    getJson("vagas.json").then(function(d){var vs=(d.vagas||[]).map(function(v){return {v:v,cp:NUCLEO.compatVaga(v.t+" "+(v.nv||""),meus)}}).filter(function(x){return x.cp.nota!=null}).sort(function(a,b){return b.cp.nota-a.cp.nota||a.v.d-b.v.d});
      ul.innerHTML="";vs.slice(0,25).forEach(function(x){var sv=h("button",{type:"button",class:"ghostbtn",text:"Salvar no funil"});sv.onclick=function(){carSalvarVaga(x.v);sv.textContent="✓ No funil";sv.disabled=true};
        ul.appendChild(h("li",null,h("span",{class:"grow"},h("b",{text:x.v.t}),h("span",{class:"sub",text:[x.v.e,x.v.m,x.cp.nota+"% · pede "+x.cp.pede.map(carSkillNome).join(", ")].filter(Boolean).join(" · ")})),sv))});
      var cont={};(d.vagas||[]).forEach(function(v){NUCLEO.compatVaga(v.t+" "+(v.nv||""),[]).pede.forEach(function(k){cont[k]=(cont[k]||0)+1})});
      var top=Object.keys(cont).sort(function(a,b){return cont[b]-cont[a]});
      pf.appendChild(h("ul",{class:"wl"},top.map(function(k){return h("li",{class:meus.indexOf(k)<0?"alerta":null},h("span",{class:"grow",text:carSkillNome(k)}),h("span",{class:"end",text:cont[k]+" vagas"+(meus.indexOf(k)<0?" · falta":"")}))})))})
      .catch(function(e){ul.innerHTML="";ul.appendChild(h("li",null,h("span",{class:"sub",text:"Não consegui ler as vagas ("+e.message+")."})))})}

  /* ---------- histórias STAR ---------- */
  function carStar(root){
    var l=PESSOAL.historias||[],p=panel("Banco de histórias (STAR)","Situação, Tarefa, Ação e Resultado: escreva uma vez e use em todas as entrevistas. Cite números e ferramentas: as histórias aparecem junto das vagas que pedem o mesmo.");
    var nv=h("button",{type:"button",class:"ghostbtn pri",text:"+ Nova história"});p.appendChild(h("div",{class:"vfil"},nv));root.appendChild(p);
    function form(s){var novo=!s;s=s||{id:"s"+Date.now().toString(36)};var fp=panel(novo?"Nova história":s.titulo),f=h("div",{class:"wform"});
      function ta(rot,k,ph){var t=h("textarea",{rows:"3",placeholder:ph});t.value=s[k]||"";t.dataset.k=k;f.appendChild(h("label",null,rot,t));return t}
      var ti=h("input",{type:"text",value:s.titulo||"",placeholder:"Ex.: Dashboard que reduziu o tempo de fechamento"});f.appendChild(h("label",null,"Título",ti));
      ta("Situação","s","Contexto: empresa, problema, quem estava envolvido");ta("Tarefa","t","O que era responsabilidade sua");ta("Ação","a","O que você fez (ferramentas: SQL, Power BI…)");ta("Resultado","r","Números: tempo economizado, % de melhora, decisão tomada");
      var tg=h("input",{type:"text",value:s.tags||"",placeholder:"Palavras-chave: SQL, Power BI, stakeholders…"});f.appendChild(h("label",null,"Palavras-chave",tg));
      var ok=h("button",{type:"button",text:"Salvar"}),volta=h("button",{type:"button",class:"ghostbtn",text:"Cancelar"});volta.onclick=function(){renderCarreira("star")};
      ok.onclick=function(){if(!ti.value.trim())return ti.focus();var o={id:s.id,titulo:ti.value.trim(),tags:tg.value.trim()};f.querySelectorAll("textarea").forEach(function(t){o[t.dataset.k]=t.value.trim()});
        pessoalGravar("historias",[o].concat((PESSOAL.historias||[]).filter(function(x){return x.id!==s.id})));renderCarreira("star")};
      f.appendChild(h("div",{class:"vfil"},ok,volta));fp.appendChild(f);root.insertBefore(fp,root.children[1]);ti.focus()}
    nv.onclick=function(){form(null)};
    l.forEach(function(s){var c=h("div",{class:"panel"},h("h3",{text:s.titulo}),
      h("dl",{class:"star"},[["S",s.s],["T",s.t],["A",s.a],["R",s.r]].map(function(x){return [h("dt",{text:x[0]}),h("dd",{text:x[1]||"—"})]})),
      s.tags?h("p",{class:"sub",text:s.tags}):null);
      var ed=h("button",{type:"button",class:"ghostbtn",text:"Editar"});ed.onclick=function(){form(s)};
      var rm=h("button",{type:"button",class:"ghostbtn",text:"Apagar"});rm.onclick=function(){pessoalGravar("historias",(PESSOAL.historias||[]).filter(function(x){return x.id!==s.id}));renderCarreira("star")};
      c.appendChild(h("div",{class:"vfil"},ed,rm));root.appendChild(c)});
    if(!l.length)root.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Nenhuma história ainda. Comece pela sua maior entrega com dados."})))}

  /* ---------- prática de SQL com os seus dados (SQLite no navegador) ---------- */
  var SQLJS="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/",SQLDB=null;
  var EXERCICIOS=[
    ["Quantos itens de compra existem?","SELECT COUNT(*) AS itens FROM compras;"],
    ["Quanto você gastou em cada mês? (mes, total), do mais antigo ao mais novo","SELECT mes, ROUND(SUM(valor_total),2) AS total FROM compras GROUP BY mes ORDER BY mes;"],
    ["Os 10 produtos em que você mais gastou","SELECT produto, ROUND(SUM(valor_total),2) AS gasto FROM compras GROUP BY produto ORDER BY gasto DESC LIMIT 10;"],
    ["Em qual mercado você mais gastou?","SELECT mercado, ROUND(SUM(valor_total),2) AS gasto FROM compras GROUP BY mercado ORDER BY gasto DESC LIMIT 1;"],
    ["Preço médio, mínimo e máximo do produto que você mais comprou (em número de compras)","SELECT produto, ROUND(AVG(valor_unitario),2) AS medio, MIN(valor_unitario) AS minimo, MAX(valor_unitario) AS maximo FROM compras WHERE produto = (SELECT produto FROM compras GROUP BY produto ORDER BY COUNT(*) DESC LIMIT 1) GROUP BY produto;"],
    ["Treinos por tipo: quantidade e km somados, do mais frequente ao menos","SELECT tipo, COUNT(*) AS treinos, ROUND(SUM(distancia_km),1) AS km FROM treinos GROUP BY tipo ORDER BY treinos DESC;"],
    ["Em que mês você mais caminhou (km)?","SELECT substr(data,1,7) AS mes, ROUND(SUM(distancia_km),1) AS km FROM treinos WHERE tipo='walking' GROUP BY mes ORDER BY km DESC LIMIT 1;"],
    ["Média de horas de sono por dia da semana (0 = domingo)","SELECT strftime('%w', data) AS dia_semana, ROUND(AVG(sono_h),2) AS sono FROM saude WHERE sono_h IS NOT NULL GROUP BY dia_semana ORDER BY dia_semana;"],
    ["Quantos dias tiveram VFC abaixo da sua média?","SELECT COUNT(*) AS dias FROM saude WHERE vfc < (SELECT AVG(vfc) FROM saude);"],
    ["Passos médios em dias COM e SEM musculação (JOIN/LEFT JOIN)","SELECT CASE WHEN t.data IS NULL THEN 'sem' ELSE 'com' END AS musculacao, ROUND(AVG(s.passos)) AS passos FROM saude s LEFT JOIN (SELECT DISTINCT data FROM treinos WHERE tipo='strength_training') t ON t.data = s.data WHERE s.passos IS NOT NULL GROUP BY musculacao ORDER BY musculacao;"],
    ["Gasto acumulado mês a mês (função de janela)","SELECT mes, total, ROUND(SUM(total) OVER (ORDER BY mes),2) AS acumulado FROM (SELECT mes, ROUND(SUM(valor_total),2) AS total FROM compras GROUP BY mes) ORDER BY mes;"],
    ["Gastos da família por quem (registros com custo)","SELECT quem, ROUND(SUM(custo),2) AS gasto FROM registros WHERE custo IS NOT NULL GROUP BY quem ORDER BY gasto DESC;"]];
  function carSqlBanco(st){
    if(SQLDB)return Promise.resolve(SQLDB);
    function lib(){return window.initSqlJs?Promise.resolve():new Promise(function(ok,erro){var s=document.createElement("script");s.src=SQLJS+"sql-wasm.js";s.onload=ok;s.onerror=function(){erro(new Error("não consegui baixar o SQLite"))};document.head.appendChild(s)})}
    function pag(t,cols,de,acc){return SB.from(t).select(cols).range(de,de+999).then(sbOk).then(function(l){acc=acc.concat(l);return l.length===1000?pag(t,cols,de+1000,acc):acc})}
    st("Carregando o SQLite e os seus dados…");
    return Promise.all([lib().then(function(){return window.initSqlJs({locateFile:function(f){return SQLJS+f}})}),pag("compras","data,mes,mercado,categoria,produto,quantidade,valor_unitario,valor_total",0,[]),
      pag("garmin_dia","data,dados",0,[]).catch(function(){return []}),pag("garmin_ativ","inicio,tipo,dados",0,[]).catch(function(){return []}),pag("registros","quem,tipo,data,titulo,dados",0,[]).catch(function(){return []})]).then(function(r){
      var db=new r[0].Database();
      function tab(nome,cols,linhas){db.run("CREATE TABLE "+nome+" ("+cols.join(",")+")");var stmt=db.prepare("INSERT INTO "+nome+" VALUES ("+cols.map(function(){return "?"}).join(",")+")");linhas.forEach(function(l){stmt.run(l)});stmt.free()}
      tab("compras",["data TEXT","mes TEXT","mercado TEXT","categoria TEXT","produto TEXT","quantidade REAL","valor_unitario REAL","valor_total REAL"],r[1].map(function(x){return [x.data,String(x.mes||x.data).slice(0,7),x.mercado,x.categoria,x.produto,+x.quantidade,+x.valor_unitario,+x.valor_total]}));
      tab("saude",["data TEXT","passos INTEGER","sono_h REAL","sono_nota INTEGER","vfc INTEGER","fc_repouso INTEGER","estresse INTEGER","body_battery INTEGER"],r[2].map(function(x){var d=x.dados||{},s=d.sono||{};return [x.data,d.passos==null?null:d.passos,s.total?Math.round(s.total/36)/100:null,s.nota==null?null:s.nota,(d.vfc||{}).noite==null?null:d.vfc.noite,d.fcRepouso==null?null:d.fcRepouso,d.estresse==null?null:d.estresse,d.bbMax==null?null:d.bbMax]}));
      tab("treinos",["data TEXT","hora TEXT","tipo TEXT","nome TEXT","distancia_km REAL","duracao_min REAL","fc_media INTEGER","calorias INTEGER"],r[3].map(function(x){var d=x.dados||{};return [x.inicio.slice(0,10),x.inicio.slice(11,16),x.tipo,d.nome||null,d.distancia?Math.round(d.distancia/10)/100:0,d.duracao?Math.round(d.duracao/6)/10:null,d.fc==null?null:Math.round(d.fc),d.calorias==null?null:Math.round(d.calorias)]}));
      tab("registros",["quem TEXT","tipo TEXT","data TEXT","titulo TEXT","custo REAL"],r[4].map(function(x){var c=(x.dados||{}).custo;return [x.quem,x.tipo,x.data,x.titulo,typeof c==="number"?c:null]}));
      SQLDB=db;return db})}
  function sqlTabela(res){if(!res.length)return h("p",{class:"sub",text:"(nenhuma linha)"});var r=res[res.length-1];
    return h("div",{class:"famtabw"},h("table",{class:"famtab"},h("thead",null,h("tr",null,r.columns.map(function(c){return h("th",{text:c})}))),h("tbody",null,r.values.slice(0,200).map(function(v){return h("tr",null,v.map(function(x){return h("td",{text:x==null?"NULL":String(x)})}))}))))}
  function sqlIgual(a,b,ordem){function linhas(res){var r=res[res.length-1];return r?r.values.map(function(v){return JSON.stringify(v.map(function(x){return typeof x==="number"?Math.round(x*100)/100:x}))}):[]}
    var x=linhas(a),y=linhas(b);if(!ordem){x.sort();y.sort()}return x.length===y.length&&x.every(function(v,i){return v===y[i]})}
  function carSql(root){
    var p=panel("Praticar SQL com os seus dados","SQLite rodando no navegador, com 4 tabelas montadas a partir do site: compras (Mercado), saude (Garmin por dia), treinos (Garmin) e registros (família e veículos). Nada sai do seu aparelho.");
    var st=h("p",{class:"sub",role:"status"});p.appendChild(st);root.appendChild(p);
    var ex=h("select",null,[h("option",{value:"",text:"Exercício livre"})].concat(EXERCICIOS.map(function(e,i){return h("option",{value:String(i),text:(i+1)+". "+e[0]})})));
    var ed=h("textarea",{class:"sqled",rows:"7",spellcheck:"false"});ed.value="SELECT * FROM compras LIMIT 10;";
    var rodar=h("button",{type:"button",text:"Rodar (Ctrl+Enter)"}),conf=h("button",{type:"button",class:"ghostbtn",text:"Conferir a resposta"}),sol=h("button",{type:"button",class:"ghostbtn",text:"Ver a solução"});
    var out=h("div"),feitos=(PESSOAL.sqlFeitos||{});
    var pe=panel(null);pe.appendChild(h("div",{class:"wform"},h("label",null,"Exercício",ex),h("label",null,"Sua consulta",ed),h("div",{class:"vfil"},rodar,conf,sol)));pe.appendChild(out);root.appendChild(pe);
    var pt=panel("Tabelas");root.appendChild(pt);
    carSqlBanco(function(t){st.textContent=t}).then(function(db){
      st.textContent="✓ Pronto. Feitos: "+Object.keys(feitos).length+" de "+EXERCICIOS.length+".";
      ["compras","saude","treinos","registros"].forEach(function(t){var n=db.exec("SELECT COUNT(*) FROM "+t)[0].values[0][0],cols=db.exec("PRAGMA table_info("+t+")")[0].values.map(function(v){return v[1]+" "+v[2]});
        pt.appendChild(h("p",null,h("b",{text:t+" ("+n+" linhas): "}),cols.join(", ")))})}).catch(function(e){st.textContent="Não consegui montar o banco: "+e.message;logErro("sql",e)});
    function rodarSql(q){return carSqlBanco(function(t){st.textContent=t}).then(function(db){return db.exec(q)})}
    rodar.onclick=function(){out.innerHTML="";rodarSql(ed.value).then(function(r){out.appendChild(sqlTabela(r))}).catch(function(e){out.appendChild(h("p",{class:"qrwarn",text:"Erro: "+e.message}))})};
    ed.addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();rodar.click()}});
    ex.onchange=function(){out.innerHTML="";if(ex.value==="")return;ed.value="-- "+EXERCICIOS[+ex.value][0]+"\n";ed.focus()};
    conf.onclick=function(){if(ex.value==="")return;var e=EXERCICIOS[+ex.value];out.innerHTML="";
      Promise.all([rodarSql(ed.value),rodarSql(e[1])]).then(function(r){var ok=sqlIgual(r[0],r[1],/ORDER BY/i.test(e[1]));
        out.appendChild(h("p",{class:ok?"capok":"qrwarn",text:ok?"✓ Certo!":"Ainda não bate com o esperado. Compare abaixo."}));out.appendChild(sqlTabela(r[0]));
        if(ok){var f=Object.assign({},PESSOAL.sqlFeitos||{});f[ex.value]=hojeISO();pessoalGravar("sqlFeitos",f)}else{out.appendChild(h("p",{class:"sub",text:"Esperado:"}));out.appendChild(sqlTabela(r[1]))}})
      .catch(function(err){out.appendChild(h("p",{class:"qrwarn",text:"Erro: "+err.message}))})};
    sol.onclick=function(){if(ex.value!=="")ed.value=EXERCICIOS[+ex.value][1]}}

  /* ---------- portfólio: estudo de caso "dados da minha vida", anonimizado ---------- */
  function carPortfolio(root){
    var p=panel("Estudo de caso para o portfólio","Um projeto público com os seus dados reais, sem nada que identifique você: datas viram “dia 1, dia 2…”, mercados viram “Mercado A, B…”, sem nomes de produtos que revelem marca de remédio, sem local dos treinos.");
    var st=h("p",{class:"sub",role:"status"}),b=h("button",{type:"button",text:"Baixar o pacote do estudo de caso (.zip)"});p.appendChild(h("div",{class:"vfil"},b));p.appendChild(st);
    p.appendChild(h("h3",{class:"mbag",text:"Perguntas que o estudo responde"}));
    p.appendChild(h("ul",{class:"famori"},["Como o gasto de mercado varia por mês e por categoria? Qual categoria mais cresceu?","Dormir melhor muda a VFC e o estresse do dia seguinte?",
      "Treinar (musculação, caminhada) aumenta os passos e o gasto calórico da semana?","Quanto custa manter a casa por mês (mercado + família + veículos)?"].map(function(t){return h("li",{text:t})})));
    root.appendChild(p);
    b.onclick=function(){b.disabled=true;carSqlBanco(function(t){st.textContent=t}).then(function(db){
      var enc=new TextEncoder(),arqs=[];function csv(q){var r=db.exec(q)[0];if(!r)return "";return r.columns.join(",")+"\n"+r.values.map(function(v){return v.map(function(x){return x==null?"":/[",\n]/.test(String(x))?'"'+String(x).replace(/"/g,'""')+'"':x}).join(",")}).join("\n")}
      /* âncora de datas: o primeiro dia com dado vira o dia 1 */
      var d0=db.exec("SELECT MIN(d) FROM (SELECT MIN(data) d FROM compras UNION SELECT MIN(data) FROM saude UNION SELECT MIN(data) FROM treinos UNION SELECT MIN(data) FROM registros)")[0].values[0][0];
      var dia="CAST(julianday(data)-julianday('"+d0+"')+1 AS INTEGER)",mesRel="CAST((julianday(data)-julianday('"+d0+"'))/30.44 AS INTEGER)+1";
      db.run("DROP TABLE IF EXISTS _merc;CREATE TABLE _merc AS SELECT mercado, 'Mercado '||char(64+ROW_NUMBER() OVER (ORDER BY SUM(valor_total) DESC)) AS apelido FROM compras GROUP BY mercado");
      arqs.push({nome:"dados/compras_mensais_por_categoria.csv",dados:enc.encode(csv("SELECT "+mesRel+" AS mes, categoria, COUNT(*) AS itens, ROUND(SUM(valor_total),2) AS total FROM compras GROUP BY 1,2 ORDER BY 1,2"))});
      arqs.push({nome:"dados/compras_por_mercado.csv",dados:enc.encode(csv("SELECT m.apelido AS mercado, COUNT(*) AS itens, ROUND(SUM(c.valor_total),2) AS total FROM compras c JOIN _merc m USING(mercado) GROUP BY 1 ORDER BY 3 DESC"))});
      arqs.push({nome:"dados/saude_diaria.csv",dados:enc.encode(csv("SELECT "+dia+" AS dia, strftime('%w',data) AS dia_semana, passos, sono_h, sono_nota, vfc, fc_repouso, estresse, body_battery FROM saude ORDER BY 1"))});
      arqs.push({nome:"dados/treinos.csv",dados:enc.encode(csv("SELECT "+dia+" AS dia, tipo, distancia_km, duracao_min, fc_media, calorias FROM treinos ORDER BY 1"))});
      arqs.push({nome:"dados/custos_da_casa_mensais.csv",dados:enc.encode(csv("SELECT "+mesRel+" AS mes, CASE WHEN quem IN ('civic','moto','c3') THEN 'veiculos' WHEN quem='eddie' THEN 'pet' ELSE 'bebe' END AS area, ROUND(SUM(custo),2) AS total FROM registros WHERE custo IS NOT NULL GROUP BY 1,2 ORDER BY 1,2"))});
      arqs.push({nome:"consultas.sql",dados:enc.encode(EXERCICIOS.map(function(e,i){return "-- "+(i+1)+". "+e[0]+"\n"+e[1]}).join("\n\n")+"\n")});
      arqs.push({nome:"README.md",dados:enc.encode("# Dados da minha vida: casa, saúde e treinos\n\nEstudo de caso com dados reais de vários anos, anonimizados: datas relativas (dia 1 = primeiro registro), mercados como \"Mercado A, B…\" e sem local dos treinos.\n\n"+
        "## Perguntas\n1. Como o gasto de mercado varia por mês e categoria?\n2. Dormir melhor muda a VFC e o estresse do dia seguinte?\n3. Treinar aumenta os passos e o gasto calórico da semana?\n4. Quanto custa manter a casa por mês?\n\n"+
        "## Dados (pasta dados/)\n- compras_mensais_por_categoria.csv, compras_por_mercado.csv: notas fiscais lançadas no site\n- saude_diaria.csv: relógio Garmin (passos, sono, VFC, FC de repouso, estresse, Body Battery)\n- treinos.csv: atividades do Garmin\n- custos_da_casa_mensais.csv: gastos registrados com bebê, pet e veículos\n\n"+
        "## Ferramentas\nSQL (consultas.sql, SQLite), Power BI ou Python para os gráficos. Sugestão de painel: tendência de gasto, sono × VFC (dispersão com defasagem de 1 dia), treinos por semana.\n\n## Coleta\nDados coletados por um site pessoal (HTML/JS + Supabase), com integração à API pessoal do Garmin e leitura de notas fiscais.\n")});
      baixarArquivo(zipCriar(arqs),"estudo-de-caso-dados-da-minha-vida.zip");st.textContent="✓ Pacote baixado: 5 tabelas anonimizadas, consultas.sql e README.md.";b.disabled=false})
      .catch(function(e){st.textContent="Não consegui gerar: "+e.message;logErro("portfólio",e);b.disabled=false})}}
