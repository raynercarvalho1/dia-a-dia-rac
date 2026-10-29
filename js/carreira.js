/* Dia a Dia RAC — módulo carregado quando a seção abre. Carreira: funil de candidaturas (com follow-up na Agenda),
   compatibilidade com as vagas, perfil de competências, banco de histórias STAR, prática de SQL com os seus dados
   (sql.js no navegador) e estudo de caso anonimizado para o portfólio.
   Dados em PESSOAL.candidaturas, PESSOAL.perfilCarreira e PESSOAL.historias. Usa as funções do núcleo (js/app.js). */
  var CAR_COLS=[["salva","Salvas"],["candidatei","Candidatei"],["entrevista","Entrevista"],["resposta","Resposta"]];
  var CAR_ABAS=[["funil","Funil"],["cv","Meu currículo"],["compat","Compatibilidade"],["star","Histórias STAR"],["sql","Praticar SQL"],["portfolio","Portfólio"]];
  function carCands(){return PESSOAL.candidaturas||[]}
  function carSkillNome(k){return (NUCLEO.SKILLS.filter(function(s){return s[0]===k})[0]||[k,k])[1]}
  function carMeus(){return ((PESSOAL.perfilCarreira||{}).skills)||["sql","powerbi","excel","negocio","estat"]}
  function renderCarreira(sub,arg){
    var root=$("#carreira-view");root.innerHTML="";var aba=CAR_ABAS.some(function(a){return a[0]===sub})?sub:"funil";
    root.appendChild(h("div",{class:"seg famseg"},CAR_ABAS.map(function(a){return h("a",{href:"#carreira/"+a[0],"aria-pressed":String(a[0]===aba),text:a[1]})}).concat([h("a",{href:"#rede",text:"Rede (LinkedIn)"})])));
    /* uma candidatura tem endereço próprio (#carreira/editar/<id>): o Voltar do topo e o do navegador funcionam */
    if(sub==="editar"){var c=arg==="novo"?null:carCands().filter(function(k){return k.id===arg})[0];if(c||arg==="novo"){carEditar(c);return}}
    ({funil:carFunil,cv:carCv,compat:carCompat,star:carStar,sql:carSql,portfolio:carPortfolio})[aba](root,arg)}

  /* ---------- funil ---------- */
  function carSalvar(l){pessoalGravar("candidaturas",l)}
  function carMover(id,col){var hj=hojeISO();carSalvar(carCands().map(function(c){if(c.id!==id)return c;var d=Object.assign({},c.datas||{});d[col]=d[col]||hj;return Object.assign({},c,{coluna:col,datas:d})}))}
  function carFunil(root){
    var l=carCands(),meus=carMeus();
    var topo=panel("Funil de candidaturas","Salve vagas da página Vagas (ou cadastre aqui), avance pelas colunas e, 5 dias depois de se candidatar sem resposta, o follow-up aparece na Agenda.");
    var nv=h("button",{type:"button",class:"ghostbtn pri",text:"+ Vaga de fora do portal"});nv.onclick=function(){location.hash="#carreira/editar/novo"};
    topo.appendChild(h("div",{class:"vfil"},nv,h("a",{href:"#vagas",class:"ghostbtn",text:"Ver vagas abertas"})));
    var tot=CAR_COLS.map(function(c){return c[1]+": "+l.filter(function(x){return x.coluna===c[0]}).length});topo.appendChild(h("p",{class:"sub",text:tot.join(" · ")}));
    root.appendChild(topo);
    root.appendChild(carEmails());
    var kb=h("div",{class:"kanban"});
    CAR_COLS.forEach(function(col,ci){
      var cards=l.filter(function(x){return x.coluna===col[0]}).sort(function(a,b){return String((b.datas||{})[col[0]]||"").localeCompare(String((a.datas||{})[col[0]]||""))});
      var c=h("div",{class:"kcol"},h("h3",{class:"mbag",text:col[1]+" ("+cards.length+")"}));
      cards.forEach(function(x){
        var cp=NUCLEO.compatVaga([x.t,x.desc].join(" "),meus),desde=(x.datas||{})[col[0]],dias=desde?Math.round((new Date(hojeISO()+"T12:00:00")-new Date(desde+"T12:00:00"))/864e5):null;
        var fem=carFollowEm(x),fu=col[0]==="candidatei"&&!x.followup&&!!fem&&fem<=hojeISO();
        var k=h("div",{class:"kcard"+(fu?" alerta":"")},h("b",{text:x.t}),h("span",{class:"sub",text:[x.e,x.local,x.modalidade,x.salario&&!/combinar/i.test(x.salario)?x.salario:"",dias!=null?"há "+dias+(dias===1?" dia":" dias"):""].filter(Boolean).join(" · ")}),
          cp.nota!=null?h("span",{class:"kcompat",title:"Pede: "+cp.pede.map(carSkillNome).join(", "),text:cp.nota+"% compatível"+(cp.falta.length?" · falta "+cp.falta.map(carSkillNome).join(", "):"")}):null,
          x.resultado?h("span",{class:"sub",text:"Resultado: "+x.resultado}):null,x.etapa?h("span",{class:"sub",text:"Etapa liberada: "+x.etapa}):null,x.fonte?h("span",{class:"sub",text:"via "+x.fonte}):null,fu?h("span",{class:"qrwarn",text:"Fazer follow-up"}):col[0]==="candidatei"&&fem&&!x.followup?h("span",{class:"sub",text:"Follow-up em "+dataBR(fem)}):null);
        var bt=h("div",{class:"vfil"});
        if(ci>0){var e=h("button",{type:"button",class:"ghostbtn",text:"◀"});e.onclick=function(){carMover(x.id,CAR_COLS[ci-1][0]);renderCarreira("funil")};bt.appendChild(e)}
        if(ci<CAR_COLS.length-1){var d=h("button",{type:"button",class:"ghostbtn",text:"▶ "+CAR_COLS[ci+1][1]});d.onclick=function(){carMover(x.id,CAR_COLS[ci+1][0]);renderCarreira("funil")};bt.appendChild(d)}
        var ed=h("button",{type:"button",class:"ghostbtn",text:"Abrir"});ed.onclick=function(){location.hash="#carreira/editar/"+x.id};bt.appendChild(ed);
        if(x.link)bt.appendChild(ext(x.link,"Vaga","ghostbtn"));
        k.appendChild(bt);c.appendChild(k)});
      kb.appendChild(c)});
    root.appendChild(kb)}
  /* uma candidatura: dados, descrição colada (deixa a compatibilidade precisa), notas, follow-up e histórias ao lado */
  /* ===== E-mails das candidaturas: confirmações, etapas, entrevistas e retornos viram passos no funil (você confirma cada um) ===== */
  var CAR_Q="newer_than:120d (from:gupy.com.br OR from:burh.com.br OR from:avisos@jobbol.com.br OR from:mailquickin.com OR from:solides.com OR from:empregoshub.com.br OR from:kenoby.com OR from:catho.com.br OR from:infojobs.com.br OR from:vagas.com.br OR from:jobs-noreply@linkedin.com OR subject:candidatura OR subject:\"processo seletivo\" OR subject:entrevista) -from:jobalerts-noreply@linkedin.com";
  var CAR_PROPS=null;
  function carEmails(){
    var p=panel("E-mails das candidaturas","Lê as confirmações da Gupy, Burh, Jobbol, Sólides, LinkedIn e outras nos seus Gmails (últimos 4 meses) e sugere: candidatura nova, etapa liberada, entrevista, retorno ou vaga cancelada. Nada muda sem você tocar em Aplicar.");
    var st=h("p",{class:"sub",role:"status"}),bt=h("button",{type:"button",class:"ghostbtn pri",text:"Buscar nos e-mails"}),cx=h("div",{class:"vfil"}),ul=h("ul",{class:"wl carmail"});
    p.appendChild(h("div",{class:"vfil"},bt));p.appendChild(cx);p.appendChild(st);p.appendChild(ul);
    function vistos(){return ((PESSOAL.carEmails||{}).vistos)||[]}
    function marcar(ids){var v=vistos().concat(ids).filter(function(x,i,a){return a.indexOf(x)===i}).slice(-800);pessoalGravar("carEmails",{vistos:v,quando:new Date().toISOString()})}
    var NOMES={candidatura:"Candidatura",etapa:"Etapa liberada",entrevista:"Entrevista",retorno:"Retorno",cancelada:"Vaga cancelada"};
    /* o que fazer com cada e-mail: {m, x, c (candidatura do funil ou null), texto, aplicar()} */
    function proposta(m,x){
      var l=carCands(),c=l.filter(function(k){return NUCLEO.vagaParecida(x,k)})[0]||null,neg=/agradecemos (a )?sua participa|infelizmente|n[ãa]o (seguiremos|foi selecionad|fomos)|optamos por|obrigad[ao] pelo interesse/i.test(m.assunto+" "+m.trecho);
      var nome=[x.vaga||"(vaga sem nome no e-mail)",x.empresa].filter(Boolean).join(" — ");
      var alvo=x.tipo==="candidatura"?"candidatei":x.tipo==="entrevista"?"entrevista":x.tipo==="etapa"?"candidatei":"resposta";
      if(c&&x.tipo==="candidatura"&&c.coluna!=="salva")return null; /* já está no funil, nada a fazer */
      if(c&&x.tipo==="etapa"&&c.etapa===x.etapa)return null;
      var texto=c?(x.tipo==="etapa"?"Anotar \"Etapa "+x.etapa+" liberada\" em ":"Mover para "+CAR_COLS.filter(function(k){return k[0]===alvo})[0][1]+(x.tipo==="cancelada"?" (vaga cancelada)":x.tipo==="retorno"&&neg?" (recusado)":"")+": ")+c.t:"Nova no funil ("+CAR_COLS.filter(function(k){return k[0]===alvo})[0][1]+"): "+nome;
      return {m:m,x:x,c:c,texto:texto,aplicar:function(){
        /* procura de novo na hora: aplicar a confirmação antes cria o card que a entrevista do mesmo e-mail vai mover */
        var lista=carCands().slice(),hj=m.data;c=lista.filter(function(k){return NUCLEO.vagaParecida(x,k)})[0]||null;
        if(c){lista=lista.map(function(k){if(k.id!==c.id)return k;var d=Object.assign({},k.datas||{});var o=Object.assign({},k,{emailId:k.emailId||m.id});
          if(x.tipo==="etapa"){o.etapa=x.etapa;o.followup=true;if(o.coluna==="salva"){o.coluna="candidatei";d.candidatei=d.candidatei||hj}}
          else{o.coluna=alvo;d[alvo]=d[alvo]||hj;if(alvo!=="candidatei")o.followup=true;if(x.tipo==="cancelada")o.resultado="vaga cancelada";else if(x.tipo==="retorno"&&neg)o.resultado="recusado"}
          if(!o.e&&x.empresa)o.e=x.empresa;o.datas=d;o.interacoes=(k.interacoes||[]).concat([{d:hj,tipo:"E-mail",t:(NOMES[x.tipo]||x.tipo)+": "+m.assunto}]);return o})}
        else{var d2={};d2[alvo]=hj;if(alvo!=="candidatei")d2.candidatei=hj;
          lista.unshift({id:"e"+m.id,emailId:m.id,t:x.vaga||"(vaga sem nome no e-mail)",e:x.empresa,link:gmLinkMsg(m),fonte:x.plataforma,coluna:alvo,datas:d2,etapa:x.etapa,followup:alvo!=="candidatei",interacoes:[{d:hj,tipo:"E-mail",t:(NOMES[x.tipo]||x.tipo)+": "+m.assunto}],
            resultado:x.tipo==="cancelada"?"vaga cancelada":x.tipo==="retorno"&&neg?"recusado":undefined})}
        carSalvar(lista)}}}
    function buscar(){bt.disabled=true;st.textContent="Lendo os e-mails…";ul.innerHTML="";cx.innerHTML="";
      gmBuscar(CAR_Q,80).then(function(res){bt.disabled=false;gmBotoesConectar(res,buscar).forEach(function(b){cx.appendChild(b)});
        var vs=vistos(),todos=[],ps=[];res.forEach(function(r){r.msgs.forEach(function(m){todos.push(m)})});
        todos.sort(function(a,b){return a.data.localeCompare(b.data)}); /* do mais antigo para o mais novo: a confirmação vem antes da entrevista */
        var semAcao=[];todos.forEach(function(m){if(vs.indexOf(m.id)>=0)return;var x=NUCLEO.lerEmailVaga(m);if(!x||x.tipo==="alerta"){semAcao.push(m.id);return}
          var pr=proposta(m,x);if(pr)ps.push(pr);else semAcao.push(m.id)});
        if(semAcao.length)marcar(semAcao);
        var erro=res.filter(function(r){return r.erro}).map(function(r){return r.conta+": "+r.erro});
        st.textContent=(ps.length?ps.length+(ps.length===1?" sugestão":" sugestões")+" dos e-mails.":"Nada novo nos e-mails."+(res.some(function(r){return r.semAcesso})?" Conecte as contas acima para ler todas.":""))+(erro.length?" ⚠ "+erro.join("; "):"");
        CAR_PROPS=ps;mostrar()
      }).catch(function(e){bt.disabled=false;st.textContent="Não consegui ler os e-mails: "+e.message;logErro("carreira (e-mails)",e)})}
    /* as sugestões ficam guardadas enquanto a página está aberta: aplicar uma redesenha o funil sem perder as outras */
    function tirar(q){CAR_PROPS=CAR_PROPS.filter(function(z){return z!==q})}
    function mostrar(){var ps=CAR_PROPS||[];ul.innerHTML="";var velho=cx.querySelector(".tudo");if(velho)velho.remove();
        if(ps.length>1){var tudo=h("button",{type:"button",class:"ghostbtn tudo",text:"Aplicar todas ("+ps.length+")"});tudo.onclick=function(){ps.forEach(function(q){q.aplicar()});marcar(ps.map(function(q){return q.m.id}));CAR_PROPS=[];renderCarreira("funil")};cx.appendChild(tudo)}
        ps.slice().reverse().forEach(function(q){var ap=h("button",{type:"button",text:"Aplicar"}),ig=h("button",{type:"button",class:"ghostbtn",text:"Ignorar"});
          ap.onclick=function(){q.aplicar();marcar([q.m.id]);tirar(q);renderCarreira("funil")};ig.onclick=function(){marcar([q.m.id]);tirar(q);li.remove()};
          var li=h("li",null,h("span",{class:"grow"},h("b",{text:(NOMES[q.x.tipo]||q.x.tipo)+" · "+q.texto}),h("span",{class:"sub",text:dataBR(q.m.data)+" · "+(q.x.plataforma||q.m.de.replace(/^.*<|>.*$/g,""))+" · "+q.m.assunto})),
            h("span",{class:"vfil"},ext(gmLinkMsg(q.m),"E-mail","ghostbtn"),ap,ig));ul.appendChild(li)});
        if(CAR_PROPS&&!ps.length&&!st.textContent)st.textContent="Tudo aplicado. ✓"}
    bt.onclick=buscar;if(CAR_PROPS)mostrar();return p}
  /* uma candidatura completa: a vaga (empresa, cargo, local, modalidade, salário, link e publicação), a candidatura (data e currículo enviado),
     etapa, contatos e histórico de interações, follow-up com data (e adiar) e as anotações de entrevista */
  var CAR_INTER=["E-mail","Mensagem","Ligação","Entrevista","Teste","Outro"];
  function carFollowEm(x){var d=(x.datas||{}).candidatei;return x.followupEm||(d?maisDias(d,5):"")}
  function carEditar(x){
    var root=$("#carreira-view");root.innerHTML="";var novo=!x;x=x||{id:"c"+Date.now().toString(36),coluna:"salva",datas:{salva:hojeISO()}};
    var p=panel(novo?"Nova candidatura":x.t,novo?null:[x.e,x.local,x.modalidade].filter(Boolean).join(" · ")),f=h("div",{class:"wform"});
    var okTopo=h("button",{type:"button",text:"Salvar"}),fun=h("a",{href:"#carreira/funil",class:"ghostbtn",text:"‹ Funil"});p.appendChild(h("div",{class:"vfil"},fun,okTopo));
    function inp(tipo,val,ph){return h("input",{type:tipo,value:val||"",placeholder:ph||""})}
    function sec(t){f.appendChild(h("h3",{class:"mbag",text:t}))}
    /* a vaga */
    var t=inp("text",x.t,"Cargo"),e=inp("text",x.e,"Empresa"),loc=inp("text",x.local,"Ex.: Sorocaba (SP)"),sal=inp("text",x.salario,"Ex.: R$ 5.000 ou A combinar");
    var mod=h("select",null,["","Remoto","Híbrido","Presencial"].map(function(m){return h("option",{value:m,selected:m===(x.modalidade||"")?"":null,text:m||"(modalidade)"})}));
    var lk=inp("url",x.link,"https://… (link original da vaga)"),pub=inp("date",x.publicada);
    var desc=h("textarea",{rows:"5",placeholder:"Cole aqui a descrição da vaga: a compatibilidade passa a usar o texto completo"});desc.value=x.desc||"";
    sec("A vaga");
    f.appendChild(h("div",{class:"two"},h("label",null,"Cargo",t),h("label",null,"Empresa",e)));
    f.appendChild(h("div",{class:"two"},h("label",null,"Localidade",loc),h("label",null,"Modalidade",mod)));
    f.appendChild(h("div",{class:"two"},h("label",null,"Salário",sal),h("label",null,"Publicada em",pub)));
    f.appendChild(h("label",null,"Link original",lk));f.appendChild(h("label",null,"Descrição",desc));
    var cpBox=h("div");f.appendChild(cpBox);
    /* a candidatura */
    sec("Candidatura e etapa");
    var col=h("select",null,CAR_COLS.map(function(c){return h("option",{value:c[0],selected:c[0]===x.coluna?"":null,text:c[1]})}));
    var res=h("select",null,["","aprovado","recusado","sem retorno","vaga cancelada","desisti"].map(function(r){return h("option",{value:r,selected:r===(x.resultado||"")?"":null,text:r||"(sem resultado ainda)"})}));
    var cand=inp("date",(x.datas||{}).candidatei),et=inp("text",x.etapa,"Ex.: Teste técnico, Entrevista com o gestor");
    var ver=h("select",null,[h("option",{value:"",text:(x.versoes||[]).length?"(nenhuma marcada)":"(gere uma versão abaixo)"})].concat((x.versoes||[]).map(function(v){return h("option",{value:v.id,selected:v.id===x.versaoEnviada?"":null,text:"Versão de "+dataBR(v.data)+(v.base==="suporte"?" · Suporte":" · Dados")})})));
    f.appendChild(h("div",{class:"two"},h("label",null,"Coluna do funil",col),h("label",null,"Resultado",res)));
    f.appendChild(h("div",{class:"two"},h("label",null,"Me candidatei em",cand),h("label",null,"Currículo enviado",ver)));
    f.appendChild(h("label",null,"Etapa atual",et));
    /* follow-up */
    sec("Follow-up");
    var fuEm=inp("date",carFollowEm(x)),fu=h("input",{type:"checkbox"});fu.checked=!!x.followup;
    function adiar(n){var base=fuEm.value&&fuEm.value>hojeISO()?fuEm.value:hojeISO();fuEm.value=maisDias(base,n)}
    var a3=h("button",{type:"button",class:"ghostbtn",text:"Adiar 3 dias"}),a7=h("button",{type:"button",class:"ghostbtn",text:"Adiar 1 semana"});a3.onclick=function(){adiar(3)};a7.onclick=function(){adiar(7)};
    cand.addEventListener("change",function(){if(cand.value&&!x.followupEm)fuEm.value=maisDias(cand.value,5)});
    f.appendChild(h("div",{class:"two"},h("label",null,"Fazer follow-up em",fuEm),h("div",{class:"vfil",style:"align-self:end"},a3,a7)));
    f.appendChild(h("label",{class:"chk"},fu," Follow-up feito (sai da Agenda)"));
    /* contatos e histórico */
    sec("Contatos e histórico");
    var cont=h("textarea",{rows:"2",placeholder:"Um por linha: nome — cargo — e-mail, telefone ou LinkedIn"});cont.value=x.contatos||"";f.appendChild(h("label",null,"Contatos",cont));
    var inter=(x.interacoes||[]).slice(),ul=h("ul",{class:"wl"});
    function desenhaInter(){ul.innerHTML="";inter.slice().sort(function(a,b){return b.d.localeCompare(a.d)}).forEach(function(i){var rm=h("button",{type:"button",class:"listarm","aria-label":"Tirar",text:"×"});
      rm.onclick=function(){inter=inter.filter(function(z){return z!==i});desenhaInter()};
      ul.appendChild(h("li",null,h("span",{class:"grow"},h("b",{text:i.tipo+(i.t?": "+i.t:"")}),h("span",{class:"sub",text:dataBR(i.d)})),rm))});
      if(!inter.length)ul.appendChild(h("li",null,h("span",{class:"sub",text:"Nenhuma interação ainda. Os e-mails aplicados no funil entram aqui sozinhos."})))}
    var idt=inp("date",hojeISO()),itp=h("select",null,CAR_INTER.map(function(z){return h("option",{value:z,text:z})})),itx=inp("text","","O que aconteceu"),iad=h("button",{type:"button",class:"ghostbtn",text:"+ Interação"});
    iad.onclick=function(){if(!itx.value.trim()&&itp.value==="Outro")return itx.focus();inter.push({d:idt.value||hojeISO(),tipo:itp.value,t:itx.value.trim()});itx.value="";desenhaInter()};
    f.appendChild(ul);f.appendChild(h("div",{class:"listaadd"},idt,itp,itx,iad));desenhaInter();
    /* entrevista */
    sec("Entrevista");
    function ta(val,ph,rows){var z=h("textarea",{rows:String(rows||3),placeholder:ph});z.value=val||"";return z}
    var anot=ta(x.entrevista,"Como foi, com quem falou, impressões"),perg=ta(x.perguntas,"Uma pergunta por linha (ótimo para treinar as próximas)"),prox=ta(x.proximos,"Ex.: enviar portfólio até sexta; retorno prometido para dia 10",2);
    var notas=ta(x.notas,"Outras anotações",2);
    f.appendChild(h("label",null,"Anotações da entrevista",anot));f.appendChild(h("label",null,"Perguntas recebidas",perg));f.appendChild(h("label",null,"Próximos passos",prox));f.appendChild(h("label",null,"Notas",notas));
    function atualizaCompat(){var cp=NUCLEO.compatVaga([t.value,desc.value].join(" "),carMeus());cpBox.innerHTML="";
      if(cp.nota==null){cpBox.appendChild(h("p",{class:"sub",text:"Cole a descrição para ver a compatibilidade."}));return}
      cpBox.appendChild(h("div",{class:"kgasto"},h("div",null,h("span",{class:"kl",text:"Compatibilidade"}),h("b",{class:"kv "+(cp.nota>=70?"bom":cp.nota<40?"ruim":""),text:cp.nota+"%"})),
        h("div",null,h("span",{class:"kl",text:"Você tem"}),h("b",{class:"kv",text:cp.tem.map(carSkillNome).join(", ")||"—"})),h("div",null,h("span",{class:"kl",text:"Falta"}),h("b",{class:"kv",text:cp.falta.map(carSkillNome).join(", ")||"nada 🎉"}))));
      /* histórias STAR que usam o que a vaga pede: para preparar a entrevista com a vaga ao lado */
      var hs=(PESSOAL.historias||[]).filter(function(s){var sk=NUCLEO.compatVaga([s.titulo,s.s,s.t,s.a,s.r,s.tags].join(" "),cp.pede).tem;return sk.length});
      if(hs.length)cpBox.appendChild(h("details",{class:"famvals",open:""},h("summary",{text:"Histórias STAR para esta vaga ("+hs.length+")"}),h("ul",{class:"wl"},hs.map(function(s){return h("li",null,h("span",{class:"grow"},h("b",{text:s.titulo}),h("span",{class:"sub",text:"R: "+(s.r||"")})))}))))}
    desc.addEventListener("input",atualizaCompat);t.addEventListener("input",atualizaCompat);atualizaCompat();
    var ok=h("button",{type:"button",text:"Salvar"}),volta=h("button",{type:"button",class:"ghostbtn",text:"Voltar sem salvar"}),del=novo?null:h("button",{type:"button",class:"ghostbtn",text:"Apagar"});
    volta.onclick=function(){location.hash="#carreira/funil"};
    ok.onclick=function(){if(!t.value.trim())return t.focus();var d=Object.assign({},x.datas||{});d[col.value]=d[col.value]||hojeISO();if(cand.value)d.candidatei=cand.value;
      var padrao=d.candidatei?maisDias(d.candidatei,5):"";
      var o=Object.assign({},x,{t:t.value.trim(),e:e.value.trim(),local:loc.value.trim()||undefined,modalidade:mod.value||undefined,salario:sal.value.trim()||undefined,publicada:pub.value||undefined,
        link:urlAbs(lk.value),coluna:col.value,resultado:res.value||null,etapa:et.value.trim()||undefined,versaoEnviada:ver.value||undefined,desc:desc.value.trim(),
        followupEm:fuEm.value&&fuEm.value!==padrao?fuEm.value:undefined,followup:fu.checked?(x.followup||hojeISO()):null,contatos:cont.value.trim()||undefined,interacoes:inter.length?inter:undefined,
        entrevista:anot.value.trim()||undefined,perguntas:perg.value.trim()||undefined,proximos:prox.value.trim()||undefined,notas:notas.value.trim(),datas:d});
      var l=carCands().filter(function(c){return c.id!==x.id});l.unshift(o);carSalvar(l);location.hash="#carreira/funil"};
    if(del){var arm=false;del.onclick=function(){if(!arm){arm=true;del.textContent="Toque de novo para apagar";return}carSalvar(carCands().filter(function(c){return c.id!==x.id}));location.hash="#carreira/funil"}}
    okTopo.onclick=function(){ok.onclick()};
    f.appendChild(h("div",{class:"vfil"},ok,volta,del));p.appendChild(f);root.appendChild(p);
    if(!novo)root.appendChild(carVersoesPainel(x,function(){return {t:t.value.trim(),e:e.value.trim(),desc:desc.value.trim()}}))}

  /* ===== Currículo base (uma vez) e versões sob medida por vaga ===== */
  /* dois currículos base: Dados (o alvo) e Suporte/Ativos; cada vaga usa o que combina com ela */
  var CAR_BASES=[["dados","Análise de dados"],["suporte","Suporte técnico e ativos"]];
  function carBase(nome){var b=PESSOAL.curriculos||{};return b[nome]||(nome==="dados"?PESSOAL.curriculo:null)||null}
  function carBaseDaVaga(v){var t=NUCLEO.norm([v.t,v.desc].join(" "));
    var dados=/\b(dados|data|bi|power bi|analytics|sql|cientista|engenheir[oa] de dados|indicadores|dashboard)/.test(t),sup=/\b(suporte|field|service desk|help ?desk|infraestrutura|ativos|tecnico|n1|n2|campo)/.test(t);
    return sup&&!dados&&carBase("suporte")?"suporte":"dados"}
  function carCv(root,arg){
    var qual=CAR_BASES.some(function(b){return b[0]===arg})?arg:"dados",cv=carBase(qual)||{};
    var p=panel("Meu currículo (base)","Dois currículos base: Análise de dados (o alvo) e Suporte técnico e ativos. Para cada vaga, o site escolhe a base pelo que a vaga pede e monta uma versão enxuta: o que a vaga pede vem primeiro, as histórias STAR viram resultados em destaque e sai uma carta. Fica só na sua conta (não vai para o código público).");
    p.appendChild(h("div",{class:"seg famseg"},CAR_BASES.map(function(b){return h("a",{href:"#carreira/cv/"+b[0],"aria-pressed":String(b[0]===qual),text:b[1]+(carBase(b[0])?"":" (vazio)")})})));
    var imp=h("input",{type:"file",accept:".json,application/json",hidden:""}),ib=h("button",{type:"button",class:"ghostbtn",text:"Importar os currículos (arquivo .json)"}),ist=h("span",{class:"sub",role:"status"});
    ib.onclick=function(){imp.click()};
    imp.onchange=function(){var fl=imp.files[0];if(!fl)return;fl.text().then(function(t){var j=JSON.parse(t),n=Object.assign({},PESSOAL.curriculos||{});
      CAR_BASES.forEach(function(b){if(j[b[0]]&&j[b[0]].nome)n[b[0]]=j[b[0]]});if(!Object.keys(n).length)throw new Error("o arquivo não tem os currículos");
      pessoalGravar("curriculos",n);renderCarreira("cv",qual)}).catch(function(e){ist.textContent="Não consegui importar: "+e.message})};
    p.appendChild(h("div",{class:"vfil"},ib,imp,ist));
    var f=h("div",{class:"wform"}),C={};
    function campo(k,rot,ph,linhas){var el=linhas?h("textarea",{rows:String(linhas),placeholder:ph}):h("input",{type:"text",placeholder:ph});el.value=cv[k]||"";C[k]=el;f.appendChild(h("label",null,rot,el))}
    campo("nome","Nome","Rayner Carvalho");campo("titulo","Título","Ex.: Analista de Dados | SQL · Power BI · Python");campo("contato","Contato","Sorocaba/SP · e-mail · telefone · linkedin.com/in/…");
    campo("resumo","Resumo","3 ou 4 linhas sobre você",4);
    campo("experiencias","Experiências","Uma por bloco, separadas por uma linha em branco. Primeira linha: Cargo — Empresa (período). Depois, uma conquista por linha.",10);
    campo("competencias","Competências técnicas","Uma área por linha. Ex.: Dados e automação: Power BI, SQL…",4);
    campo("formacao","Formação","Ex.: MBA em Data Science e Analytics — USP/Esalq (2026–2027)",3);campo("cursos","Cursos e certificações","Um por linha",3);
    campo("idiomas","Idiomas","Ex.: Português: nativo · Inglês: intermediário");
    campo("ferramentas","Ferramentas (para ordenar por vaga)","Separadas por vírgula: SQL, Power BI, Excel, Python…");
    var ok=h("button",{type:"button",text:"Salvar"}),st=h("span",{class:"sub",role:"status"});
    ok.onclick=function(){var o={};Object.keys(C).forEach(function(k){o[k]=C[k].value.trim()});var n=Object.assign({},PESSOAL.curriculos||{});n[qual]=o;pessoalGravar("curriculos",n);st.textContent="✓ Salvo. Abra uma candidatura no funil e toque em Gerar versão."};
    f.appendChild(h("div",{class:"vfil"},ok,st));p.appendChild(f);root.appendChild(p)}
  /* monta a versão para a vaga: ferramentas pedidas primeiro, 2 histórias que mais combinam, resumo e carta */
  function carGerar(cv,v){
    var cp=NUCLEO.compatVaga([v.t,v.desc].join(" "),carMeus()),tem=cp.tem.map(carSkillNome),falta=cp.falta.map(carSkillNome);
    var fer=String(cv.ferramentas||"").split(/\s*,\s*/).filter(Boolean);
    function pedida(f){var n=NUCLEO.norm(f);return tem.some(function(s){var a=NUCLEO.norm(s);return a.indexOf(n)>=0||n.indexOf(a)>=0})}
    fer=fer.filter(pedida).concat(fer.filter(function(f){return !pedida(f)}));
    var hs=(PESSOAL.historias||[]).map(function(s){return [s,NUCLEO.compatVaga([s.titulo,s.s,s.t,s.a,s.r,s.tags].join(" "),cp.pede.length?cp.pede:carMeus()).tem.length]}).sort(function(a,b){return b[1]-a[1]}).slice(0,2).map(function(x){return x[0]});
    var resumo=(cv.resumo||"")+(v.t?"\n\nObjetivo: "+v.t+(v.e?" na "+v.e:"")+(tem.length?", com experiência em "+tem.join(", ")+".":"."):"");
    var h1=hs[0],nome=cv.nome||"";
    var carta=["Olá"+(v.e?", equipe de recrutamento da "+v.e:"")+",","Tenho interesse na vaga de "+(v.t||"")+". "+(String(cv.resumo||"").match(/^[\s\S]*?[.!?](?=\s|$)/)||[cv.resumo||""])[0],
      tem.length?"O que a vaga pede e eu já uso no dia a dia: "+tem.join(", ")+"."+(h1?" Um exemplo: "+h1.titulo+". "+(h1.a?h1.a.replace(/[.!]?\s*$/,". "):"")+(h1.r?"Resultado: "+h1.r.replace(/[.!]?\s*$/,"."):""):""):"",
      falta.length?"Também estou aprofundando "+falta.join(", ")+" no MBA em Data Science e Analytics da USP/Esalq.":"",
      "Fico à disposição para conversar e agradeço a atenção.",nome+(cv.contato?"\n"+cv.contato:"")].filter(Boolean).join("\n\n");
    return {id:"v"+Date.now().toString(36),data:hojeISO(),nota:cp.nota,skills:tem,falta:falta,ferramentas:fer,historias:hs.map(function(s){return {titulo:s.titulo,r:s.r||""}}),resumo:resumo,carta:carta}}
  /* página para imprimir ou salvar em PDF (no iPhone: Compartilhar → Imprimir → abrir em PDF) */
  function carImprimir(cv,v,vaga){
    var old=$("#impressao");if(old)old.remove();
    var exps=String(cv.experiencias||"").split(/\n\s*\n/).map(function(b){var ls=b.split("\n").map(function(x){return x.trim()}).filter(Boolean);return ls.length?h("div",{class:"cvexp"},h("b",{text:ls[0]}),ls.length>1?h("ul",null,ls.slice(1).map(function(x){return h("li",{text:x.replace(/^[-•*]\s*/,"")})})):null):null}).filter(Boolean);
    function sec(t,c){return c&&(!Array.isArray(c)||c.length)?h("section",null,h("h3",{text:t}),c):null}
    var cvEl=h("article",{class:"cvdoc"},h("h1",{text:cv.nome||""}),h("p",{class:"cvtit",text:cv.titulo||""}),h("p",{class:"cvcont",text:cv.contato||""}),
      sec("Resumo",h("p",{class:"cvp",text:v.resumo})),sec("Principais ferramentas",h("p",{text:v.ferramentas.join(" · ")})),cv.competencias?sec("Competências técnicas",h("p",{class:"cvp",text:cv.competencias})):null,
      sec("Resultados em destaque",v.historias.length?h("ul",null,v.historias.map(function(s){return h("li",null,h("b",{text:s.titulo}),s.r?" — "+s.r:"")})):null),
      sec("Experiência",exps),sec("Formação",h("p",{class:"cvp",text:cv.formacao||""})),cv.cursos?sec("Cursos e certificações",h("p",{class:"cvp",text:cv.cursos})):null,cv.idiomas?sec("Idiomas",h("p",{class:"cvp",text:cv.idiomas})):null);
    var carta=h("article",{class:"cvdoc cvcarta"},h("p",{class:"cvp",text:v.carta}));
    var fechar=h("button",{type:"button",class:"ghostbtn",text:"Fechar"}),imp=h("button",{type:"button",text:"Imprimir / salvar PDF"});
    var w=h("div",{id:"impressao"},h("div",{class:"impbar"},h("span",{class:"sub",text:"Versão de "+dataBR(v.data)+" para "+(vaga.t||"")+(vaga.e?" · "+vaga.e:"")}),imp,fechar),cvEl,carta);
    fechar.onclick=function(){w.remove();document.documentElement.classList.remove("imprimindo")};imp.onclick=function(){window.print()};
    document.body.appendChild(w);document.documentElement.classList.add("imprimindo");window.scrollTo(0,0)}
  function carVersoesPainel(x,atual){
    var p=panel("Currículo e carta para esta vaga","Gera uma versão enxuta com o que a vaga pede primeiro. Cada versão fica guardada aqui: dá para saber o que foi para onde.");
    if(!carBase("dados")&&!carBase("suporte")){p.appendChild(h("p",{class:"sub"},"Primeiro preencha ou importe o ",h("a",{href:"#carreira/cv",class:"link",text:"currículo base"}),"."));return p}
    var auto=carBaseDaVaga(atual()),sb=h("select",{"aria-label":"Currículo base"},CAR_BASES.filter(function(b){return carBase(b[0])}).map(function(b){return h("option",{value:b[0],selected:b[0]===auto?"":null,text:"Base: "+b[1]+(b[0]===auto?" (combina com a vaga)":"")})}));
    function base(){return carBase(sb.value)||carBase("dados")||carBase("suporte")}
    var gerar=h("button",{type:"button",class:"ghostbtn pri",text:"Gerar versão para esta vaga"}),cl=h("button",{type:"button",class:"ghostbtn",text:"Copiar pedido para o Claude"}),st=h("p",{class:"sub",role:"status"});
    gerar.onclick=function(){var cv=base(),v=Object.assign(carGerar(cv,atual()),{base:sb.value}),l=carCands().map(function(c){return c.id===x.id?Object.assign({},c,{versoes:[v].concat(c.versoes||[])}):c});
      x.versoes=[v].concat(x.versoes||[]);carSalvar(l);desenha();carImprimir(cv,v,atual())};
    cl.onclick=function(){var a=atual(),cv=base(),v=carGerar(cv,a);
      var txt="Monte um currículo de 1 página e uma carta de apresentação curta, em português, para a vaga abaixo. Use só as informações do meu currículo e das minhas histórias; não invente experiência. Coloque primeiro o que a vaga pede.\n\nVAGA: "+a.t+(a.e?" — "+a.e:"")+"\n"+(a.desc||"(sem descrição)")+
        "\n\nMEU CURRÍCULO:\n"+[cv.nome,cv.titulo,cv.resumo,"Competências:\n"+(cv.competencias||""),"Experiências:\n"+cv.experiencias,"Formação: "+cv.formacao,"Cursos: "+(cv.cursos||""),"Idiomas: "+(cv.idiomas||""),"Ferramentas: "+cv.ferramentas].join("\n")+
        "\n\nHISTÓRIAS (STAR):\n"+(PESSOAL.historias||[]).map(function(s){return "- "+s.titulo+": "+[s.s,s.t,s.a,s.r].filter(Boolean).join(" / ")}).join("\n")+"\n\nCompatibilidade calculada: "+(v.nota==null?"—":v.nota+"%")+"; tenho "+v.skills.join(", ")+"; falta "+(v.falta.join(", ")||"nada");
      try{navigator.clipboard.writeText(txt).then(function(){st.textContent="✓ Pedido copiado. Cole numa conversa nova do Claude.";window.open("https://claude.ai/new","_blank","noopener")})}catch(e){prompt("Copie:",txt)}};
    p.appendChild(h("div",{class:"vfil"},sb,gerar,cl));p.appendChild(st);var ul=h("ul",{class:"wl"});p.appendChild(ul);
    function desenha(){ul.innerHTML="";(x.versoes||[]).forEach(function(v){var ver=h("button",{type:"button",class:"ghostbtn",text:"Ver / imprimir"});ver.onclick=function(){carImprimir(carBase(v.base||"dados")||base(),v,x)};
      ul.appendChild(h("li",null,h("span",{class:"grow"},h("b",{text:"Versão de "+dataBR(v.data)+(v.base==="suporte"?" · base Suporte":" · base Dados")+(v.nota!=null?" · "+v.nota+"% compatível":"")}),h("span",{class:"sub",text:"Destaque: "+(v.skills.join(", ")||"—")+(v.historias.length?" · histórias: "+v.historias.map(function(s){return s.titulo}).join("; "):"")})),ver))});
      if(!(x.versoes||[]).length)ul.appendChild(h("li",null,h("span",{class:"sub",text:"Nenhuma versão ainda."})))}
    desenha();return p}

  /* ---------- compatibilidade: perfil + ranking das vagas abertas ---------- */
  function carCompat(root){
    var meus=carMeus(),pp=panel("Suas competências","Marque o que você domina. A nota de cada vaga é a parte do que ela pede que você já tem.");
    var g=h("div",{class:"skillgrid"});NUCLEO.SKILLS.forEach(function(k){var cb=h("input",{type:"checkbox"});cb.checked=meus.indexOf(k[0])>=0;
      cb.onchange=function(){var s=carMeus().filter(function(x){return x!==k[0]});if(cb.checked)s.push(k[0]);pessoalGravar("perfilCarreira",Object.assign({},PESSOAL.perfilCarreira||{},{skills:s}));renderCarreira("compat")};
      g.appendChild(h("label",{class:"chk"},cb," "+k[1]))});pp.appendChild(g);root.appendChild(pp);
    var pv=panel("Vagas abertas por compatibilidade","Pelo título e nível (o portal não traz a descrição). Para a nota exata, salve no funil e cole a descrição."),ul=h("ul",{class:"wl"},h("li",null,h("span",{class:"sub",text:"Carregando…"})));pv.appendChild(ul);root.appendChild(pv);
    /* o que mais aparece nas vagas: onde vale a pena estudar */
    var pf=panel("O que o mercado mais pede (e você ainda não marcou)");root.appendChild(pf);
    getJson("vagas.json").then(function(d){var vs=(d.vagas||[]).map(function(v){return {v:v,cp:NUCLEO.compatVaga(v.t+" "+(v.nv||""),meus)}}).filter(function(x){return x.cp.nota!=null}).sort(function(a,b){return b.cp.nota-a.cp.nota||a.v.d-b.v.d});
      ul.innerHTML="";vs.slice(0,25).forEach(function(x){var sv=h("button",{type:"button",class:"ghostbtn",text:"Salvar no funil"});sv.onclick=function(){carSalvarVaga(x.v);sv.textContent="✓ No funil";sv.disabled=true};
        ul.appendChild(h("li",null,h("span",{class:"grow"},h("b",{text:x.v.t}),h("span",{class:"sub",text:[x.v.e,x.v.m,x.cp.nota+"% · pede "+x.cp.pede.map(carSkillNome).join(", ")].filter(Boolean).join(" · ")})),sv))});
      var cont={};(d.vagas||[]).forEach(function(v){NUCLEO.compatVaga(v.t+" "+(v.nv||""),[]).pede.forEach(function(k){cont[k]=(cont[k]||0)+1})});
      var top=Object.keys(cont).sort(function(a,b){return cont[b]-cont[a]});
      pf.appendChild(h("ul",{class:"wl"},top.map(function(k){return h("li",{class:meus.indexOf(k)<0?"alerta":null},h("span",{class:"grow",text:carSkillNome(k)}),h("span",{class:"end",text:cont[k]+" vagas"+(meus.indexOf(k)<0?" · falta":"")}))})))})
      .catch(function(e){ul.innerHTML="";ul.appendChild(h("li",null,h("span",{class:"sub",text:"Não consegui ler as vagas ("+e.message+")."})))})}

  /* ---------- histórias STAR ---------- */
  function carStar(root){
    var l=PESSOAL.historias||[],p=panel("Banco de histórias (STAR)","Situação, Tarefa, Ação e Resultado: escreva uma vez e use em todas as entrevistas. Cite números e ferramentas: as histórias aparecem junto das vagas que pedem o mesmo.");
    var nv=h("button",{type:"button",class:"ghostbtn pri",text:"+ Nova história"});p.appendChild(h("div",{class:"vfil"},nv));root.appendChild(p);
    function form(s){var novo=!s;s=s||{id:"s"+Date.now().toString(36)};var fp=panel(novo?"Nova história":s.titulo),f=h("div",{class:"wform"});
      function ta(rot,k,ph){var t=h("textarea",{rows:"3",placeholder:ph});t.value=s[k]||"";t.dataset.k=k;f.appendChild(h("label",null,rot,t));return t}
      var ti=h("input",{type:"text",value:s.titulo||"",placeholder:"Ex.: Dashboard que reduziu o tempo de fechamento"});f.appendChild(h("label",null,"Título",ti));
      ta("Situação","s","Contexto: empresa, problema, quem estava envolvido");ta("Tarefa","t","O que era responsabilidade sua");ta("Ação","a","O que você fez (ferramentas: SQL, Power BI…)");ta("Resultado","r","Números: tempo economizado, % de melhora, decisão tomada");
      var tg=h("input",{type:"text",value:s.tags||"",placeholder:"Palavras-chave: SQL, Power BI, stakeholders…"});f.appendChild(h("label",null,"Palavras-chave",tg));
      var ok=h("button",{type:"button",text:"Salvar"}),volta=h("button",{type:"button",class:"ghostbtn",text:"Cancelar"});volta.onclick=function(){renderCarreira("star")};
      ok.onclick=function(){if(!ti.value.trim())return ti.focus();var o={id:s.id,titulo:ti.value.trim(),tags:tg.value.trim()};f.querySelectorAll("textarea").forEach(function(t){o[t.dataset.k]=t.value.trim()});
        pessoalGravar("historias",[o].concat((PESSOAL.historias||[]).filter(function(x){return x.id!==s.id})));renderCarreira("star")};
      f.appendChild(h("div",{class:"vfil"},ok,volta));fp.appendChild(f);root.insertBefore(fp,root.children[1]);ti.focus()}
    nv.onclick=function(){form(null)};
    l.forEach(function(s){var c=h("div",{class:"panel"},h("h3",{text:s.titulo}),
      h("dl",{class:"star"},[["S",s.s],["T",s.t],["A",s.a],["R",s.r]].map(function(x){return [h("dt",{text:x[0]}),h("dd",{text:x[1]||"—"})]})),
      s.tags?h("p",{class:"sub",text:s.tags}):null);
      var ed=h("button",{type:"button",class:"ghostbtn",text:"Editar"});ed.onclick=function(){form(s)};
      var rm=h("button",{type:"button",class:"ghostbtn",text:"Apagar"});rm.onclick=function(){pessoalGravar("historias",(PESSOAL.historias||[]).filter(function(x){return x.id!==s.id}));renderCarreira("star")};
      c.appendChild(h("div",{class:"vfil"},ed,rm));root.appendChild(c)});
    if(!l.length)root.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Nenhuma história ainda. Comece pela sua maior entrega com dados."})))}

  /* ---------- prática de SQL com os seus dados (SQLite no navegador) ---------- */
  var SQLJS="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/",SQLDB=null;
  var EXERCICIOS=[
    ["Quantos itens de compra existem?","SELECT COUNT(*) AS itens FROM compras;"],
    ["Quanto você gastou em cada mês? (mes, total), do mais antigo ao mais novo","SELECT mes, ROUND(SUM(valor_total),2) AS total FROM compras GROUP BY mes ORDER BY mes;"],
    ["Os 10 produtos em que você mais gastou","SELECT produto, ROUND(SUM(valor_total),2) AS gasto FROM compras GROUP BY produto ORDER BY gasto DESC LIMIT 10;"],
    ["Em qual mercado você mais gastou?","SELECT mercado, ROUND(SUM(valor_total),2) AS gasto FROM compras GROUP BY mercado ORDER BY gasto DESC LIMIT 1;"],
    ["Preço médio, mínimo e máximo do produto que você mais comprou (em número de compras)","SELECT produto, ROUND(AVG(valor_unitario),2) AS medio, MIN(valor_unitario) AS minimo, MAX(valor_unitario) AS maximo FROM compras WHERE produto = (SELECT produto FROM compras GROUP BY produto ORDER BY COUNT(*) DESC LIMIT 1) GROUP BY produto;"],
    ["Treinos por tipo: quantidade e km somados, do mais frequente ao menos","SELECT tipo, COUNT(*) AS treinos, ROUND(SUM(distancia_km),1) AS km FROM treinos GROUP BY tipo ORDER BY treinos DESC;"],
    ["Em que mês você mais caminhou (km)?","SELECT substr(data,1,7) AS mes, ROUND(SUM(distancia_km),1) AS km FROM treinos WHERE tipo='walking' GROUP BY mes ORDER BY km DESC LIMIT 1;"],
    ["Média de horas de sono por dia da semana (0 = domingo)","SELECT strftime('%w', data) AS dia_semana, ROUND(AVG(sono_h),2) AS sono FROM saude WHERE sono_h IS NOT NULL GROUP BY dia_semana ORDER BY dia_semana;"],
    ["Quantos dias tiveram VFC abaixo da sua média?","SELECT COUNT(*) AS dias FROM saude WHERE vfc < (SELECT AVG(vfc) FROM saude);"],
    ["Passos médios em dias COM e SEM musculação (JOIN/LEFT JOIN)","SELECT CASE WHEN t.data IS NULL THEN 'sem' ELSE 'com' END AS musculacao, ROUND(AVG(s.passos)) AS passos FROM saude s LEFT JOIN (SELECT DISTINCT data FROM treinos WHERE tipo='strength_training') t ON t.data = s.data WHERE s.passos IS NOT NULL GROUP BY musculacao ORDER BY musculacao;"],
    ["Gasto acumulado mês a mês (função de janela)","SELECT mes, total, ROUND(SUM(total) OVER (ORDER BY mes),2) AS acumulado FROM (SELECT mes, ROUND(SUM(valor_total),2) AS total FROM compras GROUP BY mes) ORDER BY mes;"],
    ["Gastos da família por quem (registros com custo)","SELECT quem, ROUND(SUM(custo),2) AS gasto FROM registros WHERE custo IS NOT NULL GROUP BY quem ORDER BY gasto DESC;"]];
  function carSqlBanco(st){
    if(SQLDB)return Promise.resolve(SQLDB);
    function lib(){return window.initSqlJs?Promise.resolve():new Promise(function(ok,erro){var s=document.createElement("script");s.src=SQLJS+"sql-wasm.js";s.onload=ok;s.onerror=function(){erro(new Error("não consegui baixar o SQLite"))};document.head.appendChild(s)})}
    function pag(t,cols,de,acc){return SB.from(t).select(cols).range(de,de+999).then(sbOk).then(function(l){acc=acc.concat(l);return l.length===1000?pag(t,cols,de+1000,acc):acc})}
    st("Carregando o SQLite e os seus dados…");
    return Promise.all([lib().then(function(){return window.initSqlJs({locateFile:function(f){return SQLJS+f}})}),pag("compras","data,mes,mercado,categoria,produto,quantidade,valor_unitario,valor_total",0,[]),
      pag("garmin_dia","data,dados",0,[]).catch(function(){return []}),pag("garmin_ativ","inicio,tipo,dados",0,[]).catch(function(){return []}),pag("registros","quem,tipo,data,titulo,dados",0,[]).catch(function(){return []})]).then(function(r){
      var db=new r[0].Database();
      function tab(nome,cols,linhas){db.run("CREATE TABLE "+nome+" ("+cols.join(",")+")");var stmt=db.prepare("INSERT INTO "+nome+" VALUES ("+cols.map(function(){return "?"}).join(",")+")");linhas.forEach(function(l){stmt.run(l)});stmt.free()}
      tab("compras",["data TEXT","mes TEXT","mercado TEXT","categoria TEXT","produto TEXT","quantidade REAL","valor_unitario REAL","valor_total REAL"],r[1].map(function(x){return [x.data,String(x.mes||x.data).slice(0,7),x.mercado,x.categoria,x.produto,+x.quantidade,+x.valor_unitario,+x.valor_total]}));
      tab("saude",["data TEXT","passos INTEGER","sono_h REAL","sono_nota INTEGER","vfc INTEGER","fc_repouso INTEGER","estresse INTEGER","body_battery INTEGER"],r[2].map(function(x){var d=x.dados||{},s=d.sono||{};return [x.data,d.passos==null?null:d.passos,s.total?Math.round(s.total/36)/100:null,s.nota==null?null:s.nota,(d.vfc||{}).noite==null?null:d.vfc.noite,d.fcRepouso==null?null:d.fcRepouso,d.estresse==null?null:d.estresse,d.bbMax==null?null:d.bbMax]}));
      tab("treinos",["data TEXT","hora TEXT","tipo TEXT","nome TEXT","distancia_km REAL","duracao_min REAL","fc_media INTEGER","calorias INTEGER"],r[3].map(function(x){var d=x.dados||{};return [x.inicio.slice(0,10),x.inicio.slice(11,16),x.tipo,d.nome||null,d.distancia?Math.round(d.distancia/10)/100:0,d.duracao?Math.round(d.duracao/6)/10:null,d.fc==null?null:Math.round(d.fc),d.calorias==null?null:Math.round(d.calorias)]}));
      tab("registros",["quem TEXT","tipo TEXT","data TEXT","titulo TEXT","custo REAL"],r[4].map(function(x){var c=(x.dados||{}).custo;return [x.quem,x.tipo,x.data,x.titulo,typeof c==="number"?c:null]}));
      SQLDB=db;return db})}
  function sqlTabela(res){if(!res.length)return h("p",{class:"sub",text:"(nenhuma linha)"});var r=res[res.length-1];
    return h("div",{class:"famtabw"},h("table",{class:"famtab"},h("thead",null,h("tr",null,r.columns.map(function(c){return h("th",{text:c})}))),h("tbody",null,r.values.slice(0,200).map(function(v){return h("tr",null,v.map(function(x){return h("td",{text:x==null?"NULL":String(x)})}))}))))}
  function sqlIgual(a,b,ordem){function linhas(res){var r=res[res.length-1];return r?r.values.map(function(v){return JSON.stringify(v.map(function(x){return typeof x==="number"?Math.round(x*100)/100:x}))}):[]}
    var x=linhas(a),y=linhas(b);if(!ordem){x.sort();y.sort()}return x.length===y.length&&x.every(function(v,i){return v===y[i]})}
  function carSql(root){
    var p=panel("Praticar SQL com os seus dados","SQLite rodando no navegador, com 4 tabelas montadas a partir do site: compras (Mercado), saude (Garmin por dia), treinos (Garmin) e registros (família e veículos). Nada sai do seu aparelho.");
    var st=h("p",{class:"sub",role:"status"});p.appendChild(st);root.appendChild(p);
    var ex=h("select",null,[h("option",{value:"",text:"Exercício livre"})].concat(EXERCICIOS.map(function(e,i){return h("option",{value:String(i),text:(i+1)+". "+e[0]})})));
    var ed=h("textarea",{class:"sqled",rows:"7",spellcheck:"false"});ed.value="SELECT * FROM compras LIMIT 10;";
    var rodar=h("button",{type:"button",text:"Rodar (Ctrl+Enter)"}),conf=h("button",{type:"button",class:"ghostbtn",text:"Conferir a resposta"}),sol=h("button",{type:"button",class:"ghostbtn",text:"Ver a solução"});
    var out=h("div"),feitos=(PESSOAL.sqlFeitos||{});
    var pe=panel(null);pe.appendChild(h("div",{class:"wform"},h("label",null,"Exercício",ex),h("label",null,"Sua consulta",ed),h("div",{class:"vfil"},rodar,conf,sol)));pe.appendChild(out);root.appendChild(pe);
    var pt=panel("Tabelas");root.appendChild(pt);
    carSqlBanco(function(t){st.textContent=t}).then(function(db){
      st.textContent="✓ Pronto. Feitos: "+Object.keys(feitos).length+" de "+EXERCICIOS.length+".";
      ["compras","saude","treinos","registros"].forEach(function(t){var n=db.exec("SELECT COUNT(*) FROM "+t)[0].values[0][0],cols=db.exec("PRAGMA table_info("+t+")")[0].values.map(function(v){return v[1]+" "+v[2]});
        pt.appendChild(h("p",null,h("b",{text:t+" ("+n+" linhas): "}),cols.join(", ")))})}).catch(function(e){st.textContent="Não consegui montar o banco: "+e.message;logErro("sql",e)});
    function rodarSql(q){return carSqlBanco(function(t){st.textContent=t}).then(function(db){return db.exec(q)})}
    rodar.onclick=function(){out.innerHTML="";rodarSql(ed.value).then(function(r){out.appendChild(sqlTabela(r))}).catch(function(e){out.appendChild(h("p",{class:"qrwarn",text:"Erro: "+e.message}))})};
    ed.addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();rodar.click()}});
    ex.onchange=function(){out.innerHTML="";if(ex.value==="")return;ed.value="-- "+EXERCICIOS[+ex.value][0]+"\n";ed.focus()};
    conf.onclick=function(){if(ex.value==="")return;var e=EXERCICIOS[+ex.value];out.innerHTML="";
      Promise.all([rodarSql(ed.value),rodarSql(e[1])]).then(function(r){var ok=sqlIgual(r[0],r[1],/ORDER BY/i.test(e[1]));
        out.appendChild(h("p",{class:ok?"capok":"qrwarn",text:ok?"✓ Certo!":"Ainda não bate com o esperado. Compare abaixo."}));out.appendChild(sqlTabela(r[0]));
        if(ok){var f=Object.assign({},PESSOAL.sqlFeitos||{});f[ex.value]=hojeISO();pessoalGravar("sqlFeitos",f)}else{out.appendChild(h("p",{class:"sub",text:"Esperado:"}));out.appendChild(sqlTabela(r[1]))}})
      .catch(function(err){out.appendChild(h("p",{class:"qrwarn",text:"Erro: "+err.message}))})};
    sol.onclick=function(){if(ex.value!=="")ed.value=EXERCICIOS[+ex.value][1]}}

  /* ---------- portfólio: estudo de caso "dados da minha vida", anonimizado ---------- */
  function carPortfolio(root){
    var p=panel("Estudo de caso para o portfólio","Um projeto público com os seus dados reais, sem nada que identifique você: datas viram “dia 1, dia 2…”, mercados viram “Mercado A, B…”, sem nomes de produtos que revelem marca de remédio, sem local dos treinos.");
    var st=h("p",{class:"sub",role:"status"}),b=h("button",{type:"button",text:"Baixar o pacote do estudo de caso (.zip)"});p.appendChild(h("div",{class:"vfil"},b));p.appendChild(st);
    p.appendChild(h("h3",{class:"mbag",text:"Perguntas que o estudo responde"}));
    p.appendChild(h("ul",{class:"famori"},["Como o gasto de mercado varia por mês e por categoria? Qual categoria mais cresceu?","Dormir melhor muda a VFC e o estresse do dia seguinte?",
      "Treinar (musculação, caminhada) aumenta os passos e o gasto calórico da semana?","Quanto custa manter a casa por mês (mercado + família + veículos)?"].map(function(t){return h("li",{text:t})})));
    root.appendChild(p);
    b.onclick=function(){b.disabled=true;carSqlBanco(function(t){st.textContent=t}).then(function(db){
      var enc=new TextEncoder(),arqs=[];function csv(q){var r=db.exec(q)[0];if(!r)return "";return r.columns.join(",")+"\n"+r.values.map(function(v){return v.map(function(x){return x==null?"":/[",\n]/.test(String(x))?'"'+String(x).replace(/"/g,'""')+'"':x}).join(",")}).join("\n")}
      /* âncora de datas: o primeiro dia com dado vira o dia 1 */
      var d0=db.exec("SELECT MIN(d) FROM (SELECT MIN(data) d FROM compras UNION SELECT MIN(data) FROM saude UNION SELECT MIN(data) FROM treinos UNION SELECT MIN(data) FROM registros)")[0].values[0][0];
      var dia="CAST(julianday(data)-julianday('"+d0+"')+1 AS INTEGER)",mesRel="CAST((julianday(data)-julianday('"+d0+"'))/30.44 AS INTEGER)+1";
      db.run("DROP TABLE IF EXISTS _merc;CREATE TABLE _merc AS SELECT mercado, 'Mercado '||char(64+ROW_NUMBER() OVER (ORDER BY SUM(valor_total) DESC)) AS apelido FROM compras GROUP BY mercado");
      arqs.push({nome:"dados/compras_mensais_por_categoria.csv",dados:enc.encode(csv("SELECT "+mesRel+" AS mes, categoria, COUNT(*) AS itens, ROUND(SUM(valor_total),2) AS total FROM compras GROUP BY 1,2 ORDER BY 1,2"))});
      arqs.push({nome:"dados/compras_por_mercado.csv",dados:enc.encode(csv("SELECT m.apelido AS mercado, COUNT(*) AS itens, ROUND(SUM(c.valor_total),2) AS total FROM compras c JOIN _merc m USING(mercado) GROUP BY 1 ORDER BY 3 DESC"))});
      arqs.push({nome:"dados/saude_diaria.csv",dados:enc.encode(csv("SELECT "+dia+" AS dia, strftime('%w',data) AS dia_semana, passos, sono_h, sono_nota, vfc, fc_repouso, estresse, body_battery FROM saude ORDER BY 1"))});
      arqs.push({nome:"dados/treinos.csv",dados:enc.encode(csv("SELECT "+dia+" AS dia, tipo, distancia_km, duracao_min, fc_media, calorias FROM treinos ORDER BY 1"))});
      arqs.push({nome:"dados/custos_da_casa_mensais.csv",dados:enc.encode(csv("SELECT "+mesRel+" AS mes, CASE WHEN quem IN ('civic','moto','c3') THEN 'veiculos' WHEN quem='eddie' THEN 'pet' ELSE 'bebe' END AS area, ROUND(SUM(custo),2) AS total FROM registros WHERE custo IS NOT NULL GROUP BY 1,2 ORDER BY 1,2"))});
      arqs.push({nome:"consultas.sql",dados:enc.encode(EXERCICIOS.map(function(e,i){return "-- "+(i+1)+". "+e[0]+"\n"+e[1]}).join("\n\n")+"\n")});
      arqs.push({nome:"README.md",dados:enc.encode("# Dados da minha vida: casa, saúde e treinos\n\nEstudo de caso com dados reais de vários anos, anonimizados: datas relativas (dia 1 = primeiro registro), mercados como \"Mercado A, B…\" e sem local dos treinos.\n\n"+
        "## Perguntas\n1. Como o gasto de mercado varia por mês e categoria?\n2. Dormir melhor muda a VFC e o estresse do dia seguinte?\n3. Treinar aumenta os passos e o gasto calórico da semana?\n4. Quanto custa manter a casa por mês?\n\n"+
        "## Dados (pasta dados/)\n- compras_mensais_por_categoria.csv, compras_por_mercado.csv: notas fiscais lançadas no site\n- saude_diaria.csv: relógio Garmin (passos, sono, VFC, FC de repouso, estresse, Body Battery)\n- treinos.csv: atividades do Garmin\n- custos_da_casa_mensais.csv: gastos registrados com bebê, pet e veículos\n\n"+
        "## Ferramentas\nSQL (consultas.sql, SQLite), Power BI ou Python para os gráficos. Sugestão de painel: tendência de gasto, sono × VFC (dispersão com defasagem de 1 dia), treinos por semana.\n\n## Coleta\nDados coletados por um site pessoal (HTML/JS + Supabase), com integração à API pessoal do Garmin e leitura de notas fiscais.\n")});
      baixarArquivo(zipCriar(arqs),"estudo-de-caso-dados-da-minha-vida.zip");st.textContent="✓ Pacote baixado: 5 tabelas anonimizadas, consultas.sql e README.md.";b.disabled=false})
      .catch(function(e){st.textContent="Não consegui gerar: "+e.message;logErro("portfólio",e);b.disabled=false})}}
