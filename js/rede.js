/* Dia a Dia RAC — módulo carregado quando a seção abre. Rede em Sorocaba: as pessoas de RH e recrutamento das empresas da região
   (quem são, em que pé está o contato, quando os posts foram vistos pela última vez), buscas prontas do LinkedIn e modelos de mensagem.
   Nada aqui entra no LinkedIn sozinho (o LinkedIn proíbe robôs): os links abrem a busca e a pessoa faz o resto.
   Os contatos ficam na tabela "registros" (quem "rede"), compartilhada com quem está na casa. Usa as funções do núcleo (js/app.js). */
  var REDE={regs:null,editando:null};
  var REDE_ST=[["achei","Achei o perfil"],["convite","Convite enviado"],["conectado","Conectados"],["conversa","Já conversamos"]];
  var REDE_DIAS=7;
  function redeLi(kw){return "https://www.linkedin.com/search/results/content/?keywords="+encodeURIComponent(kw)+"&sortBy=%22date_posted%22"}
  function redePessoas(kw){return "https://www.linkedin.com/search/results/people/?keywords="+encodeURIComponent(kw)}
  function redeVagas(kw,per){return "https://www.linkedin.com/jobs/search/?keywords="+encodeURIComponent(kw)+"&location="+encodeURIComponent("Sorocaba, São Paulo, Brasil")+"&distance=25&f_TPR="+per}
  var REDE_BUSCAS=[["Posts recentes (é onde o RH anuncia)",[["Vaga dados Sorocaba",redeLi("vaga dados Sorocaba")],["Vaga analista de dados Sorocaba",redeLi("vaga analista de dados Sorocaba")],
      ["Vaga BI / Power BI Sorocaba",redeLi("vaga Power BI Sorocaba")],["Vaga TI Sorocaba",redeLi("vaga TI Sorocaba")],["#vagas Sorocaba",redeLi("#vagas Sorocaba")]]],
    ["Pessoas de RH e recrutamento",[["Recrutadora Sorocaba",redePessoas("recrutadora Sorocaba")],["Tech recruiter Sorocaba",redePessoas("tech recruiter Sorocaba")],
      ["Talent acquisition Sorocaba",redePessoas("talent acquisition Sorocaba")],["Analista de RH Sorocaba",redePessoas("analista de RH Sorocaba")]]],
    ["Vagas abertas no LinkedIn",[["Analista de dados · últimas 24 h",redeVagas("analista de dados","r86400")],["Dados ou BI · última semana",redeVagas("dados OR BI OR \"Power BI\"","r604800")],
      ["TI · última semana",redeVagas("TI OR tecnologia","r604800")]]],
    ["Empresas",[["Empresas de Sorocaba","https://www.linkedin.com/search/results/companies/?keywords=Sorocaba"]]]];
  var REDE_MSG=[["Convite de conexão (cabe nos 300 caracteres)","Olá, {nome}! Estou em transição para a área de dados (SQL, Power BI e Python) e faço MBA em Data Science e Analytics na USP/Esalq. Moro em Sorocaba e acompanho as vagas da {empresa}; gostaria de me conectar para ficar por dentro das oportunidades de dados e TI. Obrigado!"],
    ["Depois de conectar","Obrigado pela conexão, {nome}! Vi que a {empresa} costuma abrir vagas de dados e TI. Se surgir algo de analista de dados ou BI, adoraria participar do processo. Posso te enviar o meu currículo?"],
    ["Follow-up de uma candidatura","Olá, {nome}! Me candidatei à vaga de {vaga} na {empresa} e queria reforçar o meu interesse. Fico à disposição para conversar quando for melhor para você. Obrigado!"]];
  function redeTexto(m,c){return m.replace(/\{nome\}/g,c&&c.titulo?c.titulo.split(" ")[0]:"{nome}").replace(/\{empresa\}/g,c&&c.valor?c.valor:"{empresa}")}
  function redeCopiar(b,txt){try{navigator.clipboard.writeText(txt).then(function(){var t=b.textContent;b.textContent="✓ Copiado";setTimeout(function(){b.textContent=t},1500)})}catch(e){prompt("Copie:",txt)}}
  function redeDias(d){return d?Math.round((new Date(hojeISO()+"T12:00:00")-new Date(String(d).slice(0,10)+"T12:00:00"))/864e5):null}
  function redeCarregar(){return SB.from("registros").select("id,tipo,data,titulo,valor,detalhes,dados").eq("quem","rede").order("data",{ascending:false}).then(sbOk).then(function(l){REDE.regs=l;return l})}
  function renderRede(){
    var root=$("#rede-view");root.innerHTML="";
    var topo=panel("Rede em Sorocaba","Quem é de RH e recrutamento nas empresas da região, em que pé está cada contato e quando os posts foram vistos pela última vez. O LinkedIn não deixa robôs entrarem na conta, então aqui ficam os atalhos e a memória do trabalho; o resto é no próprio LinkedIn.");
    root.appendChild(topo);
    var box=h("div",{class:"stack"},h("div",{class:"panel"},h("p",{class:"sub",text:"Carregando os contatos…"})));root.appendChild(box);
    /* buscas prontas */
    var pb=panel("Buscas prontas no LinkedIn","Abrem já filtradas. Nas de vagas, o botão \"Criar alerta\" do LinkedIn manda as novas por e-mail, e o site lê esses e-mails em Vagas → Alertas por e-mail.");
    REDE_BUSCAS.forEach(function(g){pb.appendChild(h("h3",{class:"mbag",text:g[0]}));pb.appendChild(h("div",{class:"vfil"},g[1].map(function(b){return ext(b[1],b[0],"ghostbtn")})))});
    root.appendChild(pb);
    /* modelos de mensagem */
    var pm=h("details",{class:"panel famvals"},h("summary",{text:"Modelos de mensagem"}));
    REDE_MSG.forEach(function(m){var b=h("button",{type:"button",class:"ghostbtn",text:"Copiar"});b.onclick=function(){redeCopiar(b,m[1])};pm.appendChild(h("h3",{class:"mbag",text:m[0]}));pm.appendChild(h("p",{class:"sub",text:m[1]}));pm.appendChild(h("div",{class:"vfil"},b))});
    pm.appendChild(h("p",{class:"sub",text:"Em cada contato, o botão Mensagem já copia o convite com o nome e a empresa da pessoa."}));root.appendChild(pm);
    redeCarregar().then(function(){redeDesenhar(box)},function(e){box.innerHTML="";box.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Não consegui carregar ("+e.message+")."})));logErro("rede",e)})}
  function redeDesenhar(box){
    box.innerHTML="";var l=(REDE.regs||[]).filter(function(r){return r.tipo==="contato"});
    var p=panel("Contatos de RH ("+l.length+")",null),f=h("div",{class:"wform"});
    var ed=REDE.editando||{},nome=h("input",{type:"text",placeholder:"Nome",value:ed.titulo||""}),cargo=h("input",{type:"text",placeholder:"Cargo (ex.: Tech Recruiter)",value:ed.detalhes||""}),
      emp=h("input",{type:"text",placeholder:"Empresa",value:ed.valor||"",list:"rede-emp"}),perfil=h("input",{type:"url",placeholder:"Link do perfil no LinkedIn",value:(ed.dados||{}).perfil||""}),
      st=h("select",null,REDE_ST.map(function(s){return h("option",{value:s[0],selected:((ed.dados||{}).status||"achei")===s[0]?"":null,text:s[1]})})),
      notas=h("input",{type:"text",placeholder:"Notas (ex.: posta vagas toda segunda)",value:(ed.dados||{}).notas||""}),msg=h("p",{class:"sub",role:"status"});
    var dl=h("datalist",{id:"rede-emp"});l.map(function(r){return r.valor}).filter(function(x,i,a){return x&&a.indexOf(x)===i}).sort().forEach(function(x){dl.appendChild(h("option",{value:x}))});
    var salvar=h("button",{type:"button",text:REDE.editando?"Salvar alterações":"Adicionar contato"}),canc=REDE.editando?h("button",{type:"button",class:"ghostbtn",text:"Cancelar"}):null;
    f.appendChild(h("div",{class:"two"},nome,emp));f.appendChild(h("div",{class:"two"},cargo,st));f.appendChild(perfil);f.appendChild(notas);f.appendChild(dl);f.appendChild(h("div",{class:"vfil"},salvar,canc));f.appendChild(msg);
    if(canc)canc.onclick=function(){REDE.editando=null;redeDesenhar(box)};
    salvar.onclick=function(){
      if(!nome.value.trim()||!emp.value.trim()){msg.textContent="Preencha pelo menos o nome e a empresa.";return}
      var pf=perfil.value.trim();if(pf&&!/^https?:\/\//.test(pf))pf="https://"+pf;
      var dados=Object.assign({},ed.dados||{},{perfil:pf||undefined,status:st.value,notas:notas.value.trim()||undefined}),row={titulo:nome.value.trim(),valor:emp.value.trim(),detalhes:cargo.value.trim()||null,dados:dados};
      salvar.disabled=true;
      (REDE.editando?SB.from("registros").update(row).eq("id",ed.id):SB.from("registros").insert(Object.assign({quem:"rede",tipo:"contato",data:hojeISO()},row))).then(sbOk)
        .then(function(){REDE.editando=null;return redeCarregar()}).then(function(){redeDesenhar(box)},function(e){salvar.disabled=false;msg.textContent="Não consegui salvar: "+e.message})};
    p.appendChild(f);
    /* quem está há mais tempo sem visita aparece com aviso; por empresa */
    var atras=l.filter(function(r){var d=redeDias((r.dados||{}).visto);return d==null||d>=REDE_DIAS});
    if(l.length)p.appendChild(h("p",{class:atras.length?"qrwarn":"sub",text:atras.length?atras.length+(atras.length===1?" contato":" contatos")+" sem olhar os posts há "+REDE_DIAS+" dias ou mais (marcados abaixo).":"Todos os posts vistos nos últimos "+REDE_DIAS+" dias. ✓"}));
    else p.appendChild(h("p",{class:"empty",text:"Nenhum contato ainda. Use as buscas de Pessoas abaixo, abra o perfil e cadastre aqui quem for de RH ou recrutamento."}));
    var por={};l.forEach(function(r){(por[r.valor]=por[r.valor]||[]).push(r)});
    Object.keys(por).sort(function(a,b){return a.localeCompare(b)}).forEach(function(e){
      p.appendChild(h("h3",{class:"mbag",text:e+" ("+por[e].length+")"}));
      var ul=h("ul",{class:"wl acab"});
      por[e].forEach(function(r){var d=r.dados||{},dias=redeDias(d.visto),sti=REDE_ST.map(function(s){return s[0]}).indexOf(d.status||"achei");
        var vi=h("button",{type:"button",class:"ghostbtn",text:"Olhei os posts"}),av=h("button",{type:"button",class:"ghostbtn",text:sti<REDE_ST.length-1?"▶ "+REDE_ST[sti+1][1]:"✓"}),
          ms=h("button",{type:"button",class:"ghostbtn",text:"Mensagem"}),edb=h("button",{type:"button",class:"ghostbtn",text:"Editar"}),rm=h("button",{type:"button",class:"listarm","aria-label":"Apagar "+r.titulo,text:"×"});
        function grava(nd){return SB.from("registros").update({dados:Object.assign({},d,nd)}).eq("id",r.id).then(sbOk).then(redeCarregar).then(function(){redeDesenhar(box)},function(e){alert("Não consegui salvar: "+e.message)})}
        vi.onclick=function(){grava({visto:new Date().toISOString()})};av.disabled=sti>=REDE_ST.length-1;av.onclick=function(){grava({status:REDE_ST[sti+1][0]})};
        ms.onclick=function(){redeCopiar(ms,redeTexto(REDE_MSG[d.status==="conectado"||d.status==="conversa"?1:0][1],r))};
        edb.onclick=function(){REDE.editando=r;redeDesenhar(box);box.scrollIntoView({behavior:"smooth"})};
        rm.onclick=function(){if(!confirm("Apagar "+r.titulo+"?"))return;SB.from("registros").delete().eq("id",r.id).then(sbOk).then(redeCarregar).then(function(){redeDesenhar(box)})};
        var nomeEl=d.perfil?h("a",{href:d.perfil,target:"_blank",rel:"noopener",class:"link",text:r.titulo}):h("span",{text:r.titulo});
        ul.appendChild(h("li",{class:dias==null||dias>=REDE_DIAS?"alerta":null},h("span",{class:"grow"},h("b",null,nomeEl),
          h("span",{class:"sub",text:[r.detalhes,REDE_ST[sti][1],dias==null?"posts nunca vistos":dias===0?"posts vistos hoje":"posts vistos há "+dias+(dias===1?" dia":" dias"),d.notas].filter(Boolean).join(" · ")})),
          h("span",{class:"vfil"},vi,av,ms,edb,rm)))});
      p.appendChild(ul)});
    box.appendChild(p)}
