/* Dia a Dia RAC — módulo carregado quando a seção abre. Sistema: backup e restauração, agenda única, busca global e a página Sistema.
   Usa as funções do núcleo (js/app.js), que ficam no escopo global. */
  /* ---------- zip sem dependências (para o backup) ---------- */
  var CRC=(function(){var t=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
  function crc32(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
  function zipCriar(arqs){
    var partes=[],dir=[],off=0,enc=new TextEncoder();
    arqs.forEach(function(a){var nome=enc.encode(a.nome),d=a.dados,crc=crc32(d),lh=new DataView(new ArrayBuffer(30));
      lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint32(14,crc,true);lh.setUint32(18,d.length,true);lh.setUint32(22,d.length,true);lh.setUint16(26,nome.length,true);
      partes.push(lh.buffer,nome,d);
      var ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint32(16,crc,true);ch.setUint32(20,d.length,true);ch.setUint32(24,d.length,true);ch.setUint16(28,nome.length,true);ch.setUint32(42,off,true);
      dir.push(ch.buffer,nome);off+=30+nome.length+d.length});
    var tam=dir.reduce(function(s,b){return s+(b.byteLength||b.length)},0),fim=new DataView(new ArrayBuffer(22));
    fim.setUint32(0,0x06054b50,true);fim.setUint16(8,arqs.length,true);fim.setUint16(10,arqs.length,true);fim.setUint32(12,tam,true);fim.setUint32(16,off,true);
    return new Blob(partes.concat(dir,[fim.buffer]),{type:"application/zip"})}
  function zipLer(u){
    var dv=new DataView(u.buffer,u.byteOffset,u.byteLength),e=u.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)return Promise.reject(new Error("não é um .zip"));
    var n=dv.getUint16(e+10,true),p=dv.getUint32(e+16,true),dec=new TextDecoder(),saida=[];
    for(var i=0;i<n;i++){var met=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
      var nome=dec.decode(u.subarray(p+46,p+46+nl)),ini=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);saida.push({nome:nome,met:met,dados:u.subarray(ini,ini+cs)});p+=46+nl+xl+cl}
    return Promise.all(saida.map(function(a){if(a.met===0||/\/$/.test(a.nome))return a;
      return new Response(new Blob([a.dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer().then(function(b){a.dados=new Uint8Array(b);return a})}))}
  function baixarArquivo(blob,nome){var u=URL.createObjectURL(blob),a=h("a",{href:u,download:nome});document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(u);a.remove()},4000)}

  /* ---------- backup: exportar e restaurar ---------- */
  var BKP_TABELAS=["mercados","produtos","notas","itens","orcamentos","registros","pessoal","garmin_dia","garmin_ativ"];
  function lerTabela(t){var acc=[];function pag(de){return SB.from(t).select("*").range(de,de+999).then(function(r){if(r.error)throw new Error(t+": "+r.error.message);acc=acc.concat(r.data||[]);return (r.data||[]).length===1000?pag(de+1000):acc})}return Promise.resolve().then(function(){return pag(0)})}
  function paraCsv(l){if(!l.length)return "";var cols=[];l.forEach(function(r){Object.keys(r).forEach(function(k){if(cols.indexOf(k)<0)cols.push(k)})});
    function cel(v){if(v==null)return "";if(typeof v==="object")v=JSON.stringify(v);v=String(v);return /[";\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
    return "﻿"+cols.join(";")+"\n"+l.map(function(r){return cols.map(function(c){return cel(r[c])}).join(";")}).join("\n")}
  function exportarTudo(comAnexos,st){
    var enc=new TextEncoder(),arqs=[],man={versao:1,criado:new Date().toISOString(),dono:EU.id,site:"Dia a Dia RAC",tabelas:{}},regs=[];
    return BKP_TABELAS.reduce(function(p,t){return p.then(function(){st("Lendo "+t+"…");return lerTabela(t).then(function(l){
      man.tabelas[t]=l.length;if(t==="registros")regs=l;
      arqs.push({nome:"dados/"+t+".json",dados:enc.encode(JSON.stringify(l))},{nome:"dados/"+t+".csv",dados:enc.encode(paraCsv(l))})}).catch(function(e){man.tabelas[t]="não lida: "+e.message})})},Promise.resolve())
    .then(function(){
      if(!comAnexos)return;
      var paths=[];regs.forEach(function(r){(r.arquivos||[]).forEach(function(a){if(a.path)paths.push(a.path)})});man.anexos=paths.length;
      var feitos=0;
      return paths.reduce(function(p,path){return p.then(function(){return SB.storage.from("familia").download(path).then(function(r){
        feitos++;st("Baixando anexos… "+feitos+" de "+paths.length);if(r.error||!r.data)return;
        return r.data.arrayBuffer().then(function(b){arqs.push({nome:"anexos/"+path,dados:new Uint8Array(b)})})})})},Promise.resolve())})
    .then(function(){
      arqs.unshift({nome:"manifesto.json",dados:enc.encode(JSON.stringify(man,null,1))},{nome:"LEIAME.txt",dados:enc.encode(
        "Backup do Dia a Dia RAC ("+man.criado+")\n\nCada tabela está em dados/ duas vezes: .json (para restaurar no site ou levar para outro banco) e .csv (abre no Excel).\n"+
        "anexos/ tem as fotos e PDFs dos registros, no mesmo caminho do cofre do Supabase.\nPara restaurar: Sistema → Restaurar um backup, e escolha este .zip.\n")});
      st("Montando o arquivo…");
      baixarArquivo(zipCriar(arqs),"rac-backup-"+hojeISO()+(comAnexos?"-completo":"")+".zip");
      pessoalGravar("ultimoBackup",hojeISO());
      return man})}
  /* restaurar mescla (não apaga nada): linhas com o mesmo id são atualizadas, as outras entram.
     Num banco novo (outra conta), troca o dono antigo pelo atual nas linhas e nos caminhos dos anexos. */
  function restaurarBackup(arquivo,st){
    return arquivo.arrayBuffer().then(function(b){var u=new Uint8Array(b);
      if(/\.json$/i.test(arquivo.name)){var j=JSON.parse(new TextDecoder().decode(u));return {man:{dono:j.dono},tab:j.tabelas||{},anexos:[]}}
      return zipLer(u).then(function(l){var dec=new TextDecoder(),man=null,tab={},anexos=[];
        l.forEach(function(a){if(a.nome==="manifesto.json")man=JSON.parse(dec.decode(a.dados));else if(/^dados\/[\w-]+\.json$/.test(a.nome))tab[a.nome.slice(6,-5)]=JSON.parse(dec.decode(a.dados));else if(/^anexos\/.+[^/]$/.test(a.nome))anexos.push(a)});
        if(!man)throw new Error("esse .zip não é um backup do site (falta o manifesto.json)");return {man:man,tab:tab,anexos:anexos}})})
    .then(function(B){
      var velho=B.man.dono,novo=EU.id,res={};
      function troca(r){if(velho&&velho!==novo){if(r.user_id===velho)r.user_id=novo;if(r.arquivos)r.arquivos=r.arquivos.map(function(a){return Object.assign({},a,{path:String(a.path||"").replace(velho+"/",novo+"/")})})}return r}
      return BKP_TABELAS.filter(function(t){return B.tab[t]&&B.tab[t].length}).reduce(function(p,t){return p.then(function(){
        var l=B.tab[t].map(troca),feitos=0;st("Restaurando "+t+"…");
        function lote(i){if(i>=l.length)return Promise.resolve();return SB.from(t).upsert(l.slice(i,i+500)).then(function(r){if(r.error)throw new Error(t+": "+r.error.message);feitos+=Math.min(500,l.length-i);return lote(i+500)})}
        return lote(0).then(function(){res[t]=feitos})})},Promise.resolve())
      .then(function(){var n=0;return B.anexos.reduce(function(p,a){return p.then(function(){var path=a.nome.slice(7).replace(velho+"/",novo+"/");n++;st("Enviando anexos… "+n+" de "+B.anexos.length);
        return SB.storage.from("familia").upload(path,new Blob([a.dados]),{upsert:true})})},Promise.resolve()).then(function(){res.anexos=B.anexos.length;return res})})})}

  /* ---------- agenda única: tudo que tem data no site ---------- */
  var AGENDA_TIPOS={familia:["🐾","Família"],veiculo:["🚗","Veículos"],mba:["🎓","MBA"],niver:["🎂","Aniversário"],lembrete:["📌","Lembrete"],sistema:["🛟","Sistema"],carreira:["💼","Carreira"],docs:["📄","Documentos"]};
  function agendaColetar(){
    var hoje=hojeISO(),ev=[];
    function add(data,t,sub,tipo,href,extra){if(data)ev.push(Object.assign({data:String(data).slice(0,10),t:t,sub:sub||"",tipo:tipo,href:href||""},extra||{}))}
    var pReg=isOwner()?SB.from("registros").select("id,quem,tipo,data,titulo,proxima,dados").order("data",{ascending:false}).then(sbOk).catch(function(e){logErro("agenda",e);return []}):Promise.resolve([]);
    return pReg.then(function(regs){
      var visto={};
      regs.forEach(function(r){var F=FAM[r.quem];if(!F)return;var k=r.quem+"|"+r.tipo,tipo=F.veic?"veiculo":F.docs?"docs":"familia",href=F.veic?"#veiculos/"+r.quem:F.docs?"#documentos":"#"+r.quem,d=r.dados||{};
        /* vale só o registro mais novo de cada tipo: um mais novo sem "próxima" (ex.: revisão feita) substitui o aviso do anterior */
        if(!visto[k+"p"]){visto[k+"p"]=1;if(r.proxima&&r.proxima>=maisDias(hoje,-60))add(r.proxima,F.n+": "+r.titulo,tipoInfo(r.tipo)[1]+(r.proxima<hoje?" · estava previsto para "+dataBR(r.proxima):""),tipo,href,{reg:r})}
        if(d.vigenciaFim&&!visto[k+"v"]){visto[k+"v"]=1;add(d.vigenciaFim,F.n+": fim do "+r.titulo,"renovar antes",tipo,href,{reg:r})}
        if(d.garantiaAte&&!visto[k+"g"]&&d.garantiaAte>=hoje){visto[k+"g"]=1;add(d.garantiaAte,F.n+": fim da garantia de "+r.titulo,"",tipo,href,{reg:r})}});
      if(isOwner()){
        mbaAulas().forEach(function(a){if(a.data>=hoje)add(a.data,"Aula: "+a.t,a.hora+(a.prof?" · "+a.prof:""),"mba","#mba")});
        mbaAvals().forEach(function(a){if(!a.feita)add(a.ate,"Responder: "+a.t+(a.disc?" ("+a.disc+")":""),"avaliação do MBA","mba",a.link||"#mba",{ext:!!a.link})});
        var fin=mbaFin();if(fin)fin.ps.forEach(function(q){if(!q.paga)add(q.venc,"Boleto: "+q.n,BRL(q.v),"mba","#mba")});
        withDates().forEach(function(x){if(x.dias<=7||(x.fav&&x.dias<=30))add(maisDias(hoje,x.dias),"Aniversário de "+x.nome,x.fav?"marcado":"", "niver","#aniversarios")});
        (PESSOAL.lembretes||[]).forEach(function(l){if(!l.feito)add(l.data,l.t,"lembrete","lembrete","",{lembrete:l})});
        /* carreira: 5 dias depois de se candidatar sem resposta, hora do follow-up */
        (PESSOAL.candidaturas||[]).forEach(function(c){var d=(c.datas||{}).candidatei;if(c.coluna==="candidatei"&&d&&!c.followup)add(maisDias(d,5),"Follow-up: "+c.t+(c.e?" ("+c.e+")":""),"candidatura de "+dataBR(d),"carreira","#carreira/funil")});
        if(!PESSOAL.ultimoBackup||PESSOAL.ultimoBackup<maisDias(hoje,-30))add(hoje,"Baixar um backup do site",PESSOAL.ultimoBackup?"o último foi em "+dataBR(PESSOAL.ultimoBackup):"nunca foi feito","sistema","#sistema")}
      return ev.sort(function(a,b){return a.data.localeCompare(b.data)})})}
  function agendaLinha(e,redesenhar){
    var T=AGENDA_TIPOS[e.tipo]||["•",""],hoje=hojeISO(),dd=Math.round((new Date(e.data+"T12:00:00")-new Date(hoje+"T12:00:00"))/864e5);
    var quando=dd<0?"há "+(-dd)+(dd===-1?" dia":" dias"):dd===0?"hoje":dd===1?"amanhã":new Date(e.data+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"});
    var li=h("li",{class:(dd<0?"alerta":"")+(e.href?" clic":"")||null},h("span",{class:"grow"},h("b",{text:T[0]+" "+e.t}),e.sub?h("span",{class:"sub",text:e.sub}):null),h("span",{class:"end",text:quando}));
    if(e.href){li.tabIndex=0;li.onclick=function(){if(e.ext)window.open(e.href,"_blank","noopener");else location.hash=e.href}}
    if(e.lembrete){var ok=h("button",{type:"button",class:"ghostbtn",text:"Feito"});ok.onclick=function(ev){ev.stopPropagation();pessoalGravar("lembretes",(PESSOAL.lembretes||[]).map(function(l){return l.id===e.lembrete.id?Object.assign({},l,{feito:hojeISO()}):l}));if(redesenhar)redesenhar()};li.appendChild(ok)}
    return li}
  function wAgenda(){
    var p=wCard("Agenda","bolo","#2E8BD8",["#agenda","ver tudo"],"w5"),ul=h("ul",{class:"wl"},h("li",null,h("span",{class:"sub",text:"Carregando…"})));p.appendChild(ul);
    agendaColetar().then(function(ev){var hoje=hojeISO(),l=ev.filter(function(e){return e.data<=maisDias(hoje,7)});ul.innerHTML="";
      if(!l.length){ul.appendChild(h("li",null,h("span",{class:"sub",text:"Nada vencendo nos próximos 7 dias."})));return}
      l.slice(0,7).forEach(function(e){ul.appendChild(agendaLinha(e))});
      if(l.length>7)ul.appendChild(h("li",null,h("a",{href:"#agenda",class:"link",text:"e mais "+(l.length-7)}))) }).catch(function(e){logErro("agenda",e)});
    return p}
  function renderAgenda(){
    var root=$("#agenda-view");root.innerHTML="";
    var p=panel("Agenda","Tudo que tem data no site num lugar só: retornos e vacinas, seguros e garantias, aulas, avaliações e boletos do MBA, aniversários e seus lembretes.");
    var box=h("div",{class:"stack"},h("p",{class:"sub",text:"Carregando…"}));p.appendChild(box);root.appendChild(p);
    /* lembretes avulsos (tarefas com data) */
    var lp=panel("Novo lembrete"),t=h("input",{type:"text",placeholder:"Ex.: ativar a conta paga do Google Cloud"}),d=h("input",{type:"date",value:hojeISO()}),ok=h("button",{type:"button",text:"Adicionar"});
    ok.onclick=function(){if(!t.value.trim()){t.focus();return}pessoalGravar("lembretes",[{id:"l"+Date.now().toString(36),data:d.value||hojeISO(),t:t.value.trim()}].concat(PESSOAL.lembretes||[]));t.value="";desenhar()};
    lp.appendChild(h("div",{class:"wform"},h("div",{class:"two"},h("label",null,"O quê",t),h("label",null,"Quando",d)),h("div",{class:"vfil"},ok)));root.appendChild(lp);
    function desenhar(){agendaColetar().then(function(ev){box.innerHTML="";var hoje=hojeISO();
      var G=[["Atrasados",function(e){return e.data<hoje}],["Hoje",function(e){return e.data===hoje}],["Próximos 7 dias",function(e){return e.data>hoje&&e.data<=maisDias(hoje,7)}],
        ["Até 30 dias",function(e){return e.data>maisDias(hoje,7)&&e.data<=maisDias(hoje,30)}],["Depois",function(e){return e.data>maisDias(hoje,30)&&e.data<=maisDias(hoje,120)}]];
      G.forEach(function(g){var l=ev.filter(g[1]);if(!l.length)return;box.appendChild(h("h3",{class:"mbag",text:g[0]+" ("+l.length+")"}));box.appendChild(h("ul",{class:"wl"},l.map(function(e){return agendaLinha(e,desenhar)})))});
      if(!box.children.length)box.appendChild(h("p",{class:"empty",text:"Nada com data por enquanto."}))}).catch(function(e){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:"Não consegui montar a agenda ("+e.message+")."}));logErro("agenda",e)})}
    desenhar()}

  /* ---------- busca global: conteúdo, não só nomes de seções ---------- */
  var BUSCA={idx:null,carregando:null};
  function buscaIndice(){
    if(BUSCA.idx)return Promise.resolve(BUSCA.idx);if(BUSCA.carregando)return BUSCA.carregando;
    var MES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    function datas(s){if(!s)return "";s=String(s).slice(0,10);var p=s.split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]+" "+p[2]+"/"+p[1]+" "+MES[+p[1]-1]+" "+p[0]:""}
    var idx=[];function add(tipo,t,sub,extra,alvo){idx.push(Object.assign({tipo:tipo,t:t,sub:sub||"",txt:norm([tipo,t,sub,extra].join(" "))},alvo))}
    var ps=[];
    /* cada fonte é independente: se uma falhar, a busca segue com as outras */
    function tenta(f){try{return f()}catch(e){logErro("busca",e);return Promise.resolve()}}
    if(isOwner()){
      ps.push(tenta(function(){return SB.from("registros").select("id,quem,tipo,data,titulo,detalhes,valor,proxima").then(sbOk).then(function(l){l.forEach(function(r){var F=FAM[r.quem];if(!F)return;
        add(F.n,r.titulo,tipoInfo(r.tipo)[1]+" · "+dataBR(r.data),[r.detalhes,r.valor,datas(r.data),datas(r.proxima)].join(" "),{reg:r})})}).catch(function(){})}));
      ps.push(tenta(function(){return SB.from("garmin_ativ").select("id,inicio,tipo,dados").order("inicio",{ascending:false}).limit(1000).then(sbOk).then(function(l){l.forEach(function(a){var T=ativTipo(a.tipo);
        add("Treino",a.dados.nome||T[0],T[0]+" · "+dataBR(a.inicio.slice(0,10)),[T[0],a.dados.local,datas(a.inicio)].join(" "),{href:"#saude/treino/"+a.id})})}).catch(function(){})}));
      mbaAulas().forEach(function(a){add("MBA",a.t,"aula · "+dataBR(a.data)+" "+a.hora,[a.prof,datas(a.data)].join(" "),{href:"#mba"})});
      mbaAvals().forEach(function(a){add("MBA",a.t+(a.disc?" · "+a.disc:""),"avaliação até "+dataBR(a.ate),datas(a.ate),{href:a.link||"#mba",ext:!!a.link})});
      var finB=mbaFin();if(finB)finB.ps.forEach(function(q){add("MBA","Boleto: "+q.n,BRL(q.v)+" · vence "+dataBR(q.venc)+(q.paga?" · pago":""),datas(q.venc),{href:"#mba"})});
      ((PESSOAL.mba||{}).disciplinas||[]).forEach(function(d){(d.roteiro||[]).forEach(function(r){add("MBA",r.t,d.nome,r.sub,{href:"#mba"})});(d.materiais||[]).forEach(function(m){add("MBA",m.n,"material · "+d.nome,"",{href:m.url,ext:true})});(d.cola||[]).forEach(function(c){add("MBA",c.t,"fórmula · "+d.nome,c.f+" "+(c.d||""),{href:"#mba"})})});
      ((PESSOAL.mba||{}).materiaisGerais||[]).forEach(function(m){add("MBA",m.n,"material do curso",m.sub,{href:m.url,ext:true})});
      items.forEach(function(x){add("Aniversário",x.nome,String(x.dia).padStart(2,"0")+"/"+String(x.mes).padStart(2,"0"),MES[x.mes-1],{href:"#aniversarios"})});
      (PESSOAL.projetos||[]).forEach(function(p){add("Projeto",p.t,"",p.txt,{href:"#conexoes/projeto/"+p.id})});
      (PESSOAL.salvos||[]).forEach(function(s){add("Guardado",s.t,s.f,s.tema,{href:s.u,ext:true})});
      (PESSOAL.lembretes||[]).forEach(function(l){add("Lembrete",l.t,dataBR(l.data),datas(l.data),{href:"#agenda"})});
      ps.push(tenta(function(){return getJson("vagas.json").then(function(v){(v.vagas||[]).forEach(function(x){add("Vaga",x.t,[x.e,x.m,x.nv].filter(Boolean).join(" · "),x.cidade,{href:x.ap||x.pl,ext:true})})}).catch(function(){})}));
      ps.push(tenta(function(){return getJson("tecdados.json").then(function(v){(v.noticias||[]).forEach(function(x){add("Notícia",x.t,x.f,datas(x.d),{href:x.u,ext:true})})}).catch(function(){})}));
      ps.push(tenta(function(){return getJson("noticias.json").then(function(v){(v.noticias||[]).forEach(function(x){add("Notícia",x.t,x.f,datas(x.d),{href:x.u,ext:true})})}).catch(function(){})}))}
    /* Mercado: produtos (todo mundo da casa vê) */
    ps.push(tenta(function(){return SB.from("produtos").select("nome,categoria").then(sbOk).then(function(l){l.forEach(function(p){add("Mercado",p.nome,p.categoria||"produto","",{produto:p.nome})})}).catch(function(){})}));
    BUSCA.carregando=Promise.all(ps).then(function(){BUSCA.idx=idx;BUSCA.carregando=null;setTimeout(function(){BUSCA.idx=null},10*60e3);return idx});
    return BUSCA.carregando}
  function buscar(q){var ts=norm(q).split(/\s+/).filter(Boolean);return buscaIndice().then(function(idx){return idx.filter(function(x){return ts.every(function(t){return x.txt.indexOf(t)>=0})})})}
  function abrirResultado(x){
    if(x.reg){var r=x.reg,F=FAM[r.quem];famVista[r.quem]="linha";famFiltro[r.quem]="";famAlvo[r.quem]={id:r.id};var alvo=F.veic?"#veiculos/"+r.quem:F.docs?"#documentos":"#"+r.quem;
      if(location.hash===alvo)route();else location.hash=alvo;return}
    if(x.produto){if(window.RACmercado)window.RACmercado.verProduto(x.produto);return}
    if(x.ext)window.open(x.href,"_blank","noopener");else location.hash=x.href}
  function linhaResultado(x,aoAbrir){var li=h("li",{class:"clic",tabindex:"0",role:"button"},h("span",{class:"grow"},h("b",{text:x.t}),h("span",{class:"sub",text:x.tipo+(x.sub?" · "+x.sub:"")})));
    li.onclick=function(){if(aoAbrir)aoAbrir();abrirResultado(x)};li.onkeydown=function(e){if(e.key==="Enter")li.onclick()};return li}
  function renderBusca(q){
    var root=$("#busca-view");root.innerHTML="";var inp=h("input",{type:"search",value:q||"",placeholder:"Busque em tudo: registros, treinos, MBA, vagas, notícias, produtos, datas…"});
    var p=panel("Busca"),box=h("div");p.appendChild(inp);p.appendChild(box);root.appendChild(p);
    var tmr;function ir(){clearTimeout(tmr);tmr=setTimeout(function(){var v=inp.value.trim();history.replaceState(null,"","#busca/"+encodeURIComponent(v));box.innerHTML="";if(v.length<2)return;
      box.appendChild(h("p",{class:"sub",text:"Procurando…"}));
      buscar(v).then(function(l){box.innerHTML="";if(!l.length){box.appendChild(h("p",{class:"empty",text:"Nada encontrado para “"+v+"”."}));return}
        var G={};l.forEach(function(x){(G[x.tipo]=G[x.tipo]||[]).push(x)});box.appendChild(h("p",{class:"sub",text:l.length+(l.length===1?" resultado":" resultados")}));
        Object.keys(G).forEach(function(k){box.appendChild(h("h3",{class:"mbag",text:k+" ("+G[k].length+")"}));box.appendChild(h("ul",{class:"wl"},G[k].slice(0,40).map(function(x){return linhaResultado(x)})))})})},250)}
    inp.addEventListener("input",ir);ir();setTimeout(function(){inp.focus()},50)}

  /* ---------- página Sistema ---------- */
  function renderSistema(){
    var root=$("#sistema-view");root.innerHTML="";
    /* sincronização e conflitos */
    var ps=panel("Sincronização","Os dados pessoais ficam na sua conta e com uma cópia neste aparelho. Se o mesmo dado mudar em dois lugares, você escolhe qual vale.");
    var np=pendentes(),nc=Object.keys(SIS.conflitos);
    ps.appendChild(h("div",{class:"kgasto"},h("div",null,h("span",{class:"kl",text:"Situação"}),h("b",{class:"kv",text:nc.length?"conflito":SIS.falhaSinc?"sem conexão":np.length?"pendente":"sincronizado"})),
      h("div",null,h("span",{class:"kl",text:"Última sincronização"}),h("b",{class:"kv",text:SIS.ultimaSinc?new Date(SIS.ultimaSinc).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"—"})),
      h("div",null,h("span",{class:"kl",text:"Alterações pendentes"}),h("b",{class:"kv",text:String(np.length)}))));
    if(SIS.falhaSinc)ps.appendChild(h("p",{class:"qrwarn",text:"⚠ "+SIS.falhaSinc}));
    if(np.length)ps.appendChild(h("p",{class:"sub",text:"Pendentes: "+np.map(function(k){return NOMES_CHAVE[k]||k}).join(", ")+". Sobem sozinhas quando a conta responder."}));
    nc.forEach(function(ch){var c=SIS.conflitos[ch],b1=h("button",{type:"button",text:"Manter a deste aparelho"}),b2=h("button",{type:"button",class:"ghostbtn",text:"Ficar com a da conta"});
      b1.onclick=function(){SIS.versao[ch]=c.tConta;delete SIS.conflitos[ch];pessoalGravar(ch,c.local,function(){renderSistema()})};
      b2.onclick=function(){PESSOAL[ch]=c.conta;copiaGravar(ch,c.conta,true,c.tConta);SIS.versao[ch]=c.tConta;delete SIS.conflitos[ch];syncSelo();renderSistema()};
      ps.appendChild(h("div",{class:"conx"},h("b",{text:"⚠ "+(NOMES_CHAVE[ch]||ch)+" mudou aqui e em outro lugar"}),
        h("p",{class:"sub",text:"Neste aparelho: "+resumoValor(c.local)+" (mudou em "+new Date(c.tLocal).toLocaleString("pt-BR")+") · Na conta: "+resumoValor(c.conta)+" (mudou em "+new Date(c.tConta).toLocaleString("pt-BR")+")"}),h("div",{class:"vfil"},b1,b2)))});
    var sinc=h("button",{type:"button",class:"ghostbtn",text:"Sincronizar agora"});sinc.onclick=function(){sinc.disabled=true;pessoalCarregar().then(function(){SIS.falhaSinc=null}).catch(function(e){SIS.falhaSinc=e.message;logErro("sincronização",e)}).then(function(){reenviarPendentes();renderSistema()})};
    ps.appendChild(h("div",{class:"vfil"},sinc));root.appendChild(ps);
    /* backup */
    var pb=panel("Backup e portabilidade","Um arquivo .zip com todas as tabelas em JSON (para restaurar ou levar para outro banco) e CSV (abre no Excel). Guarde no seu Google Drive.");
    var stb=h("p",{class:"sub",role:"status"}),ex=h("button",{type:"button",text:"Exportar tudo (só dados)"}),exa=h("button",{type:"button",class:"ghostbtn",text:"Exportar com fotos e PDFs"});
    pb.appendChild(h("p",null,h("b",{text:"Último backup baixado: "}),PESSOAL.ultimoBackup?dataBR(PESSOAL.ultimoBackup):"nunca"));
    function exp(c,b){b.disabled=true;exportarTudo(c,function(t){stb.textContent=t}).then(function(m){stb.textContent="✓ Backup baixado: "+Object.keys(m.tabelas).map(function(k){return k+" "+m.tabelas[k]}).join(", ")+(m.anexos!=null?", anexos "+m.anexos:"")+".";b.disabled=false})
      .catch(function(e){stb.textContent="Não consegui exportar: "+e.message;logErro("backup",e);b.disabled=false})}
    ex.onclick=function(){exp(false,ex)};exa.onclick=function(){exp(true,exa)};
    var rin=h("input",{type:"file",accept:".zip,.json",hidden:""}),rb=h("button",{type:"button",class:"ghostbtn",text:"Restaurar um backup"});rb.onclick=function(){rin.click()};
    rin.onchange=function(){var f=rin.files[0];if(!f)return;if(!confirm("Restaurar “"+f.name+"”? O que está no backup é mesclado com o que já existe (nada é apagado)."))return;
      restaurarBackup(f,function(t){stb.textContent=t}).then(function(r){stb.textContent="✓ Restaurado: "+Object.keys(r).map(function(k){return k+" "+r[k]}).join(", ")+". Recarregando…";setTimeout(function(){location.reload()},2500)})
        .catch(function(e){stb.textContent="Não consegui restaurar: "+e.message;logErro("restaurar",e)})};
    pb.appendChild(h("div",{class:"vfil"},ex,exa,rb,rin));pb.appendChild(stb);
    var lb=h("ul",{class:"wl"});pb.appendChild(h("h3",{class:"mbag",text:"Backups automáticos (todo domingo, no servidor)"}));pb.appendChild(lb);
    /* cada quadro carrega por conta própria: se um falhar, os outros aparecem */
    Promise.resolve().then(function(){return SB.storage.from("backups").list(EU.id,{sortBy:{column:"name",order:"desc"}})}).catch(function(e){return {error:e}}).then(function(r){
      if(r.error||!(r.data||[]).length){lb.appendChild(h("li",null,h("span",{class:"sub",text:"Ainda nenhum. O primeiro sai no domingo depois que a rotina estiver ligada."})));return}
      r.data.forEach(function(f){var b=h("button",{type:"button",class:"ghostbtn",text:"Baixar"});b.onclick=function(){SB.storage.from("backups").download(EU.id+"/"+f.name).then(function(x){if(x.data)baixarArquivo(x.data,"rac-backup-servidor-"+f.name)})};
        lb.appendChild(h("li",null,h("span",{class:"grow",text:f.name.replace(".json","").split("-").reverse().join("/")}),b))})});
    root.appendChild(pb);
    /* rotina automática */
    var pr=panel("Rotina automática","Todo dia às 6h o servidor atualiza a Garmin, confere a agenda e manda os avisos pelo Telegram; aos domingos guarda um backup.");
    var lr=h("ul",{class:"wl"},h("li",null,h("span",{class:"sub",text:"Carregando…"})));pr.appendChild(lr);root.appendChild(pr);
    Promise.resolve().then(function(){return SB.from("rotina_log").select("quando,ok,resumo").order("quando",{ascending:false}).limit(10)}).catch(function(e){return {error:e}}).then(function(r){lr.innerHTML="";
      if(r.error){lr.appendChild(h("li",null,h("span",{class:"qrwarn",text:/rotina_log|relation|schema cache/i.test(r.error.message)?"A rotina ainda não está ligada: falta rodar o supabase/008_sistema.sql.":"Não consegui ler ("+r.error.message+")."})));return}
      if(!r.data.length){lr.appendChild(h("li",null,h("span",{class:"sub",text:"Ainda não rodou. A primeira vez é amanhã às 6h."})));return}
      r.data.forEach(function(x){var s=x.resumo||{},partes=[];if(s.garmin_dias&&s.garmin_dias.salvos!=null)partes.push(s.garmin_dias.salvos+" dias da Garmin");if(s.garmin_treinos&&s.garmin_treinos.salvas!=null)partes.push(s.garmin_treinos.salvas+" treinos conferidos");
        if(s.alertas&&s.alertas.itens!=null)partes.push(s.alertas.itens+" avisos"+(s.alertas.telegram?" ("+s.alertas.telegram+")":""));if(s.backup&&!s.backup.erro)partes.push("backup feito");
        Object.keys(s).forEach(function(k){if(s[k]&&s[k].erro)partes.push("⚠ "+k+": "+s[k].erro)});
        lr.appendChild(h("li",{class:x.ok?null:"alerta"},h("span",{class:"grow"},h("b",{text:new Date(x.quando).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+(x.ok?" · ok":" · com falha")}),h("span",{class:"sub",text:partes.join(" · ")}))))})});
    /* falhas */
    var pf=panel("Falhas recentes","O que deu errado no site ou na rotina, com a mensagem, para não depender do console do navegador.");var lf=h("ul",{class:"wl"});pf.appendChild(lf);root.appendChild(pf);
    Promise.resolve().then(function(){return SB.from("erros").select("id,quando,origem,mensagem,aparelho").order("quando",{ascending:false}).limit(30)}).catch(function(e){return {error:e}}).then(function(r){
      var l=(r.data||[]).map(function(x){return {quando:x.quando,origem:x.origem,mensagem:x.mensagem,onde:x.aparelho==="servidor"?"servidor":"conta"}});
      if(r.error)l=SIS.erros.map(function(x){return Object.assign({onde:"este aparelho"},x)});
      if(!l.length){lf.appendChild(h("li",null,h("span",{class:"sub",text:"Nenhuma falha registrada. 🎉"})));return}
      l.forEach(function(x){lf.appendChild(h("li",null,h("span",{class:"grow"},h("b",{text:x.origem+": "+x.mensagem}),h("span",{class:"sub",text:new Date(x.quando).toLocaleString("pt-BR")+" · "+x.onde}))))});
      if(!r.error){var lim=h("button",{type:"button",class:"ghostbtn",text:"Limpar as falhas"});lim.onclick=function(){SB.from("erros").delete().gte("id",0).then(function(){SIS.erros=[];try{localStorage.removeItem("rac-erros")}catch(e){}renderSistema()})};pf.appendChild(lim)}});
    /* robôs do GitHub: se um parar (fonte quebrou ou veio vazia), aparece aqui; o GitHub também manda e-mail */
    var pg=panel("Robôs de coleta","Vagas (todo dia às 7h) e notícias de Sorocaba e de tecnologia (a cada 3 horas). Se a fonte quebrar ou vier vazia, o robô falha de propósito e o GitHub avisa por e-mail."),lg=h("ul",{class:"wl"});pg.appendChild(lg);root.appendChild(pg);
    [["vagas.json","Vagas","vagas",30],["noticias.json","Notícias de Sorocaba","noticias",8],["tecdados.json","Notícias de dados e tecnologia","noticias",8]].forEach(function(r){
      getJson(r[0]+"?v="+Date.now()).then(function(d){var q=new Date(d.coletado),horas=(Date.now()-q)/36e5,n=(d[r[2]]||[]).length,velho=horas>r[3]||!n;
        lg.appendChild(h("li",{class:velho?"alerta":null},h("span",{class:"grow"},h("b",{text:(velho?"⚠ ":"✓ ")+r[1]}),h("span",{class:"sub",text:n+" itens · coletado "+q.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+(velho?" · parado há "+Math.round(horas)+" h":"")}))))})
      .catch(function(e){lg.appendChild(h("li",{class:"alerta"},h("span",{class:"grow"},h("b",{text:"⚠ "+r[1]}),h("span",{class:"sub",text:"não consegui ler ("+e.message+")"}))))})});
    pg.appendChild(h("div",{class:"vfil"},ext("https://github.com/raynercarvalho1/rac/actions","Ver os robôs no GitHub","ghostbtn")));
    /* testes automáticos */
    var pt=panel("Testes automáticos","A cada mudança publicada, o GitHub roda os testes do site: leitura de nota fiscal e de abastecimento, leitor de arquivos do relógio, importação sem duplicar e o bloqueio de quem não fez login.");
    pt.appendChild(h("a",{href:"https://github.com/raynercarvalho1/rac/actions/workflows/testes.yml",target:"_blank",rel:"noopener"},h("img",{src:"https://github.com/raynercarvalho1/rac/actions/workflows/testes.yml/badge.svg",alt:"Situação dos testes",loading:"lazy"})));
    root.appendChild(pt)}
