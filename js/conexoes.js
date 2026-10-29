/* Dia a Dia RAC — módulo carregado quando a seção abre. Conexões do dia: o mesmo tema em notícias, vagas, MBA, estudos e projetos.
   Usa as funções do núcleo (js/app.js), que ficam no escopo global. */
  /* ===== Conexões do dia =====
     Procura o mesmo tema em lugares que ficam separados no site: notícias de dados e tecnologia (tecdados.json),
     vagas (vagas.json), MBA (aulas, roteiro e materiais), trilhas de Estudos e os seus projetos (PESSOAL.projetos).
     Um tema vira conexão quando aparece numa notícia e em pelo menos mais duas fontes. Não usa IA: os temas são
     reconhecidos por palavras-chave, e a explicação diz exatamente o que foi encontrado em cada lugar. */
  function conexoesFontes(){
    function j(u){return getJson(u+"?v="+new Date().toISOString().slice(0,13)).catch(function(){return null})}
    return Promise.all([j("tecdados.json"),j("vagas.json")]).then(function(r){
      var F={noticias:[],vagas:[],mba:[],estudos:[],projetos:[]},hoje=hojeISO();
      ((r[0]||{}).noticias||[]).forEach(function(n){var ts=temasDe(n.t);if(ts.length)F.noticias.push({temas:ts,t:n.t,u:n.u,f:n.f,d:n.d})});
      ((r[1]||{}).vagas||[]).forEach(function(v){var ts=temasDe(v.t+" "+(v.nv||""));if(ts.length)F.vagas.push({temas:ts,t:v.t,e:v.e,m:v.m,u:v.ap||v.pl,dias:v.d})});
      /* MBA: aulas (as próximas pesam mais), tópicos do roteiro e materiais */
      var M=PESSOAL.mba||{},f=mbaFeito();
      (M.aulas||[]).forEach(function(a){var ts=temasDe(a.t);if(ts.length)F.mba.push({temas:ts,t:"Aula: "+a.t,quando:a.data,futura:a.data>=hoje,u:"#mba"})});
      (M.disciplinas||[]).forEach(function(d){(d.roteiro||[]).forEach(function(t){var ts=temasDe(d.nome+" "+t.t+" "+(t.sub||""));if(ts.length)F.mba.push({temas:ts,t:d.nome+": "+t.t,feito:!!f[d.id+":"+t.k],u:"#mba"})});
        (d.materiais||[]).forEach(function(m){var ts=temasDe(d.nome+" "+m.n);if(ts.length)F.mba.push({temas:ts,t:"Material: "+m.n,u:m.url,ext:true})})});
      /* Estudos: próximos exercícios ainda não feitos de cada trilha */
      var fe=feitos();TRILHAS.forEach(function(tr){tr.itens.forEach(function(i){if(fe[i[0]])return;var ts=temasDe(tr.n+" "+i[1]+" "+i[2]).concat(tr.k==="bi"?["bi"]:[]);
        if(ts.length)F.estudos.push({temas:ts.filter(function(x,k){return ts.indexOf(x)===k}),t:tr.n+": "+i[1],u:i[3],ext:true})})});
      (PESSOAL.projetos||[]).forEach(function(p){var ts=temasDe(p.t+" "+(p.txt||""));if(ts.length)F.projetos.push({temas:ts,t:p.t,id:p.id})});
      return F})}
  /* pontua cada tema: precisa de notícia + pelo menos duas outras fontes; aula chegando e projeto seu valem mais */
  function conexoesDoDia(F){
    var hoje=hojeISO(),em14=maisDias(hoje,14),disp=(PESSOAL.conexoesDisp||{})[hoje]||[];
    return TEMAS.map(function(T){var k=T[0],de=function(l){return l.filter(function(x){return x.temas.indexOf(k)>=0})};
      var c={tema:k,nome:T[1],noticias:de(F.noticias),vagas:de(F.vagas),mba:de(F.mba),estudos:de(F.estudos),projetos:de(F.projetos)};
      var tipos=["vagas","mba","estudos","projetos"].filter(function(x){return c[x].length}).length;
      if(!c.noticias.length||tipos<2||disp.indexOf(k)>=0)return null;
      var aula=c.mba.filter(function(m){return m.futura&&m.quando<=em14}).sort(function(a,b){return a.quando.localeCompare(b.quando)})[0];
      c.aula=aula;c.score=tipos*3+Math.min(c.noticias.length,5)+Math.min(c.vagas.length,10)/2+(aula?6:0)+(c.projetos.length?5:0);
      return c}).filter(Boolean).sort(function(a,b){return b.score-a.score})}
  function conexaoTexto(c){
    var p=[],n=c.noticias[0];
    p.push("A notícia “"+n.t+"” ("+n.f+") fala de "+c.nome+(c.noticias.length>1?", e mais "+(c.noticias.length-1)+" da semana também":"")+".");
    if(c.vagas.length)p.push(c.vagas.length+(c.vagas.length===1?" vaga aberta pede":" vagas abertas pedem")+" isso, como “"+c.vagas[0].t+"”"+(c.vagas[0].e?" na "+c.vagas[0].e:"")+".");
    if(c.aula)p.push("No MBA, a aula “"+c.aula.t.replace(/^Aula: /,"")+"” é em "+dataBR(c.aula.quando)+".");
    else if(c.mba.length)p.push("No MBA, o tema aparece em “"+c.mba[0].t+"”.");
    if(c.estudos.length)p.push("Na trilha de estudos, o próximo exercício é “"+c.estudos[0].t+"”.");
    if(c.projetos.length)p.push("E o seu projeto “"+c.projetos[0].t+"” menciona esse assunto.");
    return p.join(" ")}
  function salvarItem(it){var l=(PESSOAL.salvos||[]).slice();if(l.some(function(x){return x.u===it.u}))return false;l.unshift(Object.assign({quando:hojeISO()},it));pessoalGravar("salvos",l);return true}
  /* um cartão de conexão: o porquê, as peças encontradas e as ações */
  function cartaoConexao(c,compacto,redesenhar){
    var box=h("div",{class:"conx"});
    box.appendChild(h("div",{class:"conxh"},h("b",{text:"🔗 "+c.nome}),h("span",{class:"sub",text:[c.noticias.length?c.noticias.length+" notícia"+(c.noticias.length>1?"s":""):"",c.vagas.length?c.vagas.length+" vaga"+(c.vagas.length>1?"s":""):"",c.mba.length?"MBA":"",c.estudos.length?"estudos":"",c.projetos.length?"projeto":""].filter(Boolean).join(" · ")})));
    box.appendChild(h("p",{class:"conxp",text:conexaoTexto(c)}));
    var n=c.noticias[0],acts=h("div",{class:"vfil"});
    acts.appendChild(ext(n.u,"Ler a notícia","ghostbtn"));
    var g=h("button",{type:"button",class:"ghostbtn",text:(PESSOAL.salvos||[]).some(function(x){return x.u===n.u})?"✓ Guardada":"Guardar notícia"});
    g.onclick=function(){salvarItem({tipo:"noticia",t:n.t,u:n.u,f:n.f,tema:c.nome});g.textContent="✓ Guardada";g.disabled=true};acts.appendChild(g);
    var est=c.aula||c.mba.filter(function(m){return !m.feito})[0]||c.estudos[0];
    if(est){var e=est.ext?ext(est.u,"Estudar o tema","ghostbtn pri"):h("a",{href:est.u,class:"ghostbtn pri",text:"Estudar o tema"});acts.appendChild(e)}
    if(c.vagas.length)acts.appendChild(ext(c.vagas[0].u,"Analisar a vaga","ghostbtn"));
    var pj=c.projetos[0];acts.appendChild(h("a",{href:"#conexoes/projeto/"+(pj?pj.id:"novo:"+c.tema),class:"ghostbtn",text:pj?"Atualizar o projeto":"Criar projeto"}));
    if(!compacto){var dis=h("button",{type:"button",class:"ghostbtn",text:"Dispensar hoje"});
      dis.onclick=function(){var D={},hj=hojeISO();D[hj]=((PESSOAL.conexoesDisp||{})[hj]||[]).concat([c.tema]);pessoalGravar("conexoesDisp",D);if(redesenhar)redesenhar()};acts.appendChild(dis)}
    box.appendChild(acts);
    if(!compacto){
      var det=h("details",{class:"famvals"},h("summary",{text:"Ver tudo o que foi encontrado"}));
      function lista(rot,l,fn){if(!l.length)return;det.appendChild(h("h3",{class:"mbag",text:rot}));det.appendChild(h("ul",{class:"wl"},l.slice(0,6).map(fn)))}
      lista("Notícias",c.noticias,function(x){return h("li",null,h("span",{class:"grow"},h("b",{text:x.t}),h("span",{class:"sub",text:x.f+" · "+new Date(x.d).toLocaleDateString("pt-BR")})),ext(x.u,"Abrir","ghostbtn"))});
      lista("Vagas",c.vagas,function(x){return h("li",null,h("span",{class:"grow"},h("b",{text:x.t}),h("span",{class:"sub",text:[x.e,x.m].filter(Boolean).join(" · ")})),ext(x.u,"Ver","ghostbtn"))});
      lista("MBA",c.mba,function(x){return h("li",null,h("span",{class:"grow"},h("b",{text:x.t}),h("span",{class:"sub",text:x.quando?dataBR(x.quando):x.feito?"já estudado":""})),x.ext?ext(x.u,"Abrir","ghostbtn"):h("a",{href:x.u,class:"ghostbtn",text:"Abrir"}))});
      lista("Estudos",c.estudos,function(x){return h("li",null,h("span",{class:"grow",text:x.t}),ext(x.u,"Abrir","ghostbtn"))});
      lista("Seus projetos",c.projetos,function(x){return h("li",null,h("span",{class:"grow",text:x.t}),h("a",{href:"#conexoes/projeto/"+x.id,class:"ghostbtn",text:"Abrir"}))});
      box.appendChild(det)}
    return box}
  function wConexoes(){
    var p=wCard("Conexões do dia","link","#0E8A6A",["#conexoes","ver todas"],"w5"),b=h("div",null,h("p",{class:"sub",text:"Procurando ligações…"}));p.appendChild(b);
    conexoesFontes().then(function(F){var l=conexoesDoDia(F);b.innerHTML="";
      if(!l.length){b.appendChild(h("p",{class:"sub",text:"Nenhuma ligação forte hoje entre notícias, vagas, MBA e seus projetos."}));return}
      l.slice(0,2).forEach(function(c){b.appendChild(cartaoConexao(c,true))})}).catch(function(){b.innerHTML="";b.appendChild(h("p",{class:"sub",text:"Não consegui procurar agora."}))});
    return p}
  function renderConexoes(sub,arg){
    var root=$("#conexoes-view");root.innerHTML="";window.scrollTo(0,0);
    if(sub==="projeto"){root.appendChild(formProjeto(arg));return}
    var p=panel("Conexões do dia","O mesmo tema em notícias de dados, vagas, MBA, trilhas de estudo e nos seus projetos. Muda conforme chegam notícias e vagas novas."),box=h("div",{class:"stack"},h("p",{class:"sub",text:"Procurando ligações…"}));
    p.appendChild(box);root.appendChild(p);
    function desenhar(){conexoesFontes().then(function(F){var l=conexoesDoDia(F);box.innerHTML="";
      if(!l.length)box.appendChild(h("p",{class:"empty",text:"Nenhuma ligação forte hoje. Volte mais tarde: as notícias são atualizadas a cada 3 horas."}));
      l.forEach(function(c){box.appendChild(cartaoConexao(c,false,desenhar))})})}
    desenhar();
    /* projetos e ideias: o que você escreve aqui entra nas conexões */
    var pj=panel("Seus projetos e ideias","Escreva o que está fazendo ou quer fazer. Quando um tema do projeto aparecer em notícias e vagas, ele entra nas conexões.");
    var nv=h("a",{href:"#conexoes/projeto/novo",class:"ghostbtn pri",text:"+ Novo projeto"});pj.appendChild(h("div",{class:"vfil"},nv));
    var lp=PESSOAL.projetos||[];
    if(lp.length)pj.appendChild(h("ul",{class:"wl"},lp.map(function(x){var ts=temasDe(x.t+" "+(x.txt||"")).map(function(k){return TEMAS.filter(function(t){return t[0]===k})[0][1]});
      return h("li",null,h("span",{class:"grow"},h("b",{text:x.t}),h("span",{class:"sub",text:ts.length?"Temas: "+ts.join(", "):"Sem tema reconhecido ainda (cite tecnologias: Python, SQL, Power BI…)"})),h("a",{href:"#conexoes/projeto/"+x.id,class:"ghostbtn",text:"Editar"}))})));
    root.appendChild(pj);
    /* o que foi guardado */
    var sv=PESSOAL.salvos||[],ps=panel("Guardados",sv.length?sv.length+(sv.length===1?" item":" itens"):"Notícias que você guardar aparecem aqui.");
    if(sv.length)ps.appendChild(h("ul",{class:"wl"},sv.map(function(x){var rm=h("button",{type:"button",class:"ghostbtn",text:"Tirar"});
      rm.onclick=function(){pessoalGravar("salvos",(PESSOAL.salvos||[]).filter(function(y){return y.u!==x.u}));renderConexoes()};
      return h("li",null,h("span",{class:"grow"},h("b",{text:x.t}),h("span",{class:"sub",text:[x.tema,x.f,"guardada em "+dataBR(x.quando)].filter(Boolean).join(" · ")})),ext(x.u,"Abrir","ghostbtn"),rm)})));
    root.appendChild(ps)}
  function formProjeto(arg){
    var l=PESSOAL.projetos||[],novo=!arg||/^novo/.test(arg),p0=novo?null:l.filter(function(x){return x.id===arg})[0],tema=/^novo:/.test(arg||"")?arg.slice(5):"";
    var T=TEMAS.filter(function(t){return t[0]===tema})[0];
    var p=panel(p0?"Editar projeto":"Novo projeto","Cite as tecnologias e assuntos (Python, SQL, Power BI, estatística, IA…). É por elas que as conexões acham o projeto.");
    var t=h("input",{type:"text",value:p0?p0.t:(T?"Projeto com "+T[1]:""),placeholder:"Ex.: Dashboard de gastos da casa"}),tx=h("textarea",{rows:"5",placeholder:"O que é, o que falta, ideias…"});tx.value=p0?p0.txt||"":(T?"Tema: "+T[1]+".":"");
    var ok=h("button",{type:"button",text:"Salvar"}),volta=h("a",{href:"#conexoes",class:"ghostbtn",text:"Voltar"}),del=p0?h("button",{type:"button",class:"ghostbtn",text:"Apagar"}):null,st=h("p",{class:"sub",role:"status"});
    ok.onclick=function(){var tt=t.value.trim();if(!tt){st.textContent="Dê um nome ao projeto.";return}
      var nl=l.slice(),o={id:p0?p0.id:"p"+Date.now().toString(36),t:tt,txt:tx.value.trim(),atualizado:hojeISO()};
      if(p0)nl=nl.map(function(x){return x.id===p0.id?o:x});else nl.unshift(o);pessoalGravar("projetos",nl);location.hash="#conexoes"};
    if(del){var arm=false;del.onclick=function(){if(!arm){arm=true;del.textContent="Toque de novo para apagar";return}pessoalGravar("projetos",l.filter(function(x){return x.id!==p0.id}));location.hash="#conexoes"}}
    p.appendChild(h("div",{class:"wform"},h("label",null,"Nome",t),h("label",null,"Descrição",tx),h("div",{class:"vfil"},ok,volta,del),st));
    return p}
