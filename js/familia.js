/* Dia a Dia RAC — módulo carregado quando a seção abre. Eddie, Olivia e veículos: registros, resumo, exames, gráficos, importação, abastecimento e quilometragem.
   Usa as funções do núcleo (js/app.js), que ficam no escopo global. */
  function tipoInfo(k){return TIPOS.concat(TIPOS_VEIC).filter(function(t){return t[0]===k})[0]||TIPOS[TIPOS.length-1]}
  /* ===== Eddie e Olivia: linha do tempo com exames, vacinas, consultas, peso e momentos, com fotos, PDFs e vídeos.
     Tabela "registros" e cofre de arquivos "familia" no Supabase (004_familia.sql); o Rayner e a esposa veem juntos. ===== */
  var FAM={eddie:{n:"Eddie",peso:true},olivia:{n:"Olivia",peso:true,bebe:true,
    /* compras do Mercado que também são gastos dela: lata de NAN, fraldas e lenços (entram sozinhas nos Gastos) */
    merc:{termos:["nan","fralda","pampers","huggies","umedec"],re:/(^|[^a-zà-ú])nan([^a-zà-ú]|$)|fralda|pampers|huggies|umedec/i}},
    /* veículos: mesma tabela de registros, outra lista de tipos e outro resumo; aparecem na página Veículos.
       Placa, ano e cor ficam num registro com dados.ficha, na conta, e não aqui no código (o repositório é público) */
    civic:{n:"Civic",veic:true,root:"veiculos-view",desc:"Honda Civic"},
    moto:{n:"Moto",veic:true,root:"veiculos-view",desc:"Yamaha"},
    c3:{n:"C3 (antigo)",veic:true,root:"veiculos-view",desc:"Citroën C3"},
    /* cofre de documentos da casa: mesmo motor, com validade ("Vence em") que entra na Agenda */
    docs:{n:"Documentos",docs:true,root:"documentos-view"}};
  var TIPOS_DOCS=[["identidade","Documento pessoal","Ex.: CNH do Rayner","Número (opcional)"],["garantia","Garantia","Ex.: Geladeira Brastemp","Loja"],["nota","Nota fiscal","Ex.: Notebook","Loja"],
    ["contrato","Contrato","Ex.: Aluguel","Com quem"],["apolice","Apólice e plano","Ex.: Plano de saúde","Empresa"],["imposto","Impostos e taxas","Ex.: IPTU 2027",""],["outro","Outro","",""]];
  var TIPOS_VEIC=[["revisao","Revisão","Ex.: Revisão de 70.000 km","Oficina"],["oleo","Troca de óleo","Ex.: Troca de óleo e filtro","Oficina"],["manutencao","Manutenção","Ex.: Troca de pastilhas","Oficina"],
    ["abastecimento","Abastecimento","Ex.: Etanol","Posto"],["seguro","Seguro","Ex.: Seguro Allianz 2026","Seguradora"],["documento","Licenciamento e impostos","Ex.: Licenciamento 2026",""],
    ["bateria","Bateria","Ex.: Bateria Moura","Loja"],["pneu","Pneus","Ex.: 4 pneus novos","Loja"],["outro","Outro","",""]];
  function ehVeic(quem){return !!(FAM[quem]&&FAM[quem].veic)}
  function tiposDe(quem){return ehVeic(quem)?TIPOS_VEIC:FAM[quem]&&FAM[quem].docs?TIPOS_DOCS:TIPOS}
  var TIPOS=[["exame","Exame","Ex.: Hemograma completo","Resultado"],["consulta","Consulta","Ex.: Consulta de rotina","Profissional"],["tratamento","Receita / tratamento","Ex.: Receita da endocrinologista","Profissional"],
    ["sintoma","Sintomas","Ex.: Diarreia e vômito",""],["vacina","Vacina","Ex.: V10, Antirrábica, Hepatite B","Dose"],["preventivo","Antipulgas / vermífugo","Ex.: Bravecto","Produto"],
    ["peso","Peso","Ex.: Pesagem","Peso (kg)"],["alimentacao","Alimentação","Ex.: Troca de ração","Ração"],["pedido","Pedido de exames","Ex.: Exames de controle",""],["diario","Diário (mamadas e fraldas)","Ex.: Diário da semana",""],["produto","Fraldas e produtos","Ex.: Pacote de fraldas","Marca"],
    ["momento","Momento","Ex.: Primeiro passeio na praia","Onde"],["carta","Carta para o futuro","Ex.: Para você ler aos 18 anos","Abrir em"],["midia","Fotos e vídeos","Ex.: Fotos do aniversário",""],
    ["nascimento","Nascimento","Ex.: Nascimento","Onde"],["outro","Outro","",""]];
  var famFiltro={},famVista={},famAlvo={};Object.keys(FAM).forEach(function(k){famFiltro[k]="";famVista[k]="resumo";famAlvo[k]=null});
  function idadeTxt(iso){
    var n=new Date(iso+"T12:00:00"),t=new Date(),m=(t.getFullYear()-n.getFullYear())*12+t.getMonth()-n.getMonth();if(t.getDate()<n.getDate())m--;
    if(m<1)return Math.max(0,Math.floor((t-n)/864e5))+" dias";
    var a=Math.floor(m/12),r=m%12;return (a?a+(a===1?" ano":" anos"):"")+(a&&r?" e ":"")+(r?r+(r===1?" mês":" meses"):"")}
  function nomeSeguro(n){return norm(n).replace(/[^a-z0-9.]+/g,"-").replace(/^-+|-+$/g,"").slice(-60)||"arquivo"}
  function enviarArquivos(quem,id,files,status){
    var out=[],i=0;
    return Array.prototype.reduce.call(files,function(p,f){return p.then(function(){
      i++;status("Enviando arquivo "+i+" de "+files.length+"…");
      if(f.size>50*1024*1024)throw new Error("“"+f.name+"” passa de 50 MB. Vídeo longo: deixe no iCloud e cole o link nos detalhes.");
      return encolher(f).then(function(g){
        var path=DONO+"/"+quem+"/"+id+"/"+Date.now()+"-"+nomeSeguro(g.name);
        return SB.storage.from("familia").upload(path,g,{contentType:g.type||"application/octet-stream",upsert:false}).then(function(r){
          if(r.error)throw new Error(r.error.message);out.push({path:path,nome:f.name,tipo:g.type,tamanho:g.size})})})})},Promise.resolve()).then(function(){return out})}

  function refTxt(it){return it.min!=null&&it.max!=null?fmtN(it.min)+" a "+fmtN(it.max)+(it.u?" "+it.u:""):""}
  function foraRef(it){return it.max!=null&&it.v>it.max?"alto":it.min!=null&&it.v<it.min?"baixo":""}
  function pesoNum(r){var v=parseFloat(String(r.valor||"").replace(",","."));return isFinite(v)?v:null}
  function dadosDe(r){return r.dados||{}}
  /* remédios de todas as receitas, com início, fim e se está em uso hoje */
  function famMeds(regs){
    var hoje=hojeISO(),out=[];
    regs.forEach(function(r){(dadosDe(r).meds||[]).forEach(function(m){
      var ini=m.inicio||r.data,fim=m.continuo?null:maisDias(ini,Math.max(1,m.dias||1)-1);
      out.push({m:m,r:r,ini:ini,fim:fim,ativo:ini<=hoje&&(m.continuo||fim>=hoje)})})});
    return out.sort(function(a,b){return b.ini.localeCompare(a.ini)})}
  function famAtivos(regs){var vis={};return famMeds(regs).filter(function(x){var k=norm(x.m.nome).split(/\s+/).slice(0,2).join(" ");if(!x.ativo||vis[k])return false;vis[k]=1;return true})}
  function medLinha(x){
    var m=x.m,quando=m.continuo?"uso contínuo desde "+dataBR(x.ini):dataBR(x.ini)+(x.fim!==x.ini?" a "+dataBR(x.fim):"")+(m.dias?" ("+m.dias+(m.dias===1?" dia)":" dias)"):"");
    return h("li",{class:x.ativo?"ativo":null},h("span",{class:"grow"},h("b",{text:m.nome}),h("span",{class:"sub",text:[m.dose,m.como].filter(Boolean).join(" · ")})),h("span",{class:"end sub",text:quando}))}
  function famSangue(regs){return regs.filter(function(r){var d=dadosDe(r);return r.tipo==="exame"&&(d.laudo||[]).length&&(!d.categoria||d.categoria==="sangue")}).sort(function(a,b){return a.data.localeCompare(b.data)})}
  function famUS(regs){return regs.filter(function(r){var d=dadosDe(r);return r.tipo==="exame"&&(d.orgaos||[]).length&&(!d.categoria||d.categoria==="ultrassom")}).sort(function(a,b){return a.data.localeCompare(b.data)})}
  function seta(it){var f=foraRef(it);return f==="alto"?" ↑":f==="baixo"?" ↓":""}

  /* "Como está agora": diagnóstico, peso, último exame comparado ao anterior, remédios em uso e o que venceu */
  /* cada linha leva ao registro de onde a informação saiu (ir), já aberto e detalhado */
  function famAgora(quem,regs,ir){
    var p=panel("Como "+(quem==="olivia"?"a ":"o ")+FAM[quem].n+" está agora","Toque numa linha para ver o exame ou a receita completa."),ul=h("ul",{class:"wl famagora"}),hoje=hojeISO();
    function item(rot,val,sub,cls,alvo){
      var li=h("li",{class:(cls||"")+(alvo?" clic":""),tabindex:alvo?"0":null,role:alvo?"button":null},h("span",{class:"grow"},h("b",{text:rot}),sub?h("span",{class:"sub",text:sub}):null),val?h("span",{class:"end",text:val}):null);
      if(alvo){li.onclick=function(){ir(alvo)};li.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();ir(alvo)}}}
      ul.appendChild(li)}
    var dg=regs.filter(function(r){return dadosDe(r).diagnostico}).sort(function(a,b){return b.data.localeCompare(a.data)})[0];
    if(dg)item("Diagnóstico mais recente",dg.dados.diagnostico,dataBR(dg.data)+(dg.dados.vet?" · "+dg.dados.vet:""),"",{r:dg});
    var ps=regs.filter(function(r){return r.tipo==="peso"&&pesoNum(r)!=null}).sort(function(a,b){return b.data.localeCompare(a.data)});
    if(ps.length){var d=ps[1]?pesoNum(ps[0])-pesoNum(ps[1]):0;
      item("Peso",fmtN(pesoNum(ps[0]))+" kg","em "+dataBR(ps[0].data)+(ps[1]?" · "+(d>0?"+":"")+fmtN(Math.round(d*10)/10)+" kg desde "+dataBR(ps[1].data)+" ("+(d>0?"+":"")+Math.round(d/pesoNum(ps[1])*100)+"%)":""),(function(){var nasc=regs.filter(function(r){return r.tipo==="nascimento"})[0];/* bebê: ganhar peso é o esperado; só a perda chama atenção */return nasc&&nasc.data>maisDias(hojeISO(),-730)?(d<0?"alerta":"bom"):(Math.abs(d)>=0.05*pesoNum(ps[1]||ps[0])?"alerta":null)})(),{r:ps[0],filtro:"peso"})}
    var sg=famSangue(regs),ult=sg[sg.length-1],ant=sg[sg.length-2];
    if(ult){
      var fora=ult.dados.laudo.filter(foraRef);
      item("Exame de sangue de "+dataBR(ult.data),fora.length?fora.length+" fora da referência":"tudo na referência",fora.map(function(it){return it.n+" "+fmtN(it.v)+seta(it)}).join(" · "),fora.length?"alerta":null,{r:ult});
      if(ant){var antes={};ant.dados.laudo.forEach(function(it){antes[it.k]=it});
        var melhor=[],pior=[];
        function longe(it){return foraRef(it)==="alto"?it.v-it.max:it.min-it.v}
        ult.dados.laudo.forEach(function(it){var a=antes[it.k];if(!a)return;
          if(foraRef(a)&&!foraRef(it))melhor.push(it.n+" ("+fmtN(a.v)+" → "+fmtN(it.v)+")");
          else if(!foraRef(a)&&foraRef(it))pior.push(it.n+" ("+fmtN(a.v)+" → "+fmtN(it.v)+")");
          /* fora nas duas datas: melhorou se chegou mais perto da faixa de referência */
          else if(foraRef(a)&&foraRef(it))(longe(it)<longe(a)?melhor:pior).push(it.n+" ("+fmtN(a.v)+" → "+fmtN(it.v)+")")});
        if(melhor.length)item("Melhorou ou voltou ao normal desde "+dataBR(ant.data),"",melhor.join(" · "),"bom",{r:ult});
        if(pior.length)item("Piorou ou saiu da referência desde "+dataBR(ant.data),"",pior.join(" · "),"alerta",{r:ult})}}
    var us=famUS(regs),uu=us[us.length-1];
    if(uu)item("Ultrassom de "+dataBR(uu.data),"",uu.dados.resumo||uu.dados.orgaos.filter(function(o){return o.a}).map(function(o){return o.o}).join(", "),"",{r:uu});
    var ativos=famAtivos(regs);
    item("Remédios em uso",ativos.length?String(ativos.length):"nenhum",ativos.map(function(x){return x.m.nome+(x.m.continuo?" (contínuo)":" até "+dataBR(x.fim))}).join(" · "),"",{vista:"remedios"});
    /* vacina ou antipulgas cuja próxima dose passou sem nenhum registro novo do mesmo tipo */
    regs.filter(function(r){return /^(vacina|preventivo)$/.test(r.tipo)&&r.proxima&&r.proxima<hoje&&r.proxima>=maisDias(hoje,-365)&&!regs.some(function(o){return o.tipo===r.tipo&&o.data>r.data})})
      .forEach(function(r){item(r.titulo,"atrasado","a próxima dose era em "+dataBR(r.proxima)+" e não há dose nova registrada","alerta",{r:r})});
    var prox=regs.filter(function(r){return r.proxima&&r.proxima>=hoje}).sort(function(a,b){return a.proxima.localeCompare(b.proxima)});
    prox.forEach(function(r){item(r.titulo,dataBR(r.proxima),tipoInfo(r.tipo)[1]+" · próxima data","",{r:r})});
    p.appendChild(ul);
    p.appendChild(h("p",{class:"note",text:"Resumo montado a partir dos laudos e receitas. Quem interpreta é o veterinário."}));
    return p}

  /* Peso ao longo do tempo: o mesmo gráfico dos preços do Mercado (balão com o dia ao passar o mouse ou tocar) */
  var famPesoPer={eddie:"3",olivia:"tudo"},famMedida={eddie:"peso",olivia:"peso"};
  /* medidas de crescimento guardadas nos registros "peso": o peso no valor; comprimento e cabeça em dados */
  var MEDIDAS=[["peso","Peso","kg",function(r){return pesoNum(r)}],["altura","Comprimento","cm",function(r){var v=dadosDe(r).altura;return typeof v==="number"?v:null}],
    ["cabeca","Cabeça","cm",function(r){var v=dadosDe(r).cabeca;return typeof v==="number"?v:null}]];
  function famPeso(regs,quem){
    var pesos=regs.filter(function(r){return r.tipo==="peso"}).sort(function(a,b){return a.data.localeCompare(b.data)});
    var meds=MEDIDAS.filter(function(m){return pesos.filter(function(r){return m[3](r)!=null}).length>=2});
    if(!meds.length||!window.RACmercado)return null;
    if(!meds.some(function(m){return m[0]===famMedida[quem]}))famMedida[quem]=meds[0][0];
    /* bebê (menos de 2 anos): mostra também o ganho por dia, que é o que o pediatra acompanha */
    var nasc=regs.filter(function(r){return r.tipo==="nascimento"})[0],bebe=nasc&&nasc.data>maisDias(hojeISO(),-730);
    var p=panel(meds.length>1?"Crescimento":"Peso"),corpo=h("div"),segM=h("div",{class:"seg famseg famper",role:"group","aria-label":"Medida"});
    var seg=h("div",{class:"seg famseg famper",role:"group","aria-label":"Período"}),PER=[];
    function desenhar(){
      var m=meds.filter(function(x){return x[0]===famMedida[quem]})[0],val=m[3],un=m[2];
      var todos=pesos.filter(function(r){return val(r)!=null});
      function fmt(v){return fmtN(Math.round(v*(un==="kg"?100:10))/(un==="kg"?100:10))+" "+un}
      /* período: o histórico inteiro espreme o gráfico (filhote, anos sem pesagem), então o padrão do Eddie são os últimos 3 anos */
      PER=[["1","Último ano",365],["3","Últimos 3 anos",1095],["tudo","Tudo",0]].filter(function(x){return !x[2]||todos[0].data<maisDias(hojeISO(),-x[2])});
      if(!PER.some(function(x){return x[0]===famPesoPer[quem]}))famPesoPer[quem]="tudo";
      seg.innerHTML="";seg.hidden=PER.length<2;
      PER.forEach(function(x){var b=h("button",{type:"button",text:x[1],"aria-pressed":String(x[0]===famPesoPer[quem])});b.onclick=function(){famPesoPer[quem]=x[0];desenhar()};seg.appendChild(b)});
      segM.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.k===m[0]))});
      var per=PER.filter(function(x){return x[0]===famPesoPer[quem]})[0],ini=per[2]?maisDias(hojeISO(),-per[2]):"0000";
      var pts=todos.filter(function(r){return r.data>=ini});if(pts.length<2)pts=todos.slice(-2);
      var vs=pts.map(val),ult=vs[vs.length-1],d=ult-vs[0];
      corpo.innerHTML="";
      var dias=Math.max(1,(new Date(pts[pts.length-1].data)-new Date(pts[0].data))/864e5);
      corpo.appendChild(h("div",{class:"kgasto"},
        h("div",null,h("span",{class:"kl",text:"Agora"}),h("b",{class:"kv",text:fmt(ult)})),
        h("div",null,h("span",{class:"kl",text:"Menor"}),h("b",{class:"kv",text:fmt(Math.min.apply(null,vs))})),
        h("div",null,h("span",{class:"kl",text:"Maior"}),h("b",{class:"kv",text:fmt(Math.max.apply(null,vs))})),
        h("div",null,h("span",{class:"kl",text:"Desde "+dataBR(pts[0].data)}),h("b",{class:"kv",text:(d>0?"+":"")+fmt(d)})),
        bebe&&m[0]==="peso"?h("div",null,h("span",{class:"kl",text:"Ganho por dia"}),h("b",{class:"kv",text:fmtN(Math.round(d*1000/dias))+" g"})):null,
        bebe&&m[0]!=="peso"?h("div",null,h("span",{class:"kl",text:"Por mês"}),h("b",{class:"kv",text:(d>0?"+":"")+fmtN(Math.round(d/dias*30.4*10)/10)+" cm"})):null));
      /* colunas, uma por medição (mesmo estilo do "Mês a mês" do Mercado); tocar ou passar o mouse mostra o detalhe embaixo */
      var n=pts.length,maxv=Math.max.apply(null,vs),minv=Math.min.apply(null,vs),cap=h("p",{class:"vbcap",role:"status"}),barras=[];
      function det(i){var r=pts[i],ant=pts[i-1],dd=ant?val(r)-val(ant):0;
        return dataBR(r.data)+" · "+fmt(val(r))+(ant?" ("+(dd>0?"+":"")+fmt(dd)+" desde "+dataBR(ant.data)+")":"")+(r.titulo&&!/^Pesagem$|^Pesagem e medidas$/.test(r.titulo)?" · "+r.titulo.replace(/^Pesagem\s*\(?|\)$/g,""):"")}
      function marcar(i){barras.forEach(function(b,j){b.classList.toggle("on",j===i)});cap.textContent=det(i)}
      var mostraV=function(i){return n<=14||i===n-1||vs[i]===maxv||vs[i]===minv};
      /* comprimento e cabeça: as colunas começam perto do menor valor, senão ficariam todas iguais */
      var base=m[0]==="peso"?0:Math.max(0,Math.floor(minv*0.9));
      var vb=h("div",{class:"vbars vbpeso"},pts.map(function(r,i){var v=vs[i],p2=r.data.split("-");
        var b=h("button",{type:"button",class:"vb","aria-label":det(i),title:det(i)},
          h("span",{class:"vbv"+(mostraV(i)?"":" opc"),text:fmtN(Math.round(v*10)/10)}),
          h("span",{class:"vbt"},h("span",{class:"vbf",style:"height:"+Math.max(2,(v-base)/((maxv-base)||1)*100).toFixed(1)+"%"})),
          bebe?vbRotulo(p2[2],MES3[+p2[1]-1]):vbRotulo(MES3[+p2[1]-1],p2[0].slice(2)));
        b.onclick=function(){marcar(i)};b.onmouseenter=function(){marcar(i)};barras.push(b);
        racDica.ligar(b,function(){var d=det(i).split(" · ");return [d[0],d.slice(1).join(" · ")]});return b}));
      corpo.appendChild(vb);corpo.appendChild(cap);marcar(n-1);vbFim(vb);
      corpo.appendChild(h("p",{class:"sub",text:pts.length+" medições, de "+dataBR(pts[0].data)+" a "+dataBR(pts[pts.length-1].data)+". Toque numa coluna para ver os detalhes."+(base?" As colunas começam em "+fmt(base)+".":"")}))}
    meds.forEach(function(m){var b=h("button",{type:"button",text:m[1]});b.dataset.k=m[0];b.onclick=function(){famMedida[quem]=m[0];desenhar()};segM.appendChild(b)});
    if(meds.length>1)p.appendChild(segM);
    p.appendChild(seg);p.appendChild(corpo);desenhar();
    return p}

  /* Exames de sangue lado a lado: cada linha um indicador, cada coluna uma data */
  function famComparaSangue(regs){
    var sg=famSangue(regs);if(!sg.length)return null;
    var ordem=[],por={};
    sg.forEach(function(r){r.dados.laudo.forEach(function(it){if(!por[it.k]){por[it.k]={n:it.n,g:it.g,u:it.u,v:{}};ordem.push(it.k)}por[it.k].v[r.id]=it})});
    var p=panel("Exames de sangue: como estava × como está",sg.length===1?"Um exame até agora.":"Valores de "+sg.map(function(r){return dataBR(r.data)}).join(", ")+". Vermelho: fora da referência do laboratório.");
    var tb=h("table",{class:"famtab"}),hd=h("tr",null,h("th",{text:"Indicador"}),sg.map(function(r){return h("th",{text:dataBR(r.data)})}),h("th",{text:"Referência"}),sg.length>1?h("th",{text:"Mudança"}):null);
    tb.appendChild(h("thead",null,hd));var bd=h("tbody");tb.appendChild(bd);var grupo=null;
    ordem.forEach(function(k){var x=por[k];
      if(x.g!==grupo){grupo=x.g;bd.appendChild(h("tr",{class:"famg"},h("td",{colspan:String(sg.length+3),text:grupo||"Outros"})))}
      var ult=null,pri=null;sg.forEach(function(r){var it=x.v[r.id];if(it){if(!pri)pri=it;ult=it}});
      var mud=pri&&ult&&pri!==ult&&pri.v?Math.round((ult.v-pri.v)/Math.abs(pri.v)*100):null;
      bd.appendChild(h("tr",null,h("td",null,h("b",{text:x.n})),
        sg.map(function(r){var it=x.v[r.id];return h("td",{class:it?foraRef(it)||null:null,title:it?refTxt(it):null,text:it?fmtN(it.v)+seta(it):"—"})}),
        h("td",{class:"sub",text:ult?refTxt(ult):""}),
        sg.length>1?h("td",{class:"sub",text:mud==null?"":(mud>0?"+":"")+mud+"%"}):null))});
    p.appendChild(h("div",{class:"famtabw"},tb));return p}

  /* Ultrassons lado a lado: cada linha um órgão */
  function famComparaUS(regs){
    var us=famUS(regs);if(!us.length)return null;
    var ordem=[],por={};
    us.forEach(function(r){r.dados.orgaos.forEach(function(o){if(!por[o.o]){por[o.o]={};ordem.push(o.o)}por[o.o][r.id]=o})});
    var p=panel("Ultrassons: como estava × como está","⚠ marca o que o laudo apontou como alterado.");
    var tb=h("table",{class:"famtab famus"});
    tb.appendChild(h("thead",null,h("tr",null,h("th",{text:"Órgão"}),us.map(function(r){return h("th",{text:dataBR(r.data)})}))));
    var bd=h("tbody");tb.appendChild(bd);
    ordem.forEach(function(k){bd.appendChild(h("tr",null,h("td",null,h("b",{text:k})),us.map(function(r){var o=por[k][r.id];return h("td",{class:o&&o.a?"alto":null,text:o?(o.a?"⚠ ":"")+o.r:"—"})})))});
    p.appendChild(h("div",{class:"famtabw"},tb));return p}

  function famTratamentos(regs){
    var ms=famMeds(regs);if(!ms.length)return null;
    var p=panel("Remédios e tratamentos","Do mais recente para o mais antigo. Em destaque, o que está em uso hoje."),ativos=famAtivos(regs);
    if(ativos.length){p.appendChild(h("h3",{class:"dayh",text:"Em uso agora"}));p.appendChild(h("ul",{class:"wl fammeds"},ativos.map(medLinha)))}
    var porReg=[],vis={};ms.forEach(function(x){if(!vis[x.r.id]){vis[x.r.id]=1;porReg.push(x.r)}});
    porReg.forEach(function(r){var d=dadosDe(r);
      p.appendChild(h("h3",{class:"dayh",text:dataBR(r.data)+" · "+r.titulo}));
      if(d.vet||d.diagnostico)p.appendChild(h("p",{class:"sub",text:[d.diagnostico?"Diagnóstico: "+d.diagnostico:"",d.vet].filter(Boolean).join(" · ")}));
      p.appendChild(h("ul",{class:"wl fammeds"},ms.filter(function(x){return x.r===r}).map(medLinha)));
      if((d.orientacoes||[]).length)p.appendChild(h("ul",{class:"famori"},d.orientacoes.map(function(o){return h("li",{text:o})})))});
    return p}

  /* itens das notas do Mercado que são dela, no formato de registro (só para os Gastos).
     Se no mesmo dia já houver um registro com custo de fralda/fórmula, vale o registro, para não contar duas vezes;
     e a compra que virou "Lata N aberta" (dados.compra.id) sai daqui, porque o registro da lata já leva o preço dela. */
  function famMercado(quem,regs){
    var M=FAM[quem].merc;if(!M)return Promise.resolve([]);
    var or=M.termos.map(function(t){return "produto.ilike.*"+t+"*,descricao.ilike.*"+t+"*"}).join(",");
    return SB.from("compras").select("id,data,mercado,descricao,produto,quantidade,unidade,valor_total").or(or).order("data",{ascending:false}).then(sbOk).then(function(l){
      var dias={},usadas={};regs.forEach(function(r){var d=dadosDe(r);if(d.compra&&d.compra.id)usadas[d.compra.id]=1;else if(/^(produto|alimentacao)$/.test(r.tipo)&&typeof d.custo==="number")dias[r.data]=1});
      return l.filter(function(x){return M.re.test(x.produto||"")||M.re.test(x.descricao||"")}).filter(function(x){return !dias[x.data]&&!usadas[x.id]&&+x.valor_total>0}).map(function(x){
        var n=x.produto||x.descricao,q=+x.quantidade;
        return {id:"m-"+x.id,merc:true,tipo:"produto",data:x.data,titulo:n+(q>1&&x.unidade!=="kg"?" ("+fmtN(q)+" un)":""),dados:{custo:Math.round(+x.valor_total*100)/100,clinica:x.mercado}}})
    }).catch(function(){return []})}
  function famAbrirLata(quem,regs,r){
    var n=regs.reduce(function(m,x){var k=/^Lata (\d+)\b/i.exec(x.titulo||"");return k?Math.max(m,+k[1]):m},0)+1;
    var num=prompt("Número da lata (a sequência está na "+(n-1)+")",String(n));if(num==null)return;num=parseInt(num,10);if(!(num>0))return;
    var dt=prompt("Data em que a lata foi aberta (dd/mm/aaaa). A compra foi em "+dataBR(r.data)+".",dataBR(hojeISO()));if(dt==null)return;
    var m=/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(dt.trim());if(!m){alert("Use o formato dd/mm/aaaa.");return}
    var data=(m[3].length===2?"20"+m[3]:m[3])+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[1]).slice(-2),c=r.dados.custo,merc=r.dados.clinica||"";
    SB.from("registros").insert({quem:quem,tipo:"produto",data:data,titulo:"Lata "+num+" de fórmula NAN aberta",valor:"NAN",
      detalhes:"Comprada em "+dataBR(r.data)+(merc?" no "+merc:""),dados:{custo:c,clinica:merc||undefined,itensCusto:[["Lata de fórmula NAN",c]],compra:{id:r.id.replace(/^m-/,""),data:r.data,mercado:merc}}})
      .then(sbOk).then(function(){renderFamilia(quem)},function(e){alert("Não consegui salvar: "+e.message)})}
  function famGastos(regs,ir,quem){
    var cs=regs.filter(function(r){return typeof dadosDe(r).custo==="number"}).sort(function(a,b){return b.data.localeCompare(a.data)});if(!cs.length)return null;
    var anos={};cs.forEach(function(r){var a=r.data.slice(0,4);anos[a]=(anos[a]||0)+r.dados.custo});
    var p=panel("Gastos","Por ano: "+Object.keys(anos).sort().reverse().map(function(a){return a+": "+brl(anos[a])}).join(" · "));
    /* total geral e quanto foi em cada tipo de gasto */
    var grupos=ehVeic(quem)?[["Revisões e manutenção",/^(revisao|oleo|manutencao|bateria|pneu)$/],["Combustível",/^abastecimento$/],["Seguro",/^seguro$/],["Licenciamento e impostos",/^documento$/]]:[[quem==="eddie"?"Veterinário":"Saúde",/^(consulta|exame|tratamento|pedido|sintoma|vacina)$/],["Antipulgas e vermífugo",/^preventivo$/],[quem==="eddie"?"Ração":"Alimentação",/^alimentacao$/],["Fraldas, fórmula e produtos",/^produto$/]];var tot={};
    cs.forEach(function(r){var g=(grupos.filter(function(x){return x[1].test(r.tipo)})[0]||["Outros"])[0];tot[g]=(tot[g]||0)+r.dados.custo});
    p.appendChild(h("div",{class:"kgasto"},h("div",null,h("span",{class:"kl",text:"Total desde "+dataBR(cs[cs.length-1].data)}),h("b",{class:"kv",text:brl(cs.reduce(function(s,r){return s+r.dados.custo},0))})),
      grupos.map(function(x){return x[0]}).concat(["Outros"]).filter(function(g){return tot[g]}).map(function(g){return h("div",null,h("span",{class:"kl",text:g}),h("b",{class:"kv",text:brl(tot[g])}))})));
    p.appendChild(h("ul",{class:"wl famagora"},cs.map(function(r){var li=h("li",{class:"clic",tabindex:"0",role:"button"},h("span",{class:"grow"},h("b",{text:r.titulo}),h("span",{class:"sub",text:dataBR(r.data)+(r.dados.clinica?" · "+r.dados.clinica:"")+(r.merc?" · nota do Mercado":"")})),h("span",{class:"end",text:brl(r.dados.custo)}));
      function abre(){if(r.merc&&window.RACmercado)window.RACmercado.verProduto(r.titulo.replace(/ \(\S+ un\)$/,""));else ir({r:r,custo:true})}
      if(r.merc)li.title="Compra do Mercado: toque para ver o histórico de preço";
      /* lata de NAN que veio da nota: vira "Lata N de fórmula NAN aberta", com a data em que foi aberta (não a da compra) */
      if(r.merc&&quem==="olivia"&&/(^|[^a-zà-ú])nan([^a-zà-ú]|$)/i.test(r.titulo)){var ab=h("button",{type:"button",class:"ghostbtn",text:"Abrir como lata"});
        ab.onclick=function(e){e.stopPropagation();famAbrirLata(quem,regs,r)};li.appendChild(ab)}
      li.onclick=abre;li.onkeydown=function(e){if(e.key==="Enter")abre()};return li})));
    return p}

  /* O que o registro traz além do texto: profissional, diagnóstico, resumo, remédios, valores do exame, órgãos e custo */
  function fmtKm(v){return Math.round(v).toLocaleString("pt-BR")+" km"}
  function famDetalhe(card,r,regs){
    var d=dadosDe(r);
    if(typeof d.km==="number"||typeof d.proxKm==="number"||d.vigenciaFim||d.garantiaAte)card.appendChild(h("p",{class:"sub"},[
      typeof d.km==="number"?"Quilometragem: "+fmtKm(d.km):"",typeof d.proxKm==="number"?"Próxima com "+fmtKm(d.proxKm):"",
      d.vigenciaFim?"Vigência até "+dataBR(d.vigenciaFim):"",d.garantiaAte?"Garantia até "+dataBR(d.garantiaAte):""].filter(Boolean).join(" · ")));
    if(typeof d.litros==="number")card.appendChild(h("p",{class:"sub",text:fmtN(d.litros)+" litros"+(d.precoLitro?" a "+brl(d.precoLitro)+"/l":"")+(d.combustivel?" · "+d.combustivel:"")}));
    (d.alertas||[]).forEach(function(a){card.appendChild(h("p",{class:"qrwarn",text:"⚠ "+a}))});
    var quem=[d.clinica,d.vet].filter(Boolean).join(" · ");if(quem)card.appendChild(h("p",{class:"sub",text:quem}));
    if(d.motivo)card.appendChild(h("p",null,h("b",{text:"Motivo: "}),d.motivo));
    if(d.diagnostico)card.appendChild(h("p",null,h("b",{text:"Diagnóstico: "}),d.diagnostico));
    if(d.resumo)card.appendChild(h("p",{class:"famres",text:d.resumo}));
    if((d.meds||[]).length)card.appendChild(h("ul",{class:"wl fammeds"},famMeds([r]).map(medLinha)));
    if((d.orientacoes||[]).length)card.appendChild(h("ul",{class:"famori"},d.orientacoes.map(function(o){return h("li",{text:o})})));
    if((d.laudo||[]).length){
      var ant=famSangue(regs).filter(function(x){return x.data<r.data}).pop(),antes={};if(ant)ant.dados.laudo.forEach(function(it){antes[it.k]=it});
      var fora=d.laudo.filter(foraRef).length,tb=h("table",{class:"famtab"});
      tb.appendChild(h("thead",null,h("tr",null,h("th",{text:"Indicador"}),h("th",{text:"Resultado"}),h("th",{text:"Referência"}),ant?h("th",{text:"Em "+dataBR(ant.data)}):null)));
      tb.appendChild(h("tbody",null,d.laudo.map(function(it){var a=antes[it.k];
        return h("tr",null,h("td",{text:it.n}),h("td",{class:foraRef(it)||null,text:fmtN(it.v)+(it.u?" "+it.u:"")+seta(it)}),h("td",{class:"sub",text:refTxt(it)}),ant?h("td",{class:a?foraRef(a)||"sub":"sub",text:a?fmtN(a.v)+seta(a):"—"}):null)})));
      card.appendChild(h("details",{class:"famvals"},h("summary",{text:"Ver os "+d.laudo.length+" valores"+(fora?" ("+fora+" fora da referência)":"")}),h("div",{class:"famtabw"},tb)))}
    if((d.orgaos||[]).length)card.appendChild(h("details",{class:"famvals"},h("summary",{text:d.categoria==="ultrassom"||!d.categoria?"Ver o laudo por órgão":"Ver o laudo"}),
      h("ul",{class:"famori"},d.orgaos.map(function(o){return h("li",{class:o.a?"alto":null},h("b",{text:(o.a?"⚠ ":"")+o.o+": "}),o.r)}))));
    if((d.dias||[]).length){
      var COLD=[["coco","Cocôs"],["xixi","Xixis"],["fraldas","Fraldas"],["mamadas","Mamadas"],["peito","Só peito"],["formula","Só fórmula"],["mistas","Mistas"],["peitoMin","Peito (min)"],["formulaMl","Fórmula (ml)"],["maternoMl","Leite materno (ml)"],["ordenhaMl","Ordenha (ml)"],["remedios","Remédios"]]
        .filter(function(c){return d.dias.some(function(x){return x[c[0]]!=null})});
      var tbd=h("table",{class:"famtab famdiario"},h("thead",null,h("tr",null,h("th",{text:"Dia"}),COLD.map(function(c){return h("th",{text:c[1]})}))),
        h("tbody",null,d.dias.map(function(x){var p=x.data.split("-");return h("tr",null,h("td",null,h("b",{text:p[2]+"/"+p[1]}),x.obs?h("span",{class:"sub",text:" ("+x.obs+")"}):null),
          COLD.map(function(c){var v=x[c[0]];return h("td",{class:c[0]==="remedios"?"sub":null,text:v==null?"—":String(v)})}))})));
      card.appendChild(h("details",{class:"famvals",open:""},h("summary",{text:"Ver os "+d.dias.length+" dias"}),h("div",{class:"famtabw"},tbd)))}
    if(typeof d.custo==="number")card.appendChild(h("details",{class:"famvals"},h("summary",{text:"Custo: "+brl(d.custo)}),
      h("ul",{class:"famori"},(d.itensCusto||[]).map(function(x){return h("li",{text:x[0]+": "+brl(x[1])})}))))}

  /* Importar histórico: um .json (montado a partir dos laudos) junto com os PDFs e fotos citados nele.
     O que já existe (mesmo tipo, data e título) é pulado, então dá para importar de novo sem duplicar. */
  function famImportar(quem,regs,pronto,fechar){
    var p=panel("Importar histórico","Escolha de uma vez o arquivo .json do histórico e os PDFs e fotos que ele cita (estão na mesma pasta).");
    var inp=h("input",{type:"file",multiple:"",accept:".json,application/json,image/*,video/*,application/pdf"}),st=h("p",{class:"sub",role:"status"});
    var ok=h("button",{type:"button",text:"Importar"}),canc=h("button",{type:"button",class:"ghostbtn",text:"Fechar"});canc.onclick=fechar;
    ok.onclick=function(){
      var fs=Array.prototype.slice.call(inp.files||[]),js=fs.filter(function(f){return /\.json$/i.test(f.name)})[0];
      if(!js){st.textContent="Inclua o arquivo .json do histórico.";return}
      var porNome={};fs.forEach(function(f){porNome[norm(f.name.normalize("NFC"))]=f});
      ok.disabled=true;st.textContent="Lendo o histórico…";
      /* compara com o que está na conta agora (não com a tela, que pode estar desatualizada) */
      Promise.all([js.text(),SB.from("registros").select("*").eq("quem",quem).then(sbOk)]).then(function(rr){
        var t=rr[0];regs=rr[1];
        var j=JSON.parse(t),lista=(j.registros||[]).filter(function(r){return r.tipo&&r.data&&r.titulo});
        if(j.quem&&j.quem!==quem)throw new Error("esse histórico é de "+j.quem);
        var existe={};regs.forEach(function(r){existe[r.tipo+"|"+r.data+"|"+norm(r.titulo)]=1});
        /* "juntar": completa um registro que já existe (mesmo tipo e data) com arquivos, remédios e texto que faltam */
        function alvoDe(r){var l=regs.filter(function(x){return x.tipo===r.tipo&&x.data===r.data});return l.filter(function(x){return norm(x.titulo)===norm(r.titulo)})[0]||l[0]||null}
        function pegarArquivos(r,ja){var tem={};(ja||[]).forEach(function(a){tem[norm(String(a.nome).normalize("NFC"))]=1});
          return (r.arquivos||[]).filter(function(n){return !tem[norm(String(n).normalize("NFC"))]}).map(function(n){var f=porNome[norm(String(n).normalize("NFC"))];
            /* um registro, um arquivo citado e um só arquivo escolhido: vale mesmo com outro nome (ex.: moto.jpeg em vez de Foto da moto.jpg) */
            if(!f&&lista.length===1&&(r.arquivos||[]).length===1&&outros.length===1)f=outros[0];
            if(!f)faltam.push(n);return f}).filter(Boolean)}
        var faltam=[],feitos=0,criados=0,juntados=0,iguais=0,outros=fs.filter(function(f){return f!==js});
        var fila=lista.filter(function(r){return r.juntar||!existe[r.tipo+"|"+r.data+"|"+norm(r.titulo)]});
        iguais=lista.length-fila.length;
        if(!fila.length){st.textContent="Tudo desse histórico já está aqui.";ok.disabled=false;return}
        return fila.reduce(function(pr,r){return pr.then(function(){
          feitos++;st.textContent="Salvando "+feitos+" de "+fila.length+": "+r.titulo+"…";
          var alvo=r.juntar?alvoDe(r):null;
          if(alvo){
            var upd={},nd=r.dados?juntarDados(alvo.dados,r.dados):null,arqs=pegarArquivos(r,alvo.arquivos);
            if(nd)upd.dados=nd;
            if(r.detalhes&&(alvo.detalhes||"").indexOf(r.detalhes)<0)upd.detalhes=(alvo.detalhes?alvo.detalhes+"\n\n":"")+r.detalhes;
            if(!Object.keys(upd).length&&!arqs.length){iguais++;return}
            juntados++;
            return (arqs.length?enviarArquivos(quem,alvo.id,arqs,function(x){st.textContent=r.titulo+": "+x.toLowerCase()}):Promise.resolve([])).then(function(up){
              if(up.length)upd.arquivos=(alvo.arquivos||[]).concat(up);
              return SB.from("registros").update(upd).eq("id",alvo.id).then(sbOk)})}
          criados++;
          var dados={quem:quem,tipo:r.tipo,data:r.data,titulo:r.titulo,valor:r.valor||null,proxima:r.proxima||null,detalhes:r.detalhes||null};
          if(r.dados)dados.dados=r.dados;
          return SB.from("registros").insert(dados).select("id,arquivos").single().then(sbOk).then(function(row){
            var arqs=pegarArquivos(r,[]);
            if(!arqs.length)return;
            return enviarArquivos(quem,row.id,arqs,function(x){st.textContent=r.titulo+": "+x.toLowerCase()}).then(function(up){return SB.from("registros").update({arquivos:up}).eq("id",row.id).then(sbOk)})})})},Promise.resolve())
          .then(function(){st.textContent="✓ "+criados+(criados===1?" registro novo":" registros novos")+(juntados?", "+juntados+" completados":"")+(iguais?" ("+iguais+" já estavam aqui)":"")+"."+(faltam.length?" Faltaram estes arquivos: "+faltam.join(", ")+". Importe de novo escolhendo-os junto com o .json, ou anexe pelo Editar.":"");
            setTimeout(pronto,faltam.length?6000:1500)})
      }).catch(function(e){ok.disabled=false;logErro("importação",e,{quem:quem});
        st.textContent=/dados/.test(e.message)&&/column|schema/i.test(e.message)?"Falta rodar o supabase/005_registros_dados.sql no Supabase (uma vez) para guardar os valores dos exames.":"Não consegui importar: "+e.message})};
    p.appendChild(h("div",{class:"wform"},inp,h("div",{class:"vfil"},ok,canc),st));return p}

  /* Miniatura da 1ª página do PDF (pdf.js, carregado só quando aparece um PDF na tela); tocar abre o arquivo */
  var PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",PDFW="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",pdfLib=null;
  function pdfjs(){
    if(!pdfLib)pdfLib=new Promise(function(res,rej){var sc=document.createElement("script");sc.src=PDFJS;
      sc.onload=function(){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFW;res(window.pdfjsLib)};sc.onerror=function(){pdfLib=null;rej(new Error("pdf.js"))};document.head.appendChild(sc)});
    return pdfLib}
  var pdfObs="IntersectionObserver" in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){pdfObs.unobserve(e.target);e.target._desenhar()}})},{rootMargin:"300px"}):null;
  function pdfMini(url,nome){
    var cv=h("canvas",{"aria-hidden":"true"}),a=h("a",{class:"fampdf",href:url,target:"_blank",rel:"noopener",title:"Abrir "+nome},h("span",{class:"fampg"},cv,h("span",{class:"fampdfx",text:"PDF"})),h("span",{class:"fampn",text:nome.replace(/\.pdf$/i,"")}));
    a._desenhar=function(){
      pdfjs().then(function(lib){return lib.getDocument({url:url}).promise}).then(function(doc){return doc.getPage(1)}).then(function(pg){
        var k=(160*(window.devicePixelRatio||1))/pg.getViewport({scale:1}).width,vp=pg.getViewport({scale:k});
        cv.width=Math.floor(vp.width);cv.height=Math.floor(vp.height);
        return pg.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise}).then(function(){a.classList.add("pronto")}).catch(function(){a.classList.add("falhou")})};
    if(pdfObs)pdfObs.observe(a);else setTimeout(a._desenhar,0);
    return a}


  /* ===== Veículos: Civic, moto e o C3 antigo. Mesmo motor de registros do Eddie e da Olivia, com resumo próprio ===== */
  var veicAtual=null;
  function renderVeiculos(qual){
    var lista=Object.keys(FAM).filter(ehVeic);
    try{veicAtual=lista.indexOf(qual)>=0?qual:(veicAtual||localStorage.getItem("rac-veic")||lista[0])}catch(e){veicAtual=lista[0]}
    if(lista.indexOf(veicAtual)<0)veicAtual=lista[0];
    var seg=$("#veicseg");seg.innerHTML="";
    lista.forEach(function(k){var b=h("button",{type:"button","aria-pressed":String(k===veicAtual),text:FAM[k].n});b.onclick=function(){try{localStorage.setItem("rac-veic",k)}catch(e){}renderVeiculos(k)};seg.appendChild(b)});
    renderFamilia(veicAtual)}
  /* maior quilometragem anotada (e quando) */
  function veicKm(regs){var m=null;regs.forEach(function(r){var k=dadosDe(r).km;if(typeof k==="number"&&(!m||k>m.km))m={km:k,data:r.data}});return m}
  /* ritmo de uso: km por dia entre a primeira e a última quilometragem do último ano (precisa de 20 dias) */
  function veicRitmo(regs){
    var pts=regs.map(function(r){return {data:r.data,km:dadosDe(r).km}}).filter(function(x){return typeof x.km==="number"&&x.data>=maisDias(hojeISO(),-365)}).sort(function(a,b){return a.data.localeCompare(b.data)});
    if(pts.length<2)return null;var a=pts[0],b=pts[pts.length-1],dias=(new Date(b.data)-new Date(a.data))/864e5;
    return dias>=20&&b.km>a.km?{kmDia:(b.km-a.km)/dias,de:a,ate:b}:null}
  /* custo por km (tudo que tem custo) e só do combustível, mais o consumo médio entre tanques, no mesmo período do ritmo */
  function veicCustos(regs,rit){
    if(!rit||rit.ate.km-rit.de.km<300)return null;var rod=rit.ate.km-rit.de.km,tot=0,comb=0;
    regs.forEach(function(r){var c=dadosDe(r).custo;if(typeof c!=="number"||r.data<=rit.de.data||r.data>rit.ate.data)return;tot+=c;if(r.tipo==="abastecimento")comb+=c});
    var ab=regs.filter(function(r){return r.tipo==="abastecimento"&&typeof dadosDe(r).km==="number"}).sort(function(a,b){return a.data.localeCompare(b.data)}),km=0,l=0;
    for(var i=1;i<ab.length;i++){var d=dadosDe(ab[i]);if(d.litros&&d.km>dadosDe(ab[i-1]).km){km+=d.km-dadosDe(ab[i-1]).km;l+=d.litros}}
    return {rod:rod,tot:tot,comb:comb,porKm:tot/rod,combKm:comb/rod,consumo:l?km/l:null}}
  function veicAgora(quem,regs,ir){
    var p=panel("Como "+(quem==="moto"?"a ":"o ")+FAM[quem].n+" está","Toque numa linha para ver o registro completo."),ul=h("ul",{class:"wl famagora"}),hoje=hojeISO(),km=veicKm(regs);
    function item(rot,val,sub,cls,r){var li=h("li",{class:(cls||"")+(r?" clic":""),tabindex:r?"0":null,role:r?"button":null},h("span",{class:"grow"},h("b",{text:rot}),sub?h("span",{class:"sub",text:sub}):null),val?h("span",{class:"end",text:val}):null);
      if(r){li.onclick=function(){ir({r:r})};li.onkeydown=function(e){if(e.key==="Enter")ir({r:r})}}ul.appendChild(li)}
    var rit=veicRitmo(regs);
    if(km)item("Quilometragem",fmtKm(km.km),"última anotada, em "+dataBR(km.data)+(rit?" · você roda uns "+fmtKm(Math.round(rit.kmDia*30))+" por mês":""));
    /* próxima revisão / troca de óleo: o registro mais recente de cada tipo que diz quando é a próxima */
    ["oleo","revisao"].forEach(function(t){
      var r=regs.filter(function(x){var d=dadosDe(x);return x.tipo===t&&(x.proxima||typeof d.proxKm==="number")}).sort(function(a,b){return b.data.localeCompare(a.data)})[0];if(!r)return;
      /* uma revisão depois da última troca de óleo também troca o óleo */
      var depois=t==="oleo"&&regs.filter(function(x){return x.tipo==="revisao"&&x.data>r.data}).sort(function(a,b){return b.data.localeCompare(a.data)})[0];
      if(depois){item("Troca de óleo","em dia","feita na revisão de "+dataBR(depois.data)+"; anote a próxima quando a oficina informar","bom",depois);return}
      /* um registro mais novo do mesmo tipo, sem próxima anotada, substitui o antigo */
      var novo=regs.filter(function(x){return x.tipo===t&&x.data>r.data}).sort(function(a,b){return b.data.localeCompare(a.data)})[0];
      if(novo){item(t==="oleo"?"Troca de óleo":"Revisão","em dia","feita em "+dataBR(novo.data)+"; anote a próxima quando a oficina informar","bom",novo);return}
      var d=dadosDe(r),falta=km&&typeof d.proxKm==="number"?d.proxKm-km.km:null,venc=(r.proxima&&r.proxima<hoje)||(falta!=null&&falta<=0);
      /* no seu ritmo, quando chega no km da próxima (e se isso vem antes da data marcada) */
      var prev=!venc&&falta!=null&&rit?maisDias(km.data,Math.ceil(falta/rit.kmDia)):null;if(prev&&r.proxima&&r.proxima<prev)prev=null;
      item(t==="oleo"?"Próxima troca de óleo":"Próxima revisão",venc?"atrasada":(falta!=null?"faltam "+fmtKm(falta):dataBR(r.proxima)),
        [typeof d.proxKm==="number"?"com "+fmtKm(d.proxKm):"",r.proxima?"ou até "+dataBR(r.proxima):"",prev?"no seu ritmo, por volta de "+dataBR(prev):"","última em "+dataBR(r.data)].filter(Boolean).join(" · "),venc?"alerta":(falta!=null&&falta<1500)||(prev&&prev<maisDias(hoje,30))?"alerta":null,r)});
    var cu=veicCustos(regs,rit);
    if(cu)item("Custo por km",brl(cu.porKm)+"/km",[brl(cu.tot)+" em "+fmtKm(cu.rod)+" desde "+dataBR(rit.de.data),cu.comb?"combustível "+brl(cu.combKm)+"/km":"",cu.consumo?"consumo médio "+fmtN(Math.round(cu.consumo*10)/10)+" km/l":""].filter(Boolean).join(" · "));
    var seg=regs.filter(function(x){return x.tipo==="seguro"&&dadosDe(x).vigenciaFim}).sort(function(a,b){return b.data.localeCompare(a.data)})[0];
    if(seg){var vf=seg.dados.vigenciaFim;item("Seguro: "+(seg.valor||seg.titulo),vf<hoje?"vencido":"até "+dataBR(vf),vf<hoje?"venceu em "+dataBR(vf):"vigente",vf<hoje||vf<maisDias(hoje,30)?"alerta":"bom",seg)}
    var bat=regs.filter(function(x){return x.tipo==="bateria"}).sort(function(a,b){return b.data.localeCompare(a.data)})[0];
    if(bat){var ga=dadosDe(bat).garantiaAte;item(bat.titulo,ga?(ga<hoje?"fora da garantia":"garantia até "+dataBR(ga)):"","trocada em "+dataBR(bat.data),null,bat)}
    var doc=regs.filter(function(x){return x.tipo==="documento"}).sort(function(a,b){return b.data.localeCompare(a.data)})[0];
    if(doc)item(doc.titulo,"pago","em "+dataBR(doc.data),null,doc);
    /* avisos das oficinas que ainda não foram resolvidos (o registro mais recente com aviso) */
    regs.filter(function(x){return (dadosDe(x).alertas||[]).length}).sort(function(a,b){return b.data.localeCompare(a.data)}).slice(0,2)
      .forEach(function(r){r.dados.alertas.forEach(function(a){item("Aviso da oficina ("+dataBR(r.data)+")","",a,"alerta",r)})});
    if(!ul.children.length)return null;
    p.appendChild(ul);return p}
  /* consumo: entre dois abastecimentos de tanque cheio, km rodados ÷ litros do segundo */
  function veicConsumo(regs){
    var ab=regs.filter(function(r){return r.tipo==="abastecimento"}).sort(function(a,b){return a.data.localeCompare(b.data)});if(!ab.length)return null;
    var p=panel("Abastecimentos",ab.length+(ab.length===1?" anotado":" anotados")),tb=h("table",{class:"famtab"});
    tb.appendChild(h("thead",null,h("tr",null,["Data","Km","Litros","R$/litro","Total","Consumo"].map(function(c){return h("th",{text:c})}))));
    tb.appendChild(h("tbody",null,ab.map(function(r,i){var d=dadosDe(r),ant=ab[i-1]&&dadosDe(ab[i-1]),c=ant&&typeof ant.km==="number"&&typeof d.km==="number"&&d.litros?(d.km-ant.km)/d.litros:null;
      return h("tr",null,h("td",{text:dataBR(r.data)}),h("td",{text:typeof d.km==="number"?fmtKm(d.km):"—"}),h("td",{text:d.litros?fmtN(d.litros):"—"}),h("td",{text:d.precoLitro?brl(d.precoLitro):"—"}),
        h("td",{text:typeof d.custo==="number"?brl(d.custo):"—"}),h("td",{text:c?fmtN(Math.round(c*100)/100)+" km/l":"—"}))})));
    p.appendChild(h("div",{class:"famtabw"},tb));return p}

  function renderFamilia(quem){
    var root=$("#"+(FAM[quem].root||quem+"-view")),F=FAM[quem],merc=[];root.innerHTML="";
    root.appendChild(h("div",{class:"panel"},loading()));
    SB.from("registros").select("*").eq("quem",quem).order("data",{ascending:false}).order("criado_em",{ascending:false}).then(sbOk).then(function(regs){
      var paths=[];regs.forEach(function(r){(r.arquivos||[]).forEach(function(a){paths.push(a.path)})});
      var urls={};
      return Promise.all([paths.length?SB.storage.from("familia").createSignedUrls(paths,3600).then(function(r){(r.data||[]).forEach(function(x){if(x.signedUrl)urls[x.path]=x.signedUrl})}):null,famMercado(quem,regs)])
        .then(function(r){merc=r[1];desenhar(regs,urls)})
    }).catch(function(e){logErro("família ("+quem+")",e);root.innerHTML="";root.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:/registros|relation|schema cache/i.test(e.message)?"Falta rodar o supabase/004_familia.sql no Supabase para ligar esta área.":"Não consegui carregar ("+e.message+")."})))});

    function desenhar(regs,urls){
      root.innerHTML="";
      var fotoBg=regs.filter(function(r){return dadosDe(r).perfil}).map(function(r){return (r.arquivos||[]).filter(function(a){return urls[a.path]&&/^image\//.test(a.tipo)})[0]}).filter(Boolean)[0];
      /* só troca o fundo se a pessoa ainda estiver nesta página quando os links chegarem */
      var topoH=(location.hash||"").replace("#","").split("/")[0];
      if(topoH===quem||(ehVeic(quem)&&topoH==="veiculos"))fundoPagina(fotoBg?urls[fotoBg.path]:null,F.n,ehVeic(quem));
      var nasc=regs.filter(function(r){return r.tipo==="nascimento"})[0],ultPeso=regs.filter(function(r){return r.tipo==="peso"&&r.valor})[0];
      var foto=regs.filter(function(r){return dadosDe(r).perfil&&(r.arquivos||[]).some(function(a){return urls[a.path]&&/^image\//.test(a.tipo)})})[0];
      var add=h("button",{type:"button",class:"mkadd",text:"+ Adicionar registro"}),imp=h("button",{type:"button",class:"ghostbtn",text:"Importar histórico"}),abf=ehVeic(quem)?h("button",{type:"button",class:"ghostbtn",text:"⛽ Abastecimento pela foto"}):null,akm=ehVeic(quem)?h("button",{type:"button",class:"ghostbtn",text:"Atualizar km"}):null;
      var topo=h("div",{class:"panel famhead"},foto?h("img",{class:"famav",src:urls[foto.arquivos.filter(function(a){return /^image\//.test(a.tipo)})[0].path],alt:F.n}):null,
        h("div",{class:"grow"},h("h2",{text:F.n}),
        h("p",{class:"sub",text:F.docs?"Documentos, garantias, notas fiscais e contratos da casa. O que tem validade entra na Agenda.":ehVeic(quem)?[(regs.filter(function(r){return dadosDe(r).ficha})[0]||{dados:{ficha:F.desc}}).dados.ficha,(function(){var k=veicKm(regs);return k?fmtKm(k.km)+" em "+dataBR(k.data):""})()].filter(Boolean).join(" · "):[nasc?idadeTxt(nasc.data)+" (nasceu em "+dataBR(nasc.data)+")":"Adicione um registro “Nascimento” para mostrar a idade",ultPeso?"último peso "+ultPeso.valor+" kg em "+dataBR(ultPeso.data):""].filter(Boolean).join(" · ")})),
        h("div",{class:"vfil famacoes"},add,akm,abf,imp));
      root.appendChild(topo);
      var formBox=h("div");root.appendChild(formBox);
      add.onclick=function(){abrirForm(null)};
      if(akm)akm.onclick=function(){formBox.innerHTML="";formBox.appendChild(veicKmForm(quem,regs,function(){renderFamilia(quem)},function(){formBox.innerHTML=""}));formBox.scrollIntoView({behavior:"smooth",block:"start"})};
      if(abf)abf.onclick=function(){formBox.innerHTML="";formBox.appendChild(veicFoto(quem,regs,function(q){try{localStorage.setItem("rac-veic",q)}catch(e){}if(location.hash!=="#veiculos/"+q)location.hash="#veiculos/"+q;else renderVeiculos(q)},function(){formBox.innerHTML=""}));formBox.scrollIntoView({behavior:"smooth",block:"start"})};
      imp.onclick=function(){formBox.innerHTML="";formBox.appendChild(famImportar(quem,regs,function(){renderFamilia(quem)},function(){formBox.innerHTML=""}));formBox.scrollIntoView({behavior:"smooth",block:"start"})};
      function abrirForm(reg){formBox.innerHTML="";formBox.appendChild(famForm(quem,reg,function(){renderFamilia(quem)},function(){formBox.innerHTML=""}));formBox.scrollIntoView({behavior:"smooth",block:"start"})}
      if(!regs.length){root.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:F.docs?"Nada guardado ainda. Toque em “Adicionar registro” para guardar o primeiro documento, garantia ou nota fiscal (com foto ou PDF e a validade).":"Nada registrado ainda. Toque em “Adicionar registro” para lançar o primeiro exame, vacina ou foto, ou em “Importar histórico”."})));return}
      /* quatro jeitos de ver: resumo, exames, remédios e a linha do tempo completa */
      var temSaude=ehVeic(quem)||F.bebe||regs.some(function(r){var d=dadosDe(r);return d.laudo||d.orgaos||d.meds});
      var vistas=ehVeic(quem)?[["resumo","Resumo"],["linha","Linha do tempo"]]:F.bebe?[["resumo","Resumo"],["diadia","Dia a dia"],["crescimento","Crescimento e vacinas"],["meses","Mês a mês"],["exames","Exames"],["remedios","Remédios"],["linha","Linha do tempo"]]:[["resumo","Resumo"],["exames","Exames"],["remedios","Remédios"],["linha","Linha do tempo"]];
      if(!temSaude)famVista[quem]="linha";
      var vista=famVista[quem],seg=h("div",{class:"seg famseg famvista",role:"group","aria-label":"Ver"});
      if(temSaude){vistas.forEach(function(v){var b=h("button",{type:"button","aria-pressed":vista===v[0]?"true":"false",text:v[1]});b.onclick=function(){famVista[quem]=v[0];desenhar(regs,urls)};seg.appendChild(b)});root.appendChild(seg)}
      function cards(lista,box){
        var ano=null;
        lista.forEach(function(r){
          var a=r.data.slice(0,4);if(a!==ano){ano=a;box.appendChild(h("h2",{class:"sec",text:a}))}
          var ti=tipoInfo(r.tipo),card=h("article",{class:"panel famcard","data-reg":r.id});
          card.appendChild(h("div",{class:"vpills"},h("span",{class:"vp",text:ti[1]}),h("span",{class:"when",text:dataBR(r.data)}),r.proxima?h("span",{class:"sub",text:"próxima: "+dataBR(r.proxima)}):null));
          card.appendChild(h("h3",{text:r.titulo}));
          if(r.valor)card.appendChild(h("p",null,h("b",{text:(ti[3]||"Valor")+": "}),r.valor+(r.tipo==="peso"&&/^[\d.,]+$/.test(r.valor)?" kg":"")));
          if(r.detalhes)card.appendChild(h("p",{class:"famdet",text:r.detalhes}));
          famDetalhe(card,r,regs);
          var arqs=r.arquivos||[];
          if(arqs.length){var g=h("div",{class:"famarq"});
            arqs.forEach(function(x){var u=urls[x.path];if(!u){g.appendChild(h("span",{class:"sub",text:x.nome}));return}
              if(/^image\//.test(x.tipo))g.appendChild(h("a",{href:u,target:"_blank",rel:"noopener",title:x.nome},h("img",{src:u,alt:x.nome,loading:"lazy"})));
              else if(/^video\//.test(x.tipo))g.appendChild(h("video",{src:u,controls:"",preload:"metadata",playsinline:""}));
              else if(/pdf/i.test(x.tipo)||/\.pdf$/i.test(x.nome))g.appendChild(pdfMini(u,x.nome));
              else g.appendChild(ext(u,"📄 Abrir "+x.nome,"ghostbtn"))});
            card.appendChild(g)}
          var ed=h("button",{type:"button",class:"ghostbtn",text:"Editar"});ed.onclick=function(){abrirForm(r)};
          var del=h("button",{type:"button",class:"ghostbtn",text:"Apagar"}),armado=false;
          del.onclick=function(){
            if(!armado){armado=true;del.textContent="Toque de novo para apagar";del.classList.add("danger");setTimeout(function(){armado=false;del.textContent="Apagar";del.classList.remove("danger")},5000);return}
            del.disabled=true;
            var ps=(r.arquivos||[]).map(function(x){return x.path});
            (ps.length?SB.storage.from("familia").remove(ps):Promise.resolve()).then(function(){return SB.from("registros").delete().eq("id",r.id).then(sbOk)}).then(function(){renderFamilia(quem)})
              .catch(function(e){del.disabled=false;del.textContent="Não apagou ("+e.message+")"})};
          card.appendChild(h("div",{class:"vfoot"},ed,del));
          box.appendChild(card)})}
      /* do Resumo para o registro: troca de vista, rola até o cartão e abre os detalhes */
      function ir(a){
        famAlvo[quem]=a.r?{id:a.r.id,custo:a.custo}:null;
        if(a.vista)famVista[quem]=a.vista;
        else{famVista[quem]=/^(exame|pedido)$/.test(a.r.tipo)?"exames":"linha";famFiltro[quem]=a.filtro||""}
        desenhar(regs,urls);if(!famAlvo[quem])root.scrollIntoView({behavior:"smooth",block:"start"})}
      function irAoAlvo(){
        var a=famAlvo[quem];famAlvo[quem]=null;if(!a)return;
        var c=root.querySelector('[data-reg="'+a.id+'"]');if(!c)return;
        c.querySelectorAll("details").forEach(function(d){if(!/^Custo/.test(d.querySelector("summary").textContent)||a.custo)d.open=true});
        c.classList.add("alvo");setTimeout(function(){c.classList.remove("alvo")},2600);
        setTimeout(function(){c.scrollIntoView({behavior:"smooth",block:"start"})},30)}
      var box=h("div",{class:"stack"});root.appendChild(box);
      if(vista==="resumo"&&ehVeic(quem)){[veicAgora(quem,regs,ir),veicConsumo(regs),famGastos(regs,ir,quem)].forEach(function(x){if(x)box.appendChild(x)});return}
      if(vista==="resumo"){[famAgora(quem,regs,ir),famPeso(regs,quem),famGastos(regs.concat(merc),ir,quem)].forEach(function(x){if(x)box.appendChild(x)});return}
      if(vista==="exames"){[famComparaSangue(regs),famComparaUS(regs)].forEach(function(x){if(x)box.appendChild(x)});
        cards(regs.filter(function(r){return r.tipo==="exame"||r.tipo==="pedido"}),box);irAoAlvo();return}
      if(vista==="remedios"){var t=famTratamentos(regs);if(t)box.appendChild(t);return}
      /* bebê: diário do Napper, curvas da OMS e vacinas, e mês a mês (módulo js/bebe.js, carregado aqui) */
      if(/^(diadia|crescimento|meses)$/.test(vista)){box.appendChild(h("p",{class:"sub",text:"Carregando…"}));precisa(["bebe"]).then(function(){box.innerHTML="";
        if(vista==="diadia")bebeDiaDia(box,quem);else if(vista==="crescimento")bebeCrescimento(box,quem,regs);else{(BEBE.evs?Promise.resolve():bebeCarregar(quem).catch(function(){})).then(function(){bebeMeses(box,quem,regs,urls)})}})
        .catch(function(e){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:"Não consegui abrir ("+e.message+")."}))});return}
      /* linha do tempo: filtro por tipo */
      var usados=tiposDe(quem).filter(function(t){return regs.some(function(r){return r.tipo===t[0]})});
      var fseg=h("div",{class:"seg famseg",role:"group","aria-label":"Tipo"});
      [["","Tudo"]].concat(usados).forEach(function(t){var b=h("button",{type:"button","aria-pressed":famFiltro[quem]===t[0]?"true":"false",text:t[1]});b.onclick=function(){famFiltro[quem]=t[0];desenhar(regs,urls)};fseg.appendChild(b)});
      box.appendChild(fseg);
      cards(regs.filter(function(r){return !famFiltro[quem]||r.tipo===famFiltro[quem]}),box);irAoAlvo()}
  }

  /* Abastecimento pela foto: o Claude lê a foto do painel (km) e a da bomba (litros, R$/litro e total)
     e devolve um JSON; aqui a pessoa cola, confere e salva no veículo certo ("carro" ou "moto" na mensagem) */
  var PEDIDO_ABAST="Leia as fotos deste abastecimento: uma do painel (quilometragem) e uma da bomba (litros, preço por litro e total). Responda só com este JSON, sem texto antes ou depois:\n"+
    '{"veiculo":"carro ou moto","data":"AAAA-MM-DD","km":0,"litros":0,"preco_litro":0,"total":0,"combustivel":"gasolina, etanol ou diesel","posto":""}\n'+
    "Regras: veiculo é o que eu escrever na mensagem (carro ou moto). km é o hodômetro total do painel, não o parcial (trip). Use ponto como separador decimal e não use separador de milhar. "+
    "Se a data não aparecer nas fotos, use null. Se não conseguir ler um número, use null.";
  function veicFoto(quem,regs,pronto,fechar){
    var p=panel("Abastecimento pela foto","O Claude lê as duas fotos; você cola a resposta aqui, confere e salva."),f=h("div",{class:"wform"});
    var CH_LINK="rac-claude-abast";function link(){try{return localStorage.getItem(CH_LINK)||""}catch(e){return ""}}
    var cmsg=h("p",{class:"sub",role:"status"}),pedTxt=h("textarea",{class:"qrpaste",rows:"4",readonly:"",hidden:"","aria-label":"Pedido para copiar"});pedTxt.value=PEDIDO_ABAST;
    var abrir=h("a",{class:"filebtn",target:"_blank",rel:"noopener"});
    abrir.onclick=function(){try{navigator.clipboard.writeText(PEDIDO_ABAST).then(function(){cmsg.textContent=link()?"✓ Pedido copiado (só precisa colar se o projeto ainda não tiver as instruções).":"✓ Pedido copiado. No Claude: anexe as 2 fotos, escreva carro ou moto, cole o pedido e envie."},function(){pedTxt.hidden=false})}catch(e){pedTxt.hidden=false}};
    var trocar=h("button",{type:"button",class:"ghostbtn"}),lform=h("div",{class:"vfil",hidden:""}),lin=h("input",{type:"url",placeholder:"https://claude.ai/project/…","aria-label":"Link do projeto do Claude",autocomplete:"off"}),lok=h("button",{type:"button",text:"Salvar"}),lmsg=h("p",{class:"sub",role:"status"});
    function mostrar(){var l=link();abrir.href=l||"https://claude.ai/new";abrir.textContent=l?"Abrir o Claude (projeto Abastecimento)":"Abrir o Claude";trocar.textContent=l?"Trocar o projeto":"Usar o meu projeto de abastecimento"}
    trocar.onclick=function(){lform.hidden=!lform.hidden;lin.value=link();lmsg.textContent="";if(!lform.hidden)lin.focus()};
    lok.onclick=function(){var v=lin.value.trim();
      if(v&&!/^https:\/\/claude\.ai\/(chat|project)\/[\w-]+/.test(v)){lmsg.textContent="O link precisa começar com https://claude.ai/project/ (ou /chat/). Copie o endereço da barra do navegador com o projeto aberto.";return}
      try{if(v)localStorage.setItem(CH_LINK,v);else localStorage.removeItem(CH_LINK)}catch(e){}lform.hidden=true;lmsg.textContent=v?"✓ Pronto: o botão agora abre o seu projeto.":"Voltou a abrir uma conversa nova.";mostrar()};
    lform.appendChild(lin);lform.appendChild(lok);mostrar();
    f.appendChild(h("ol",{class:"how"},h("li",null,"Tire as duas fotos: o painel com a quilometragem e a bomba com o total abastecido."),
      h("li",null,"Toque em Abrir o Claude, anexe as fotos, escreva ",h("b",{text:"carro"})," ou ",h("b",{text:"moto"})," e envie."),
      h("li",null,"Copie a resposta inteira, volte aqui e toque em ",h("b",{text:"Colar a resposta"}),".")));
    f.appendChild(h("div",{class:"vfil"},abrir,trocar));f.appendChild(lform);f.appendChild(lmsg);f.appendChild(cmsg);f.appendChild(pedTxt);
    var resp=h("textarea",{class:"qrpaste",rows:"3",placeholder:"…ou cole aqui a resposta","aria-label":"Resposta do Claude"}),colar=h("button",{type:"button",text:"Colar a resposta"}),fch=h("button",{type:"button",class:"ghostbtn",text:"Fechar"}),rmsg=h("p",{class:"sub",role:"status"});
    colar.onclick=function(){if(!navigator.clipboard||!navigator.clipboard.readText){resp.focus();return}navigator.clipboard.readText().then(function(t){resp.value=t;ler()},function(){rmsg.textContent="Toque no quadro abaixo e cole.";resp.focus()})};
    fch.onclick=fechar;resp.addEventListener("input",function(){ler()});
    f.appendChild(h("div",{class:"vfil"},colar,fch));f.appendChild(resp);f.appendChild(rmsg);
    /* conferência: tudo editável antes de salvar */
    var conf=h("div",{class:"wform",hidden:""});
    var veic=h("select",{"aria-label":"Veículo"},Object.keys(FAM).filter(ehVeic).map(function(k){return h("option",{value:k,selected:k===quem?"":null,text:FAM[k].n})}));
    var data=h("input",{type:"date",value:hojeISO()}),km=h("input",{type:"text",inputmode:"numeric"}),lit=h("input",{type:"text",inputmode:"decimal"}),pre=h("input",{type:"text",inputmode:"decimal"}),tot=h("input",{type:"text",inputmode:"decimal"});
    var comb=h("select",{"aria-label":"Combustível"},["gasolina","etanol","diesel"].map(function(c){return h("option",{value:c,text:c.charAt(0).toUpperCase()+c.slice(1)})})),posto=h("input",{type:"text",placeholder:"Ex.: Posto Shell"});
    var arq=h("input",{type:"file",multiple:"",accept:"image/*"}),aviso=h("p",{class:"qrwarn",hidden:""});
    conf.appendChild(h("div",{class:"two"},h("label",null,"Veículo",veic),h("label",null,"Data",data)));
    conf.appendChild(h("div",{class:"two"},h("label",null,"Quilometragem do painel",km),h("label",null,"Litros",lit)));
    conf.appendChild(h("div",{class:"two"},h("label",null,"Preço por litro (R$)",pre),h("label",null,"Total pago (R$)",tot)));
    conf.appendChild(h("div",{class:"two"},h("label",null,"Combustível",comb),h("label",null,"Posto (opcional)",posto)));
    conf.appendChild(h("label",null,"As duas fotos (para guardar junto)",arq));conf.appendChild(aviso);
    function br(v,c){return v==null?"":v.toLocaleString("pt-BR",{minimumFractionDigits:c,maximumFractionDigits:c})}
    function num(s){s=String(s||"").replace(/[R$\s]/g,"");if(!s)return null;if(/,/.test(s))s=s.replace(/\./g,"").replace(",",".");var x=parseFloat(s);return isFinite(x)?x:null}
    function ler(){
      if(!resp.value.trim()){rmsg.textContent="";return}
      var r=lerAbast(resp.value);
      if(r.km==null&&r.litros==null&&r.total==null){rmsg.textContent="Não achei km, litros nem total nessa resposta. Copie a resposta inteira do Claude.";conf.hidden=true;return}
      if(r.veiculo)veic.value=r.veiculo;if(r.data)data.value=r.data;km.value=r.km!=null?String(r.km):"";lit.value=br(r.litros,2);pre.value=br(r.preco,3);tot.value=br(r.total,2);
      var cb=/gasolina|etanol|diesel/.exec(r.combustivel);if(cb)comb.value=cb[0];if(r.posto)posto.value=r.posto;
      rmsg.textContent="✓ Li a resposta. Confira os valores abaixo e salve."+(r.veiculo?"":" Escolha o veículo (a resposta não disse se é carro ou moto).");conf.hidden=false;conferir()}
    /* avisa o que parece errado: conta que não fecha ou km menor que o último anotado */
    function conferir(){var L=num(lit.value),P=num(pre.value),T=num(tot.value),K=parseInt(km.value.replace(/\D/g,""),10),avs=[];
      if(L&&P&&T&&Math.abs(L*P-T)>Math.max(1,T*0.02))avs.push("Litros × preço dá "+brl(Math.round(L*P*100)/100)+", diferente do total. Confira na foto da bomba.");
      if(K&&veic.value===quem){var ult=veicKm(regs);if(ult&&K<ult.km)avs.push("A quilometragem é menor que a última anotada ("+fmtKm(ult.km)+" em "+dataBR(ult.data)+"). Confira se não leu o parcial (trip).")}
      aviso.textContent=avs.map(function(a){return "⚠ "+a}).join(" ");aviso.hidden=!avs.length}
    [km,lit,pre,tot,veic].forEach(function(x){x.addEventListener("change",conferir)});
    var st=h("p",{class:"sub",role:"status"}),salvar=h("button",{type:"button",text:"Salvar abastecimento"}),canc=h("button",{type:"button",class:"ghostbtn",text:"Cancelar"});
    canc.onclick=fechar;
    salvar.onclick=function(){
      var K=parseInt(km.value.replace(/\D/g,""),10),L=num(lit.value),P=num(pre.value),T=num(tot.value);
      if(!data.value){st.textContent="Escolha a data.";return}
      if(!(T>0)&&!(L>0)){st.textContent="Preencha pelo menos os litros ou o total.";return}
      if(T==null&&L&&P)T=Math.round(L*P*100)/100;
      var c=comb.value,tit=c.charAt(0).toUpperCase()+c.slice(1)+(posto.value.trim()?" ("+posto.value.trim()+")":""),q=veic.value;
      var dd={combustivel:c};if(K>0)dd.km=K;if(L>0)dd.litros=L;if(P>0)dd.precoLitro=P;if(T>0){dd.custo=Math.round(T*100)/100;dd.itensCusto=[[L?fmtN(L)+" l de "+c:c,dd.custo]]}
      var reg={quem:q,tipo:"abastecimento",data:data.value,titulo:tit,valor:posto.value.trim()||null,detalhes:[L?fmtN(L)+" litros":"",P?"a "+brl(P)+"/l":"",T?"total "+brl(T):""].filter(Boolean).join(" ")||null,dados:dd};
      salvar.disabled=true;st.textContent="Salvando…";
      SB.from("registros").insert(reg).select("id,arquivos").single().then(sbOk).then(function(row){
        if(!arq.files.length)return;
        return enviarArquivos(q,row.id,arq.files,function(t){st.textContent=t}).then(function(novos){return SB.from("registros").update({arquivos:(row.arquivos||[]).concat(novos)}).eq("id",row.id).then(sbOk)})
      }).then(function(){pronto(q)}).catch(function(e){salvar.disabled=false;st.textContent="Não consegui salvar: "+e.message})};
    conf.appendChild(h("div",{class:"vfil"},salvar,canc));conf.appendChild(st);
    f.appendChild(conf);p.appendChild(f);return p}

  /* Formulário de registro: tipo, data, título, valor, próxima data, detalhes e arquivos */
  function famForm(quem,reg,pronto,cancelar){
    var p=panel(reg?"Editar registro":"Novo registro "+(ehVeic(quem)?"do ":"de ")+FAM[quem].n),f=h("div",{class:"wform"});
    var tipo=h("select",{"aria-label":"Tipo"},tiposDe(quem).map(function(t){return h("option",{value:t[0],selected:(reg?reg.tipo:(ehVeic(quem)?"revisao":"exame"))===t[0]?"":null,text:t[1]})}));
    var data=h("input",{type:"date",value:reg?reg.data:hojeISO()}),titulo=h("input",{type:"text",value:reg?reg.titulo:""});
    var valor=h("input",{type:"text",value:reg&&reg.valor||""}),prox=h("input",{type:"date",value:reg&&reg.proxima||""});
    /* quanto custou (consulta, remédio, lata de fórmula, pacote de fraldas…): entra no quadro de gastos */
    var custoV=reg&&reg.dados&&typeof reg.dados.custo==="number"?reg.dados.custo:null;
    var custo=h("input",{type:"text",inputmode:"decimal",placeholder:"Ex.: 80,00",value:custoV!=null?custoV.toLocaleString("pt-BR",{minimumFractionDigits:2}):""});
    var det=h("textarea",{rows:"3",placeholder:"Contexto: como foi, o que o veterinário ou o pediatra disse, valores importantes…"});det.value=reg&&reg.detalhes||"";
    var arq=h("input",{type:"file",multiple:"",accept:"image/*,video/*,application/pdf"});
    var lValor=h("label",null,h("span"),valor),lProx=h("label",null,h("span"),prox);
    function ajustar(){var t=tipoInfo(tipo.value);titulo.placeholder=t[2]||"Título";lValor.firstChild.textContent=t[3]||"Valor (opcional)";lValor.hidden=!t[3];
      lProx.firstChild.textContent=FAM[quem].docs?"Vence em (opcional)":/^(vacina|preventivo)$/.test(tipo.value)?"Próxima dose":"Retorno (opcional)";lProx.hidden=!FAM[quem].docs&&!/^(vacina|consulta|exame|preventivo|tratamento)$/.test(tipo.value)}
    tipo.addEventListener("change",ajustar);ajustar();
    f.appendChild(h("div",{class:"two"},h("label",null,"Tipo",tipo),h("label",null,"Data",data)));
    f.appendChild(h("label",null,"Título",titulo));
    f.appendChild(h("div",{class:"two"},lValor,lProx));
    f.appendChild(h("label",null,"Quanto custou (R$, opcional)",custo));
    var rd=reg&&reg.dados||{},kmI=h("input",{type:"text",inputmode:"numeric",placeholder:"Ex.: 103372",value:rd.km!=null?String(rd.km):""}),pkI=h("input",{type:"text",inputmode:"numeric",placeholder:"Ex.: 108500",value:rd.proxKm!=null?String(rd.proxKm):""});
    if(ehVeic(quem))f.appendChild(h("div",{class:"two"},h("label",null,"Quilometragem (opcional)",kmI),h("label",null,"Próxima com quantos km (opcional)",pkI)));
    f.appendChild(h("label",null,"Detalhes",det));
    f.appendChild(h("label",null,reg&&(reg.arquivos||[]).length?"Mais arquivos (fotos, PDFs, vídeos de até 50 MB)":"Arquivos (fotos, PDFs, vídeos de até 50 MB)",arq));
    var st=h("p",{class:"sub",role:"status"}),salvar=h("button",{type:"button",text:"Salvar"}),canc=h("button",{type:"button",class:"ghostbtn",text:"Cancelar"});
    canc.onclick=cancelar;
    salvar.onclick=function(){
      if(!titulo.value.trim()){st.textContent="Escreva um título.";titulo.focus();return}
      if(!data.value){st.textContent="Escolha a data.";return}
      salvar.disabled=true;st.textContent="Salvando…";
      var dados={quem:quem,tipo:tipo.value,data:data.value,titulo:titulo.value.trim(),valor:valor.value.trim()||null,proxima:lProx.hidden?null:(prox.value||null),detalhes:det.value.trim()||null};
      var cv=custo.value.trim().replace(/[R$\s]/g,""),cn=cv?parseFloat(/,/.test(cv)?cv.replace(/\./g,"").replace(",","."):cv):null;
      if(cv&&!(cn>=0)){st.textContent="O valor precisa ser um número, como 80,00.";salvar.disabled=false;return}
      if(cn!=null||(reg&&reg.dados&&reg.dados.custo!=null)){var dd0=Object.assign({},reg&&reg.dados||{});
        if(cn!=null){dd0.custo=Math.round(cn*100)/100;if(!dd0.itensCusto||dd0.itensCusto.length<2)dd0.itensCusto=[[titulo.value.trim(),dd0.custo]]}else{delete dd0.custo;delete dd0.itensCusto}
        dados.dados=dd0}
      if(ehVeic(quem)){var dv=Object.assign({},dados.dados||reg&&reg.dados||{});
        [["km",kmI],["proxKm",pkI]].forEach(function(x){var v=parseInt(x[1].value.replace(/\D/g,""),10);if(v>0)dv[x[0]]=v;else delete dv[x[0]]});
        dados.dados=dv}
      var passo=reg?SB.from("registros").update(dados).eq("id",reg.id).select("id,arquivos").single():SB.from("registros").insert(dados).select("id,arquivos").single();
      passo.then(sbOk).then(function(row){
        if(!arq.files.length)return;
        return enviarArquivos(quem,row.id,arq.files,function(t){st.textContent=t}).then(function(novos){
          return SB.from("registros").update({arquivos:(row.arquivos||[]).concat(novos)}).eq("id",row.id).then(sbOk)})
      }).then(pronto).catch(function(e){salvar.disabled=false;st.textContent="Não consegui salvar: "+e.message})};
    f.appendChild(h("div",{class:"vfil"},salvar,canc));f.appendChild(st);
    p.appendChild(f);return p}
