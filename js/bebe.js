/* Dia a Dia RAC — módulo carregado quando a seção abre. Olivia: dia a dia (eventos do Napper, tabela "bebe"),
   crescimento com as curvas da OMS (js/oms.js), calendário de vacinas do SUS e a linha do tempo mês a mês com a cápsula do tempo.
   Usa as funções do núcleo (js/app.js) e do módulo família (js/familia.js). */
  var BEBE={evs:null,quem:null,met:"sono",dias:30};
  function bebeCarregar(quem,forca){
    if(BEBE.evs&&BEBE.quem===quem&&!forca)return Promise.resolve(BEBE.evs);
    function pag(de,acc){return SB.from("bebe").select("tipo,inicio,fim,dados").eq("quem",quem).order("inicio",{ascending:true}).range(de,de+999).then(sbOk).then(function(l){acc=acc.concat(l);return l.length===1000?pag(de+1000,acc):acc})}
    return pag(0,[]).then(function(l){BEBE.evs=l;BEBE.quem=quem;return l})}
  function haQuanto(iso){var m=Math.round((Date.now()-new Date(iso))/6e4);return m<60?m+" min":m<48*60?Math.floor(m/60)+"h"+String(m%60).padStart(2,"0"):Math.round(m/1440)+" dias"}
  function bebeImportar(quem,pronto){
    var inp=h("input",{type:"file",accept:".csv,text/csv",hidden:""}),b=h("button",{type:"button",class:"ghostbtn",text:"Importar do Napper (.csv)"}),st=h("p",{class:"sub",role:"status"});
    b.onclick=function(){inp.click()};
    inp.onchange=function(){var f=inp.files[0];if(!f)return;b.disabled=true;st.textContent="Lendo…";
      f.text().then(function(t){var ev=NUCLEO.napperLer(t).map(function(e){return {quem:quem,tipo:e.tipo,inicio:e.inicio,fim:e.fim,dados:e.dados,origem:"napper",chave:e.chave}});
        var feitos=0;function lote(i){if(i>=ev.length)return Promise.resolve();return SB.from("bebe").upsert(ev.slice(i,i+500),{onConflict:"user_id,chave",ignoreDuplicates:true}).then(function(r){if(r.error)throw new Error(r.error.message);feitos+=Math.min(500,ev.length-i);st.textContent="Importando… "+feitos+" de "+ev.length;return lote(i+500)})}
        return lote(0).then(function(){st.textContent="✓ "+ev.length+" registros do Napper conferidos (os que já estavam aqui não duplicam).";b.disabled=false;BEBE.evs=null;if(pronto)pronto()})})
      .catch(function(e){b.disabled=false;st.textContent=/bebe|relation|schema cache/i.test(e.message)?"Falta rodar o supabase/010_bebe.sql no Supabase.":"Não consegui importar: "+e.message;logErro("Napper",e)})};
    return h("div",null,h("div",{class:"vfil"},b,inp),st)}
  /* colunas simples por dia (mesmo visual dos outros gráficos do site) */
  function bebeColunas(pts,cor,fmt){
    var n=pts.length,vs=pts.map(function(p){return p.v}),mx=Math.max.apply(null,vs.concat([1])),passo=Math.ceil(n/(innerWidth<600?5:10)),cap=h("p",{class:"vbcap",role:"status"}),bs=[];
    function marcar(i){bs.forEach(function(b,j){b.classList.toggle("on",j===i)});cap.textContent=dataBR(pts[i].data)+" · "+fmt(pts[i].v)}
    var vb=h("div",{class:"vbars vbpeso"},pts.map(function(p,i){var b=h("button",{type:"button",class:"vb",title:dataBR(p.data)+" · "+fmt(p.v)},
      h("span",{class:"vbv"+(n<=14||i===n-1?"":" opc"),text:fmt(p.v).replace(/ .*/,"")}),h("span",{class:"vbt"},h("span",{class:"vbf",style:"background:"+cor+";height:"+Math.max(2,p.v/mx*100).toFixed(1)+"%"})),
      h("span",{class:"vbl",text:(n-1-i)%passo===0?p.data.slice(8)+"/"+p.data.slice(5,7):""}));b.onclick=function(){marcar(i)};b.onmouseenter=function(){marcar(i)};bs.push(b);return b}));
    var w=h("div",null,vb,cap);if(n)marcar(n-1);return w}
  var BEBE_MET=[["sono","Sono total",function(d){return d.sonoMin/60},function(v){return fmtN(Math.round(v*10)/10)+" h"},"#5B5BD6"],
    ["noite","Noite",function(d){return d.noiteMin/60},function(v){return fmtN(Math.round(v*10)/10)+" h"},"#3B3B98"],
    ["sonecas","Sonecas",function(d){return d.sonecaMin/60},function(v){return fmtN(Math.round(v*10)/10)+" h"},"#7C6FE0"],
    ["mamadas","Mamadas",function(d){return d.peito+d.mamadeira},function(v){return Math.round(v)+""},"#D9468F"],
    ["formula","Fórmula",function(d){return d.mlFormula},function(v){return Math.round(v)+" ml"},"#E8A317"],
    ["peito","Peito (min)",function(d){return d.peitoMin},function(v){return Math.round(v)+" min"},"#F58BC0"],
    ["fraldas","Fraldas",function(d){return d.fraldas},function(v){return Math.round(v)+""},"#0E8A6A"],
    ["despertares","Despertares",function(d){return d.despertares},function(v){return Math.round(v)+""},"#D6283B"]];
  function bebeDiaDia(box,quem){
    box.appendChild(h("p",{class:"sub",text:"Carregando o diário…"}));
    bebeCarregar(quem).then(function(evs){box.innerHTML="";
      var topo=panel("Dia a dia",evs.length?evs.length+" registros do Napper, de "+dataBR(evs[0].inicio.slice(0,10))+" a "+dataBR(evs[evs.length-1].inicio.slice(0,10))+".":"Exporte o CSV no Napper (Configurações → Exportar dados) e importe aqui. Pode importar de novo quando quiser: nada duplica.");
      topo.appendChild(bebeImportar(quem,function(){box.innerHTML="";bebeDiaDia(box,quem)}));box.appendChild(topo);
      if(!evs.length)return;
      /* agora: há quanto tempo foi a última mamada, fralda e sono */
      function ult(f){for(var i=evs.length-1;i>=0;i--)if(f(evs[i]))return evs[i];return null}
      var um=ult(function(e){return e.tipo==="peito"||e.tipo==="mamadeira"}),uf=ult(function(e){return e.tipo==="fralda"}),ud=ult(function(e){return e.tipo==="dormir"||e.tipo==="acordar"||e.tipo==="sono"});
      var dias=NUCLEO.bebeDias(evs),hj=dias.filter(function(d){return d.data===hojeISO()})[0],ag=panel("Agora");
      ag.appendChild(h("div",{class:"kgasto"},
        um?h("div",null,h("span",{class:"kl",text:"Última mamada"}),h("b",{class:"kv",text:"há "+haQuanto(um.fim||um.inicio)}),h("span",{class:"sub",text:um.tipo==="mamadeira"?(um.dados.ml||"?")+" ml de "+(um.dados.leite==="materno"?"leite materno":"fórmula"):"peito"})):null,
        uf?h("div",null,h("span",{class:"kl",text:"Última fralda"}),h("b",{class:"kv",text:"há "+haQuanto(uf.inicio)}),h("span",{class:"sub",text:uf.dados.conteudo||""})):null,
        ud?h("div",null,h("span",{class:"kl",text:ud.tipo==="dormir"?"Dormindo desde":ud.tipo==="acordar"?"Acordou há":"Último sono terminou há"}),h("b",{class:"kv",text:ud.tipo==="dormir"?new Date(ud.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):haQuanto(ud.fim||ud.inicio)})):null,
        hj?h("div",null,h("span",{class:"kl",text:"Hoje"}),h("b",{class:"kv",text:(hj.peito+hj.mamadeira)+" mamadas"}),h("span",{class:"sub",text:hj.mlFormula+" ml de fórmula · sonecas "+fmtN(Math.round(hj.sonecaMin/6)/10)+" h"})):null));
      box.appendChild(ag);
      /* médias: últimos 7 dias contra os 30 anteriores */
      function media(l,f){l=l.filter(function(d){return f(d)>0});return l.length?l.reduce(function(s,d){return s+f(d)},0)/l.length:null}
      var ult7=dias.filter(function(d){return d.data>maisDias(hojeISO(),-8)&&d.data<hojeISO()}),ant=dias.filter(function(d){return d.data<=maisDias(hojeISO(),-8)&&d.data>maisDias(hojeISO(),-38)});
      var pm=panel("Médias","Últimos 7 dias completos, comparados com o mês anterior.");
      pm.appendChild(h("div",{class:"kgasto"},BEBE_MET.map(function(m){var a=media(ult7,m[2]),b=media(ant,m[2]);if(a==null)return null;
        return h("div",null,h("span",{class:"kl",text:m[1]}),h("b",{class:"kv",text:m[3](a)}),b!=null?h("span",{class:"sub",text:"antes "+m[3](b)}):null)})));
      box.appendChild(pm);
      /* gráfico por dia */
      var pg=panel("Por dia"),segM=h("div",{class:"seg famseg famper"}),segP=h("div",{class:"seg famseg famper"}),gbox=h("div");
      function desenhar(){var M=BEBE_MET.filter(function(m){return m[0]===BEBE.met})[0];gbox.innerHTML="";
        segM.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.k===BEBE.met))});segP.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",String(+b.dataset.k===BEBE.dias))});
        var l=dias.filter(function(d){return d.data>maisDias(hojeISO(),-BEBE.dias)}).map(function(d){return {data:d.data,v:M[2](d)}});
        gbox.appendChild(l.length?bebeColunas(l,M[4],M[3]):h("p",{class:"empty",text:"Sem registros nesse período."}))}
      BEBE_MET.forEach(function(m){var b=h("button",{type:"button",text:m[1]});b.dataset.k=m[0];b.onclick=function(){BEBE.met=m[0];desenhar()};segM.appendChild(b)});
      [[14,"14 dias"],[30,"30 dias"],[120,"Tudo"]].forEach(function(x){var b=h("button",{type:"button",text:x[1]});b.dataset.k=x[0];b.onclick=function(){BEBE.dias=x[0];desenhar()};segP.appendChild(b)});
      pg.appendChild(segM);pg.appendChild(segP);pg.appendChild(gbox);box.appendChild(pg);desenhar();
      /* remédios e observações do Napper */
      var rem=evs.filter(function(e){return e.tipo==="remedio"||e.dados&&e.dados.obs}).slice(-12).reverse();
      if(rem.length){var pr=panel("Remédios e anotações (Napper)");pr.appendChild(h("ul",{class:"wl"},rem.map(function(e){return h("li",null,h("span",{class:"grow"},h("b",{text:e.dados.obs||e.tipo}),h("span",{class:"sub",text:new Date(e.inicio).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+" · "+e.tipo})))})));box.appendChild(pr)}
    }).catch(function(e){box.innerHTML="";box.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:/bebe|relation|schema cache/i.test(e.message)?"Falta rodar o supabase/010_bebe.sql no Supabase para ligar o diário.":"Não consegui carregar ("+e.message+")."}),bebeImportar(quem)));logErro("bebê",e)})}

  /* ---------- crescimento (OMS) e vacinas ---------- */
  var OMS_CURVAS=[[-1.881,"P3"],[-1.036,"P15"],[0,"P50"],[1.036,"P85"],[1.881,"P97"]];
  function bebeCrescimento(box,quem,regs){
    var nasc=(regs.filter(function(r){return r.tipo==="nascimento"})[0]||{}).data;
    if(!nasc){box.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Adicione o registro “Nascimento” para calcular os percentis e o calendário de vacinas."})));return}
    function idadeDias(iso){return Math.round((new Date(iso+"T12:00:00")-new Date(nasc+"T12:00:00"))/864e5)}
    var med=[["peso","Peso","kg"],["comprimento","Comprimento","cm"],["cabeca","Perímetro cefálico","cm"]];
    med.forEach(function(m){
      var tab=OMS_MENINAS[m[0]],pts=regs.filter(function(r){return r.tipo==="peso"}).map(function(r){var d=dadosDe(r),v=m[0]==="peso"?pesoNum(r):m[0]==="comprimento"?d.altura:d.cabeca;return typeof v==="number"?{data:r.data,dia:idadeDias(r.data),v:v}:null})
        .filter(function(p){return p&&p.dia>=0&&p.dia<=730}).sort(function(a,b){return a.dia-b.dia});
      if(!pts.length)return;
      pts.forEach(function(p){p.z=NUCLEO.omsZ(tab[p.dia],p.v);p.p=NUCLEO.percentilDeZ(p.z)});
      var ultp=pts[pts.length-1],maxd=Math.min(730,Math.max(ultp.dia+60,120)),W=640,H=220;
      var lo=NUCLEO.omsValor(tab[0],-2.3),hi=NUCLEO.omsValor(tab[maxd],2.3);
      function X(d){return (d/maxd*W).toFixed(1)}function Y(v){return (H-(v-lo)/(hi-lo)*H).toFixed(1)}
      var linhas=OMS_CURVAS.map(function(c){var dd="";for(var d=0;d<=maxd;d+=Math.max(1,Math.round(maxd/80)))dd+=(dd?"L":"M")+X(d)+" "+Y(NUCLEO.omsValor(tab[d],c[0]));
        return '<path d="'+dd+'" fill="none" stroke="'+(c[0]===0?"#0E8A6A":"#9AA5B1")+'" stroke-width="'+(c[0]===0?2:1)+'" stroke-dasharray="'+(c[0]===0?"":"4 4")+'" vector-effect="non-scaling-stroke"/>'+
          '<text x="'+(W-2)+'" y="'+Y(NUCLEO.omsValor(tab[maxd],c[0]))+'" text-anchor="end" class="tgt">'+c[1]+'</text>'}).join("");
      var pontos=pts.map(function(p){return '<circle cx="'+X(p.dia)+'" cy="'+Y(p.v)+'" r="4" fill="#D9468F" stroke="#fff" stroke-width="1.5"><title>'+dataBR(p.data)+": "+fmtN(p.v)+" "+m[2]+" · percentil "+fmtN(p.p)+'</title></circle>'}).join("");
      var meses="";for(var mm=0;mm*30.4375<=maxd;mm+=maxd>365?3:1)meses+='<text x="'+X(mm*30.4375)+'" y="'+(H+14)+'" text-anchor="middle" class="tgt">'+mm+'m</text>';
      var p=panel(m[1]+" (OMS)","Último: "+fmtN(ultp.v)+" "+m[2]+" em "+dataBR(ultp.data)+" · percentil "+fmtN(ultp.p)+" ("+(ultp.p<3?"abaixo do esperado, converse com o pediatra":ultp.p>97?"acima do esperado, converse com o pediatra":"dentro da faixa normal")+")");
      var g=h("div",{class:"tgbox"});g.innerHTML='<svg viewBox="0 0 '+W+' '+(H+18)+'" class="tgraf omsg" preserveAspectRatio="none">'+linhas+pontos+meses+'</svg>';p.appendChild(g);
      p.appendChild(h("details",{class:"famvals"},h("summary",{text:"Todas as medidas e percentis"}),h("ul",{class:"wl"},pts.slice().reverse().map(function(x){return h("li",null,h("span",{class:"grow",text:dataBR(x.data)+" · "+Math.floor(x.dia/30.4375)+" meses"}),h("span",{class:"end",text:fmtN(x.v)+" "+m[2]+" · P"+fmtN(Math.round(x.p))}))}))));
      box.appendChild(p)});
    /* vacinas: o que já foi (registros "Vacina" e anotações de remédio do Napper) e o que vem */
    var pv=panel("Vacinas (calendário do SUS)","Datas pela idade. Dá como tomada quando o nome aparece num registro de vacina ou numa anotação do Napper; confira com a carteirinha."),ul=h("ul",{class:"wl"});pv.appendChild(ul);box.appendChild(pv);
    var textos=regs.filter(function(r){return r.tipo==="vacina"}).map(function(r){return [r.titulo,r.valor,r.detalhes].join(" ")});
    (BEBE.evs?Promise.resolve(BEBE.evs):bebeCarregar(quem).catch(function(){return []})).then(function(evs){
      evs.forEach(function(e){if(e.tipo==="remedio"&&e.dados&&e.dados.obs&&/vacina/i.test(e.dados.obs))textos.push(e.dados.obs)});
      var hj=hojeISO();NUCLEO.vacinasCalendario(nasc,textos).forEach(function(v){var atr=!v.tomada&&v.prevista<hj;
        ul.appendChild(h("li",{class:atr?"alerta":null},h("span",{class:"grow"},h("b",{text:(v.tomada?"✓ ":atr?"⚠ ":"")+v.nome}),h("span",{class:"sub",text:(v.meses?v.meses+" meses":"ao nascer")+" · "+dataBR(v.prevista)})),h("span",{class:"end",text:v.tomada?"tomada":atr?"atrasada?":"prevista"})))})})}

  /* ---------- mês a mês e cápsula do tempo ---------- */
  function bebeMeses(box,quem,regs,urls){
    var nasc=(regs.filter(function(r){return r.tipo==="nascimento"})[0]||{}).data;
    if(!nasc){box.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Adicione o registro “Nascimento” para montar a linha do tempo por mês."})));return}
    function mesDe(iso){var a=new Date(nasc+"T12:00:00"),b=new Date(iso.slice(0,10)+"T12:00:00"),m=(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth();if(b.getDate()<a.getDate())m--;return Math.max(0,m)}
    var cartas=regs.filter(function(r){return r.tipo==="carta"});
    var cp=panel("Cápsula do tempo","Cartas para a Olivia ler no futuro. Escreva em “+ Adicionar registro”, tipo “Carta para o futuro”, e diga em “Abrir em” quando ela pode ler.");
    if(cartas.length)cp.appendChild(h("ul",{class:"wl"},cartas.map(function(c){var det=h("details",{class:"famvals"},h("summary",{text:"✉️ "+c.titulo+(c.valor?" · abrir em "+c.valor:"")+" · escrita em "+dataBR(c.data)}),h("p",{class:"famdet",text:c.detalhes||""}));
      var fs=((c.dados||{}).fotos||[]).map(function(pth){return urls[pth]}).filter(Boolean);if(fs.length)det.appendChild(h("div",{class:"famarq"},fs.map(function(u){return h("a",{href:u,target:"_blank",rel:"noopener"},h("img",{src:u,alt:"",loading:"lazy"}))})));
      return h("li",null,det)})));
    else cp.appendChild(h("p",{class:"sub",text:"Nenhuma carta ainda."}));
    box.appendChild(cp);
    var G={};regs.forEach(function(r){if(r.tipo==="carta")return;var m=mesDe(r.data);(G[m]=G[m]||[]).push(r)});
    var porDia=BEBE.evs?NUCLEO.bebeDias(BEBE.evs):[];
    Object.keys(G).map(Number).sort(function(a,b){return b-a}).forEach(function(m){
      var l=G[m].slice().sort(function(a,b){return a.data.localeCompare(b.data)}),p=panel(m===0?"Primeiro mês":(m+1)+"º mês",dataBR(l[0].data)+" a "+dataBR(l[l.length-1].data));
      var peso=l.filter(function(r){return r.tipo==="peso"&&pesoNum(r)}).pop();
      var dm=porDia.filter(function(d){return mesDe(d.data)===m});
      var info=[peso?"Peso: "+fmtN(pesoNum(peso))+" kg"+(dadosDe(peso).altura?" · "+fmtN(dadosDe(peso).altura)+" cm":""):"",
        dm.length?"Sono médio: "+fmtN(Math.round(dm.reduce(function(s,d){return s+d.sonoMin},0)/dm.length/6)/10)+" h/dia · "+fmtN(Math.round(dm.reduce(function(s,d){return s+d.peito+d.mamadeira},0)/dm.length*10)/10)+" mamadas/dia":""].filter(Boolean);
      if(info.length)p.appendChild(h("p",{class:"sub",text:info.join(" · ")}));
      p.appendChild(h("ul",{class:"wl"},l.filter(function(r){return r.tipo!=="peso"&&r.tipo!=="diario"}).map(function(r){return h("li",null,h("span",{class:"grow"},h("b",{text:tipoInfo(r.tipo)[1]+": "+r.titulo}),h("span",{class:"sub",text:dataBR(r.data)})))})));
      var fotos=[];l.forEach(function(r){(r.arquivos||[]).forEach(function(a){if(/^image\//.test(a.tipo)&&urls[a.path])fotos.push(urls[a.path])})});
      if(fotos.length)p.appendChild(h("div",{class:"famarq"},fotos.slice(0,12).map(function(u){return h("a",{href:u,target:"_blank",rel:"noopener"},h("img",{src:u,alt:"",loading:"lazy"}))})));
      /* carta do mês: quando o mês termina, um rascunho com os números e as fotos dele, para editar e guardar na cápsula */
      if(mesDe(hojeISO())>m&&!cartas.some(function(c){return (c.dados||{}).mes===m}))p.appendChild(bebeCartaBtn(quem,nasc,m,l,dm,peso,urls));
      box.appendChild(p)})}
  function bebeMesData(nasc,m){var d=new Date(nasc+"T12:00:00");d.setMonth(d.getMonth()+m);return d.toISOString().slice(0,10)}
  function bebeCartaBtn(quem,nasc,m,l,dm,peso,urls){
    var w=h("div",{class:"stack"}),b=h("button",{type:"button",class:"ghostbtn pri",text:"✉️ Escrever a carta do "+(m===0?"primeiro":(m+1)+"º")+" mês"});w.appendChild(b);
    b.onclick=function(){b.remove();
      var de=bebeMesData(nasc,m),ate=maisDias(bebeMesData(nasc,m+1),-1),pd=dadosDe(peso||{}),linhas=[];
      if(peso)linhas.push("Você terminou o mês com "+fmtN(pesoNum(peso))+" kg"+(pd.altura?" e "+fmtN(pd.altura)+" cm":"")+".");
      if(dm.length){var so=dm.reduce(function(s,d){return s+d.sonoMin},0)/dm.length/60,ma=dm.reduce(function(s,d){return s+d.peito+d.mamadeira},0)/dm.length;
        linhas.push("Dormia umas "+fmtN(Math.round(so*10)/10)+" horas por dia e mamava umas "+Math.round(ma)+" vezes.")}
      var mom=l.filter(function(r){return r.tipo==="momento"}).map(function(r){return r.titulo}),vac=l.filter(function(r){return r.tipo==="vacina"}).map(function(r){return r.titulo}),con=l.filter(function(r){return /consulta|exame/.test(r.tipo)}).map(function(r){return r.titulo});
      if(mom.length)linhas.push("Foi o mês de: "+mom.join("; ")+".");if(vac.length)linhas.push("Tomou "+(vac.length===1?"a vacina ":"as vacinas ")+vac.join(", ")+" (e foi corajosa).");if(con.length)linhas.push("Teve "+con.join(", ")+".");
      var txt="Querida Olivia,\n\nEste é o seu "+(m===0?"primeiro":(m+1)+"º")+" mês de vida, de "+dataBR(de)+" a "+dataBR(ate)+". "+linhas.join(" ")+"\n\n(Escreva aqui o que vocês viveram, o que ela aprontou, como vocês se sentiram.)\n\nCom amor,\n";
      var ta=h("textarea",{rows:"9"});ta.value=txt;
      var d18=new Date(nasc+"T12:00:00");d18.setFullYear(d18.getFullYear()+18);var ab=h("input",{type:"date",value:d18.toISOString().slice(0,10)});
      var fotos=[];l.forEach(function(r){(r.arquivos||[]).forEach(function(a){if(/^image\//.test(a.tipo))fotos.push(a.path)})});
      var sv=h("button",{type:"button",text:"Guardar na cápsula"}),st=h("p",{class:"sub",role:"status"});
      w.appendChild(h("div",{class:"wform"},h("label",null,"Carta (é só um rascunho: edite à vontade)",ta),h("label",null,"Ela pode abrir em",ab),
        fotos.length?h("p",{class:"sub",text:"As "+Math.min(fotos.length,12)+" fotos deste mês vão junto com a carta."}):null,h("div",{class:"vfil"},sv),st));
      sv.onclick=function(){sv.disabled=true;st.textContent="Guardando…";
        SB.from("registros").insert({quem:quem,tipo:"carta",data:hojeISO(),titulo:"Carta do "+(m===0?"primeiro":(m+1)+"º")+" mês",valor:ab.value?dataBR(ab.value):null,detalhes:ta.value.trim(),dados:{mes:m,fotos:fotos.slice(0,12),abrirEm:ab.value||undefined}})
          .then(sbOk).then(function(){renderFamilia(quem)},function(e){sv.disabled=false;st.textContent="Não consegui guardar: "+e.message})};
      ta.focus()};
    return w}
