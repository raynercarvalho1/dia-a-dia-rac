/* Dia a Dia RAC — módulo carregado quando a seção abre. Resumo: a semana (comparada com a anterior) e a retrospectiva do ano, no estilo "Wrapped",
   juntando relógio, mercado, veículos, Olivia e MBA. Usa as funções do núcleo (js/app.js), da Saúde e do MBA, que ficam no escopo global. */
  var RESUMO={per:"semana"};
  /* cada cartão abre a sua tela de detalhe: #resumo/<período>/<cartão> */
  var RS_DET={treinos:"Treinos",esporte:"Esportes",distancia:"Distâncias",passos:"Passos",sono:"Sono",vfc:"Coração",mercado:"Gastos no mercado",mercados:"Mercados e produtos",olivia:"Olivia",mba:"Aulas do MBA",civic:"Civic",moto:"Moto"};
  var RS_MESES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  function renderResumo(per,det){
    var root=$("#resumo-view");root.innerHTML="";RESUMO.per=per||RESUMO.per;if(det&&!RS_DET[det])det=null;
    var hoje=hojeISO(),ano=+hoje.slice(0,4),anos=[];for(var a=ano;a>=+GARMIN_DESDE.slice(0,4);a--)anos.push(String(a));
    var p=panel(det?"Resumo · "+(FAM[det]&&FAM[det].n||RS_DET[det]):"Resumo",det?"Os números do cartão em detalhe. Troque o período aqui em cima.":"A semana e o ano em números: treinos, sono, passos, mercado, carros, Olivia e MBA. Toque num cartão para ver os detalhes."),seg=h("div",{class:"seg famseg",role:"group","aria-label":"Período"});
    [["semana","Últimos 7 dias"],["mes","Este mês"]].concat(anos.map(function(a){return [a,a===String(ano)?"Retrospectiva "+a:a]})).forEach(function(o){
      var b=h("button",{type:"button","aria-pressed":String(RESUMO.per===o[0]),text:o[1]});b.onclick=function(){location.hash="#resumo/"+o[0]+(det?"/"+det:"")};seg.appendChild(b)});
    if(det)p.appendChild(h("div",{class:"vfil"},h("a",{href:"#resumo/"+RESUMO.per,class:"ghostbtn",text:"‹ Todos os números"})));
    p.appendChild(seg);var box=h("div",{class:det?"rsdet":"wrapg"},h("p",{class:"sub",text:"Juntando tudo…"}));p.appendChild(box);root.appendChild(p);
    var per2=RESUMO.per,ini,fim=hoje,iniA,fimA;
    if(per2==="semana"){ini=maisDias(hoje,-6);iniA=maisDias(hoje,-13);fimA=maisDias(hoje,-7)}
    else if(per2==="mes"){ini=hoje.slice(0,8)+"01";var dm=Math.round((new Date(hoje)-new Date(ini))/864e5);fimA=maisDias(ini,-1);iniA=fimA.slice(0,8)+"01";if(fimA>maisDias(iniA,dm))fimA=maisDias(iniA,dm)}
    else{ini=per2+"-01-01";fim=per2===String(ano)?hoje:per2+"-12-31"}
    Promise.all([resumoDados(ini,fim),iniA&&!det?resumoDados(iniA,fimA):null]).then(function(r){box.innerHTML="";if(det)resumoDetalhe(box,r[0],per2,det);else resumoDesenhar(box,r[0],r[1],per2)})
      .catch(function(e){logErro("resumo",e);box.innerHTML="";box.appendChild(h("p",{class:"empty",text:"Não consegui juntar os dados ("+e.message+")."}))})}

  /* tudo de um período [ini, fim] */
  function resumoDados(ini,fim){
    function dentro(d){return d>=ini&&d<=fim}
    function pag(q,from,acc){return Promise.resolve().then(function(){return q(from)}).then(sbOk).then(function(l){acc=acc.concat(l);return l.length===1000?pag(q,from+1000,acc):acc})}
    var pSaude=(SAUDE.dias?Promise.resolve():saudeCarregar()).catch(function(){SAUDE.dias=SAUDE.dias||[];SAUDE.ativs=SAUDE.ativs||[]});
    var pMerc=pag(function(f){return SB.from("compras").select("data,mercado,numero,produto,descricao,valor_total").gte("data",ini).lte("data",fim).order("data").range(f,f+999)},0,[]).catch(function(){return []});
    var pVeic=Promise.resolve().then(function(){return SB.from("registros").select("quem,tipo,data,dados").in("quem",["civic","moto"])}).then(sbOk).catch(function(){return []});
    var BT=["peito","mamadeira","fralda","despertar"],pBebe=Promise.all(BT.map(function(t){return Promise.resolve().then(function(){return SB.from("bebe").select("id",{count:"exact",head:true}).eq("tipo",t).gte("inicio",ini).lte("inicio",fim+"T23:59:59")}).then(function(r){return r.error?0:r.count||0},function(){return 0})}));
    return Promise.all([pSaude,pMerc,pVeic,pBebe]).then(function(r){
      var o={ini:ini,fim:fim,dias:Math.round((new Date(fim)-new Date(ini))/864e5)+1};
      /* relógio */
      var at=(SAUDE.ativs||[]).filter(function(a){return dentro(a.inicio.slice(0,10))&&TREINO_OCULTOS.indexOf(a.tipo)<0}),ds=(SAUDE.dias||[]).filter(function(d){return dentro(d.data)});
      o.treinos=at.length;o.km=at.reduce(function(s,a){return s+(a.dados.distancia||0)},0)/1000;o.seg=at.reduce(function(s,a){return s+(a.dados.duracao||0)},0);
      var pt={};at.forEach(function(a){pt[a.tipo]=(pt[a.tipo]||0)+1});o.fav=Object.keys(pt).sort(function(a,b){return pt[b]-pt[a]})[0];o.favN=o.fav?pt[o.fav]:0;
      o.maior=at.filter(function(a){return a.dados.distancia}).sort(function(a,b){return b.dados.distancia-a.dados.distancia})[0];
      var pm={};at.forEach(function(a){var k=a.inicio.slice(0,7);pm[k]=(pm[k]||0)+1});o.mesTop=Object.keys(pm).sort(function(a,b){return pm[b]-pm[a]})[0];o.mesTopN=o.mesTop?pm[o.mesTop]:0;
      var dtr={};at.forEach(function(a){dtr[a.inicio.slice(0,10)]=1});o.diasTreino=Object.keys(dtr).length;o.at=at;o.ds=ds;
      function med(f){var v=ds.map(function(d){return f(d.dados||{})}).filter(function(x){return typeof x==="number"});return v.length?v.reduce(function(a,b){return a+b},0)/v.length:null}
      o.sono=med(function(d){return d.sono&&d.sono.total});o.notaSono=med(function(d){return d.sono&&d.sono.nota});o.vfc=med(function(d){return d.vfc&&d.vfc.noite});o.fcRep=med(function(d){return d.fcRepouso});
      o.passosDia=med(function(d){return d.passos});o.passos=ds.reduce(function(s,d){return s+((d.dados||{}).passos||0)},0);
      o.melhorNoite=ds.filter(function(d){return d.dados&&d.dados.sono&&d.dados.sono.nota}).sort(function(a,b){return b.dados.sono.nota-a.dados.sono.nota})[0];
      o.diaPassos=ds.filter(function(d){return d.dados&&d.dados.passos}).sort(function(a,b){return b.dados.passos-a.dados.passos})[0];
      /* mercado */
      var cp=r[1],notas={},prod={},merc={},prodV={},mercT={};cp.forEach(function(x){var k=x.data+"|"+x.mercado+"|"+(x.numero||"");notas[k]=notas[k]||{data:x.data,mercado:x.mercado,t:0,n:0};notas[k].t+=+x.valor_total;notas[k].n++;
        var pn=x.produto||x.descricao;prod[pn]=(prod[pn]||0)+1;prodV[pn]=(prodV[pn]||0)+(+x.valor_total||0);merc[x.mercado]=merc[x.mercado]||{};merc[x.mercado][k]=1;mercT[x.mercado]=(mercT[x.mercado]||0)+(+x.valor_total||0)});
      o.prod=prod;o.prodV=prodV;o.merc=merc;o.mercT=mercT;
      var nl=Object.keys(notas).map(function(k){return notas[k]});o.gasto=nl.reduce(function(s,n){return s+n.t},0);o.compras=nl.length;
      o.notas=nl.slice();o.maiorCompra=nl.sort(function(a,b){return b.t-a.t})[0];o.produto=Object.keys(prod).sort(function(a,b){return prod[b]-prod[a]})[0];o.produtoN=o.produto?prod[o.produto]:0;
      o.mercado=Object.keys(merc).sort(function(a,b){return Object.keys(merc[b]).length-Object.keys(merc[a]).length})[0];o.mercadoN=o.mercado?Object.keys(merc[o.mercado]).length:0;
      /* veículos: km rodados (maior menos menor km anotado no período) e combustível */
      o.veic=["civic","moto"].map(function(q){var rr=r[2].filter(function(x){return x.quem===q&&dentro(x.data)}),kms=rr.map(function(x){return (x.dados||{}).km}).filter(function(k){return typeof k==="number"});
        var comb=rr.filter(function(x){return x.tipo==="abastecimento"}).reduce(function(s,x){return s+((x.dados||{}).custo||0)},0);
        return {q:q,km:kms.length>1?Math.max.apply(null,kms)-Math.min.apply(null,kms):0,comb:comb,regs:rr}}).filter(function(v){return v.km||v.comb});
      o.bebe={peito:r[3][0],mamadeira:r[3][1],fralda:r[3][2],despertar:r[3][3]};
      o.aulasL=typeof mbaAulas==="function"?mbaAulas().filter(function(a){return dentro(a.data)&&a.data<=hojeISO()}):[];o.aulas=o.aulasL.length;
      return o})}

  function resumoDesenhar(box,o,ant,per){
    var T=function(t){return ativTipo(t)},MESES=RS_MESES;
    function dif(v,va,fmt,inverso){if(ant==null||va==null||v==null||!va)return "";var d=v-va;if(Math.abs(d)<1e-9)return "igual ao período anterior";var bom=inverso?d<0:d>0;
      return (bom?"▲ ":"▼ ")+(d>0?"+":"−")+fmt(Math.abs(d))+" vs. período anterior"}
    function card(k,cor,ico,num,rot,sub,sub2){box.appendChild(h("a",{class:"wcard",href:"#resumo/"+per+"/"+k,style:"--wc:"+cor,"aria-label":num+" "+rot+": ver os detalhes"},h("span",{class:"wico",text:ico}),h("b",{class:"wnum",text:num}),h("span",{class:"wrot",text:rot}),sub?h("span",{class:"sub",text:sub}):null,sub2?h("span",{class:"sub wdif",text:sub2}):null,h("span",{class:"wver",text:"Ver detalhes ›"})))}
    var n=function(v){return Math.round(v).toLocaleString("pt-BR")},km=function(v){return fmtN(Math.round(v*10)/10)+" km"};
    if(o.treinos)card("treinos","#E5484D","🏋️",String(o.treinos),o.treinos===1?"treino":"treinos",[o.km>=1?km(o.km):"",hmDur(o.seg)+" de treino",o.diasTreino+" de "+o.dias+" dias com treino"].filter(Boolean).join(" · "),dif(o.treinos,ant&&ant.treinos,function(v){return String(v)}));
    if(o.fav)card("esporte","#B5641B",T(o.fav)[1],T(o.fav)[0],"esporte que mais apareceu",o.favN+"×"+(per.length===4&&o.mesTop?" · mês mais ativo: "+MESES[+o.mesTop.slice(5)-1]+" ("+o.mesTopN+")":""));
    if(o.maior&&o.maior.dados.distancia>=1000)card("distancia","#0E8A6A","📍",km(o.maior.dados.distancia/1000),"maior distância",(o.maior.dados.nome||T(o.maior.tipo)[0])+" · "+dataBR(o.maior.inicio.slice(0,10)));
    if(o.passosDia)card("passos","#2E8BD8","👟",n(o.passosDia),"passos por dia",n(o.passos)+" no total"+(o.diaPassos?" · recorde: "+n(o.diaPassos.dados.passos)+" em "+dataBR(o.diaPassos.data):""),dif(o.passosDia,ant&&ant.passosDia,n));
    if(o.sono)card("sono","#5B5BD6","😴",hmDur(o.sono),"de sono por noite",[o.notaSono?"nota média "+Math.round(o.notaSono):"",o.melhorNoite?"melhor noite: "+dataBR(o.melhorNoite.data)+" ("+o.melhorNoite.dados.sono.nota+")":""].filter(Boolean).join(" · "),dif(o.sono,ant&&ant.sono,function(v){return Math.round(v/60)+" min"}));
    if(o.vfc)card("vfc","#7C6FE0","💓",Math.round(o.vfc)+" ms","variabilidade cardíaca média à noite",o.fcRep?"batimentos em repouso: "+Math.round(o.fcRep)+" por minuto, em média":"",dif(o.vfc,ant&&ant.vfc,function(v){return Math.round(v)+" ms"}));
    if(o.compras)card("mercado","#0E8A6A","🛒",brl(o.gasto),"no mercado",o.compras+(o.compras===1?" compra":" compras")+(o.maiorCompra?" · maior: "+brl(o.maiorCompra.t)+" em "+dataBR(o.maiorCompra.data):""),dif(o.gasto,ant&&ant.gasto,brl,true));
    if(o.mercado&&o.compras>1)card("mercados","#4B5D73","🏪",o.mercado.replace(/\s*\(.*\)$/,""),"mercado favorito",o.mercadoN+" visitas"+(o.produto?" · mais comprado: "+o.produto+" ("+o.produtoN+"×)":""));
    o.veic.forEach(function(v){card(v.q,"#4B5D73",v.q==="moto"?"🛵":"🚗",v.km?n(v.km)+" km":brl(v.comb),v.km?"rodados de "+FAM[v.q].n:"de combustível no "+FAM[v.q].n,v.km&&v.comb?brl(v.comb)+" de combustível":"")});
    var b=o.bebe;if(b.peito+b.mamadeira+b.fralda)card("olivia","#D9468F","🍼",n(b.peito+b.mamadeira),"mamadas da Olivia",[b.mamadeira?n(b.mamadeira)+" na mamadeira":"",b.fralda?n(b.fralda)+" fraldas":"",b.despertar?n(b.despertar)+" despertares à noite":""].filter(Boolean).join(" · "));
    if(o.aulas)card("mba","#B5641B","🎓",String(o.aulas),o.aulas===1?"aula do MBA":"aulas do MBA","");
    if(!box.children.length)box.appendChild(h("p",{class:"empty",text:"Sem dados neste período."}))}

  /* ===== Telas de detalhe dos cartões ===== */
  /* períodos de até 31 dias: uma coluna por dia; maiores: uma por mês */
  function rsBaldes(o){var L=[];
    if(o.dias<=31){for(var d=o.ini;d<=o.fim;d=maisDias(d,1))L.push({k:d,cima:d.slice(8),baixo:SEM1[new Date(d+"T12:00").getDay()],nome:dataBR(d)});return L}
    var y=+o.ini.slice(0,4),m=+o.ini.slice(5,7),ym;
    while((ym=y+"-"+String(m).padStart(2,"0"))<=o.fim.slice(0,7)){L.push({k:ym,cima:MES3[m-1],baixo:String(y).slice(2),nome:RS_MESES[m-1]+" de "+y});if(++m>12){m=1;y++}}
    return L}
  function rsDiaLocal(s){var d=new Date(s);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  /* colunas no padrão do site: valor fixo em cima, dia embaixo, toque mostra o cartão destacado */
  function rsColunas(B,vals,curto,dica){var mx=Math.max.apply(null,vals.concat([0]))||1;
    var vb=h("div",{class:"vbars vbpeso rsvb"},B.map(function(b,i){var v=vals[i]||0;
      var c=h("button",{type:"button",class:"vb","aria-label":b.nome+": "+(v?curto(v):"nada")},h("span",{class:"vbv",text:v?curto(v):"–"}),
        h("span",{class:"vbt"},h("span",{class:"vbf",style:"height:"+(v?Math.max(2,v/mx*100):0).toFixed(1)+"%"})),vbRotulo(b.cima,b.baixo));
      racDica.ligar(c,function(){return dica(i,v)});return c}));
    vbFim(vb);return vb}
  /* barras deitadas: nome, barra e valor; com href viram link */
  function rsBarras(L){var mx=Math.max.apply(null,L.map(function(x){return x.v}).concat([0]))||1;
    return h("div",{class:"hbars"},L.map(function(x){var b=h(x.href?"a":"button",x.href?{class:"hb",href:x.href}:{type:"button",class:"hb"},
      h("span",{class:"hbl"},x.nome,x.sub?h("small",{text:x.sub}):null),h("span",{class:"hbt"},h("span",{class:"hbf",style:"width:"+Math.max(2,x.v/mx*100).toFixed(1)+"%"})),h("span",{class:"hbv",text:x.txt}));
      racDica.ligar(b,function(){return [x.nome,x.dica||x.txt]});return b}))}
  function rsKpis(L){return h("div",{class:"kgasto"},L.filter(function(x){return x&&x[1]!=null&&x[1]!==""}).map(function(x){return h("div",null,h("span",{class:"kl",text:x[0]}),h("b",{class:"kv",text:String(x[1])}))}))}
  /* tabela em que a linha inteira leva a outra tela */
  function rsTabela(cols,linhas){var tb=h("table",{class:"famtab rstab"});tb.appendChild(h("thead",null,h("tr",null,cols.map(function(c){return h("th",{text:c})}))));
    var bd=h("tbody");linhas.forEach(function(l){var tr=h("tr",l.href?{class:"clic",tabindex:"0"}:null,l.c.map(function(c){return h("td",null,c==null?"":c)}));
      if(l.href){tr.onclick=function(e){if(!e.target.closest("a"))location.hash=l.href};tr.onkeydown=function(e){if(e.key==="Enter")location.hash=l.href}}bd.appendChild(tr)});
    tb.appendChild(bd);return h("div",{class:"famtabw"},tb)}

  function resumoDetalhe(box,o,per,k){
    var B=rsBaldes(o),idx={},mes=o.dias>31,porQ=mes?" por mês":" por dia",T=function(t){return ativTipo(t)};B.forEach(function(b,i){idx[b.k]=i});
    var n=function(v){return Math.round(v).toLocaleString("pt-BR")},km=function(v){return fmtN(Math.round(v*10)/10)+" km"},kmA=function(a){return a.dados.distancia?km(a.dados.distancia/1000):""};
    var mil=function(v){return v>=1000?fmtN(Math.round(v/100)/10)+"k":String(Math.round(v))};
    function ch(d){return mes?d.slice(0,7):d}
    function serie(lista,data,val){var v=B.map(function(){return 0});lista.forEach(function(x){var i=idx[ch(data(x))];if(i!=null)v[i]+=val(x)});return v}
    function media(lista,data,val){var s=B.map(function(){return 0}),c=B.map(function(){return 0});lista.forEach(function(x){var y=val(x),i=idx[ch(data(x))];if(typeof y==="number"&&i!=null){s[i]+=y;c[i]++}});return s.map(function(x,i){return c[i]?x/c[i]:0})}
    function noBalde(lista,data,i){return lista.filter(function(x){return ch(data(x))===B[i].k})}
    function sec(t,s){var d=h("div",{class:"rssec"},h("h3",{text:t}),s?h("p",{class:"sub",text:s}):null);box.appendChild(d);return d}
    function link(href,t){return h("div",{class:"vfil"},h("a",{href:href,class:"ghostbtn",text:t}))}
    box.appendChild(h("p",{class:"sub rsper",text:"De "+dataBR(o.ini)+" a "+dataBR(o.fim)+" · "+o.dias+" dias"}));
    var diaA=function(a){return a.inicio.slice(0,10)},porData=function(a,b){return b.inicio.localeCompare(a.inicio)};
    function treinosTab(L){return rsTabela(["Data","Esporte","Nome","Distância","Tempo"],L.slice(0,300).map(function(a){return {href:"#saude/treino/"+a.id,c:[dataBR(diaA(a)),T(a.tipo)[1]+" "+T(a.tipo)[0],a.dados.nome||"",kmA(a),hmDur(a.dados.duracao)]}}))}
    function porEsporte(at){var g={};at.forEach(function(a){var x=g[a.tipo]=g[a.tipo]||{n:0,s:0,m:0};x.n++;x.s+=a.dados.duracao||0;x.m+=a.dados.distancia||0});
      return rsBarras(Object.keys(g).sort(function(a,b){return g[b].n-g[a].n}).map(function(t){var x=g[t];return {nome:T(t)[1]+" "+T(t)[0],sub:hmDur(x.s)+(x.m>=1000?" · "+km(x.m/1000):""),v:x.n,txt:x.n+"×",dica:x.n+(x.n===1?" treino":" treinos")+" · "+hmDur(x.s)+(x.m>=1000?" · "+km(x.m/1000):"")}}))}
    var at=(o.at||[]).slice().sort(porData),ds=(o.ds||[]).slice().sort(function(a,b){return b.data.localeCompare(a.data)}),dd=function(d){return d.dados||{}};
    if(k==="treinos"){
      box.appendChild(rsKpis([["Treinos",o.treinos],["Distância",o.km?km(o.km):""],["Tempo",hmDur(o.seg)],["Dias com treino",o.diasTreino+" de "+o.dias]]));
      sec("Treinos"+porQ).appendChild(rsColunas(B,serie(at,diaA,function(){return 1}),String,function(i,v){var L=noBalde(at,diaA,i),s=L.reduce(function(t,a){return t+(a.dados.duracao||0)},0),m=L.reduce(function(t,a){return t+(a.dados.distancia||0)},0);
        return [B[i].nome,v?v+(v===1?" treino":" treinos")+" · "+hmDur(s)+(m>=1000?" · "+km(m/1000):"")+(v<=3?" · "+L.map(function(a){return T(a.tipo)[0]}).join(", "):""):"sem treino"]}));
      sec("Por esporte").appendChild(porEsporte(at));
      sec("Todos os treinos","Toque num treino para abrir o mapa, os batimentos e as voltas.").appendChild(treinosTab(at))}
    else if(k==="esporte"){
      var fav=o.fav,af=at.filter(function(a){return a.tipo===fav});
      box.appendChild(rsKpis([["Mais frequente",fav?T(fav)[0]:"—"],["Vezes",af.length],["Tempo",hmDur(af.reduce(function(t,a){return t+(a.dados.duracao||0)},0))],["Esportes diferentes",Object.keys(at.reduce(function(g,a){g[a.tipo]=1;return g},{})).length]]));
      sec("Todos os esportes").appendChild(porEsporte(at));
      if(fav){sec(T(fav)[0]+porQ).appendChild(rsColunas(B,serie(af,diaA,function(){return 1}),String,function(i,v){var L=noBalde(af,diaA,i);return [B[i].nome,v?v+"× "+T(fav)[0].toLowerCase()+" · "+hmDur(L.reduce(function(t,a){return t+(a.dados.duracao||0)},0)):"nenhuma vez"]}));
        sec("Cada "+T(fav)[0].toLowerCase()).appendChild(treinosTab(af))}}
    else if(k==="distancia"){
      var ad=at.filter(function(a){return a.dados.distancia}).sort(function(a,b){return b.dados.distancia-a.dados.distancia});
      box.appendChild(rsKpis([["Maior",ad[0]?kmA(ad[0]):"—"],["Total",km(o.km)],["Média por treino",ad.length?km(o.km/ad.length):"—"],["Treinos com distância",ad.length]]));
      sec("Quilômetros"+porQ).appendChild(rsColunas(B,serie(ad,diaA,function(a){return a.dados.distancia/1000}),function(v){return fmtN(Math.round(v*10)/10)},function(i,v){var L=noBalde(ad,diaA,i);return [B[i].nome,v?km(v)+" em "+L.length+(L.length===1?" treino":" treinos"):"sem distância"]}));
      sec("As maiores distâncias","Toque para abrir o treino.").appendChild(rsTabela(["#","Data","Esporte","Nome","Distância","Tempo"],ad.slice(0,25).map(function(a,i){return {href:"#saude/treino/"+a.id,c:[String(i+1),dataBR(diaA(a)),T(a.tipo)[0],a.dados.nome||"",kmA(a),hmDur(a.dados.duracao)]}})))}
    else if(k==="passos"){
      var dp=ds.filter(function(d){return dd(d).passos}),rec=dp.slice().sort(function(a,b){return dd(b).passos-dd(a).passos});
      box.appendChild(rsKpis([["Por dia",o.passosDia?n(o.passosDia):"—"],["Total",n(o.passos)],["Recorde",rec[0]?n(dd(rec[0]).passos)+" em "+dataBR(rec[0].data).slice(0,5):""],["Dias com 10 mil ou mais",dp.filter(function(d){return dd(d).passos>=1e4}).length+" de "+dp.length]]));
      sec(mes?"Média de passos por dia, mês a mês":"Passos por dia").appendChild(rsColunas(B,media(dp,function(d){return d.data},function(d){return dd(d).passos}),mil,function(i,v){var x=noBalde(dp,function(d){return d.data},i)[0];
        return [B[i].nome,v?n(v)+(mes?" passos por dia, em média":" passos")+(!mes&&x&&dd(x).distancia?" · "+km(dd(x).distancia/1000):""):"sem registro"]}));
      sec("Os dias com mais passos").appendChild(rsTabela(["#","Data","Passos"],rec.slice(0,10).map(function(d,i){return {href:"#saude",c:[String(i+1),dataBR(d.data),n(dd(d).passos)]}})));
      box.appendChild(link("#saude","Abrir Saúde e treinos ›"))}
    else if(k==="sono"){
      var dn=ds.filter(function(d){return dd(d).sono&&dd(d).sono.total}),pn=dn.filter(function(d){return dd(d).sono.nota}).sort(function(a,b){return dd(b).sono.nota-dd(a).sono.nota});
      box.appendChild(rsKpis([["Por noite",hmDur(o.sono)],["Nota média",o.notaSono?Math.round(o.notaSono):""],["Melhor noite",pn[0]?dataBR(pn[0].data).slice(0,5)+" ("+dd(pn[0]).sono.nota+")":""],["Pior noite",pn.length>1?dataBR(pn[pn.length-1].data).slice(0,5)+" ("+dd(pn[pn.length-1]).sono.nota+")":""],["Noites com 7h ou mais",dn.filter(function(d){return dd(d).sono.total>=25200}).length+" de "+dn.length]]));
      sec(mes?"Sono por noite, média do mês":"Sono por noite").appendChild(rsColunas(B,media(dn,function(d){return d.data},function(d){return dd(d).sono.total}),function(v){return hmDur(v)},function(i,v){var x=noBalde(dn,function(d){return d.data},i)[0];
        return [B[i].nome,v?hmDur(v)+(mes?" por noite, em média":"")+(!mes&&x&&dd(x).sono.nota?" · nota "+dd(x).sono.nota:""):"sem registro"]}));
      sec("Noite a noite").appendChild(rsTabela(["Data","Sono","Nota"],dn.slice(0,62).map(function(d){return {href:"#saude",c:[dataBR(d.data),hmDur(dd(d).sono.total),dd(d).sono.nota?String(dd(d).sono.nota):"—"]}})));
      box.appendChild(link("#saude","Abrir Saúde e treinos ›"))}
    else if(k==="vfc"){
      var dv=ds.filter(function(d){return dd(d).vfc&&dd(d).vfc.noite}),vv=dv.map(function(d){return dd(d).vfc.noite});
      box.appendChild(rsKpis([["Variabilidade média",o.vfc?Math.round(o.vfc)+" ms":""],["Menor",vv.length?Math.min.apply(null,vv)+" ms":""],["Maior",vv.length?Math.max.apply(null,vv)+" ms":""],["Batimentos em repouso",o.fcRep?Math.round(o.fcRep)+" por minuto":""]]));
      sec("Variabilidade cardíaca à noite"+(mes?", média do mês":""),"Quanto maior, mais descansado o corpo costuma estar.").appendChild(rsColunas(B,media(dv,function(d){return d.data},function(d){return dd(d).vfc.noite}),function(v){return String(Math.round(v))},function(i,v){var x=noBalde(dv,function(d){return d.data},i)[0];
        return [B[i].nome,v?Math.round(v)+" ms"+(!mes&&x&&dd(x).fcRepouso?" · repouso "+dd(x).fcRepouso+" bpm":""):"sem registro"]}));
      var df=ds.filter(function(d){return dd(d).fcRepouso});
      sec("Batimentos em repouso"+(mes?", média do mês":""),"Quanto menor, melhor o condicionamento.").appendChild(rsColunas(B,media(df,function(d){return d.data},function(d){return dd(d).fcRepouso}),function(v){return String(Math.round(v))},function(i,v){return [B[i].nome,v?Math.round(v)+" batimentos por minuto"+(mes?", em média":""):"sem registro"]}));
      box.appendChild(link("#saude","Abrir Saúde e treinos ›"))}
    else if(k==="mercado"){
      var ns=(o.notas||[]).slice().sort(function(a,b){return b.data.localeCompare(a.data)}),dN=function(x){return x.data};
      box.appendChild(rsKpis([["Total",brl(o.gasto||0)],["Compras",o.compras],["Média por compra",o.compras?brl(o.gasto/o.compras):""],["Maior compra",o.maiorCompra?brl(o.maiorCompra.t):""]]));
      sec("Gasto"+porQ).appendChild(rsColunas(B,serie(ns,dN,function(x){return x.t}),mil,function(i,v){var L=noBalde(ns,dN,i);return [B[i].nome,v?brl(v)+" · "+(L.length<=2?L.map(function(x){return x.mercado.replace(/\s*\(.*\)$/,"")}).join(" e "):L.length+" compras"):"sem compra"]}));
      var mt=o.mercT||{};sec("Por mercado").appendChild(rsBarras(Object.keys(mt).sort(function(a,b){return mt[b]-mt[a]}).map(function(m){var vis=Object.keys(o.merc[m]).length;return {nome:m.replace(/\s*\(.*\)$/,""),sub:vis+(vis===1?" visita":" visitas"),v:mt[m],txt:brl(mt[m]),dica:brl(mt[m])+" em "+vis+(vis===1?" visita":" visitas")}})));
      var pv=o.prodV||{};sec("Onde mais foi dinheiro").appendChild(rsBarras(Object.keys(pv).sort(function(a,b){return pv[b]-pv[a]}).slice(0,12).map(function(p){return {nome:p,sub:o.prod[p]+"×",v:pv[p],txt:brl(pv[p]),dica:brl(pv[p])+" em "+o.prod[p]+(o.prod[p]===1?" compra":" compras")}})));
      sec("Cada compra","Toque para abrir as notas do Mercado.").appendChild(rsTabela(["Data","Mercado","Itens","Total"],ns.map(function(x){return {href:"#mercado/notas",c:[dataBR(x.data),x.mercado.replace(/\s*\(.*\)$/,""),String(x.n),brl(x.t)]}})))}
    else if(k==="mercados"){
      var mv=o.merc||{};box.appendChild(rsKpis([["Favorito",o.mercado?o.mercado.replace(/\s*\(.*\)$/,""):"—"],["Mercados diferentes",Object.keys(mv).length],["Produtos diferentes",Object.keys(o.prod||{}).length]]));
      sec("Visitas por mercado").appendChild(rsBarras(Object.keys(mv).sort(function(a,b){return Object.keys(mv[b]).length-Object.keys(mv[a]).length}).map(function(m){var vis=Object.keys(mv[m]).length;return {nome:m.replace(/\s*\(.*\)$/,""),sub:brl((o.mercT||{})[m]||0),v:vis,txt:vis+"×",dica:vis+(vis===1?" visita":" visitas")+" · "+brl((o.mercT||{})[m]||0)}})));
      var pr=o.prod||{};sec("Os mais comprados").appendChild(rsBarras(Object.keys(pr).sort(function(a,b){return pr[b]-pr[a]||(o.prodV[b]-o.prodV[a])}).slice(0,15).map(function(p){return {nome:p,sub:brl(o.prodV[p]),v:pr[p],txt:pr[p]+"×",dica:pr[p]+(pr[p]===1?" vez":" vezes")+" · "+brl(o.prodV[p])}})));
      box.appendChild(link("#mercado","Abrir o Mercado ›"))}
    else if(k==="civic"||k==="moto"){
      var v=(o.veic||[]).filter(function(x){return x.q===k})[0]||{km:0,comb:0,regs:[]},rg=v.regs.slice().sort(function(a,b){return b.data.localeCompare(a.data)}),dR=function(x){return x.data};
      box.appendChild(rsKpis([["Rodados",v.km?n(v.km)+" km":"—"],["Combustível",brl(v.comb)],["Custo por km",v.km&&v.comb?brl(v.comb/v.km):""],["Registros",rg.length]]));
      var ab=rg.filter(function(x){return x.tipo==="abastecimento"});
      if(ab.length)sec("Combustível"+porQ).appendChild(rsColunas(B,serie(ab,dR,function(x){return (x.dados||{}).custo||0}),mil,function(i,val){var L=noBalde(ab,dR,i);return [B[i].nome,val?brl(val)+" em "+L.length+(L.length===1?" abastecimento":" abastecimentos"):"sem abastecimento"]}));
      sec("O que foi anotado").appendChild(rsTabela(["Data","O quê","km","Custo"],rg.map(function(x){var d=x.dados||{};return {href:"#veiculos/"+k,c:[dataBR(x.data),x.tipo,typeof d.km==="number"?n(d.km):"",d.custo?brl(d.custo):""]}})));
      box.appendChild(link("#veiculos/"+k,"Abrir "+FAM[k].n+" ›"))}
    else if(k==="olivia"){
      var esp=h("p",{class:"sub",text:"Buscando o dia a dia da Olivia…"});box.appendChild(esp);
      (function pag(from,acc){return Promise.resolve().then(function(){return SB.from("bebe").select("tipo,inicio").gte("inicio",o.ini).lte("inicio",o.fim+"T23:59:59").order("inicio").range(from,from+999)}).then(sbOk).then(function(l){acc=acc.concat(l);return l.length===1000?pag(from+1000,acc):acc})})(0,[])
        .then(function(L){esp.remove();var dB=function(x){return rsDiaLocal(x.inicio)},c=function(t){return L.filter(function(x){return x.tipo===t})};
          var pe=c("peito"),ma=c("mamadeira"),fr=c("fralda"),de=c("despertar"),mm=pe.concat(ma);
          box.appendChild(rsKpis([["Mamadas",n(mm.length)],["No peito",n(pe.length)],["Na mamadeira",n(ma.length)],["Fraldas",n(fr.length)],["Despertares à noite",n(de.length)],["Mamadas por dia",n(mm.length/o.dias)]]));
          sec("Mamadas"+porQ).appendChild(rsColunas(B,serie(mm,dB,function(){return 1}),String,function(i,v){var p=noBalde(pe,dB,i).length,m=noBalde(ma,dB,i).length;return [B[i].nome,v?v+" mamadas · "+p+" no peito, "+m+" na mamadeira":"nada anotado"]}));
          if(fr.length)sec("Fraldas"+porQ).appendChild(rsColunas(B,serie(fr,dB,function(){return 1}),String,function(i,v){return [B[i].nome,v?v+(v===1?" fralda":" fraldas"):"nada anotado"]}));
          if(de.length)sec("Despertares à noite"+porQ).appendChild(rsColunas(B,serie(de,dB,function(){return 1}),String,function(i,v){return [B[i].nome,v?v+(v===1?" despertar":" despertares"):"nenhum"]}));
          box.appendChild(link("#olivia","Abrir a página da Olivia ›"))})
        .catch(function(e){esp.textContent="Não consegui buscar o dia a dia ("+e.message+")."})}
    else if(k==="mba"){
      var al=(o.aulasL||[]).slice().reverse();box.appendChild(rsKpis([["Aulas no período",al.length],["Aulas no curso",typeof mbaAulas==="function"?mbaAulas().length:""]]));
      sec("As aulas","Toque para abrir as aulas no MBA.").appendChild(rsTabela(["Data","Hora","Aula"],al.map(function(a){return {href:"#mba/aulas",c:[dataBR(a.data),a.hora||"",a.t||""]}})));
      box.appendChild(link("#mba/aulas","Abrir o MBA ›"))}
  }
