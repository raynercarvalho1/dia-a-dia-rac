/* Dia a Dia RAC — módulo carregado quando a seção abre. Resumo: a semana (comparada com a anterior) e a retrospectiva do ano, no estilo "Wrapped",
   juntando relógio, mercado, veículos, Olivia e MBA. Usa as funções do núcleo (js/app.js), da Saúde e do MBA, que ficam no escopo global. */
  var RESUMO={per:"semana"};
  function renderResumo(per){
    var root=$("#resumo-view");root.innerHTML="";RESUMO.per=per||RESUMO.per;
    var hoje=hojeISO(),ano=+hoje.slice(0,4),anos=[];for(var a=ano;a>=+GARMIN_DESDE.slice(0,4);a--)anos.push(String(a));
    var p=panel("Resumo","A semana e o ano em números: treinos, sono, passos, mercado, carros, Olivia e MBA."),seg=h("div",{class:"seg famseg",role:"group","aria-label":"Período"});
    [["semana","Últimos 7 dias"],["mes","Este mês"]].concat(anos.map(function(a){return [a,a===String(ano)?"Retrospectiva "+a:a]})).forEach(function(o){
      var b=h("button",{type:"button","aria-pressed":String(RESUMO.per===o[0]),text:o[1]});b.onclick=function(){location.hash="#resumo/"+o[0]};seg.appendChild(b)});
    p.appendChild(seg);var box=h("div",{class:"wrapg"},h("p",{class:"sub",text:"Juntando tudo…"}));p.appendChild(box);root.appendChild(p);
    var per2=RESUMO.per,ini,fim=hoje,iniA,fimA;
    if(per2==="semana"){ini=maisDias(hoje,-6);iniA=maisDias(hoje,-13);fimA=maisDias(hoje,-7)}
    else if(per2==="mes"){ini=hoje.slice(0,8)+"01";var dm=Math.round((new Date(hoje)-new Date(ini))/864e5);fimA=maisDias(ini,-1);iniA=fimA.slice(0,8)+"01";if(fimA>maisDias(iniA,dm))fimA=maisDias(iniA,dm)}
    else{ini=per2+"-01-01";fim=per2===String(ano)?hoje:per2+"-12-31"}
    Promise.all([resumoDados(ini,fim),iniA?resumoDados(iniA,fimA):null]).then(function(r){box.innerHTML="";resumoDesenhar(box,r[0],r[1],per2)})
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
      var dtr={};at.forEach(function(a){dtr[a.inicio.slice(0,10)]=1});o.diasTreino=Object.keys(dtr).length;
      function med(f){var v=ds.map(function(d){return f(d.dados||{})}).filter(function(x){return typeof x==="number"});return v.length?v.reduce(function(a,b){return a+b},0)/v.length:null}
      o.sono=med(function(d){return d.sono&&d.sono.total});o.notaSono=med(function(d){return d.sono&&d.sono.nota});o.vfc=med(function(d){return d.vfc&&d.vfc.noite});o.fcRep=med(function(d){return d.fcRepouso});
      o.passosDia=med(function(d){return d.passos});o.passos=ds.reduce(function(s,d){return s+((d.dados||{}).passos||0)},0);
      o.melhorNoite=ds.filter(function(d){return d.dados&&d.dados.sono&&d.dados.sono.nota}).sort(function(a,b){return b.dados.sono.nota-a.dados.sono.nota})[0];
      o.diaPassos=ds.filter(function(d){return d.dados&&d.dados.passos}).sort(function(a,b){return b.dados.passos-a.dados.passos})[0];
      /* mercado */
      var cp=r[1],notas={},prod={},merc={};cp.forEach(function(x){var k=x.data+"|"+x.mercado+"|"+(x.numero||"");notas[k]=notas[k]||{data:x.data,mercado:x.mercado,t:0};notas[k].t+=+x.valor_total;
        var pn=x.produto||x.descricao;prod[pn]=(prod[pn]||0)+1;merc[x.mercado]=merc[x.mercado]||{};merc[x.mercado][k]=1});
      var nl=Object.keys(notas).map(function(k){return notas[k]});o.gasto=nl.reduce(function(s,n){return s+n.t},0);o.compras=nl.length;
      o.maiorCompra=nl.sort(function(a,b){return b.t-a.t})[0];o.produto=Object.keys(prod).sort(function(a,b){return prod[b]-prod[a]})[0];o.produtoN=o.produto?prod[o.produto]:0;
      o.mercado=Object.keys(merc).sort(function(a,b){return Object.keys(merc[b]).length-Object.keys(merc[a]).length})[0];o.mercadoN=o.mercado?Object.keys(merc[o.mercado]).length:0;
      /* veículos: km rodados (maior menos menor km anotado no período) e combustível */
      o.veic=["civic","moto"].map(function(q){var rr=r[2].filter(function(x){return x.quem===q&&dentro(x.data)}),kms=rr.map(function(x){return (x.dados||{}).km}).filter(function(k){return typeof k==="number"});
        var comb=rr.filter(function(x){return x.tipo==="abastecimento"}).reduce(function(s,x){return s+((x.dados||{}).custo||0)},0);
        return {q:q,km:kms.length>1?Math.max.apply(null,kms)-Math.min.apply(null,kms):0,comb:comb}}).filter(function(v){return v.km||v.comb});
      o.bebe={peito:r[3][0],mamadeira:r[3][1],fralda:r[3][2],despertar:r[3][3]};
      o.aulas=typeof mbaAulas==="function"?mbaAulas().filter(function(a){return dentro(a.data)&&a.data<=hojeISO()}).length:0;
      return o})}

  function resumoDesenhar(box,o,ant,per){
    var T=function(t){return ativTipo(t)},MESES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    function dif(v,va,fmt,inverso){if(ant==null||va==null||v==null||!va)return "";var d=v-va;if(Math.abs(d)<1e-9)return "igual ao período anterior";var bom=inverso?d<0:d>0;
      return (bom?"▲ ":"▼ ")+(d>0?"+":"−")+fmt(Math.abs(d))+" vs. período anterior"}
    function card(cor,ico,num,rot,sub,sub2){box.appendChild(h("div",{class:"wcard",style:"--wc:"+cor},h("span",{class:"wico",text:ico}),h("b",{class:"wnum",text:num}),h("span",{class:"wrot",text:rot}),sub?h("span",{class:"sub",text:sub}):null,sub2?h("span",{class:"sub wdif",text:sub2}):null))}
    var n=function(v){return Math.round(v).toLocaleString("pt-BR")},km=function(v){return fmtN(Math.round(v*10)/10)+" km"};
    if(o.treinos)card("#E5484D","🏋️",String(o.treinos),o.treinos===1?"treino":"treinos",[o.km>=1?km(o.km):"",hmDur(o.seg)+" de treino",o.diasTreino+" de "+o.dias+" dias com treino"].filter(Boolean).join(" · "),dif(o.treinos,ant&&ant.treinos,function(v){return String(v)}));
    if(o.fav)card("#B5641B",T(o.fav)[1],T(o.fav)[0],"esporte que mais apareceu",o.favN+"×"+(per.length===4&&o.mesTop?" · mês mais ativo: "+MESES[+o.mesTop.slice(5)-1]+" ("+o.mesTopN+")":""));
    if(o.maior&&o.maior.dados.distancia>=1000)card("#0E8A6A","📍",km(o.maior.dados.distancia/1000),"maior distância",(o.maior.dados.nome||T(o.maior.tipo)[0])+" · "+dataBR(o.maior.inicio.slice(0,10)));
    if(o.passosDia)card("#2E8BD8","👟",n(o.passosDia),"passos por dia",n(o.passos)+" no total"+(o.diaPassos?" · recorde: "+n(o.diaPassos.dados.passos)+" em "+dataBR(o.diaPassos.data):""),dif(o.passosDia,ant&&ant.passosDia,n));
    if(o.sono)card("#5B5BD6","😴",hmDur(o.sono),"de sono por noite",[o.notaSono?"nota média "+Math.round(o.notaSono):"",o.melhorNoite?"melhor noite: "+dataBR(o.melhorNoite.data)+" ("+o.melhorNoite.dados.sono.nota+")":""].filter(Boolean).join(" · "),dif(o.sono,ant&&ant.sono,function(v){return Math.round(v/60)+" min"}));
    if(o.vfc)card("#7C6FE0","💓",Math.round(o.vfc)+" ms","variabilidade cardíaca média à noite",o.fcRep?"batimentos em repouso: "+Math.round(o.fcRep)+" por minuto, em média":"",dif(o.vfc,ant&&ant.vfc,function(v){return Math.round(v)+" ms"}));
    if(o.compras)card("#0E8A6A","🛒",brl(o.gasto),"no mercado",o.compras+(o.compras===1?" compra":" compras")+(o.maiorCompra?" · maior: "+brl(o.maiorCompra.t)+" em "+dataBR(o.maiorCompra.data):""),dif(o.gasto,ant&&ant.gasto,brl,true));
    if(o.mercado&&o.compras>1)card("#4B5D73","🏪",o.mercado.replace(/\s*\(.*\)$/,""),"mercado favorito",o.mercadoN+" visitas"+(o.produto?" · mais comprado: "+o.produto+" ("+o.produtoN+"×)":""));
    o.veic.forEach(function(v){card("#4B5D73",v.q==="moto"?"🛵":"🚗",v.km?n(v.km)+" km":brl(v.comb),v.km?"rodados de "+FAM[v.q].n:"de combustível no "+FAM[v.q].n,v.km&&v.comb?brl(v.comb)+" de combustível":"")});
    var b=o.bebe;if(b.peito+b.mamadeira+b.fralda)card("#D9468F","🍼",n(b.peito+b.mamadeira),"mamadas da Olivia",[b.mamadeira?n(b.mamadeira)+" na mamadeira":"",b.fralda?n(b.fralda)+" fraldas":"",b.despertar?n(b.despertar)+" despertares à noite":""].filter(Boolean).join(" · "));
    if(o.aulas)card("#B5641B","🎓",String(o.aulas),o.aulas===1?"aula do MBA":"aulas do MBA","");
    if(!box.children.length)box.appendChild(h("p",{class:"empty",text:"Sem dados neste período."}))}
