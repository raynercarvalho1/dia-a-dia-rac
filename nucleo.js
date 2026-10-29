/* Núcleo do Dia a Dia RAC: funções puras (sem tela nem banco), usadas pelo site e pelos testes automáticos (tests/).
   Carregado antes do script principal; expõe window.RACnucleo. */
(function (raiz) {
  function norm(t){return String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
  /* link digitado sem "https://" (ex.: site.com/pagina) abriria como página do próprio site e daria 404 */
  function urlAbs(u){u=String(u||"").trim();return !u||/^([a-z][a-z0-9+.-]*:|#|\/|\.)/i.test(u)?u:"https://"+u}

  /* Abastecimento pela foto: lê a resposta do Claude (JSON ou texto) e devolve veículo, data, km, litros, preço e total */
  function lerAbast(txt){
    var t=String(txt||"").replace(/[“”„]/g,'"').replace(/[‘’]/g,"'"),j=null,a=t.indexOf("{"),b=t.lastIndexOf("}");
    if(a>=0&&b>a){var x=t.slice(a,b+1);try{j=JSON.parse(x)}catch(e){try{j=JSON.parse(x.replace(/,\s*([}\]])/g,"$1").replace(/:\s*(-?\d+),(\d+)(?=\s*[,}])/g,":$1.$2"))}catch(e2){}}}
    j=j||{};
    /* sem JSON (ou faltando campos): procura no texto */
    function campo(k,re){if(j[k]==null){var m=re.exec(t);if(m)j[k]=m[1]}}
    campo("veiculo",/"?ve[ií]culo"?\s*[:=]\s*"?(carro|moto)/i);campo("km",/"?km"?\s*[:=]\s*"?([\d.]+)/i);campo("litros",/"?litros"?\s*[:=]\s*"?([\d.,]+)/i);
    campo("preco_litro",/"?pre[cç]o[_ ]?(?:por[_ ])?litro"?\s*[:=]\s*"?(?:R\$\s*)?([\d.,]+)/i);campo("total",/"?total"?\s*[:=]\s*"?(?:R\$\s*)?([\d.,]+)/i);campo("data",/(\d{4}-\d{2}-\d{2})/);
    function n(v){if(typeof v==="number")return v;v=String(v==null?"":v).replace(/[^\d,.-]/g,"");if(!v)return null;if(/,/.test(v))v=v.replace(/\./g,"").replace(",",".");var x=parseFloat(v);return isFinite(x)?x:null}
    var ve=String(j.veiculo||"");
    var r={veiculo:/moto/i.test(ve)?"moto":/c3/i.test(ve)?"c3":/carro|civic/i.test(ve)?"civic":"",
      data:/^\d{4}-\d{2}-\d{2}$/.test(j.data||"")?j.data:"",km:j.km==null?null:parseInt(String(j.km).replace(/\D/g,""),10)||null,
      litros:n(j.litros),preco:n(j.preco_litro!=null?j.preco_litro:j.precoLitro),total:n(j.total),combustivel:String(j.combustivel||(/gasolina|etanol|[aá]lcool|diesel/i.exec(t)||[""])[0]).toLowerCase().replace(/[aá]lcool/,"etanol"),posto:String(j.posto||"").trim()};
    if(r.total==null&&r.litros&&r.preco)r.total=Math.round(r.litros*r.preco*100)/100;
    if(r.preco==null&&r.litros&&r.total)r.preco=Math.round(r.total/r.litros*1000)/1000;
    return r}
  /* só a quilometragem do painel, sem abastecimento: vira um registro "Quilometragem" com a data */
  function veicKmForm(quem,regs,pronto,fechar){
    var p=panel("Atualizar a quilometragem","Olhe o total do painel (não o Trip)."),ult=veicKm(regs);
    var km=h("input",{type:"text",inputmode:"numeric",placeholder:ult?"Última: "+fmtKm(ult.km):"Ex.: 104308"}),data=h("input",{type:"date",value:hojeISO()});
    var st=h("p",{class:"sub",role:"status"}),ok=h("button",{type:"button",text:"Salvar"}),canc=h("button",{type:"button",class:"ghostbtn",text:"Cancelar"});
    canc.onclick=fechar;
    ok.onclick=function(){var K=parseInt(km.value.replace(/\D/g,""),10);
      if(!(K>0)){st.textContent="Escreva a quilometragem, como 104308.";km.focus();return}
      if(ult&&K<ult.km&&!ok.dataset.conf){ok.dataset.conf="1";st.textContent="⚠ É menor que a última anotada ("+fmtKm(ult.km)+"). Toque em Salvar de novo se estiver certo.";return}
      ok.disabled=true;st.textContent="Salvando…";
      SB.from("registros").insert({quem:quem,tipo:"outro",data:data.value||hojeISO(),titulo:"Quilometragem",valor:null,detalhes:null,dados:{km:K}}).then(sbOk).then(pronto)
        .catch(function(e){ok.disabled=false;st.textContent="Não consegui salvar: "+e.message})};
    p.appendChild(h("div",{class:"wform"},h("div",{class:"two"},h("label",null,"Quilometragem total",km),h("label",null,"Data",data)),h("div",{class:"vfil"},ok,canc),st));
    setTimeout(function(){km.focus()},50);return p}
  var TEMAS=[
    ["python","Python",/\bpython\b|\bpandas\b|jupyter|numpy/i,"python"],
    ["sql","SQL e bancos de dados",/\bsql\b|banco[s]? de dados|postgres|mysql|bigquery|snowflake|oracle db/i,"sql"],
    ["bi","BI e visualização de dados",/power ?bi|\bdax\b|tableau|looker|data ?vi[sz]|visualiza[cç][aã]o de dados|dashboards?|business intelligence|\bbi\b/i,"bi"],
    ["estat","Estatística",/estat[ií]stic|probabilidade|regress[aã]o|teste[s]? de hip[oó]tese|infer[eê]ncia|distribui[cç][aã]o normal/i],
    ["ml","Machine learning e ciência de dados",/machine learning|aprendizado de m[aá]quina|modelos? preditivos?|deep learning|redes neurais|ci[eê]ncia de dados|cientista de dados|data scien/i],
    ["ia","Inteligência artificial",/intelig[eê]ncia artificial|\bia\b|\bai\b|ia generativa|\bllms?\b|chatgpt|gemini|claude|copilot|agentes? de ia/i],
    ["eng","Engenharia de dados",/engenh\w* de dados|data engineer|pipelines? de dados|\betl\b|\belt\b|spark|databricks|airflow|data lake|lakehouse|\bdbt\b/i],
    ["cloud","Nuvem",/\baws\b|azure|google cloud|\bgcp\b|computa[cç][aã]o em nuvem|\bcloud\b/i],
    ["agil","Metodologias ágeis",/[aá]geis|\b[aá]gil\b|scrum|kanban/i],
    ["redes","Análise de redes",/social network|an[aá]lise de redes|\bgrafos?\b/i],
    ["analytics","Análise de dados",/an[aá]lise de dados|analista de dados|data analyst|analytics/i]];
  function temasDe(txt){txt=String(txt||"");return TEMAS.filter(function(t){return t[2].test(txt)}).map(function(t){return t[0]})}

  /* importação com "juntar": completa os dados de um registro sem apagar nada; devolve null se não mudou */
  function juntarDados(velho,novo){var d=Object.assign({},velho||{}),mudou=false;
    Object.keys(novo||{}).forEach(function(k){
      if(Array.isArray(novo[k])){var l=(d[k]||[]).slice(),chave=function(x){return norm(typeof x==="string"?x:x.nome||x.o||x.k||JSON.stringify(x))},tem={};l.forEach(function(x){tem[chave(x)]=1});
        novo[k].forEach(function(x){if(!tem[chave(x)]){l.push(x);mudou=true}});d[k]=l}
      else if(d[k]==null){d[k]=novo[k];mudou=true}});
    return mudou?d:null}
  /* Carreira: competências que aparecem em vagas de dados, para comparar com o seu perfil */
  var SKILLS=[
    ["sql","SQL",/\bsql\b|consultas? em banco|postgres|mysql|sql server|oracle|bigquery|snowflake|redshift/i],
    ["powerbi","Power BI",/power ?bi|\bdax\b|power query|\bpbi\b/i],
    ["excel","Excel avançado",/excel|planilhas?|vba|tabelas? din[aâ]micas?|proc ?v/i],
    ["python","Python",/\bpython\b|pandas|numpy|jupyter/i],
    ["r","R",/\blinguagem r\b|\bem r\b|\br\/|rstudio|tidyverse/i],
    ["estat","Estatística",/estat[ií]stic|teste[s]? de hip[oó]tese|regress[aã]o|infer[eê]ncia/i],
    ["ml","Machine learning",/machine learning|aprendizado de m[aá]quina|modelos? preditivos?|scikit|xgboost/i],
    ["viz","Visualização (Tableau, Looker…)",/tableau|looker|qlik|metabase|data ?viz|visualiza[cç][aã]o de dados|storytelling/i],
    ["etl","ETL e engenharia de dados",/\betl\b|\belt\b|pipelines?|airflow|\bdbt\b|spark|databricks|data lake|lakehouse|integra[cç][aã]o de dados/i],
    ["cloud","Nuvem (AWS, Azure, GCP)",/\baws\b|azure|google cloud|\bgcp\b|cloud/i],
    ["negocio","Requisitos de negócio",/requisitos|regras? de neg[oó]cio|stakeholders?|levantamento|vis[aã]o de neg[oó]cio|kpis?|indicadores/i],
    ["agil","Metodologias ágeis",/[aá]geis|\b[aá]gil\b|scrum|kanban|jira/i],
    ["ingles","Inglês",/ingl[eê]s|english/i],
    ["git","Git",/\bgit\b|github|gitlab/i],
    ["ia","IA generativa",/ia generativa|\bllms?\b|genai|chatgpt|prompt/i],
    ["sap","SAP / ERP",/\bsap\b|\berp\b|totvs|protheus/i]];
  /* o que o texto da vaga pede, o que você tem e o que falta (nota de 0 a 100) */
  function compatVaga(texto,meus){
    var pede=SKILLS.filter(function(k){return k[2].test(String(texto||""))}).map(function(k){return k[0]}),tem=pede.filter(function(k){return (meus||[]).indexOf(k)>=0});
    return {pede:pede,tem:tem,falta:pede.filter(function(k){return tem.indexOf(k)<0}),nota:pede.length?Math.round(tem.length/pede.length*100):null}}
  /* ===== Bebê: percentis da OMS, Napper e vacinas ===== */
  /* OMS (método LMS): z de uma medida e a medida de um z; percentil pela normal padrão */
  function omsZ(lms,x){var L=lms[0],M=lms[1],S=lms[2];return Math.abs(L)<1e-9?Math.log(x/M)/S:(Math.pow(x/M,L)-1)/(L*S)}
  function omsValor(lms,z){var L=lms[0],M=lms[1],S=lms[2];return Math.abs(L)<1e-9?M*Math.exp(S*z):M*Math.pow(1+L*S*z,1/L)}
  function percentilDeZ(z){var t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2),p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return Math.round((z>0?1-p:p)*1000)/10}
  /* CSV do Napper: uma linha por evento; vira {chave, tipo, inicio, fim, dados} (a chave evita duplicar ao importar de novo) */
  function csvLinhas(txt){var out=[],linha=[],campo="",q=false;txt=String(txt||"").replace(/^﻿/,"");
    for(var i=0;i<txt.length;i++){var c=txt[i];if(q){if(c==='"'){if(txt[i+1]==='"'){campo+='"';i++}else q=false}else campo+=c}
      else if(c==='"')q=true;else if(c===","){linha.push(campo);campo=""}else if(c==="\n"||c==="\r"){if(c==="\r"&&txt[i+1]==="\n")i++;linha.push(campo);campo="";if(linha.length>1||linha[0])out.push(linha);linha=[]}else campo+=c}
    if(campo||linha.length){linha.push(campo);out.push(linha)}return out}
  var NAPPER_TIPOS={NURSING:"peito",BOTTLE:"mamadeira",NAP:"sono",CHANGED_DIAPER:"fralda",NIGHT_WAKING:"despertar",BED_TIME:"dormir",WOKE_UP:"acordar",PUMPING:"ordenha",MEDICINE:"remedio",SOLIDS:"papinha",TEMPERATURE:"temperatura",BATH:"banho"};
  function napperLer(txt){
    var l=csvLinhas(txt);if(!l.length)return [];var cab=l[0].map(function(x){return x.trim()}),ix={};cab.forEach(function(c,i){ix[c]=i});
    if(ix.category==null||ix.start==null)throw new Error("esse arquivo não parece uma exportação do Napper (faltam as colunas start e category)");
    function v(r,k){var x=ix[k]==null?"":r[ix[k]];return x==null||x===""?null:x}
    function num(r,k){var x=v(r,k);return x==null?null:+x}
    return l.slice(1).filter(function(r){return v(r,"category")&&v(r,"start")}).map(function(r){
      var cat=v(r,"category"),d={};
      if(cat==="NURSING"){d.esq=num(r,"breastLeftSeconds");d.dir=num(r,"breastRightSeconds")}
      if(cat==="BOTTLE"){d.ml=num(r,"feedingAmount");d.leite=v(r,"bottleFeedingType")==="BREAST_MILK"?"materno":v(r,"bottleFeedingType")==="FORMULA"?"formula":null}
      if(cat==="CHANGED_DIAPER")d.conteudo=({WET:"xixi",DIRTY:"coco",MIXED:"xixi e coco"})[v(r,"diaperContent")]||null;
      if(cat==="PUMPING"){d.esq=num(r,"amountPumpedLeft");d.dir=num(r,"amountPumpedRight")}
      if(cat==="NAP"){d.como=v(r,"howBabySlept");d.acordou=v(r,"howBabyWoke")}
      if(cat==="TEMPERATURE")d.temp=num(r,"temperature");
      if(v(r,"comment"))d.obs=v(r,"comment");
      Object.keys(d).forEach(function(k){if(d[k]==null)delete d[k]});
      return {chave:"napper:"+cat+":"+v(r,"start")+":"+(v(r,"createdAt")||""),tipo:NAPPER_TIPOS[cat]||cat.toLowerCase(),inicio:v(r,"start"),fim:v(r,"end")||v(r,"start"),dados:d}})}
  /* resumo por dia (data local do início): mamadas, ml, fraldas, sono e despertares.
     Noite = da hora de dormir até a de acordar (até 16 h depois), menos os despertares; ela conta no dia em que começou.
     Soneca registrada dentro de uma noite não é somada de novo. */
  function bebeDias(evs){
    var D={};function dia(k){return D[k]=D[k]||{data:k,peito:0,peitoMin:0,mamadeira:0,mlFormula:0,mlMaterno:0,fraldas:0,xixi:0,coco:0,sonoMin:0,sonecaMin:0,noiteMin:0,sonecas:0,despertares:0,ordenhaMl:0,remedios:0}}
    function t(x){return new Date(x).getTime()}
    var ord=evs.slice().sort(function(a,b){return t(a.inicio)-t(b.inicio)}),noites=[];
    ord.forEach(function(e,i){if(e.tipo!=="dormir")return;var ate=t(e.inicio)+16*36e5;
      for(var j=i+1;j<ord.length&&t(ord[j].inicio)<=ate;j++){if(ord[j].tipo==="dormir")break;if(ord[j].tipo==="acordar"){noites.push({de:t(e.inicio),ate:t(ord[j].inicio),dia:String(e.inicio).slice(0,10)});break}}});
    function naNoite(x){return noites.filter(function(n){return x>=n.de&&x<n.ate})[0]}
    noites.forEach(function(n){var acordado=ord.filter(function(e){return e.tipo==="despertar"&&t(e.inicio)>=n.de&&t(e.inicio)<n.ate}).reduce(function(s,e){return s+Math.max(0,t(e.fim)-t(e.inicio))},0);
      var d=dia(n.dia);d.noiteMin+=Math.round((n.ate-n.de-acordado)/6e4)});
    ord.forEach(function(e){var d=dia(String(e.inicio).slice(0,10)),x=e.dados||{},min=Math.max(0,(t(e.fim)-t(e.inicio))/6e4);
      if(e.tipo==="peito"){d.peito++;d.peitoMin+=Math.round(((x.esq||0)+(x.dir||0))/60)}
      else if(e.tipo==="mamadeira"){d.mamadeira++;if(x.leite==="materno")d.mlMaterno+=x.ml||0;else d.mlFormula+=x.ml||0}
      else if(e.tipo==="fralda"){d.fraldas++;if(/xixi/.test(x.conteudo||""))d.xixi++;if(/coco/.test(x.conteudo||""))d.coco++}
      else if(e.tipo==="sono"){if(!naNoite(t(e.inicio))){d.sonecaMin+=Math.round(min);d.sonecas++}}
      else if(e.tipo==="despertar")d.despertares++;
      else if(e.tipo==="ordenha")d.ordenhaMl+=(x.esq||0)+(x.dir||0);
      else if(e.tipo==="remedio")d.remedios++});
    return Object.keys(D).sort().map(function(k){var d=D[k];d.sonoMin=d.sonecaMin+d.noiteMin;return d})}
  /* calendário básico de vacinação do SUS (PNI) até 15 meses: [idade em meses, vacina, palavras para reconhecer no registro] */
  var VACINAS_PNI=[[0,"BCG",/bcg/i],[0,"Hepatite B (ao nascer)",/hepatite b|hep\.? ?b/i],
    [2,"Pentavalente (1ª dose)",/penta/i],[2,"Poliomielite VIP (1ª dose)",/vip|polio/i],[2,"Rotavírus (1ª dose)",/rota/i],[2,"Pneumocócica 10 (1ª dose)",/pneumo/i],
    [3,"Meningocócica C (1ª dose)",/meningo/i],
    [4,"Pentavalente (2ª dose)",/penta/i],[4,"Poliomielite VIP (2ª dose)",/vip|polio/i],[4,"Rotavírus (2ª dose)",/rota/i],[4,"Pneumocócica 10 (2ª dose)",/pneumo/i],
    [5,"Meningocócica C (2ª dose)",/meningo/i],[6,"Pentavalente (3ª dose)",/penta/i],[6,"Poliomielite VIP (3ª dose)",/vip|polio/i],[6,"Influenza (gripe)",/influenza|gripe/i],
    [9,"Febre amarela",/febre amarela/i],[12,"Tríplice viral",/tr[ií]plice viral|sarampo/i],[12,"Pneumocócica 10 (reforço)",/pneumo/i],[12,"Meningocócica (reforço)",/meningo/i],
    [15,"DTP (1º reforço)",/dtp|tr[ií]plice bacteriana/i],[15,"Poliomielite (reforço)",/vip|vop|polio/i],[15,"Hepatite A",/hepatite a|hep\.? ?a\b/i],[15,"Tetraviral",/tetra ?viral|varicela/i]];
  /* cada vacina do calendário com a data prevista e se já foi tomada (conta quantas vezes o nome aparece nos registros, na ordem das doses) */
  function vacinasCalendario(nasc,textosTomadas){
    var usados={};return VACINAS_PNI.map(function(v){var d=new Date(nasc+"T12:00:00");d.setMonth(d.getMonth()+v[0]);var prev=d.toISOString().slice(0,10);
      var k=String(v[2]),n=(textosTomadas||[]).filter(function(t){return v[2].test(t)}).length;usados[k]=(usados[k]||0)+1;
      return {meses:v[0],nome:v[1],prevista:prev,tomada:n>=usados[k]}})}
  raiz.RACnucleo={norm:norm,urlAbs:urlAbs,lerAbast:lerAbast,TEMAS:TEMAS,temasDe:temasDe,juntarDados:juntarDados,SKILLS:SKILLS,compatVaga:compatVaga,omsZ:omsZ,omsValor:omsValor,percentilDeZ:percentilDeZ,csvLinhas:csvLinhas,napperLer:napperLer,bebeDias:bebeDias,VACINAS_PNI:VACINAS_PNI,vacinasCalendario:vacinasCalendario};
})(typeof window!=="undefined"?window:globalThis);
