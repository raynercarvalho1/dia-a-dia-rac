/* Dia a Dia RAC — módulo carregado quando a seção abre. Saúde e treinos: dados do Garmin, tendências, sono, treinos e a página de cada treino com mapa.
   Usa as funções do núcleo (js/app.js), que ficam no escopo global. */
  /* ===== Saúde e treinos: dados do relógio Garmin =====
     A função "garmin" do Supabase busca na Garmin (API pessoal oficial) e grava em garmin_dia e garmin_ativ;
     esta página lê as tabelas, mostra o dia, as tendências e os treinos, e pede uma atualização quando abre. */
  var SAUDE={dias:null,ativs:null,met:"sono",per:"30",tipo:"",mais:30,sinc:null};
  var ATIV_TIPOS={running:["Corrida","🏃"],treadmill_running:["Esteira","🏃"],walking:["Caminhada","🚶"],strength_training:["Musculação","🏋️"],
    lap_swimming:["Natação","🏊"],open_water_swimming:["Águas abertas","🌊"],cycling:["Bike","🚴"],fitness_equipment:["Aparelhos","⚙️"]};
  /* esportes que não aparecem no quadro de Treinos: aparelhos, águas abertas e bike */
  var TREINO_OCULTOS=["fitness_equipment","open_water_swimming","cycling"];
  function ativTipo(t){return ATIV_TIPOS[t]||[t.replace(/_/g," "),"•"]}
  function hmDur(seg){if(seg==null)return "—";var m=Math.round(seg/60);return Math.floor(m/60)+"h"+String(m%60).padStart(2,"0")}
  function durTxt(seg){var m=Math.round(seg/60);return m<60?m+" min":Math.floor(m/60)+"h"+String(m%60).padStart(2,"0")}
  /* ritmo pelo tempo em movimento (numa caminhada com paradas, o tempo total daria um ritmo irreal) */
  function ritmo(a){var d=a.dados,v=d.emMovimento&&d.distancia?d.distancia/d.emMovimento:d.velocidade;if(!v||!d.distancia)return "";
    if(/running|walking/.test(a.tipo)){var s=1000/v,m=Math.floor(s/60);return m+":"+String(Math.round(s%60)).padStart(2,"0")+" /km"}
    if(/swimming/.test(a.tipo)){var s2=100/v;return Math.floor(s2/60)+":"+String(Math.round(s2%60)).padStart(2,"0")+" /100 m"}
    return fmtN(Math.round(v*36)/10)+" km/h"}
  function distTxt(a){var m=a.dados.distancia;if(!m)return "";return /swimming/.test(a.tipo)?fmtN(Math.round(m))+" m":fmtN(Math.round(m/10)/100)+" km"}
  /* o que cada métrica mostra: [chave, nome, como ler do dia, formato, cor, maior é melhor?] */
  var SAUDE_MET=[
    ["sono","Sono",function(d){return d.sono&&d.sono.total?d.sono.total/3600:null},function(v){return hmDur(v*3600)},"#5B5BD6",true],
    ["nota","Nota do sono",function(d){return d.sono&&d.sono.nota},function(v){return Math.round(v)},"#7C6FE0",true],
    ["vfc","Variabilidade cardíaca",function(d){return d.vfc&&d.vfc.noite},function(v){return Math.round(v)+" ms"},"#0E8A6A",true],
    ["fc","Batimentos em repouso",function(d){return d.fcRepouso},function(v){return Math.round(v)+" por minuto"},"#D6283B",false],
    ["bb","Energia do corpo",function(d){return d.bbMax},function(v){return Math.round(v)},"#2E8BD8",true],
    ["estresse","Estresse",function(d){return d.estresse},function(v){return Math.round(v)},"#E8A317",false],
    ["passos","Passos",function(d){return d.passos},function(v){return Math.round(v).toLocaleString("pt-BR")},"#B5641B",true],
    ["humor","Humor (diário)",function(d){return d.humor},function(v){return HUMOR[Math.round(v)-1]+" "+fmtN(Math.round(v*10)/10)},"#D9468F",true]];
  /* diário de uma linha: humor de 1 a 5 e uma frase por dia, em PESSOAL.diario {"AAAA-MM-DD": {h, t}} */
  var HUMOR=["😞","🙁","😐","🙂","😄"];
  /* antes desta data o relógio era de outra pessoa: nada disso entra no site, e o que tiver ficado no banco é apagado */
  var GARMIN_DESDE="2025-11-01";
  /* o que cada número quer dizer, sem sigla */
  function saudeGlossario(){
    var G=[["Prontidão","Nota do site, de 0 a 100: compara a variabilidade cardíaca, os batimentos em repouso, o sono e a energia do corpo de hoje com o seu normal dos últimos 60 dias."],
      ["Variabilidade cardíaca","Em inglês, heart rate variability (HRV). É a variação do tempo entre um batimento e outro, medida durante o sono, em milissegundos (ms). Acima do seu normal = corpo recuperado; bem abaixo = cansaço, estresse, álcool ou doença chegando."],
      ["Batimentos em repouso","Em inglês, resting heart rate. A média mais baixa de batimentos por minuto no dia. Cinco ou mais acima do seu normal costuma ser sinal de cansaço."],
      ["Energia do corpo","Em inglês, Body Battery (0 a 100). Estimativa da Garmin da energia que você tem: carrega dormindo e descansando, gasta com esforço e estresse."],
      ["Estresse","De 0 a 100, calculado pela variabilidade cardíaca ao longo do dia: até 25 é descanso, de 26 a 50 é baixo, acima de 50 é alto."],
      ["Oxigênio no sangue","Em inglês, pulse oximetry (SpO2). Porcentagem de oxigênio no sangue, medida à noite. O normal é acima de 95%."],
      ["Efeito aeróbico e anaeróbico","Em inglês, training effect (0 a 5). Quanto o treino melhorou o condicionamento: de 2 a 3 mantém, de 3 a 4 melhora, acima de 4 é muito puxado."],
      ["Carga de exercício","Em inglês, training load. Soma da intensidade e da duração do treino; quanto maior, mais o corpo precisa para se recuperar."],
      ["Faixas de batimentos","Em inglês, heart rate zones: de 1 (leve, aquecimento) a 5 (esforço máximo), pela porcentagem dos seus batimentos máximos."],
      ["Idade do condicionamento físico","Em inglês, fitness age. A idade que o seu condicionamento aparenta, comparada com a média das pessoas."]];
    return h("details",{class:"famvals"},h("summary",{text:"O que significa cada número"}),h("dl",{class:"glos"},G.map(function(g){return [h("dt",{text:g[0]}),h("dd",{text:g[1]})]}).reduce(function(a,b){return a.concat(b)},[])))}
  function saudeCarregar(){
    function pag(t,cols,ord,from,acc){return SB.from(t).select(cols).order(ord,{ascending:false}).range(from,from+999).then(sbOk).then(function(l){acc=acc.concat(l);return l.length===1000?pag(t,cols,ord,from+1000,acc):acc})}
    return Promise.all([pag("garmin_dia","data,dados,atualizado","data",0,[]),pag("garmin_ativ","id,inicio,tipo,dados","inicio",0,[])])
      .then(function(r){SAUDE.dias=r[0].reverse().filter(function(d){return d.data>=GARMIN_DESDE});
        SAUDE.ativs=r[1].filter(function(a){return a.inicio>=GARMIN_DESDE});
        if(SAUDE.ativs.length<r[1].length||SAUDE.dias.length<r[0].length)Promise.resolve().then(function(){return Promise.all([SB.from("garmin_ativ").delete().lt("inicio",GARMIN_DESDE),SB.from("garmin_dia").delete().lt("data",GARMIN_DESDE)])}).catch(function(e){logErro("Garmin (limpar antigos)",e)})})}
  /* pede à função "garmin" o que é novo (dias e depois treinos), em rodadas até não ter mais */
  function saudeSincronizar(st){
    function chamar(corpo){return SB.functions.invoke("garmin",{body:corpo}).then(function(r){
      if(r.error){var c=r.error.context;return (c&&c.json?c.json().catch(function(){return {}}):Promise.resolve({})).then(function(j){throw new Error(j.erro||r.error.message)})}
      if(r.data&&r.data.erro)throw new Error(r.data.erro);return r.data})}
    var n=0;
    function dias(){st("Buscando no relógio… (dias)");return chamar({tipo:"dias"}).then(function(d){n+=d.salvos||0;if(d.mais)return dias()})}
    function ativs(ini){st("Buscando no relógio… (treinos)");return chamar({tipo:"ativ",inicio:ini||0}).then(function(d){if(d.mais)return ativs(d.inicio)})}
    return dias().then(function(){return ativs(0)})}
  function renderSaude(treino){
    var root=$("#saude-view");root.innerHTML="";window.scrollTo(0,0);
    if(treino){(SAUDE.ativs?Promise.resolve():saudeCarregar()).then(function(){saudeTreino(root,treino)}).catch(function(e){root.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Não consegui carregar ("+e.message+")."})))});return}
    var topo=panel("Relógio Garmin","Fenix 6S Pro · dados oficiais da Garmin"),st=h("p",{class:"sub",role:"status"}),bt=h("button",{type:"button",class:"ghostbtn",text:"Atualizar agora"});
    topo.appendChild(h("div",{class:"vfil"},bt,st));root.appendChild(topo);
    var corpo=h("div",{class:"stack"});root.appendChild(corpo);
    function sinc(){bt.disabled=true;SAUDE.sinc=saudeSincronizar(function(t){st.textContent=t}).then(function(){return saudeCarregar()}).then(function(){SAUDE.sinc=null;bt.disabled=false;st.textContent="✓ Atualizado agora.";desenhar()})
      .catch(function(e){SAUDE.sinc=null;bt.disabled=false;logErro("Garmin",e);
        st.textContent=/Failed to send|not found|404|FunctionsFetchError/i.test(e.message)?"A função “garmin” ainda não está no Supabase (veja o passo a passo).":"Não consegui atualizar: "+e.message})}
    bt.onclick=sinc;
    (SAUDE.dias?Promise.resolve():saudeCarregar()).then(function(){
      desenhar();
      var ult=SAUDE.dias.length?SAUDE.dias[SAUDE.dias.length-1].atualizado:null;
      st.textContent=ult?"Última atualização: "+new Date(ult).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
      /* abre atualizando se faz mais de 2 horas */
      if(!SAUDE.sinc&&(!ult||Date.now()-new Date(ult).getTime()>2*3600e3))sinc()
    }).catch(function(e){corpo.innerHTML="";corpo.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:/garmin_dia|relation|schema cache/i.test(e.message)?"Falta rodar o supabase/007_garmin.sql no Supabase para ligar esta área.":"Não consegui carregar ("+e.message+")."})))});
    function desenhar(){
      corpo.innerHTML="";var dias=SAUDE.dias||[],ativs=SAUDE.ativs||[];
      if(!dias.length&&!ativs.length){corpo.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Ainda sem dados. Toque em Atualizar agora."})));return}
      /* o humor do diário entra nos dados do dia (só na tela), para a tendência e os cruzamentos */
      var di=PESSOAL.diario||{};dias.forEach(function(d){var x=di[d.data];if(d.dados)d.dados.humor=x?x.h:undefined});
      [saudeDiario(),saudeProntidao(dias,ativs),saudeHoje(dias),saudeTendencia(dias),saudeSono(dias),saudeTreinos(ativs)].forEach(function(x){if(x)corpo.appendChild(x)})}
    /* prontidão do dia (VFC, FC de repouso, sono e Body Battery contra a sua faixa dos últimos 60 dias) e cruzamentos dos últimos 120 dias */
    function saudeProntidao(dias,ativs){
      var d=dias[dias.length-1];if(!d)return null;var pr=NUCLEO.prontidao(dias,d.data);if(!pr)return null;
      var cor=pr.nota>=70?"var(--good)":pr.nota>=45?"#E8A317":"#D6283B";
      var p=panel("Prontidão "+(d.data===hojeISO()?"de hoje":"em "+dataBR(d.data)),"Comparada com o seu normal dos últimos 60 dias, não com a média da população.");
      var P=pr.partes,itens=[P.vfc?["Variabilidade cardíaca",P.vfc.v+" ms","normal "+Math.round(P.vfc.mediana),P.vfc.nota]:null,P.fc?["Batimentos em repouso",P.fc.v+" por minuto","normal "+Math.round(P.fc.mediana),P.fc.nota]:null,
        P.sono?["Sono",hmDur(P.sono.v*3600),"",P.sono.nota]:null,P.bb?["Energia do corpo",String(P.bb.v),"",P.bb.nota]:null].filter(Boolean);
      /* últimos 14 dias em barrinhas */
      var serie=dias.slice(-14).map(function(x){var q=NUCLEO.prontidao(dias,x.data);return [x.data,q&&q.nota]});
      p.appendChild(h("div",{class:"prontw"},h("div",{class:"pronto",style:"--c:"+cor},h("b",{text:String(pr.nota)}),h("span",{text:pr.rotulo})),
        h("div",{class:"prontp"},itens.map(function(i){return h("div",{class:"prontl"},h("span",{class:"kl",text:i[0]}),h("i",{class:"prontb"},h("i",{style:"width:"+i[3]+"%"})),h("span",{class:"sub",text:i[1]+(i[2]?" · "+i[2]:"")}))}))));
      /* cada barra com o valor em cima e o dia embaixo, sempre visíveis */
      p.appendChild(h("p",{class:"kl",text:"Prontidão dos últimos 14 dias"}));
      p.appendChild(h("div",{class:"prontserie"},serie.map(function(x){var dt=new Date(x[0]+"T12:00:00");
        return h("div",{class:"pcol",title:dataBR(x[0])+": "+(x[1]==null?"sem dado":x[1])},h("span",{class:"pv",text:x[1]==null?"–":String(x[1])}),
          h("span",{class:"pbar"},h("i",{style:"height:"+(x[1]||2)+"%;background:"+(x[1]==null?"var(--line)":x[1]>=70?"#1a8a4a":x[1]>=45?"#E8A317":"#D6283B")})),
          h("span",{class:"pd",text:dt.toLocaleDateString("pt-BR",{weekday:"narrow"}).toUpperCase()+" "+x[0].slice(8,10)}))})));
      if(pr.alertas.length)p.appendChild(h("ul",{class:"wl"},pr.alertas.map(function(t){return h("li",{class:"qrwarn"},h("span",{class:"grow",text:"⚠ "+t}))})));
      var ins=saudeInsights(dias,ativs);
      if(ins.length){p.appendChild(h("h3",{class:"dayh",text:"O que os seus dados mostram"}));p.appendChild(h("ul",{class:"wl"},ins.map(function(t){return h("li",null,h("span",{class:"grow",text:t}))})))}
      return p}
    function saudeDiario(){
      if(!isOwner())return null;var hoje=hojeISO(),di=PESSOAL.diario||{},x=di[hoje]||{};
      var p=panel("Como foi hoje?","Uma linha por dia. Com algumas semanas, dá para ver o que o sono, o treino e o estresse fazem com o seu humor.");
      var esc=h("div",{class:"humor",role:"group","aria-label":"Humor de hoje"}),sel=x.h||0;
      HUMOR.forEach(function(e,i){var b=h("button",{type:"button","aria-pressed":String(sel===i+1),title:["Péssimo","Ruim","Normal","Bom","Ótimo"][i],text:e});b.onclick=function(){sel=i+1;[].forEach.call(esc.children,function(c,j){c.setAttribute("aria-pressed",String(j===i))})};esc.appendChild(b)});
      var t=h("input",{type:"text",maxlength:"140",placeholder:"Uma linha sobre o dia (opcional)",value:x.t||""}),sv=h("button",{type:"button",text:x.h?"Atualizar":"Salvar"}),st=h("span",{class:"sub",role:"status"});
      sv.onclick=function(){if(!sel){st.textContent="Escolha um rosto.";return}var n=Object.assign({},PESSOAL.diario||{});n[hoje]={h:sel,t:t.value.trim()||undefined};pessoalGravar("diario",n);st.textContent="✓ Anotado.";sv.textContent="Atualizar";desenhar()};
      p.appendChild(esc);p.appendChild(h("div",{class:"listaadd"},t,sv));p.appendChild(st);
      /* últimas 2 semanas */
      var fx=h("div",{class:"humorfx"});for(var i=13;i>=0;i--){var dt=maisDias(hoje,-i),y=di[dt];fx.appendChild(h("span",{title:dataBR(dt)+(y&&y.t?": "+y.t:""),class:y?null:"vazio",text:y?HUMOR[y.h-1]:"·"}))}
      p.appendChild(fx);return p}
    function saudeInsights(dias,ativs){
      var ini=NUCLEO.somaDiasISO(hojeISO(),-120),D=dias.filter(function(x){return x.data>=ini}),por={},out=[];D.forEach(function(x){por[x.data]=x.dados||{}});
      function media(l){return l.length?l.reduce(function(a,b){return a+b},0)/l.length:null}
      /* carga de treino por dia (soma da "carga" do Garmin, ou minutos quando não tem) */
      var carga={};ativs.forEach(function(a){var k=a.inicio.slice(0,10);if(k<ini)return;carga[k]=(carga[k]||0)+(a.dados.carga||(a.dados.duracao||0)/60)});
      var cs=Object.keys(carga).map(function(k){return carga[k]}).sort(function(a,b){return a-b}),forte=cs.length?cs[Math.floor(cs.length*.6)]:Infinity;
      var vf=[],vd=[],sf=[],sd=[];
      D.forEach(function(x){var ont=NUCLEO.somaDiasISO(x.data,-1);if(!por[ont])return;var c=carga[ont]||0,v=x.dados.vfc&&x.dados.vfc.noite,n=x.dados.sono&&x.dados.sono.nota;
        if(c>=forte){if(v)vf.push(v);if(n)sf.push(n)}else if(!c){if(v)vd.push(v);if(n)sd.push(n)}});
      if(vf.length>=5&&vd.length>=5){var dv=media(vf)-media(vd);if(Math.abs(dv)>=2)out.push("Na noite depois de um treino forte, a sua variabilidade cardíaca fica em média "+Math.abs(Math.round(dv))+" ms "+(dv<0?"mais baixa":"mais alta")+" do que depois de um dia sem treino ("+Math.round(media(vf))+" × "+Math.round(media(vd))+" ms).")}
      if(sf.length>=5&&sd.length>=5){var dn=media(sf)-media(sd);if(Math.abs(dn)>=3)out.push("A nota do sono é "+Math.abs(Math.round(dn))+" pontos "+(dn>0?"maior":"menor")+" nas noites depois de treino forte.")}
      /* horário de dormir contra a nota do sono */
      var cedo=[],tarde=[];D.forEach(function(x){var s2=x.dados.sono;if(!s2||!s2.inicio||!s2.nota)return;var m=+s2.inicio.slice(0,2)*60+ +s2.inicio.slice(3,5);if(m<12*60)m+=1440;(m<=23*60?cedo:m>=23*60+45?tarde:[]).push(s2.nota)});
      if(cedo.length>=5&&tarde.length>=5){var dc=media(cedo)-media(tarde);if(Math.abs(dc)>=3)out.push("Quando você dorme até 23h, a nota do sono fica em "+Math.round(media(cedo))+"; depois de 23h45, cai para "+Math.round(media(tarde))+".")}
      /* estresse por dia da semana */
      var DS=["domingo","segunda","terça","quarta","quinta","sexta","sábado"],sem=[[],[],[],[],[],[],[]];
      D.forEach(function(x){if(typeof x.dados.estresse==="number")sem[new Date(x.data+"T12:00:00").getDay()].push(x.dados.estresse)});
      var ms=sem.map(function(l,i){return [i,l.length>=4?media(l):null]}).filter(function(x){return x[1]!=null}).sort(function(a,b){return b[1]-a[1]});
      if(ms.length>=5&&ms[0][1]-ms[ms.length-1][1]>=5)out.push("O dia da semana mais estressante é "+DS[ms[0][0]]+" (média "+Math.round(ms[0][1])+"); o mais tranquilo, "+DS[ms[ms.length-1][0]]+" ("+Math.round(ms[ms.length-1][1])+").");
      /* passos do dia contra o sono da noite seguinte */
      var xs=[],ys=[];D.forEach(function(x){var am=por[NUCLEO.somaDiasISO(x.data,1)];if(am&&am.sono&&am.sono.total&&x.dados.passos){xs.push(x.dados.passos);ys.push(am.sono.total/3600)}});
      var rc=NUCLEO.correlacao(xs,ys);if(rc!=null&&Math.abs(rc)>=.25)out.push("Nos dias em que você anda mais, você "+(rc>0?"dorme mais":"dorme menos")+" na noite seguinte (correlação "+fmtN(Math.round(rc*100)/100)+").");
      /* humor do diário contra sono, treino e estresse */
      var hs=D.filter(function(x){return typeof x.dados.humor==="number"});
      if(hs.length>=8){
        var bom=[],ruim=[];hs.forEach(function(x){var s3=x.dados.sono&&x.dados.sono.total/3600;if(s3>=7)bom.push(x.dados.humor);else if(s3&&s3<6)ruim.push(x.dados.humor)});
        if(bom.length>=3&&ruim.length>=3&&media(bom)-media(ruim)>=.4)out.push("Depois de noites com 7 h ou mais de sono, o seu humor fica em "+fmtN(Math.round(media(bom)*10)/10)+" de 5; com menos de 6 h, cai para "+fmtN(Math.round(media(ruim)*10)/10)+".");
        var tr=[],des=[];hs.forEach(function(x){(carga[x.data]?tr:des).push(x.dados.humor)});
        if(tr.length>=3&&des.length>=3&&Math.abs(media(tr)-media(des))>=.3)out.push("Nos dias com treino o seu humor médio é "+fmtN(Math.round(media(tr)*10)/10)+"; sem treino, "+fmtN(Math.round(media(des)*10)/10)+".");
        var ex=[],ey=[];hs.forEach(function(x){if(typeof x.dados.estresse==="number"){ex.push(x.dados.estresse);ey.push(x.dados.humor)}});
        var re=NUCLEO.correlacao(ex,ey);if(re!=null&&re<=-.3)out.push("Quanto mais estresse o relógio mede no dia, pior o humor que você anota (correlação "+fmtN(Math.round(re*100)/100)+").")}
      else if(isOwner())out.push("Anote o humor por mais "+(8-hs.length)+(8-hs.length===1?" dia":" dias")+" para o site cruzar com o sono e o treino.");
      return out}
    function saudeHoje(dias){
      var d=dias[dias.length-1];if(!d)return null;var x=d.dados,ont=dias[dias.length-2];
      var p=panel(d.data===hojeISO()?"Hoje":"Em "+dataBR(d.data),"Toque numa métrica para ver o gráfico."),g=h("div",{class:"kgasto saudekpi"});
      function kpi(k,rot,val,sub){var b=h("button",{type:"button",class:"skpi"+(SAUDE.met===k?" on":"")},h("span",{class:"kl",text:rot}),h("b",{class:"kv",text:val}),sub?h("span",{class:"sub",text:sub}):null);
        b.onclick=function(){SAUDE.met=k;desenhar();var t=corpo.querySelector(".saudetend");if(t)t.scrollIntoView({behavior:"smooth",block:"start"})};g.appendChild(b)}
      var s=x.sono,v=x.vfc,VS={BALANCED:"equilibrada",UNBALANCED:"desequilibrada",LOW:"baixa",POOR:"ruim"};
      if(s)kpi("sono","Sono",hmDur(s.total),(s.nota?"nota "+s.nota:"")+(s.inicio?" · "+s.inicio+"–"+s.fim:""));
      if(v)kpi("vfc","Variabilidade cardíaca (noite)",v.noite+" ms",(VS[v.status]||"")+(v.faixaMin?" (normal "+v.faixaMin+"–"+v.faixaMax+")":""));
      if(x.fcRepouso)kpi("fc","Batimentos em repouso",x.fcRepouso+" por minuto","mín. do dia "+(x.fcMin||"—")+" · máx "+(x.fcMax||"—"));
      if(x.bbMax!=null)kpi("bb","Energia do corpo",String(x.bbMax),"carregou "+(x.bbCarga||0)+" · gastou "+(x.bbGasto||0));
      if(x.estresse!=null)kpi("estresse","Estresse médio",String(x.estresse),x.estresseAlto!=null?Math.round(x.estresseAlto*100)+"% do dia alto":"");
      if(x.passos!=null)kpi("passos","Passos",x.passos.toLocaleString("pt-BR"),"meta "+(x.metaPassos||0).toLocaleString("pt-BR")+(x.distancia?" · "+fmtN(Math.round(x.distancia/100)/10)+" km":""));
      p.appendChild(g);
      var fit=(dias.slice().reverse().filter(function(q){return q.dados.idadeFitness})[0]||{}).dados;
      var extra=[x.minModerados!=null?"Minutos de intensidade hoje: "+((x.minModerados||0)+2*(x.minVigorosos||0))+" (meta semanal "+(x.metaMinutos||150)+")":"",
        x.calorias?"Calorias: "+x.calorias.toLocaleString("pt-BR")+" ("+(x.caloriasAtivas||0)+" ativas)":"",x.spo2?"Oxigênio no sangue (média da noite): "+x.spo2+"%":"",x.respiracao?"Respiração: "+x.respiracao+" respirações por minuto":"",
        fit?"Idade do condicionamento físico: "+fmtN(Math.round(fit.idadeFitness.fitness*10)/10)+" anos (real "+fit.idadeFitness.real+"; dá para chegar a "+fmtN(Math.round(fit.idadeFitness.possivel*10)/10)+")":""].filter(Boolean);
      if(extra.length)p.appendChild(h("ul",{class:"wl"},extra.map(function(t){return h("li",null,h("span",{class:"grow",text:t}))})));
      p.appendChild(saudeGlossario());
      return p}
    /* tendência: 30 dias = um por dia; 90 dias = média por semana; 1 ano = média por mês */
    function saudeTendencia(dias){
      var M=SAUDE_MET.filter(function(m){return m[0]===SAUDE.met})[0]||SAUDE_MET[0];
      var p=panel("Tendência: "+M[1]);p.classList.add("saudetend");
      var segM=h("div",{class:"seg famseg famper",role:"group","aria-label":"Métrica"});
      SAUDE_MET.forEach(function(m){var b=h("button",{type:"button",text:m[1],"aria-pressed":String(m[0]===M[0])});b.onclick=function(){SAUDE.met=m[0];desenhar()};segM.appendChild(b)});
      var segP=h("div",{class:"seg famseg famper",role:"group","aria-label":"Período"});
      [["30","30 dias"],["90","3 meses"],["365","1 ano"]].forEach(function(x){var b=h("button",{type:"button",text:x[1],"aria-pressed":String(x[0]===SAUDE.per)});b.onclick=function(){SAUDE.per=x[0];desenhar()};segP.appendChild(b)});
      p.appendChild(segM);p.appendChild(segP);
      var ini=maisDias(hojeISO(),-(+SAUDE.per)+1),pts=dias.filter(function(d){return d.data>=ini&&M[2](d.dados)!=null});
      if(pts.length<2){p.appendChild(h("p",{class:"empty",text:"Poucos dados nesse período."}));return p}
      var grupos=[];
      /* legenda de cada barra em duas linhas curtas (cabe em todas): dia + inicial da semana; semana: dia + mês; mês: mês + ano */
      var MESES3=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
      if(SAUDE.per==="30")pts.forEach(function(d){var dt=new Date(d.data+"T12:00:00");grupos.push({rot:d.data.slice(8),rot2:"DSTQQSS".charAt(dt.getDay()),det:dt.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}),vs:[M[2](d.dados)]})});
      else{var chave=SAUDE.per==="90"?function(s){var dt=new Date(s+"T12:00:00");dt.setDate(dt.getDate()-((dt.getDay()+6)%7));return dt.toISOString().slice(0,10)}:function(s){return s.slice(0,7)};
        var mapa={};pts.forEach(function(d){var k=chave(d.data);if(!mapa[k]){mapa[k]={k:k,vs:[]};grupos.push(mapa[k])}mapa[k].vs.push(M[2](d.dados))});
        grupos.forEach(function(g){g.rot=SAUDE.per==="90"?g.k.slice(8):MESES3[+g.k.slice(5,7)-1];g.rot2=SAUDE.per==="90"?MESES3[+g.k.slice(5,7)-1]:g.k.slice(2,4);
          g.det=(SAUDE.per==="90"?"semana de "+dataBR(g.k):g.rot+"/"+g.rot2)+" · média de "+g.vs.length+(g.vs.length===1?" dia":" dias")})}
      grupos.forEach(function(g){g.v=g.vs.reduce(function(s,x){return s+x},0)/g.vs.length});
      var vs=grupos.map(function(g){return g.v}),media=vs.reduce(function(s,x){return s+x},0)/vs.length,maxv=Math.max.apply(null,vs),minv=Math.min.apply(null,vs);
      var ult=grupos[grupos.length-1].v,dif=ult-media,bom=M[5]?dif>=0:dif<=0;
      p.appendChild(h("div",{class:"kgasto"},h("div",null,h("span",{class:"kl",text:"Média do período"}),h("b",{class:"kv",text:M[3](media)})),
        h("div",null,h("span",{class:"kl",text:"Melhor"}),h("b",{class:"kv",text:M[3](M[5]?maxv:minv)})),
        h("div",null,h("span",{class:"kl",text:"Pior"}),h("b",{class:"kv",text:M[3](M[5]?minv:maxv)})),
        h("div",null,h("span",{class:"kl",text:"Último vs. média"}),h("b",{class:"kv "+(Math.abs(dif)<media*0.03?"":bom?"bom":"ruim"),text:(dif>0?"+":"−")+M[3](Math.abs(dif))}))));
      var n=grupos.length,cap=h("p",{class:"vbcap",role:"status"}),barras=[];
      /* as colunas começam perto do menor valor, senão ficariam todas iguais (VFC, FC) */
      var base=M[0]==="passos"||M[0]==="sono"?0:Math.max(0,Math.floor(minv*0.85));
      function marcar(i){barras.forEach(function(b,j){b.classList.toggle("on",j===i)});cap.textContent=grupos[i].det+" · "+M[3](grupos[i].v)}
      var vb=h("div",{class:"vbars vbpeso"},grupos.map(function(g,i){
        var b=h("button",{type:"button",class:"vb","aria-label":g.det+" "+M[3](g.v),title:g.det+" · "+M[3](g.v)},
          h("span",{class:"vbv"+(n<=14||i===n-1||g.v===maxv||g.v===minv?"":" opc"),text:M[0]==="sono"?hmDur(g.v*3600).replace(/^(\d+)h(\d+)$/,"$1:$2"):M[0]==="passos"?(g.v>=1000?fmtN(Math.round(g.v/100)/10)+"k":Math.round(g.v)):String(Math.round(g.v))}),
          h("span",{class:"vbt"},h("span",{class:"vbf",style:"background:"+M[4]+";height:"+Math.max(2,(g.v-base)/((maxv-base)||1)*100).toFixed(1)+"%"})),
          h("span",{class:"vbl"},h("b",{text:g.rot}),h("small",{text:g.rot2||""})));
        b.onclick=function(){marcar(i)};b.onmouseenter=function(){marcar(i)};barras.push(b);return b}));
      p.appendChild(vb);p.appendChild(cap);marcar(n-1);
      /* no celular o gráfico rola para o lado: começa mostrando os dias mais recentes */
      setTimeout(function(){vb.scrollLeft=vb.scrollWidth},0);
      return p}
    /* sono das últimas 14 noites: fases empilhadas */
    function saudeSono(dias){
      var l=dias.filter(function(d){return d.dados.sono&&d.dados.sono.total}).slice(-14);if(!l.length)return null;
      var p=panel("Sono das últimas noites","Profundo, REM, leve e acordado, em horas."),mx=Math.max.apply(null,l.map(function(d){var s=d.dados.sono;return s.total+(s.acordado||0)}));
      var F=[["profundo","Profundo","#3B3B98"],["rem","REM","#7C6FE0"],["leve","Leve","#9DB4E8"],["acordado","Acordado","#E8A317"]];
      p.appendChild(h("div",{class:"sonoleg"},F.map(function(f){return h("span",null,h("i",{style:"background:"+f[2]}),f[1])})));
      p.appendChild(h("div",{class:"sonol"},l.map(function(d){var s=d.dados.sono,tot=s.total+(s.acordado||0);
        return h("div",{class:"sonorow",title:dataBR(d.data)+" · "+hmDur(s.total)+(s.nota?" · nota "+s.nota:"")},
          h("span",{class:"sonod",text:d.data.slice(8)+"/"+d.data.slice(5,7)}),
          h("span",{class:"sonobar",style:"width:"+(tot/mx*100).toFixed(1)+"%"},F.map(function(f){return s[f[0]]?h("i",{style:"background:"+f[2]+";flex:"+s[f[0]],title:f[1]+": "+hmDur(s[f[0]])}):null})),
          h("span",{class:"sonot",text:hmDur(s.total)+(s.nota?" · "+s.nota:"")}))})));
      return p}
    function saudeTreinos(ativs){
      ativs=ativs.filter(function(a){return TREINO_OCULTOS.indexOf(a.tipo)<0});
      if(!ativs.length)return null;
      var p=panel("Treinos",ativs.length+" atividades desde "+dataBR(ativs[ativs.length-1].inicio.slice(0,10)));
      /* resumo do mês e do ano por esporte */
      var mes=hojeISO().slice(0,7),ano=hojeISO().slice(0,4),tot={};
      ativs.forEach(function(a){var t=ativTipo(a.tipo)[0],o=tot[t]=tot[t]||{n:0,km:0,seg:0,nm:0,kmm:0,ico:ativTipo(a.tipo)[1]};
        if(a.inicio.slice(0,4)===ano){o.n++;o.km+=(a.dados.distancia||0)/1000;o.seg+=a.dados.duracao||0}
        if(a.inicio.slice(0,7)===mes){o.nm++;o.kmm+=(a.dados.distancia||0)/1000}});
      var tb=h("table",{class:"famtab"});
      tb.appendChild(h("thead",null,h("tr",null,["Esporte","Este mês","Em "+ano,"Tempo no ano"].map(function(c){return h("th",{text:c})}))));
      tb.appendChild(h("tbody",null,Object.keys(tot).filter(function(t){return tot[t].n}).sort(function(a,b){return tot[b].n-tot[a].n}).map(function(t){var o=tot[t],km=function(v){return v>=1?fmtN(Math.round(v*10)/10)+" km":""};
        return h("tr",null,h("td",null,h("b",{text:o.ico+" "+t})),h("td",{text:o.nm?o.nm+"× "+(km(o.kmm)?"· "+km(o.kmm):""):"—"}),h("td",{text:o.n+"× "+(km(o.km)?"· "+km(o.km):"")}),h("td",{text:durTxt(o.seg)}))})));
      p.appendChild(h("div",{class:"famtabw"},tb));
      /* filtro por esporte e lista */
      var usados=[];ativs.forEach(function(a){if(usados.indexOf(a.tipo)<0)usados.push(a.tipo)});
      var seg=h("div",{class:"seg famseg",role:"group","aria-label":"Esporte"});
      [""].concat(usados).forEach(function(t){var b=h("button",{type:"button",text:t?ativTipo(t)[1]+" "+ativTipo(t)[0]:"Todos","aria-pressed":String(SAUDE.tipo===t)});b.onclick=function(){SAUDE.tipo=t;SAUDE.mais=30;desenhar()};seg.appendChild(b)});
      p.appendChild(seg);
      var l=ativs.filter(function(a){return !SAUDE.tipo||a.tipo===SAUDE.tipo}),ul=h("ul",{class:"wl saudeativ"});
      l.slice(0,SAUDE.mais).forEach(function(a){var d=a.dados,T=ativTipo(a.tipo);
        var linha2=[distTxt(a),d.duracao?durTxt(d.duracao):"",ritmo(a),d.fc?"batimentos "+Math.round(d.fc)+(d.fcMax?" (máx. "+Math.round(d.fcMax)+")":""):"",d.calorias?Math.round(d.calorias)+" kcal":"",d.series?d.series+" séries":""].filter(Boolean).join(" · ");
        var li=h("li",{class:"clic",tabindex:"0",role:"button",title:"Ver o treino completo"},h("span",{class:"grow"},h("b",{text:T[1]+" "+(d.nome||T[0])+(d.recorde?" 🏅":"")}),h("span",{class:"sub",text:new Date(a.inicio).toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",year:"2-digit"})+", "+a.inicio.slice(11,16)+(d.local&&(d.nome||"").indexOf(d.local)<0?" · "+d.local:"")}),
          h("span",{class:"sub",text:linha2})),d.efeitoAerobico?h("span",{class:"end",title:"Efeito aeróbico do treino (0 a 5): quanto melhorou o condicionamento",text:fmtN(d.efeitoAerobico)}):null);
        if(d.zonas){var tz=d.zonas.reduce(function(s,x){return s+x},0);if(tz)li.querySelector(".grow").appendChild(h("span",{class:"zonas",title:"Tempo em cada faixa de batimentos (1 leve a 5 máxima)"},d.zonas.map(function(z,i){return z?h("i",{class:"z"+(i+1),style:"flex:"+z}):null})))}
        li.onclick=function(){location.hash="#saude/treino/"+a.id};li.onkeydown=function(e){if(e.key==="Enter")li.onclick()};
        ul.appendChild(li)});
      p.appendChild(ul);
      if(l.length>SAUDE.mais){var mais=h("button",{type:"button",class:"ghostbtn",text:"Ver mais ("+(l.length-SAUDE.mais)+")"});mais.onclick=function(){SAUDE.mais+=50;desenhar()};p.appendChild(mais)}
      return p}
  }

  /* ===== Um treino aberto (#saude/treino/<id>): mapa, números, gráficos, zonas, voltas e séries =====
     O detalhe vem da função "garmin" ({tipo:"detalhe"}) e fica guardado enquanto a página estiver aberta. */
  var TREINO_DET={},LEAFLET_JS="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",LEAFLET_CSS="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
  function carregarLeaflet(){
    if(window.L)return Promise.resolve();
    if(!document.querySelector('link[href="'+LEAFLET_CSS+'"]'))document.head.appendChild(h("link",{rel:"stylesheet",href:LEAFLET_CSS}));
    return new Promise(function(ok,erro){var s=document.createElement("script");s.src=LEAFLET_JS;s.onload=ok;s.onerror=function(){erro(new Error("mapa indisponível"))};document.head.appendChild(s)})}
  function hms(seg){if(seg==null)return "—";seg=Math.round(seg);var h2=Math.floor(seg/3600),m=Math.floor(seg%3600/60),s=seg%60;return (h2?h2+":"+String(m).padStart(2,"0"):m)+":"+String(s).padStart(2,"0")}
  function ritmoDe(v,tipo){if(!v)return "—";if(/swimming/.test(tipo)){var s2=100/v;return hms(s2)+" /100 m"}if(/running|walking|hiking/.test(tipo))return hms(1000/v)+" /km";return fmtN(Math.round(v*36)/10)+" km/h"}
  /* cor da rota pela velocidade: azul (mais lento) → verde → amarelo → vermelho (mais rápido), como no Connect */
  function corVel(f){var c=[[33,102,204],[40,170,90],[240,200,40],[230,60,40]],x=Math.max(0,Math.min(.999,f))*(c.length-1),i=Math.floor(x),t=x-i,a=c[i],b=c[i+1];
    return "rgb("+a.map(function(v,k){return Math.round(v+(b[k]-v)*t)}).join(",")+")"}
  /* gráfico de linha com área, em SVG; tocar/passar o mouse mostra o valor */
  function grafTreino(serie,campo,rot,cor,fmt,inverter){
    var pts=serie.filter(function(p){return p[campo]!=null&&(campo!=="vel"||p.vel>0.05)});if(pts.length<5)return null;
    var W=640,H=150,vs=pts.map(function(p){return p[campo]}),mn=Math.min.apply(null,vs),mx=Math.max.apply(null,vs),tm=pts[pts.length-1].t||1;
    if(mx===mn)mx=mn+1;var pad=(mx-mn)*.08;mn-=pad;mx+=pad;
    function X(t){return (t/tm*W).toFixed(1)}function Y(v){var f=(v-mn)/(mx-mn);return (inverter?f*H:H-f*H).toFixed(1)}
    var linha=pts.map(function(p,i){return (i?"L":"M")+X(p.t)+" "+Y(p[campo])}).join(" ");
    var media=vs.reduce(function(s,x){return s+x},0)/vs.length;
    var svg='<svg viewBox="0 0 '+W+' '+(H+18)+'" preserveAspectRatio="none" class="tgraf"><path d="'+linha+" L"+X(tm)+" "+(inverter?0:H)+" L0 "+(inverter?0:H)+' Z" fill="'+cor+'" opacity=".18"/><path d="'+linha+'" fill="none" stroke="'+cor+'" stroke-width="2" vector-effect="non-scaling-stroke"/>'+
      '<line x1="0" x2="'+W+'" y1="'+Y(media)+'" y2="'+Y(media)+'" stroke="'+cor+'" stroke-dasharray="4 4" opacity=".6" vector-effect="non-scaling-stroke"/>'+
      [0,.25,.5,.75,1].map(function(f){return '<text x="'+(f*W).toFixed(0)+'" y="'+(H+14)+'" text-anchor="'+(f===0?"start":f===1?"end":"middle")+'" class="tgt">'+hms(f*tm)+'</text>'}).join("")+
      '<line class="tcur" x1="0" x2="0" y1="0" y2="'+H+'" stroke="var(--ink)" opacity="0" vector-effect="non-scaling-stroke"/></svg>';
    var box=h("div",{class:"tgbox"}),cap=h("p",{class:"vbcap",role:"status"});
    box.innerHTML=svg;var el=box.firstChild,cur=el.querySelector(".tcur");
    function mostrar(ev){var r=el.getBoundingClientRect(),x=((ev.touches?ev.touches[0].clientX:ev.clientX)-r.left)/r.width*tm,best=pts[0];
      pts.forEach(function(p){if(Math.abs(p.t-x)<Math.abs(best.t-x))best=p});cur.setAttribute("x1",X(best.t));cur.setAttribute("x2",X(best.t));cur.setAttribute("opacity",".5");
      cap.textContent=hms(best.t)+" · "+fmt(best[campo])+(best.dist?" · "+fmtN(Math.round(best.dist/10)/100)+" km":"")}
    el.addEventListener("mousemove",mostrar);el.addEventListener("touchmove",mostrar,{passive:true});el.addEventListener("click",mostrar);
    cap.textContent="Média "+fmt(media)+" · mín "+fmt(inverter?mx-pad:mn+pad)+" · máx "+fmt(inverter?mn+pad:mx-pad);
    /* ritmo/velocidade: paradas puxam o mínimo para valores sem sentido, então mostra só média e o mais rápido */
    if(campo==="vel")cap.textContent="Média "+fmt(media)+" · mais rápido "+fmt(Math.max.apply(null,vs));
    return h("div",{class:"tgwrap"},h("h3",{class:"tgh",text:rot}),box,cap)}
  /* rota no mapa: Google Maps quando há chave (guardada na conta, em PESSOAL.googleMaps); senão OpenStreetMap */
  function rotaCores(rota){var vels=rota.map(function(p){return p[2]||0}).filter(function(v){return v>0}).sort(function(a2,b2){return a2-b2});
    var lo=vels[Math.floor(vels.length*.05)]||0,hi=vels[Math.floor(vels.length*.95)]||1;
    /* trechos seguidos com a mesma cor viram uma linha só */
    var tr=[],cor=null;for(var i=1;i<rota.length;i++){var c=corVel(Math.round(((rota[i][2]||0)-lo)/((hi-lo)||1)*12)/12);
      if(c!==cor){tr.push({cor:c,pts:[rota[i-1]]});cor=c}tr[tr.length-1].pts.push(rota[i])}return tr}
  function carregarGoogle(chave){
    if(window.google&&window.google.maps)return Promise.resolve();
    return new Promise(function(ok,erro){window.__gmOk=ok;setTimeout(function(){erro(new Error("o Google Maps não respondeu"))},10000);
      var s=document.createElement("script");s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(chave)+"&v=weekly&language=pt-BR&region=BR&callback=__gmOk";s.async=true;
      s.onerror=function(){erro(new Error("Google Maps indisponível"))};document.head.appendChild(s)})}
  function mapaRota(div,rota){
    var chave=PESSOAL.googleMaps,tr=rotaCores(rota),ini=rota[0],fim=rota[rota.length-1];
    function osm(){return carregarLeaflet().then(function(){
      var L=window.L,m=L.map(div,{scrollWheelZoom:false});
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(m);
      tr.forEach(function(t){L.polyline(t.pts.map(function(p){return [p[0],p[1]]}),{color:t.cor,weight:5,opacity:.95}).addTo(m)});
      L.circleMarker([ini[0],ini[1]],{radius:7,color:"#fff",weight:2,fillColor:"#2e9e44",fillOpacity:1}).addTo(m).bindTooltip("Início");
      L.circleMarker([fim[0],fim[1]],{radius:7,color:"#fff",weight:2,fillColor:"#d6283b",fillOpacity:1}).addTo(m).bindTooltip("Fim");
      m.fitBounds(L.latLngBounds(rota.map(function(p){return [p[0],p[1]]})),{padding:[18,18]});setTimeout(function(){m.invalidateSize()},200)})}
    if(!chave)return osm().catch(function(){div.replaceWith(h("p",{class:"sub",text:"Não consegui carregar o mapa agora."}))});
    var caiu=false;
    function cair(motivo){if(caiu)return;caiu=true;div.innerHTML="";div.className="tmapa";var av=h("p",{class:"qrwarn",text:"⚠ O Google Maps não aceitou a chave ("+motivo+"). Mostrando o OpenStreetMap."});div.parentNode.insertBefore(av,div);return osm()}
    /* a chave recusada só é avisada depois que o mapa abre: aí troca para o OpenStreetMap */
    window.gm_authFailure=function(){cair("chave recusada ou sem a Maps JavaScript API ativada")};
    return carregarGoogle(chave).then(function(){if(caiu)return;
      var g=window.google.maps,m=new g.Map(div,{mapTypeId:"roadmap",mapTypeControl:true,streetViewControl:false,fullscreenControl:true,gestureHandling:"cooperative"}),b=new g.LatLngBounds();
      tr.forEach(function(t){var path=t.pts.map(function(p){var ll={lat:p[0],lng:p[1]};b.extend(ll);return ll});new g.Polyline({path:path,strokeColor:t.cor,strokeWeight:5,strokeOpacity:.95,map:m})});
      [[ini,"#2e9e44","Início"],[fim,"#d6283b","Fim"]].forEach(function(q){new g.Marker({position:{lat:q[0][0],lng:q[0][1]},map:m,title:q[2],icon:{path:g.SymbolPath.CIRCLE,scale:7,fillColor:q[1],fillOpacity:1,strokeColor:"#fff",strokeWeight:2}})});
      m.fitBounds(b,20);
      /* se em 8 segundos o Google não desenhou nada (chave inválida, API desligada), volta para o OpenStreetMap */
      setTimeout(function(){if(!div.querySelector(".gm-style"))cair("o mapa não abriu com essa chave")},8000)
    }).catch(function(e){return cair(e.message)})}
  /* onde colar (ou trocar) a chave do Google Maps */
  function mapaConfig(redesenhar){
    var tem=!!PESSOAL.googleMaps,abrir=h("button",{type:"button",class:"ghostbtn",text:tem?"Trocar a chave do Google Maps":"Usar o Google Maps"}),f=h("div",{class:"vfil",hidden:""});
    var inp=h("input",{type:"password",placeholder:"Chave da API do Google Maps (AIza…)",autocomplete:"off","aria-label":"Chave do Google Maps"}),ok=h("button",{type:"button",text:"Salvar"}),tira=tem?h("button",{type:"button",class:"ghostbtn",text:"Voltar ao OpenStreetMap"}):null,msg=h("p",{class:"sub",role:"status"});
    abrir.onclick=function(){f.hidden=!f.hidden;if(!f.hidden)inp.focus()};
    ok.onclick=function(){var v=inp.value.trim();if(!/^AIza[\w-]{30,}$/.test(v)){msg.textContent="A chave do Google Maps começa com AIza e tem uns 39 caracteres.";return}
      ok.disabled=true;msg.textContent="Guardando…";pessoalGravar("googleMaps",v,function(e){msg.textContent=e||"✓ Chave guardada na sua conta.";setTimeout(function(){location.reload()},600)});inp.value="";f.hidden=true};
    if(tira)tira.onclick=function(){pessoalGravar("googleMaps","",function(){location.reload()})};
    f.appendChild(inp);f.appendChild(ok);if(tira)f.appendChild(tira);
    return h("div",{class:"mapcfg"},abrir,f,msg)}
  function saudeTreino(root,id){
    var a=(SAUDE.ativs||[]).filter(function(x){return String(x.id)===String(id)})[0];
    var volta=h("a",{href:"#saude",class:"ghostbtn",text:"← Treinos"});
    if(!a){root.appendChild(h("div",{class:"panel"},volta,h("p",{class:"empty",text:"Treino não encontrado."})));return}
    var T=ativTipo(a.tipo),d=a.dados;
    var topo=panel(T[1]+" "+(d.nome||T[0]),new Date(a.inicio).toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})+" às "+a.inicio.slice(11,16)+(d.local?" · "+d.local:""));
    topo.insertBefore(h("div",{class:"vfil"},volta),topo.firstChild);root.appendChild(topo);
    var st=h("p",{class:"sub",role:"status",text:"Carregando o treino…"});topo.appendChild(st);
    var corpo=h("div",{class:"stack"});root.appendChild(corpo);
    (TREINO_DET[id]?Promise.resolve(TREINO_DET[id]):SB.functions.invoke("garmin",{body:{tipo:"detalhe",id:+id}}).then(function(r){
      if(r.error)throw new Error(r.error.message);if(r.data&&r.data.erro)throw new Error(r.data.erro);TREINO_DET[id]=r.data;return r.data}))
    .then(function(x){st.remove();desenharTreino(x)}).catch(function(e){logErro("treino",e,{id:id});st.textContent="Não consegui carregar os detalhes ("+e.message+"). Os números abaixo vêm do resumo.";desenharTreino({resumo:{},serie:[],rota:[],voltas:[],series:[]})});
    function desenharTreino(x){
      var r=x.resumo||{},tipo=a.tipo,nado=/swimming/.test(tipo);
      /* mapa da rota */
      if((x.rota||[]).length>1){
        var mp=panel("Percurso"),div=h("div",{class:"tmapa"}),leg=h("div",{class:"tleg"},h("span",{text:"Mais lento"}),h("i"),h("span",{text:"Mais rápido"}));
        mp.appendChild(div);mp.appendChild(leg);corpo.appendChild(mp);
        mapaRota(div,x.rota);
        mp.appendChild(mapaConfig(function(){div.innerHTML="";mapaRota(div,x.rota)}))}
      /* números */
      var dist=r.distance||d.distancia,mov=r.movingDuration||d.emMovimento,dur=r.duration||d.duracao,velMov=r.averageMovingSpeed||(dist&&mov?dist/mov:d.velocidade);
      var itens=[
        dist?["Distância",nado?fmtN(Math.round(dist))+" m":fmtN(Math.round(dist/10)/100)+" km"]:null,
        ["Tempo total",hms(r.elapsedDuration||dur)],mov&&Math.abs(mov-(r.elapsedDuration||dur))>30?["Em movimento",hms(mov)]:null,
        dist&&velMov?[nado||/running|walking/.test(tipo)?"Ritmo médio":"Velocidade média",ritmoDe(velMov,tipo)]:null,
        r.maxSpeed&&dist?[nado||/running|walking/.test(tipo)?"Melhor ritmo":"Velocidade máxima",ritmoDe(r.maxSpeed,tipo)]:null,
        (r.averageHR||d.fc)?["Batimentos (média)",Math.round(r.averageHR||d.fc)+" por minuto"]:null,(r.maxHR||d.fcMax)?["Batimentos (máximo)",Math.round(r.maxHR||d.fcMax)+" por minuto"]:null,
        (r.calories||d.calorias)?["Calorias",Math.round(r.calories||d.calorias)+(r.bmrCalories?" ("+Math.round(r.calories-r.bmrCalories)+" ativas)":"")]:null,
        r.elevationGain?["Subida / descida",Math.round(r.elevationGain)+" / "+Math.round(r.elevationLoss||0)+" m"]:null,
        r.minElevation!=null&&r.maxElevation!=null&&dist?["Altitude",Math.round(r.minElevation)+"–"+Math.round(r.maxElevation)+" m"]:null,
        (r.averageRunCadence||d.cadencia)?["Passos por minuto (média)",Math.round(r.averageRunCadence||d.cadencia)+""+(r.maxRunCadence?" (máx "+Math.round(r.maxRunCadence)+")":"")]:null,
        (r.strideLength||d.passada)?["Tamanho da passada",fmtN(Math.round(r.strideLength||d.passada))+" cm"]:null,
        (r.steps||d.passos)?["Passos",Math.round(r.steps||d.passos).toLocaleString("pt-BR")]:null,
        r.averageTemperature!=null?["Temperatura",Math.round(r.minTemperature)+"–"+Math.round(r.maxTemperature)+" °C"]:null,
        (r.trainingEffect||d.efeitoAerobico)!=null?["Efeito aeróbico",fmtN(r.trainingEffect||d.efeitoAerobico)]:null,
        (r.anaerobicTrainingEffect!=null||d.efeitoAnaerobico!=null)?["Efeito anaeróbico",fmtN(r.anaerobicTrainingEffect!=null?r.anaerobicTrainingEffect:d.efeitoAnaerobico)]:null,
        (r.activityTrainingLoad||d.carga)?["Carga de exercício",Math.round(r.activityTrainingLoad||d.carga)]:null,
        (d.minModerados||d.minVigorosos)?["Minutos de intensidade",(d.minModerados||0)+" moderados · "+(d.minVigorosos||0)+" vigorosos"]:null,
        r.waterEstimated?["Suor estimado",Math.round(r.waterEstimated)+" ml"]:null,
        x.piscinas?["Piscinas",x.piscinas+(d.piscina?" de "+fmtN(d.piscina/100)+" m":"")]:null,d.swolf?["Eficiência do nado (braçadas + segundos por piscina; menor é melhor)",d.swolf]:null,
        (x.series||[]).length?["Séries",x.series.length+" · "+x.series.reduce(function(s,q){return s+(q.reps||0)},0)+" repetições"]:null].filter(Boolean);
      var EF={RECOVERY:"Recuperação",AEROBIC_BASE:"Base aeróbica",TEMPO:"Ritmo (tempo)",LACTATE_THRESHOLD:"Limiar de lactato",VO2MAX:"Capacidade aeróbica máxima",ANAEROBIC_CAPACITY:"Capacidade anaeróbica",SPEED:"Velocidade"};
      var np=panel("Estatísticas",d.efeito?"Principal benefício: "+(EF[d.efeito]||d.efeito.toLowerCase().replace(/_/g," ")):null);
      np.appendChild(h("div",{class:"kgasto"},itens.map(function(it){return h("div",null,h("span",{class:"kl",text:it[0]}),h("b",{class:"kv",text:String(it[1])}))})));
      corpo.appendChild(np);
      /* gráficos */
      var s=x.serie||[],gp=panel("Gráficos","Toque no gráfico para ver o valor naquele momento. A linha tracejada é a média."),gs=[
        grafTreino(s,"fc","Batimentos por minuto","#D6283B",function(v){return Math.round(v)+" por minuto"}),
        dist?grafTreino(s,"vel",nado||/running|walking/.test(tipo)?"Ritmo":"Velocidade","#2E8BD8",function(v){return ritmoDe(v,tipo)}):null,
        grafTreino(s,"alt","Altitude","#0E8A6A",function(v){return Math.round(v)+" m"}),
        /running|walking/.test(tipo)?grafTreino(s,"cad","Passos por minuto","#7C6FE0",function(v){return Math.round(v*2)+" por minuto"}):null,
        grafTreino(s,"temp","Temperatura","#E8A317",function(v){return Math.round(v)+" °C"})].filter(Boolean);
      if(gs.length){gs.forEach(function(g){gp.appendChild(g)});corpo.appendChild(gp)}
      /* zonas de FC */
      if(d.zonas&&d.zonas.some(Boolean)){var tz=d.zonas.reduce(function(a2,b2){return a2+b2},0),zp=panel("Faixas de batimentos","Quanto tempo o coração ficou em cada faixa de esforço."),NZ=["Aquecimento","Fácil","Aeróbica","Limiar","Máxima"];
        zp.appendChild(h("div",{class:"tzonas"},d.zonas.map(function(z,i){return h("div",{class:"tzrow"},h("span",{text:"Zona "+(i+1)+" · "+NZ[i]}),h("span",{class:"tzbar"},h("i",{class:"z"+(i+1),style:"width:"+(z/tz*100).toFixed(1)+"%"})),h("b",{text:hms(z)+" · "+Math.round(z/tz*100)+"%"}))})));
        corpo.appendChild(zp)}
      /* voltas */
      if((x.voltas||[]).length>1){var vp=panel("Voltas",x.voltas.length+" voltas"),tb=h("table",{class:"famtab"});
        tb.appendChild(h("thead",null,h("tr",null,["Volta","Distância","Tempo",nado||/running|walking/.test(tipo)?"Ritmo":"Velocidade","Batimentos (média)","Batimentos (máx.)","Calorias"].map(function(c){return h("th",{text:c})}))));
        tb.appendChild(h("tbody",null,x.voltas.map(function(v,i){return h("tr",null,h("td",{text:String(i+1)}),h("td",{text:v.dist?(nado?fmtN(v.dist)+" m":fmtN(Math.round(v.dist/10)/100)+" km"):"—"}),h("td",{text:hms(v.tempo)}),
          h("td",{text:v.dist&&v.tempo?ritmoDe(v.dist/v.tempo,tipo):"—"}),h("td",{text:v.fc?String(v.fc):"—"}),h("td",{text:v.fcMax?String(v.fcMax):"—"}),h("td",{text:v.cal!=null?String(v.cal):"—"}))})));
        vp.appendChild(h("div",{class:"famtabw"},tb));corpo.appendChild(vp)}
      /* séries da musculação */
      if((x.series||[]).length){var sp=panel("Séries",x.series.length+" séries"),tb2=h("table",{class:"famtab"});
        tb2.appendChild(h("thead",null,h("tr",null,["#","Exercício","Repetições","Peso","Tempo"].map(function(c){return h("th",{text:c})}))));
        tb2.appendChild(h("tbody",null,x.series.map(function(q,i){return h("tr",null,h("td",{text:String(i+1)}),h("td",{text:!q.exercicio||q.exercicio==="Exercício"?"Musculação":q.exercicio}),h("td",{text:q.reps!=null?String(q.reps):"—"}),h("td",{text:q.peso?fmtN(q.peso)+" kg":"—"}),h("td",{text:hms(q.tempo)}))})));
        sp.appendChild(h("div",{class:"famtabw"},tb2));
        sp.appendChild(h("p",{class:"sub",text:"O nome do exercício aparece quando ele é escolhido no relógio durante o treino; senão fica “Musculação”."}));corpo.appendChild(sp)}
    }
  }
