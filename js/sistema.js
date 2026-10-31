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
  var AGENDA_TIPOS={familia:["🐾","Família"],veiculo:["🚗","Veículos"],mba:["🎓","MBA"],niver:["🎂","Aniversário"],lembrete:["📌","Lembrete"],sistema:["🛟","Sistema"],carreira:["💼","Carreira"],docs:["📄","Documentos"],saude:["❤️","Saúde"]};
  /* a área de cada item aparece só como ícone (o título fica curto e cabe no celular); "pre" é a área por extenso, usada no briefing falado */
  var AGENDA_ICO={eddie:"🐶",olivia:"👶",civic:"🚗",moto:"🛵",c3:"🚙",docs:"📄"};
  function agendaIco(e){return e.ico||(AGENDA_TIPOS[e.tipo]||["•"])[0]}
  function agendaColetar(){
    var hoje=hojeISO(),ev=[];
    function add(data,t,sub,tipo,href,extra){if(data)ev.push(Object.assign({data:String(data).slice(0,10),t:t,sub:sub||"",tipo:tipo,href:href||""},extra||{}))}
    var pReg=isOwner()?SB.from("registros").select("id,quem,tipo,data,titulo,proxima,dados").order("data",{ascending:false}).then(sbOk).catch(function(e){logErro("agenda",e);return []}):Promise.resolve([]);
    return pReg.then(function(regs){
      var visto={};
      regs.forEach(function(r){var F=FAM[r.quem];if(!F)return;var k=r.quem+"|"+r.tipo,tipo=F.veic?"veiculo":F.docs?"docs":"familia",href=F.veic?"#veiculos/"+r.quem:F.docs?"#documentos":"#"+r.quem,d=r.dados||{};
        /* vale só o registro mais novo de cada tipo: um mais novo sem "próxima" (ex.: revisão feita) substitui o aviso do anterior */
        var ex={reg:r,ico:AGENDA_ICO[r.quem],pre:F.n};
        if(!visto[k+"p"]){visto[k+"p"]=1;if(r.proxima&&r.proxima>=maisDias(hoje,-60))add(r.proxima,r.titulo,F.n+" · "+tipoInfo(r.tipo)[1]+(r.proxima<hoje?" · estava previsto para "+dataBR(r.proxima):""),tipo,href,ex)}
        if(d.vigenciaFim&&!visto[k+"v"]){visto[k+"v"]=1;add(d.vigenciaFim,"Fim do "+r.titulo,F.n+" · renovar antes",tipo,href,ex)}
        if(d.garantiaAte&&!visto[k+"g"]&&d.garantiaAte>=hoje){visto[k+"g"]=1;add(d.garantiaAte,"Fim da garantia de "+r.titulo,F.n,tipo,href,ex)}});
      /* rede em Sorocaba: contatos de RH com os posts sem olhar há 7 dias ou mais viram um lembrete só */
      var rede=regs.filter(function(r){return r.quem==="rede"&&r.tipo==="contato"}),atras=rede.filter(function(r){var v=(r.dados||{}).visto;return !v||String(v).slice(0,10)<=maisDias(hoje,-7)});
      if(atras.length)add(hoje,"Olhar os posts de "+atras.length+(atras.length===1?" contato":" contatos")+" de RH",atras.slice(0,4).map(function(r){return r.titulo+" ("+r.valor+")"}).join(", ")+(atras.length>4?"…":""),"carreira","#rede",{ico:"🤝",pre:"Rede"});
      /* IPVA de SP: vence em janeiro pelo final da placa (cota única com desconto ou 1ª parcela); aparece de novembro até quitar.
         Some quando houver um registro "Licenciamento e impostos" com IPVA do ano. */
      var ano=+hoje.slice(0,4)+(+hoje.slice(5,7)>=11?1:0),dIpva=ano+"-01-09";
      if(dIpva>=maisDias(hoje,-60)&&dIpva<=maisDias(hoje,75))Object.keys(FAM).forEach(function(q){var F=FAM[q];if(!F.veic||/antigo/i.test(F.n))return;
        if(regs.some(function(r){return r.quem===q&&r.tipo==="documento"&&/ipva/i.test(r.titulo||"")&&(String(r.titulo).indexOf(String(ano))>=0||r.data>=(ano-1)+"-12-01")}))return;
        add(dIpva,"IPVA "+ano,F.n+" · vence em janeiro conforme o final da placa · veja a data na Sefaz-SP","veiculo","https://portal.fazenda.sp.gov.br/servicos/ipva",{ext:true,ico:AGENDA_ICO[q],pre:F.n})});
      if(isOwner()){
        mbaAulas().forEach(function(a){if(a.data>=hoje)add(a.data,a.t,"aula às "+a.hora+(a.prof?" · "+a.prof:""),"mba","#mba",{pre:"Aula"})});
        mbaAvals().forEach(function(a){if(!a.feita)add(a.ate,a.t+(a.disc?" ("+a.disc+")":""),"responder a avaliação do MBA","mba",a.link||"#mba",{ext:!!a.link,pre:"Responder"})});
        var fin=mbaFin();if(fin)fin.ps.forEach(function(q){if(!q.paga)add(q.venc,q.n,"boleto do MBA · "+BRL(q.v),"mba","#mba",{pre:"Boleto"})});
        withDates().forEach(function(x){if(x.dias<=7||(x.fav&&x.dias<=30))add(maisDias(hoje,x.dias),x.nome,"aniversário"+(x.fav?" · marcado":""), "niver","#aniversarios",{pre:"Aniversário de"})});
        (PESSOAL.lembretes||[]).forEach(function(l){if(!l.feito)add(l.data,l.t,"lembrete","lembrete","",{lembrete:l})});
        /* carreira: 5 dias depois de se candidatar sem resposta, hora do follow-up */
        (PESSOAL.candidaturas||[]).forEach(function(c){var d=(c.datas||{}).candidatei;if(c.coluna==="candidatei"&&d&&!c.followup)add(c.followupEm||maisDias(d,5),c.t+(c.e?" · "+c.e:""),"follow-up · candidatura de "+dataBR(d),"carreira","#carreira/funil",{pre:"Follow-up"})});
        if(!PESSOAL.ultimoBackup||PESSOAL.ultimoBackup<maisDias(hoje,-30))add(hoje,"Baixar um backup do site",PESSOAL.ultimoBackup?"o último foi em "+dataBR(PESSOAL.ultimoBackup):"nunca foi feito","sistema","#sistema")}
      /* o backup automático de domingo (no cofre privado do servidor): se o mais novo tiver mais de 9 dias, alguma coisa parou */
      if(!isOwner())return ev.sort(function(a,b){return a.data.localeCompare(b.data)});
      return Promise.resolve().then(function(){return SB.storage.from("backups").list(EU.id,{sortBy:{column:"name",order:"desc"},limit:1})}).then(function(r){
        var ult=r&&r.data&&r.data[0]&&r.data[0].name.slice(0,10);
        if(!r.error&&(!ult||ult<maisDias(hoje,-9)))add(hoje,"O backup automático de domingo não rodou",ult?"o último é de "+dataBR(ult):"ainda não há nenhum no servidor","sistema","#sistema")},function(){})
        .then(function(){return ev.sort(function(a,b){return a.data.localeCompare(b.data)})})})}
  /* ===== Próxima melhor ação: tudo o que pede algo de você, numa ordem só =====
     Agenda (atrasado > hoje > amanhã > semana, com peso por tipo), vagas muito compatíveis ainda fora do funil e a prontidão para treinar. */
  function proximasAcoes(){
    var hoje=hojeISO(),PESO={mba:12,familia:10,veiculo:8,carreira:8,docs:6,lembrete:6,niver:4,sistema:2};
    var pAg=agendaColetar().catch(function(){return []});
    var pVg=(typeof vgPronto!=="undefined"&&vgPronto?vgPronto:Promise.resolve()).then(function(){return VG.all||[]}).catch(function(){return []});
    var pSa=Promise.resolve().then(function(){return Promise.all([SB.from("garmin_dia").select("data,dados").gte("data",maisDias(hoje,-61)).order("data").then(sbOk),
      SB.from("garmin_ativ").select("inicio").gte("inicio",maisDias(hoje,-3)).then(sbOk)])}).catch(function(){return null});
    return Promise.all([pAg,pVg,pSa]).then(function(r){
      var out=[];
      r[0].forEach(function(e){var dd=Math.round((new Date(e.data+"T12:00:00")-new Date(hoje+"T12:00:00"))/864e5);if(dd>7)return;
        var base=dd<0?100+Math.min(-dd,20):dd===0?90:dd===1?70:dd<=3?50:30;
        out.push({p:base+(PESO[e.tipo]||0),t:e.t,ico:agendaIco(e),pre:e.pre,sub:(dd<0?"atrasado há "+(-dd)+(dd===-1?" dia":" dias"):dd===0?"hoje":dd===1?"amanhã":"em "+dd+" dias")+(e.sub?" · "+e.sub:""),href:e.href,ext:e.ext,tipo:e.tipo})});
      /* vagas: só as novas (até 7 dias), bem compatíveis e que ainda não estão no funil nem escondidas */
      var meus=((PESSOAL.perfilCarreira||{}).skills)||["sql","powerbi","excel","negocio","estat"],noFunil=(PESSOAL.candidaturas||[]).map(function(c){return c.vagaId});
      r[1].filter(function(v){return v.d<=7&&noFunil.indexOf(v.id)<0&&!(typeof vgHidden!=="undefined"&&vgHidden[v.id])}).map(function(v){return [v,NUCLEO.compatVaga(v.t+" "+(v.nv||""),meus).nota]})
        .filter(function(x){return x[1]!=null&&x[1]>=70}).sort(function(a,b){return b[1]-a[1]}).slice(0,2)
        .forEach(function(x){out.push({p:40+(x[1]-70)/2,t:x[0].t,ico:"💼",pre:"Vaga "+x[1]+"% compatível",sub:x[1]+"% compatível"+(x[0].e?" · "+x[0].e:"")+(x[0].d<=1?" · publicada hoje":" · há "+x[0].d+" dias"),href:"#vagas",tipo:"carreira"})});
      /* treino: pela prontidão de hoje e pelos dias sem treinar */
      if(r[2]&&r[2][0].length){var pr=NUCLEO.prontidao(r[2][0],r[2][0][r[2][0].length-1].data),sem=!r[2][1].length;
        if(pr&&pr.nota<45)out.push({p:60,ico:"❤️",t:"Hoje é dia de recuperação",sub:"prontidão "+pr.nota+(pr.alertas[0]?" · "+pr.alertas[0]:""),href:"#saude",tipo:"saude"});
        else if(pr&&sem)out.push({p:pr.nota>=70?55:45,ico:"🏃",t:pr.nota>=70?"Bom dia para treinar forte":"Que tal um treino moderado?",sub:"prontidão "+pr.nota+" · 3 dias sem treino",href:"#saude",tipo:"saude"})}
      return out.sort(function(a,b){return b.p-a.p})})}
  function wProxima(){
    var p=wCard("Próxima melhor ação","alvo","#E5484D",["#agenda","agenda"],"w5 wprox"),ul=h("ul",{class:"wl agl"},h("li",null,h("span",{class:"sub",text:"Pensando…"})));p.appendChild(ul);
    proximasAcoes().then(function(l){ul.innerHTML="";
      if(!l.length){ul.appendChild(h("li",null,h("span",{class:"sub",text:"Nada pedindo a sua atenção agora. 🎉"})));return}
      l.slice(0,5).forEach(function(a,i){var li=h("li",{class:(i===0?"top ":"")+(/atrasado/.test(a.sub)?"alerta":"")||null},h("span",{class:"agico","aria-hidden":"true",text:a.ico||"•"}),h("span",{class:"grow"},h("b",{text:a.t}),h("span",{class:"sub",text:a.sub})));
        if(a.href){li.classList.add("clic");li.tabIndex=0;li.onclick=function(){if(a.ext)window.open(a.href,"_blank","noopener");else location.hash=a.href}}
        ul.appendChild(li)})}).catch(function(e){ul.innerHTML="";ul.appendChild(h("li",null,h("span",{class:"sub",text:"Não consegui montar agora."})));logErro("próxima ação",e)});
    return p}
  function agendaLinha(e,redesenhar){
    var hoje=hojeISO(),dd=Math.round((new Date(e.data+"T12:00:00")-new Date(hoje+"T12:00:00"))/864e5);
    var quando=dd<0?"há "+(-dd)+(dd===-1?" dia":" dias"):dd===0?"hoje":dd===1?"amanhã":new Date(e.data+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"});
    var li=h("li",{class:(dd<0?"alerta":"")+(e.href?" clic":"")||null},h("span",{class:"agico","aria-hidden":"true",text:agendaIco(e)}),h("span",{class:"grow"},h("b",{text:e.t}),e.sub?h("span",{class:"sub",text:e.sub}):null),h("span",{class:"end",text:quando}));
    if(e.href){li.tabIndex=0;li.onclick=function(){if(e.ext)window.open(e.href,"_blank","noopener");else location.hash=e.href}}
    if(e.lembrete){var ok=h("button",{type:"button",class:"ghostbtn",text:"Feito"});ok.onclick=function(ev){ev.stopPropagation();pessoalGravar("lembretes",(PESSOAL.lembretes||[]).map(function(l){return l.id===e.lembrete.id?Object.assign({},l,{feito:hojeISO()}):l}));if(redesenhar)redesenhar()};li.appendChild(ok)}
    return li}
  function wAgenda(){
    var p=wCard("Agenda","bolo","#2E8BD8",["#agenda","ver tudo"],"w5"),ul=h("ul",{class:"wl agl"},h("li",null,h("span",{class:"sub",text:"Carregando…"})));p.appendChild(ul);
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
      G.forEach(function(g){var l=ev.filter(g[1]);if(!l.length)return;box.appendChild(h("h3",{class:"mbag",text:g[0]+" ("+l.length+")"}));box.appendChild(h("ul",{class:"wl agl"},l.map(function(e){return agendaLinha(e,desenhar)})))});
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
    var tmr;function ir(){clearTimeout(tmr);tmr=setTimeout(function(){var v=inp.value.trim();history.replaceState(history.state,"","#busca/"+encodeURIComponent(v));box.innerHTML="";if(v.length<2)return;
      box.appendChild(h("p",{class:"sub",text:"Procurando…"}));
      buscar(v).then(function(l){box.innerHTML="";if(!l.length){box.appendChild(h("p",{class:"empty",text:"Nada encontrado para “"+v+"”."}));return}
        var G={};l.forEach(function(x){(G[x.tipo]=G[x.tipo]||[]).push(x)});box.appendChild(h("p",{class:"sub",text:l.length+(l.length===1?" resultado":" resultados")}));
        Object.keys(G).forEach(function(k){box.appendChild(h("h3",{class:"mbag",text:k+" ("+G[k].length+")"}));box.appendChild(h("ul",{class:"wl"},G[k].slice(0,40).map(function(x){return linhaResultado(x)})))})})},250)}
    inp.addEventListener("input",ir);ir();setTimeout(function(){inp.focus()},50)}

  /* ---------- página Sistema ---------- */
  /* ===== Notificações push neste aparelho: a inscrição fica em push_inscricoes e a rotina das 6h manda os avisos ===== */
  function pushPainel(){
    var p=panel("Notificações neste aparelho","O aviso das 6h (chuva em Sorocaba e o que vence na agenda) e, no domingo, o resumo da semana. No iPhone, funciona com o site instalado na tela de início (Compartilhar → Adicionar à Tela de Início).");
    var st=h("p",{class:"sub",role:"status",text:"Conferindo…"}),at=h("button",{type:"button",text:"Ativar neste aparelho",hidden:""}),te=h("button",{type:"button",class:"ghostbtn",text:"Mandar um teste",hidden:""}),de=h("button",{type:"button",class:"ghostbtn",text:"Desativar",hidden:""});
    p.appendChild(h("div",{class:"vfil"},at,te,de));p.appendChild(st);
    var pode="serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
    function reg(){return Promise.race([navigator.serviceWorker.ready,new Promise(function(_,n){setTimeout(function(){n(new Error("o app ainda está se instalando; recarregue a página"))},5000)})])}
    function chamar(corpo){return SB.functions.invoke("garmin",{body:corpo}).then(function(r){
      if(r.error){var c=r.error.context;return (c&&c.json?c.json().catch(function(){return {}}):Promise.resolve({})).then(function(j){throw new Error(j.erro||r.error.message)})}
      if(r.data&&r.data.erro)throw new Error(r.data.erro);return r.data})}
    function bytes(b64){var s=atob(b64.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((b64.length+3)%4)),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
    function estado(){
      if(!pode){st.textContent="Este navegador não recebe notificações do site."+(/iPhone|iPad/.test(navigator.userAgent)?" No iPhone, instale o site na tela de início e abra por lá.":"");return}
      reg().then(function(r){return r.pushManager.getSubscription()}).then(function(s){at.hidden=!!s;te.hidden=de.hidden=!s;at.disabled=false;
        st.textContent=s?"✓ Ativas neste aparelho.":Notification.permission==="denied"?"As notificações do site estão bloqueadas nas configurações do navegador. Libere lá e volte aqui.":"Desligadas neste aparelho."})
        .catch(function(e){st.textContent="Não consegui conferir ("+e.message+")."})}
    at.onclick=function(){at.disabled=true;st.textContent="Pedindo permissão…";
      /* o pedido de permissão precisa sair direto do toque (exigência do iPhone) */
      Notification.requestPermission().then(function(perm){if(perm!=="granted")throw new Error("a permissão não foi dada");return Promise.all([reg(),chamar({tipo:"push_chave"})])})
        .then(function(r){return r[0].pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(r[1].publica)})})
        .then(function(s){var j=s.toJSON();return SB.from("push_inscricoes").upsert({endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,aparelho:navigator.userAgent.slice(0,160)},{onConflict:"endpoint"}).then(sbOk)})
        .then(function(){estado()},function(e){at.disabled=false;logErro("notificações",e);
          st.textContent=/push_inscricoes|relation|schema cache/i.test(e.message)?"Falta rodar o supabase/011_push.sql no Supabase.":"Não consegui ativar: "+e.message})};
    te.onclick=function(){te.disabled=true;st.textContent="Mandando…";chamar({tipo:"push_teste"}).then(function(d){st.textContent="Teste enviado para "+d.resultado+". Deve chegar em alguns segundos."},function(e){st.textContent="Não consegui mandar: "+e.message}).then(function(){te.disabled=false})};
    de.onclick=function(){reg().then(function(r){return r.pushManager.getSubscription()}).then(function(s){if(!s)return;return SB.from("push_inscricoes").delete().eq("endpoint",s.endpoint).then(function(){return s.unsubscribe()})}).then(estado,function(e){st.textContent="Não consegui desativar: "+e.message})};
    estado();return p}
  /* ===== Saúde do RAC: um quadro só com o estado do próprio sistema (cada linha carrega por conta própria) ===== */
  function sisHa(iso){if(!iso)return "nunca";var m=Math.round((Date.now()-new Date(iso).getTime())/6e4);return m<60?"há "+Math.max(1,m)+" min":m<2880?"há "+Math.round(m/60)+" h":"há "+Math.round(m/1440)+" dias"}
  function sisKb(n){return n>=1048576?fmtN(Math.round(n/104857.6)/10)+" MB":fmtN(Math.round(n/1024))+" KB"}
  var SIS_TABS=["pessoal","registros","garmin_dia","garmin_ativ","mercados","produtos","notas","itens","orcamentos","lista","bebe"];
  function sisContar(t){return Promise.resolve().then(function(){return SB.from(t).select("*",{count:"exact",head:true})}).then(function(r){return r.error?null:r.count},function(){return null})}
  function sisQ(f){return Promise.resolve().then(f)}
  function sisSaude(){
    var p=panel("Saúde do RAC","O estado do próprio site: sincronização, coletas, fontes que falharam, notificações, backup, espaço e dados incompletos."),ul=h("ul",{class:"wl sissaude"});p.appendChild(ul);
    function linha(rot){var li=h("li",null,h("span",{class:"sisdot",text:"…"}),h("span",{class:"grow"},h("b",{text:rot}),h("span",{class:"sub",text:"Conferindo…"})));ul.appendChild(li);
      return function(nivel,txt,extra){li.querySelector(".sisdot").textContent=nivel==="ok"?"✓":nivel==="aviso"?"⚠":"✗";li.className=nivel==="ok"?null:"alerta";li.querySelector(".sub").textContent=txt;if(extra)li.querySelector(".grow").appendChild(extra)}}
    /* 1. sincronização */
    var l1=linha("Sincronização"),np=pendentes().length,fila=0;try{fila=(JSON.parse(localStorage.getItem("rac-fila")||"[]")||[]).length}catch(e){}
    l1(SIS.falhaSinc||Object.keys(SIS.conflitos).length?"erro":np||fila?"aviso":"ok",(SIS.ultimaSinc?"Última sincronização bem-sucedida "+sisHa(SIS.ultimaSinc):"Ainda não sincronizou nesta sessão")+(np?" · "+np+" alterações esperando":"")+(fila?" · "+fila+" itens na fila sem internet":"")+(SIS.falhaSinc?" · ⚠ "+SIS.falhaSinc:""));
    /* 2. coletas */
    var l2=linha("Coletas (vagas, notícias, relógio e rotina)");
    Promise.all([["vagas.json",30],["noticias.json",8],["tecdados.json",8],["rumores.json",8]].map(function(x){return getJson(x[0]+"?v="+Date.now()).then(function(d){return [x[0],d.coletado,x[1]]},function(){return [x[0],null,x[1]]})})
      .concat([sisQ(function(){return SB.from("garmin_dia").select("atualizado").order("atualizado",{ascending:false}).limit(1)}).then(sbOk).then(function(l){return ["relógio",l[0]&&l[0].atualizado,30]},function(){return ["relógio",null,30]}),
        sisQ(function(){return SB.from("rotina_log").select("quando,ok").order("quando",{ascending:false}).limit(1)}).then(sbOk).then(function(l){return ["rotina das 6h",l[0]&&l[0].quando,26,l[0]&&l[0].ok]},function(){return ["rotina das 6h",null,26]})])).then(function(r){
      var NOME={"vagas.json":"vagas","noticias.json":"notícias de Sorocaba","tecdados.json":"notícias de tecnologia","rumores.json":"rumores da MLB"},velhas=r.filter(function(x){return !x[1]||(Date.now()-new Date(x[1]))/36e5>x[2]||x[3]===false});
      l2(velhas.length?"aviso":"ok",r.map(function(x){return (NOME[x[0]]||x[0])+" "+sisHa(x[1])+(x[3]===false?" (com falha)":"")}).join(" · "))});
    /* 3. fontes que falharam */
    var l3=linha("Fontes que falharam (30 dias)");
    Promise.resolve().then(function(){return SB.from("erros").select("quando,origem").gte("quando",new Date(Date.now()-30*864e5).toISOString()).order("quando",{ascending:false})}).then(sbOk).then(function(l){
      var g={};l.forEach(function(x){var k=x.origem.replace(/\s*\(.*\)$/,"");(g[k]=g[k]||{n:0,ult:x.quando}).n++});var ks=Object.keys(g);
      l3(!ks.length?"ok":ks.some(function(k){return Date.now()-new Date(g[k].ult)<2*864e5})?"aviso":"ok",ks.length?ks.map(function(k){return k+": "+g[k].n+"× (a última "+sisHa(g[k].ult)+")"}).join(" · "):"Nenhuma falha registrada.")},function(e){l3("aviso","Não consegui ler as falhas ("+e.message+").")});
    /* 4. notificações */
    var l4=linha("Notificações");
    Promise.all([sisContar("push_inscricoes"),sisQ(function(){return SB.from("rotina_log").select("resumo").order("quando",{ascending:false}).limit(1)}).then(sbOk).catch(function(){return []}),
      ("serviceWorker" in navigator&&"PushManager" in window?Promise.race([navigator.serviceWorker.ready.then(function(r){return r.pushManager.getSubscription()}),new Promise(function(ok){setTimeout(function(){ok(undefined)},3000)})]):Promise.resolve(undefined))]).then(function(r){
      var al=((r[1][0]||{}).resumo||{}).alertas||{},push=al.push||"",tg=al.telegram||"",ruim=/^0 de|erro/i.test(push);
      l4(r[0]===0||ruim?"aviso":"ok",(r[0]==null?"":r[0]+(r[0]===1?" aparelho inscrito":" aparelhos inscritos"))+(r[2]?" · este aparelho recebe":r[2]===null?" · este aparelho não está inscrito":"")+(push?" · último envio: "+push:"")+(tg&&!/sem Telegram/.test(tg)?" · Telegram: "+tg:""))});
    /* 5. backup e teste de restauração */
    var l5=linha("Backup e restauração"),tr=PESSOAL.testeRestauracao;
    Promise.resolve().then(function(){return SB.storage.from("backups").list(EU.id,{sortBy:{column:"name",order:"desc"}})}).then(function(r){
      var l=(r&&r.data)||[],ult=l[0],tam=l.reduce(function(s,f){return s+((f.metadata||{}).size||0)},0),dt=ult&&ult.name.slice(0,10);
      var bt=h("button",{type:"button",class:"ghostbtn",text:"Testar restauração agora"});bt.onclick=function(){bt.disabled=true;bt.textContent="Testando…";sisTesteRestauracao(ult).then(function(){renderSistema()},function(e){bt.disabled=false;bt.textContent="Falhou: "+e.message})};
      var velho=!dt||dt<maisDias(hojeISO(),-9),testeVelho=!tr||tr.quando<maisDias(hojeISO(),-35);
      l5(velho||(tr&&!tr.ok)?"aviso":testeVelho?"aviso":"ok",(dt?"Último backup automático: "+dataBR(dt)+" ("+l.length+" guardados, "+sisKb(tam)+")":"Nenhum backup automático ainda")+" · baixado à mão: "+(PESSOAL.ultimoBackup?dataBR(PESSOAL.ultimoBackup):"nunca")+
        " · teste de restauração: "+(tr?dataBR(tr.quando.slice(0,10))+(tr.ok?" ✓ ok":" ⚠ "+(tr.problemas||[]).join("; ")):"nunca feito"),ult?h("div",{class:"vfil"},bt):null)},function(e){l5("aviso","Não consegui ver os backups ("+e.message+").")});
    /* 6. espaço */
    var l6=linha("Espaço utilizado");
    Promise.all([Promise.all(SIS_TABS.map(sisContar)),sisQ(function(){return SB.from("registros").select("arquivos")}).then(sbOk).catch(function(){return []})]).then(function(r){
      var tot=r[0].reduce(function(s,n){return s+(n||0)},0),arq=0,bytes=0;r[1].forEach(function(x){(x.arquivos||[]).forEach(function(a){arq++;bytes+=a.tamanho||0})});
      var maiores=SIS_TABS.map(function(t,i){return [t,r[0][i]]}).filter(function(x){return x[1]}).sort(function(a,b){return b[1]-a[1]}).slice(0,4);
      l6(bytes>800*1048576?"aviso":"ok",fmtN(tot)+" registros no banco ("+maiores.map(function(x){return x[0]+" "+fmtN(x[1])}).join(", ")+") · "+arq+" arquivos no cofre ("+sisKb(bytes)+" de 1 GB do plano grátis)")});
    /* 7. dados incompletos */
    var l7=linha("Dados incompletos");
    Promise.all([sisQ(function(){return SB.from("registros").select("quem,tipo,titulo,dados,valor")}).then(sbOk).catch(function(){return []}),
      Promise.resolve().then(function(){return SB.from("notas").select("id,data,total")}).then(sbOk).catch(function(){return []}),
      Promise.resolve().then(function(){return SB.from("compras").select("nota_id,valor_total").range(0,9999)}).then(sbOk).catch(function(){return []}),
      Promise.resolve().then(function(){return SB.from("produtos").select("categoria")}).then(sbOk).catch(function(){return []})]).then(function(r){
      var regs=r[0],soma={};r[2].forEach(function(x){soma[x.nota_id]=(soma[x.nota_id]||0)+(+x.valor_total||0)});
      var achados=[],c=(PESSOAL.candidaturas||[]);
      function add(n,txt,href){if(n)achados.push(h("li",null,h("a",{href:href,class:"link",text:n+" "+txt})))}
      add(r[1].filter(function(n){return soma[n.id]!=null&&n.total!=null&&Math.abs(soma[n.id]-(+n.total))>1}).length,"notas do Mercado em que os itens não somam o total (resposta cortada?)","#mercado/notas");
      add(r[3].filter(function(x){return !x.categoria||/^outros?$/i.test(x.categoria)}).length,"produtos do Mercado sem categoria","#mercado/produtos");
      add(regs.filter(function(x){var d=x.dados||{};return x.tipo==="abastecimento"&&(typeof d.km!=="number"||!d.litros)}).length,"abastecimentos sem km ou litros","#veiculos");
      add(regs.filter(function(x){return x.tipo==="peso"&&!x.valor&&!(x.dados||{}).peso}).length,"pesagens sem o peso","#olivia");
      add(c.filter(function(x){return !x.e}).length,"candidaturas sem empresa","#carreira/funil");
      add(c.filter(function(x){return x.coluna!=="salva"&&!(x.datas||{}).candidatei}).length,"candidaturas sem a data em que você se candidatou","#carreira/funil");
      add(regs.filter(function(x){return x.quem==="rede"&&x.tipo==="contato"&&!(x.dados||{}).perfil}).length,"contatos da Rede sem o link do perfil","#rede");
      l7(achados.length?"aviso":"ok",achados.length?"Toque para corrigir:":"Nada incompleto encontrado.",achados.length?h("ul",{class:"clean"},achados):null)});
    return p}
  /* baixa o backup automático mais novo e confere se ele restauraria tudo (sem gravar nada): JSON íntegro, todas as tabelas, sem ids repetidos e com a quantidade de hoje */
  function sisTesteRestauracao(arq){
    return SB.storage.from("backups").download(EU.id+"/"+arq.name).then(function(r){if(r.error)throw r.error;return r.data.text()}).then(function(txt){
      var j=JSON.parse(txt),tab=j.tabelas||{},probs=[],det={};
      return Promise.all(SIS_TABS.map(sisContar)).then(function(agora){
        SIS_TABS.forEach(function(t,i){var l=tab[t];if(!Array.isArray(l)){if(["lista","bebe"].indexOf(t)<0||agora[i])probs.push(t+" fora do backup");return}
          var ids={},rep=0;l.forEach(function(x){var k=x.id!=null?x.id:x.chave||x.data;if(k!=null){if(ids[k])rep++;ids[k]=1}});if(rep)probs.push(t+": "+rep+" ids repetidos");
          det[t]=[l.length,agora[i]];if(agora[i]!=null&&l.length<agora[i]*0.8&&agora[i]-l.length>5)probs.push(t+": "+l.length+" no backup, "+agora[i]+" hoje")});
        var res={quando:new Date().toISOString(),arquivo:arq.name,ok:!probs.length,problemas:probs,tabelas:det};pessoalGravar("testeRestauracao",res);return res})})}
  /* ===== RAC Intelligence: gasto do mês (reservado, estimado pelo RAC, cobrado), alertas, modo, chamadas incertas e preços.
     Só o dono altera; a casa vê. A estimativa do RAC não é a fatura: a cobrança efetiva vem do Console da Anthropic. */
  function sisIA(){
    var p=panel("RAC Intelligence","A IA do RAC: o quanto já foi usado no mês e o que está configurado."),corpo=h("div",null,h("p",{class:"sub",text:"Carregando…"}));p.appendChild(corpo);
    var usd=NUCLEO.iaUsd;
    /* um indicador: rótulo, valor e, se houver, uma linha menor embaixo (ex.: o valor em reais) */
    function kpi(rot,val,sub){return h("div",null,h("span",{class:"kl",text:rot}),h("b",{class:"kv",text:val}),sub?h("span",{class:"ksub",text:sub}):null)}
    function iaQuando(iso){return new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
    /* histórico das chamadas pagas (o DEMO não grava): só leitura de ia_uso. O banco limita o que cada um vê: o dono, a casa
       toda; quem é da casa, só as próprias chamadas. O filtro e a contagem ficam entre um desenho e outro */
    var HIST={mes:"",modulo:"",n:20},HIST_COLS="id,criado_em,enviado_em,modulo,acao,modelo,estado,reservado_usd,estimado_usd,tokens_entrada,tokens_saida,ms,erro_codigo,reconciliado_cobrado,reconciliado_usd,reconciliado_em";
    function historico(mesAtual){
      if(!HIST.mes)HIST.mes=mesAtual;
      function opc(v,t,sel){var o=h("option",{value:v,text:t});if(v===sel)o.selected=true;return o}
      var sm=h("select",{"aria-label":"Mês do histórico"},NUCLEO.iaCompetencias(mesAtual,12).map(function(m){return opc(m,NUCLEO.iaNomeMes(m),HIST.mes)})),
        sd=h("select",{"aria-label":"Módulo do histórico"},[["","Todos os módulos"],["abastecimento","Abastecimento"],["mercado","Nota do mercado"]].map(function(x){return opc(x[0],x[1],HIST.modulo)})),
        lista=h("div",null,h("p",{class:"sub",text:"Carregando…"}));
      sm.onchange=function(){HIST.mes=sm.value;HIST.n=20;carregar()};sd.onchange=function(){HIST.modulo=sd.value;HIST.n=20;carregar()};
      function item(u){var x=NUCLEO.iaUsoLinha(u,Date.now()),det=[iaQuando(u.criado_em),u.modelo||""];
        if(u.tokens_entrada!=null)det.push(NUCLEO.iaNum(u.tokens_entrada,0)+" → "+NUCLEO.iaNum(u.tokens_saida||0,0)+" tokens");
        if(u.reconciliado_em)det.push("conferida em "+new Date(u.reconciliado_em).toLocaleDateString("pt-BR"));
        return h("li",null,h("span",{class:"grow"},h("b",{text:NUCLEO.iaModulo(u.modulo)+" · "+x.estado}),h("span",{class:"sub",text:det.filter(Boolean).join(" · ")})),
          h("span",{class:"end",text:x.custo==null?"—":usd(x.custo)+" · "+x.custoTxt}))}
      function carregar(){
        var q=SB.from("ia_uso").select(HIST_COLS,{count:"exact"}).eq("mes",HIST.mes);if(HIST.modulo)q=q.eq("modulo",HIST.modulo);
        q.order("criado_em",{ascending:false}).range(0,HIST.n-1).then(function(r){if(r.error)throw new Error(r.error.message);
          var l=r.data||[],tot=r.count==null?l.length:r.count;lista.innerHTML="";
          if(!l.length){lista.appendChild(h("p",{class:"empty",text:"Nenhuma chamada paga em "+NUCLEO.iaNomeMes(HIST.mes)+(HIST.modulo?" neste módulo":"")+"."}));return}
          lista.appendChild(h("p",{class:"sub",text:"Mostrando "+l.length+" de "+tot+(tot===1?" chamada":" chamadas")+", da mais nova para a mais antiga."}));
          lista.appendChild(h("ul",{class:"wl iahist"},l.map(item)));
          if(l.length<tot){var mais=h("button",{type:"button",class:"ghostbtn",text:"Ver mais"});mais.onclick=function(){HIST.n+=20;carregar()};lista.appendChild(h("div",{class:"vfil"},mais))}})
        .catch(function(e){lista.innerHTML="";lista.appendChild(h("p",{class:"empty",text:"Não consegui carregar o histórico ("+e.message+")."}))})}
      carregar();
      return h("div",null,h("h3",{class:"dayh",text:"Histórico de chamadas pagas"}),
        h("p",{class:"sub",text:isOwner()?"Todas as chamadas pagas da casa. Leituras em demonstração não aparecem: elas não usam a IA de verdade.":"As suas chamadas pagas (o dono vê as da casa toda). Leituras em demonstração não aparecem."}),
        h("div",{class:"vfil"},sm,sd),lista)}
    function desenhar(){
      Promise.all([SB.rpc("ia_totais_mes").then(sbOk),SB.from("ia_config").select("*").maybeSingle().then(sbOk),SB.from("ia_precos").select("*").then(sbOk),
        isOwner()?SB.from("ia_uso").select("id,criado_em,modulo,acao,estado,reservado_usd,erro_codigo,enviado_em").in("estado",["incerto","enviando"]).order("criado_em",{ascending:false}).limit(20).then(sbOk):Promise.resolve([]),
        isOwner()?SB.from("ia_cobranca").select("*").order("mes",{ascending:false}).limit(1).then(sbOk):Promise.resolve([])])
      .then(function(r){
        var t=r[0]||{},semConfig=!r[1],cfg=r[1]||{modo:"DEMO",limite_brl:50,cambio_brl_usd:6,margem_impostos:0.12,margem_seguranca:0.1},s=NUCLEO.iaResumo(t,cfg),al=NUCLEO.iaAlerta(s);
        function brl(v){return "≈ "+NUCLEO.iaBrl(v,cfg)}
        corpo.innerHTML="";
        if(al)corpo.appendChild(h("p",{class:al.forte?"qrwarn":"sub",text:al.texto}));
        corpo.appendChild(h("div",{class:"kgasto"},
          kpi("Modo",cfg.modo==="REAL"?"REAL":"DEMO"),
          kpi("Disponível no mês",usd(s.disponivel),brl(s.disponivel)),
          kpi("Comprometido no mês",usd(s.comprometido)+" ("+s.pct+"%)",brl(s.comprometido)),
          kpi("Teto interno",usd(s.teto),brl(s.teto)+" de "+NUCLEO.iaReais(cfg.limite_brl)),
          kpi("Estimado pelo RAC",usd(s.estimado)),
          kpi("Reservado em aberto",usd(s.aberto)),
          kpi("Cobrança efetiva",r[4][0]&&r[4][0].valor_usd!=null?usd(r[4][0].valor_usd)+" ("+String(r[4][0].mes).slice(0,7)+")":"não informada")));
        corpo.appendChild(h("p",{class:"sub",text:NUCLEO.iaEstados(t.por_estado)}));
        /* modo por leitura, como o servidor decide: casa em REAL + leitura liberada (acoes_reais, 016) + papel; o Mercado fica sempre em DEMO nesta fase */
        var reais=cfg.modo==="REAL"&&Array.isArray(cfg.acoes_reais)?cfg.acoes_reais:[],reaisCasa=Array.isArray(cfg.acoes_reais_casa)?cfg.acoes_reais_casa:[];
        corpo.appendChild(h("p",{class:"sub",text:"Por leitura: Abastecimento "+(reais.indexOf("abastecimento.interpretar")>=0?"REAL ("+(reaisCasa.indexOf("abastecimento.interpretar")>=0?"dono e casa":"só o dono; a casa em DEMO")+")":"DEMO")+" · Nota do mercado DEMO (fixo nesta fase)."}));
        var pm=t.por_modulo||{};if(Object.keys(pm).length)corpo.appendChild(h("p",{class:"sub",text:"Por módulo: "+Object.keys(pm).map(function(k){return k+" "+usd(pm[k])}).join(" · ")}));
        corpo.appendChild(h("p",{class:"sub",text:"A estimativa do RAC (uso informado pela API × tabela de preços) não é a fatura. A cobrança efetiva está no Console da Anthropic. O teto interno acima é do RAC: quando acaba, o RAC não faz novas leituras REAL. O limite de gasto da conta na Anthropic é outro e é configurado no Console."}));
        (r[2]||[]).forEach(function(x){var dias=Math.round((Date.now()-new Date(x.conferido_em+"T12:00:00"))/864e5);
          corpo.appendChild(h("p",{class:dias>30?"qrwarn":"sub",text:x.modelo+": "+usd(x.entrada_usd_mtok)+" / "+usd(x.saida_usd_mtok)+" por milhão de tokens (entrada / saída), conferido em "+dataBR(x.conferido_em)+(dias>30?". Confira o preço de novo na página oficial.":".")}))});
        corpo.appendChild(historico(s.mes||NUCLEO.iaCompetencias(hojeISO(),1)[0]));
        if(!isOwner())return;
        /* chamadas incertas: só o dono decide, pelo id, depois de olhar o uso no Console */
        if(r[3].length){corpo.appendChild(h("h3",{class:"dayh",text:"Chamadas incertas (a reserva continua contando)"}));
          var ul=h("ul",{class:"wl"});r[3].forEach(function(u){
            var sim=h("button",{type:"button",class:"ghostbtn",text:"Foi cobrada"}),nao=h("button",{type:"button",class:"ghostbtn",text:"Não foi cobrada"});
            function rec(cobrado){var v=0;if(cobrado){v=parseFloat(String(window.prompt("Quanto foi cobrado por esta chamada, em US$? (veja no Console da Anthropic)",String(u.reservado_usd))||"").replace(",","."));if(!(v>=0))return}
              SB.rpc("ia_reconciliar",{p_id:u.id,p_cobrado:cobrado,p_valor_usd:cobrado?v:0}).then(sbOk).then(function(okr){if(!okr)alert("Esta chamada não pode ser reconciliada agora.");desenhar()}).catch(function(e){alert("Não consegui: "+e.message)})}
            sim.onclick=function(){rec(true)};nao.onclick=function(){rec(false)};
            ul.appendChild(h("li",null,h("span",{class:"grow"},h("b",{text:u.acao+" · "+new Date(u.criado_em).toLocaleString("pt-BR")}),h("span",{class:"sub",text:"Id "+u.id+" · reservado "+usd(u.reservado_usd)+(u.erro_codigo?" · "+u.erro_codigo:"")})),h("span",{class:"end vfil"},sim,nao)))});
          corpo.appendChild(ul)}
        /* configuração: modo, limite e margens. A linha da casa é criada pelo administrador no SQL Editor (o site não cria) */
        if(semConfig){corpo.appendChild(h("p",{class:"qrwarn",text:"A configuração da IA desta casa ainda não foi criada. Ela é criada uma vez pelo administrador no SQL Editor (docs/rac-intelligence.md, Fase B). Até lá, tudo funciona só em DEMO."}));return}
        /* o site não troca o modo nem as leituras liberadas: o banco só deixa o site alterar os campos de limite (016);
           o modo muda só no SQL Editor (docs/rac-intelligence.md, Fase F) */
        var aviso=h("p",{class:"sub",text:"O modo é decidido pelo servidor e não pode ser trocado pelo site: o modo REAL e as leituras liberadas mudam só pelo SQL Editor. Em DEMONSTRAÇÃO a leitura é simulada, não consome orçamento e não pode ser salva; em REAL ela usa o orçamento abaixo e só grava quando você toca em Salvar."});
        function campo(rot,k,passo){var i=h("input",{type:"number",step:passo,value:String(cfg[k]),"aria-label":rot});i.dataset.k=k;return h("label",null,rot,i)}
        var form=h("div",{class:"wform"},h("div",{class:"two"},campo("Limite mensal (R$)","limite_brl","1"),campo("Câmbio (R$ por US$)","cambio_brl_usd","0.01")),
          h("div",{class:"two"},campo("Margem de impostos (0,12 = 12%)","margem_impostos","0.01"),campo("Margem de segurança (0,10 = 10%)","margem_seguranca","0.01")));
        var salvar=h("button",{type:"button",text:"Salvar limites"});salvar.onclick=function(){var o={};form.querySelectorAll("input").forEach(function(i){o[i.dataset.k]=parseFloat(i.value)});gravar(o)};
        var cob=h("input",{type:"number",step:"0.01",placeholder:"US$ cobrados no mês (Console)","aria-label":"Cobrança efetiva do mês em US$"}),cobB=h("button",{type:"button",class:"ghostbtn",text:"Registrar cobrança do mês"});
        cobB.onclick=function(){var v=parseFloat(cob.value);if(!(v>=0))return;SB.from("ia_cobranca").upsert({dono:EU.id,mes:t.mes,valor_usd:v,informado_em:new Date().toISOString()}).then(sbOk).then(desenhar).catch(function(e){alert("Não consegui: "+e.message)})};
        corpo.appendChild(aviso);corpo.appendChild(form);corpo.appendChild(h("div",{class:"vfil"},salvar));corpo.appendChild(h("div",{class:"vfil"},cob,cobB))})
      .catch(function(e){corpo.innerHTML="";corpo.appendChild(h("p",{class:"empty",text:"O RAC Intelligence ainda não está disponível ("+e.message+")."}))})}
    /* só altera a linha que já existe (UPDATE); se nada mudou, a linha não existe ou a pessoa não é o dono.
       Só os campos de limite passam: o modo nunca é enviado pelo site */
    var SIS_IA_CAMPOS=["limite_brl","cambio_brl_usd","margem_impostos","margem_seguranca"];
    function gravar(mud){var o={atualizado_em:new Date().toISOString()};SIS_IA_CAMPOS.forEach(function(k){if(typeof mud[k]==="number"&&isFinite(mud[k]))o[k]=mud[k]});
      SB.from("ia_config").update(o).eq("dono",EU.id).select("dono").then(sbOk)
      .then(function(l){if(!l||!l.length)alert("Não salvei: a configuração da IA desta casa ainda não existe ou só o dono pode alterar.");desenhar()})
      .catch(function(e){alert("Não consegui salvar: "+e.message)})}
    desenhar();return p}
  function renderSistema(){
    var root=$("#sistema-view");root.innerHTML="";
    /* a versão que este aparelho está usando: se não for a mais nova, é só fechar e abrir o site de novo */
    root.appendChild(h("p",{class:"sub sisversao",text:"Versão do site neste aparelho: "+MOD_VERSAO}));
    try{root.appendChild(sisSaude())}catch(e){logErro("saúde do RAC",e)}
    if(typeof iaLigada==="function"&&iaLigada())try{root.appendChild(sisIA())}catch(e){logErro("RAC Intelligence",e)}
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
    root.appendChild(pushPainel());
    /* rotina automática */
    var pr=panel("Rotina automática","Todo dia às 6h o servidor atualiza a Garmin, vê se vai chover, confere a agenda e manda os avisos (notificação e Telegram); aos domingos manda o resumo da semana e guarda um backup.");
    var lr=h("ul",{class:"wl"},h("li",null,h("span",{class:"sub",text:"Carregando…"})));pr.appendChild(lr);root.appendChild(pr);
    Promise.resolve().then(function(){return SB.from("rotina_log").select("quando,ok,resumo").order("quando",{ascending:false}).limit(10)}).catch(function(e){return {error:e}}).then(function(r){lr.innerHTML="";
      if(r.error){lr.appendChild(h("li",null,h("span",{class:"qrwarn",text:/rotina_log|relation|schema cache/i.test(r.error.message)?"A rotina ainda não está ligada: falta rodar o supabase/008_sistema.sql.":"Não consegui ler ("+r.error.message+")."})));return}
      if(!r.data.length){lr.appendChild(h("li",null,h("span",{class:"sub",text:"Ainda não rodou. A primeira vez é amanhã às 6h."})));return}
      r.data.forEach(function(x){var s=x.resumo||{},partes=[];if(s.garmin_dias&&s.garmin_dias.salvos!=null)partes.push(s.garmin_dias.salvos+" dias da Garmin");if(s.garmin_treinos&&s.garmin_treinos.salvas!=null)partes.push(s.garmin_treinos.salvas+" treinos conferidos");
        if(s.alertas&&s.alertas.itens!=null)partes.push(s.alertas.itens+" avisos"+(s.alertas.telegram?" (Telegram: "+s.alertas.telegram+(s.alertas.push?"; notificação: "+s.alertas.push:"")+")":""));if(typeof s.chuva==="string"&&s.chuva!=="sem chuva")partes.push("chuva");if(s.backup&&!s.backup.erro)partes.push("backup feito");
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
    [["vagas.json","Vagas","vagas",30],["noticias.json","Notícias de Sorocaba","noticias",8],["tecdados.json","Notícias de dados e tecnologia","noticias",8],["rumores.json","Rumores da MLB","liga",8]].forEach(function(r){
      getJson(r[0]+"?v="+Date.now()).then(function(d){var q=new Date(d.coletado),horas=(Date.now()-q)/36e5,n=(d[r[2]]||[]).length,velho=horas>r[3]||!n;
        lg.appendChild(h("li",{class:velho?"alerta":null},h("span",{class:"grow"},h("b",{text:(velho?"⚠ ":"✓ ")+r[1]}),h("span",{class:"sub",text:n+" itens · coletado "+q.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+(velho?" · parado há "+Math.round(horas)+" h":"")}))))})
      .catch(function(e){lg.appendChild(h("li",{class:"alerta"},h("span",{class:"grow"},h("b",{text:"⚠ "+r[1]}),h("span",{class:"sub",text:"não consegui ler ("+e.message+")"}))))})});
    pg.appendChild(h("div",{class:"vfil"},ext("https://github.com/raynercarvalho1/rac/actions","Ver os robôs no GitHub","ghostbtn")));
    /* testes automáticos */
    var pt=panel("Testes automáticos","A cada mudança publicada, o GitHub roda os testes do site: leitura de nota fiscal e de abastecimento, leitor de arquivos do relógio, importação sem duplicar e o bloqueio de quem não fez login.");
    pt.appendChild(h("a",{href:"https://github.com/raynercarvalho1/rac/actions/workflows/testes.yml",target:"_blank",rel:"noopener"},h("img",{src:"https://github.com/raynercarvalho1/rac/actions/workflows/testes.yml/badge.svg",alt:"Situação dos testes",loading:"lazy"})));
    root.appendChild(pt)}
