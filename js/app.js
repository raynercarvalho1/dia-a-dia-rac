/* Dia a Dia RAC — núcleo: login, menu e rotas, utilidades, tela inicial, aniversários, perfis do X, estudos, sincronização e falhas.
   As seções grandes ficam em js/<seção>.js e carregam só quando abertas (veja modulo() e ROTA_MODS). */
  var NUCLEO=window.RACnucleo,urlAbs=NUCLEO.urlAbs,lerAbast=NUCLEO.lerAbast,TEMAS=NUCLEO.TEMAS,temasDe=NUCLEO.temasDe,juntarDados=NUCLEO.juntarDados;
  var MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  var $=function(s){return document.querySelector(s)};
  var $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
  var now=new Date();
  $("#hoje").textContent=now.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});

  /* Rotas por hash: #esportes/beisebol/liga, #esportes/beisebol/time-119, #esportes/beisebol/jogo-849805,
     #esportes/basquete/jogo-401909092, #x/jornalistas, #vagas ... */
  var tabs=["inicio","esportes","vagas","mercado","aniversarios","em-breve","x","estudos","mba","saude","conexoes","agenda","busca","sistema","resumo","lista","carreira","documentos","eddie","olivia","veiculos"];
  var DA_CASA=["mercado","lista","eddie","olivia","veiculos","documentos"];
  var sports=["beisebol","basquete","futebol-americano"];
  function mark(sel,attr,val){document.querySelectorAll(sel).forEach(function(a){
    if(a.dataset[attr]===val)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")})}
  /* Marca o item da barra lateral e copia o ícone e o nome dele para o título da página */
  function sideMark(key,top){
    var links=document.querySelectorAll(".side a.it[data-k]"),hit=null;
    links.forEach(function(a){if(a.dataset.k===key)hit=a});
    if(!hit)links.forEach(function(a){if(!hit&&a.dataset.k===top)hit=a});
    links.forEach(function(a){if(a===hit)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
    var ic=hit&&hit.querySelector(".ico"),n=ic?ic.cloneNode(true):h("span");
    n.id="pico";$("#pico").replaceWith(n);
    $("#ptitle").textContent=hit?hit.querySelector(".t").textContent:"Dia a Dia RAC"}
  /* ===== Módulos: cada seção grande fica em js/<seção>.js e só carrega quando é aberta ===== */
  var MOD_VERSAO="2026-10-29.5",MODULOS={},MOD_OK={};
  var MOD_DEPS={conexoes:["mba"],sistema:["familia","mba","saude"],carreira:["sistema"],bebe:["familia","oms"],resumo:["saude","mba","familia"]};
  var ROTA_MODS={esportes:["esportes"],eddie:["familia"],olivia:["familia"],veiculos:["familia"],mba:["mba"],saude:["saude"],
    conexoes:["conexoes"],agenda:["sistema"],busca:["sistema"],sistema:["sistema"],lista:["lista"],carreira:["carreira"],documentos:["familia"],resumo:["resumo"]};
  function modulo(n){
    if(MODULOS[n])return MODULOS[n];
    MODULOS[n]=Promise.all((MOD_DEPS[n]||[]).map(modulo)).then(function(){return new Promise(function(ok,erro){
      var s=document.createElement("script");s.src="js/"+n+".js?v="+MOD_VERSAO;
      s.onload=function(){MOD_OK[n]=1;ok()};s.onerror=function(){delete MODULOS[n];erro(new Error("não consegui carregar a seção "+n+" (sem internet?)"))};
      document.head.appendChild(s)})});
    return MODULOS[n]}
  function precisa(l){return Promise.all(l.map(modulo))}
  /* cartão da tela inicial que depende de um módulo: aparece "carregando" e é trocado quando o módulo chega */
  function wLazy(mods,nome){
    var ph=h("div",{class:"panel"},h("p",{class:"sub",text:"Carregando…"}));
    precisa(mods).then(function(){var el=window[nome]();if(ph.parentNode)ph.replaceWith(el)})
      .catch(function(e){ph.innerHTML="";ph.appendChild(h("p",{class:"sub",text:"Não consegui carregar agora ("+e.message+")."}));logErro("módulo",e)});
    return ph}
  function route(){
    if(!PAPEL)return;
    var parts=(location.hash||"").replace("#","").split("/");
    if(parts[0]==="captura"){history.replaceState(null,"","#"+(isOwner()?"inicio":"lista"));setTimeout(function(){abrirCaptura()},300);parts=[isOwner()?"inicio":"lista"]}
    var top=tabs.indexOf(parts[0])<0?"inicio":parts[0];
    /* a esposa vê o Mercado, o Eddie, a Olivia e os Veículos; o resto leva ao Mercado */
    if(PAPEL==="casa"&&DA_CASA.indexOf(top)<0){top="mercado";parts=["mercado"]}
    var faltam=(ROTA_MODS[top]||[]).filter(function(n){return !MOD_OK[n]});
    if(faltam.length){precisa(faltam).then(route,function(e){logErro("módulo",e);var v=document.querySelector("#"+top+" .stack, #"+top);
      tabs.forEach(function(t){document.getElementById(t).hidden=(t!==top)});if(v)v.insertBefore(h("div",{class:"panel"},h("p",{class:"empty",text:"Não consegui abrir esta seção agora ("+e.message+"). Tente de novo."})),v.firstChild)});return}
    tabs.forEach(function(t){document.getElementById(t).hidden=(t!==top)});
    document.documentElement.setAttribute("data-sec",top);
    if(top!=="eddie"&&top!=="olivia"&&top!=="veiculos")fundoPagina(null);
    /* voltar ao Início em todas as páginas (a esposa não tem o Início) */
    $("#homebtn").hidden=top==="inicio"||PAPEL==="casa";
    setSide(false);
    window.scrollTo(0,0);
    if(top==="x"){var cat=xCats().some(function(c){return c.k===parts[1]})?parts[1]:"";sideMark(cat?"x/"+cat:"x","x");renderX(cat);return}
    if(top==="mercado"){sideMark("mercado","mercado");if(window.RACmercado)window.RACmercado.render(parts[1]||"");return}
    if(top==="inicio"){sideMark("inicio","inicio");renderInicio();return}
    if(top==="estudos"){sideMark("estudos","estudos");renderEstudos();return}
    if(top==="mba"){sideMark("mba","mba");renderMba();return}
    if(top==="documentos"){sideMark("documentos","documentos");renderFamilia("docs");return}
    if(top==="carreira"){sideMark("carreira","carreira");renderCarreira(parts[1],parts[2]);return}
    if(top==="lista"){sideMark("lista","lista");renderLista(parts[1]);return}
    if(top==="agenda"){sideMark("agenda","agenda");renderAgenda();return}
    if(top==="resumo"){sideMark("resumo","resumo");renderResumo(parts[1]);return}
    if(top==="busca"){sideMark("busca","busca");$("#ptitle").textContent="Busca";renderBusca(decodeURIComponent(parts.slice(1).join("/")||""));return}
    if(top==="sistema"){sideMark("sistema","sistema");renderSistema();return}
    if(top==="conexoes"){sideMark("conexoes","conexoes");renderConexoes(parts[1],decodeURIComponent(parts[2]||""));return}
    if(top==="saude"){sideMark("saude","saude");renderSaude(parts[1]==="treino"?parts[2]:null);return}
    if(top==="eddie"||top==="olivia"){sideMark(top,top);renderFamilia(top);return}
    if(top==="veiculos"){sideMark("veiculos","veiculos");renderVeiculos(parts[1]);return}
    if(top!=="esportes"){sideMark(top,top);return}
    var sp=sports.indexOf(parts[1])<0?"beisebol":parts[1];
    sports.forEach(function(x){document.getElementById("sp-"+x).hidden=(x!==sp)});
    var v=parts[2]||"";
    sideMark("esportes/"+sp+(sp==="beisebol"&&v==="dodgers"?"/dodgers":""),"esportes");
    if(sp==="beisebol"){
      v=v||"liga";
      mark(".pills a","v",/^time-/.test(v)?"times":v);
      renderMlb(v)}
    else renderEspn(sp==="basquete"?"nba":"nfl",v)
  }
  window.addEventListener("hashchange",route);

  /* Barra lateral: no celular ela desliza por cima do conteúdo */
  var app=$("#app");
  var travaY=null;
  function setSide(open){
    /* no celular, trava a página de fundo enquanto o menu está aberto (no iPhone, só overflow:hidden não basta) */
    if(open&&innerWidth<=860&&travaY==null){travaY=scrollY;document.body.style.top=-travaY+"px";document.documentElement.classList.add("travado")}
    if(!open&&travaY!=null){document.documentElement.classList.remove("travado");document.body.style.top="";scrollTo(0,travaY);travaY=null}
    app.classList.toggle("open",open);$("#openside").setAttribute("aria-expanded",open?"true":"false")}
  addEventListener("resize",function(){if(travaY!=null&&innerWidth>860)setSide(false)});
  $("#openside").addEventListener("click",function(){setSide(true)});
  $("#closeside").addEventListener("click",function(){setSide(false)});
  $("#scrimbg").addEventListener("click",function(){setSide(false)});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&app.classList.contains("open"))setSide(false)});
  /* no celular: arrastar o dedo para a direita abre o menu e para a esquerda fecha; o menu acompanha o dedo.
     Não vale em cima do que já rola para o lado (tabelas, mapas, gráficos, botões em faixa) nem em campos de texto. */
  (function(){
    var side=$("#side"),x0=0,y0=0,t0=0,arr=false,eixo=null,aberto=false,larg=0;
    function celular(){return innerWidth<=860}
    function rolaParaLado(el){for(;el&&el!==document.body;el=el.parentElement){
      if(el.matches&&el.matches("input,textarea,select,.tmapa,.leaflet-container,.gm-style,.tgraf,.vbars,[data-noswipe]"))return true;
      var cs=getComputedStyle(el);if(/(auto|scroll)/.test(cs.overflowX)&&el.scrollWidth>el.clientWidth+2)return true}return false}
    document.addEventListener("touchstart",function(e){
      if(!celular()||e.touches.length!==1)return;aberto=app.classList.contains("open");
      if(!aberto&&rolaParaLado(e.target))return;
      var t=e.touches[0];x0=t.clientX;y0=t.clientY;t0=Date.now();arr=true;eixo=null;larg=side.getBoundingClientRect().width||300},{passive:true});
    document.addEventListener("touchmove",function(e){
      if(!arr)return;var t=e.touches[0],dx=t.clientX-x0,dy=t.clientY-y0;
      if(!eixo){if(Math.abs(dx)<10&&Math.abs(dy)<10)return;eixo=Math.abs(dx)>Math.abs(dy)*1.3?"x":"y";if(eixo==="y"){arr=false;return}
        if((!aberto&&dx<0)||(aberto&&dx>0)){arr=false;return}side.style.transition="none"}
      var desl=aberto?Math.min(0,dx):Math.min(0,dx-larg-16);side.style.transform="translateX("+desl+"px)"},{passive:true});
    document.addEventListener("touchend",function(e){
      if(!arr)return;arr=false;if(eixo!=="x")return;
      var dx=(e.changedTouches[0].clientX-x0),rapido=Math.abs(dx)/(Date.now()-t0)>0.4;
      side.style.transition="";side.style.transform="";
      if(!aberto)setSide(dx>larg*0.35||(rapido&&dx>40));else setSide(!(-dx>larg*0.3||(rapido&&dx<-40)))});
    /* depois de rolar a página, um botão de menu fica sempre à mão no canto */
    var flut=h("button",{type:"button",class:"menuflut","aria-label":"Abrir menu",hidden:""});flut.innerHTML=$("#openside").innerHTML;
    flut.onclick=function(){setSide(true)};document.body.appendChild(flut);
    addEventListener("scroll",function(){flut.hidden=!(celular()&&scrollY>220)},{passive:true});
  })();

  /* Foto de fundo (Wikimedia Commons, licença livre); a escolha fica salva neste navegador */
  var BGS=[
    {k:"dodger",n:"Dodger Stadium",u:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Dodger_Stadium_and_DTLA.jpg/1920px-Dodger_Stadium_and_DTLA.jpg",by:"Cody Williams",lic:"CC BY-SA 4.0",src:"https://commons.wikimedia.org/wiki/File:Dodger_Stadium_and_DTLA.jpg"},
    {k:"yosemite",n:"Yosemite",u:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Tunnel_View%2C_Yosemite_Valley%2C_Yosemite_NP_-_Diliff.jpg/1920px-Tunnel_View%2C_Yosemite_Valley%2C_Yosemite_NP_-_Diliff.jpg",by:"Diliff",lic:"CC BY-SA 3.0",src:"https://commons.wikimedia.org/wiki/File:Tunnel_View,_Yosemite_Valley,_Yosemite_NP_-_Diliff.jpg"}];
  function setBg(k){
    var b=BGS.filter(function(x){return x.k===k})[0]||BGS[0];
    fundoDaPagina=null;var bgi=$("#bgimg");bgi.style.removeProperty("--bgpos");bgi.classList.remove("mosaico");bgi.innerHTML="";
    $("#bgimg").style.setProperty("--bgurl",'url("'+b.u+'")');
    document.querySelectorAll("#bgpick button").forEach(function(x){x.setAttribute("aria-pressed",x.dataset.k===b.k?"true":"false")});
    var cr=$("#credit");cr.innerHTML="";
    cr.appendChild(document.createTextNode("Foto: "+b.n+", de "+b.by+" ("));
    cr.appendChild(h("a",{href:b.src,target:"_blank",rel:"noopener",text:b.lic}));
    cr.appendChild(document.createTextNode(")"));
    try{localStorage.setItem("rac-fundo",b.k)}catch(e){}}
  BGS.forEach(function(b){
    var bt=h("button",{type:"button",title:b.n,"aria-label":"Fundo: "+b.n,style:'background-image:url("'+b.u+'")'});bt.dataset.k=b.k;
    bt.onclick=function(){setBg(b.k)};$("#bgpick").appendChild(bt)});
  function fundoSalvo(){try{return localStorage.getItem("rac-fundo")}catch(e){return null}}
  setBg(fundoSalvo());
  /* Páginas com foto própria (Eddie, Olivia) usam a foto dela de fundo; ao sair, volta o fundo escolhido */
  var fundoDaPagina=null;
  /* largo: foto deitada (carro, moto), em quadros mais largos que altos */
  function fundoPagina(url,nome,largo){
    if(!url){if(fundoDaPagina)setBg(fundoSalvo());return}
    if(fundoDaPagina===url)return;
    /* a foto em vários quadros (mosaico), alternando o lado, em vez de uma foto só esticada */
    fundoDaPagina=url;var bg=$("#bgimg");bg.style.setProperty("--bgurl","none");bg.classList.add("mosaico");bg.innerHTML="";
    var n=Math.ceil(Math.max(screen.width,innerWidth,1600)/180)*Math.ceil(Math.max(screen.height,innerHeight,1000)/250),g=h("div",{class:"mos"+(largo?" largo":"")});
    for(var i=0;i<n;i++)g.appendChild(h("img",{src:url,alt:"",class:i%2?"esp":null,decoding:"async"}));
    bg.appendChild(g);
    var cr=$("#credit");cr.innerHTML="";cr.appendChild(document.createTextNode("Foto: "+nome))}
  /* Seletor de tema: Claro (padrão), Escuro ou Auto (segue o sistema) */
  function setTheme(t){
    if(t==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",t);
    document.querySelectorAll("#themepick button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.t===t?"true":"false")});
    try{localStorage.setItem("rac-tema",t)}catch(e){}}
  document.querySelectorAll("#themepick button").forEach(function(b){b.onclick=function(){setTheme(b.dataset.t)}});
  setTheme((function(){try{return localStorage.getItem("rac-tema")||"light"}catch(e){return "light"}})());

  /* ===== Perfis no X, por categoria =====
     Ler posts pela API do X é pago, então o site leva direto ao X: a busca "Mais recentes" com since_time
     mostra só as últimas 36h, do mais novo para o mais antigo, já logado na conta do Rayner. */
  var XCATS=[
    /* Amigos: só aparece depois da senha da área restrita, e os perfis ficam só no navegador do dono (nunca no código) */
    {k:"amigos",n:"Amigos",c:"#E2700F",h:[],priv:true},
    {k:"jornalistas",n:"Jornalistas",c:"#1D6FE0",h:["SamPancher","reporterenato","GugaNoblat","demori","reinaldoazevedo","demetriovec","RenanPeixoto_"]},
    {k:"dodgers",n:"Dodgers",c:"#005A9C",h:["dodgernate","LADodgersMuse","SleeperDodgers","ShotimeLAD","DoyersDave","ChadMoriyama","DodgersNation","Dodgers"]},
    {k:"oficiais",n:"Oficiais",c:"#0E7C86",h:["TSEjusbr"]},
    {k:"beisebol",n:"Beisebol",c:"#0B9A4B",h:["KutterIsKing","DMAC_LA"]},
    {k:"politicos",n:"Políticos",c:"#7A3FE0",h:["AndreJanonesMG","jonesmanoel_PE","ErikakHilton"]}];
  /* Links das Listas do X por categoria. Quando criar uma lista no X, cole o link aqui, ex.: amigos:"https://x.com/i/lists/123" */
  var XLISTS={};
  var AMIGOSLS="rac-x-amigos";
  function lerAmigos(){return PESSOAL["x-amigos"]||[]}
  /* Categorias que quem está vendo pode ver */
  function xCats(){var own=isOwner();
    return XCATS.filter(function(c){if(c.priv){c.h=own?lerAmigos():[];return own}return true})}
  function x36(handles){
    var since=Math.floor(Date.now()/1000)-36*3600;
    return "https://x.com/search?q="+encodeURIComponent("("+handles.map(function(x){return "from:"+x}).join(" OR ")+") since_time:"+since)+"&src=typed_query&f=live"}
  /* Link que recalcula as 36h na hora do clique, mesmo com a página aberta há horas */
  function x36link(handles,text,cls){
    var a=h("a",{class:cls,href:x36(handles),target:"_blank",rel:"noopener",text:text});
    function upd(){a.href=x36(handles)}
    a.addEventListener("mousedown",upd);a.addEventListener("click",upd);
    return a}
  function avatar(handle,cls){
    var i=h("img",{class:cls,src:"https://unavatar.io/x/"+handle,alt:"",loading:"lazy"});
    i.onerror=function(){i.replaceWith(h("span",{class:cls+" avfb",text:handle.charAt(0).toUpperCase()}))};
    return i}
  function catIco(c){return h("span",{class:"ico",style:"--ic:"+c.c},h("b",{text:c.n.charAt(0)}))}
  function xCatHead(c,compact){
    var p=h("div",{class:"panel xhead"});
    p.appendChild(h("div",{class:"avs"},c.h.slice(0,7).map(function(x){return avatar(x,"av")})));
    p.appendChild(h("div",{class:"xht"},h("h2",{text:compact?c.n+" no X":c.n}),
      h("p",{class:"sub",text:c.h.length+(c.h.length===1?" perfil":" perfis")+" · "+c.h.map(function(x){return "@"+x}).join(", ")})));
    var acts=h("div",{class:"xacts"});
    /* sem perfis cadastrados a busca do X viria com posts de qualquer pessoa: leva para o cadastro */
    if(!c.h.length){
      p.querySelector(".sub").textContent="Nenhum perfil cadastrado ainda.";
      if(compact)acts.appendChild(h("a",{class:"pri",href:"#x/"+c.k,text:"Cadastrar os perfis"}));
      p.appendChild(acts);return p}
    acts.appendChild(x36link(c.h,"Posts das últimas 36h","pri"));
    if(XLISTS[c.k])acts.appendChild(ext(XLISTS[c.k],"Abrir a lista no X",""));
    else if(!compact)acts.appendChild(ext("https://x.com/i/lists/create","Criar a lista no X",""));
    if(compact)acts.appendChild(h("a",{href:"#x/"+c.k,text:"Ver os perfis"}));
    p.appendChild(acts);
    return p}
  function renderX(cat){
    var root=$("#x-view");root.innerHTML="";
    if(!cat){
      var how=panel("Como funciona");
      how.appendChild(h("ul",{class:"how"},
        h("li",null,h("b",{text:"Posts das últimas 36h: "}),"abre a busca do X em “Mais recentes”, só com os perfis da categoria e só das últimas 36 horas, do mais novo para o mais antigo."),
        h("li",null,h("b",{text:"Curtir, responder e repostar: "}),"cada post aberto no X já tem esses botões, e a ação sai da sua conta. Contas privadas aparecem se você as segue."),
        h("li",null,h("b",{text:"Listas do X: "}),"crie uma lista para cada categoria no X e me mande o link. Aí o botão “Abrir a lista no X” aparece aqui.")));
      root.appendChild(how);
      xCats().forEach(function(c){root.appendChild(xCatHead(c,true))});
      return}
    var c=xCats().filter(function(x){return x.k===cat})[0];
    root.appendChild(xCatHead(c,false));
    if(c.priv)root.appendChild(editarAmigos(c));
    root.appendChild(h("div",{class:"xgrid"},c.h.map(function(x){
      return h("div",{class:"panel xp"},avatar(x,"av big"),h("b",{text:"@"+x}),
        h("div",{class:"xacts"},x36link([x],"Últimas 36h","pri"),ext("https://x.com/"+x,"Perfil",""),ext("https://x.com/intent/post?text="+encodeURIComponent("@"+x+" "),"Mencionar","")))})));
    if(!XLISTS[c.k]&&!c.priv)root.appendChild(h("p",{class:"foot",text:"Ainda não há lista no X para "+c.n+". Crie a lista no X com estes perfis e me mande o link para eu colocar o botão aqui."}))}
  /* Editor dos perfis de Amigos: ficam na sua conta (e numa cópia neste aparelho), nunca no código */
  function editarAmigos(c){
    var p=panel("Só você vê esta categoria","Os perfis ficam guardados na sua conta, nunca no código do site.");
    var inp=h("input",{type:"text",value:c.h.map(function(x){return "@"+x}).join(", "),placeholder:"@perfil1, @perfil2",autocomplete:"off","aria-label":"Perfis dos amigos"});
    var b=h("button",{type:"button",text:"Salvar perfis"});
    b.onclick=function(){
      var l=inp.value.split(/[\s,;]+/).map(function(x){return x.replace(/^@/,"").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i,"").replace(/[^A-Za-z0-9_]/g,"")}).filter(Boolean);
      if(!l.length&&c.h.length&&!confirm("Apagar todos os perfis dos amigos?"))return;
      b.disabled=true;msg.textContent="Salvando…";
      pessoalGravar("x-amigos",l,function(erro){
        montarSideX();renderX("amigos");
        var m=$("#x-view .amsg");if(m){m.textContent=erro||"Salvo na sua conta.";m.classList.toggle("erro",!!erro)}})};
    var msg=h("p",{class:"sub amsg",role:"status"});
    p.appendChild(h("div",{class:"vfil"},inp,b));p.appendChild(msg);
    return p}
  /* Categorias do X na barra lateral; refeito quando a senha é digitada ou o acesso é travado */
  function montarSideX(){
    var g=$("#grp-x"),total=0;
    g.querySelectorAll('a.it[data-k^="x/"]').forEach(function(a){a.remove()});
    xCats().forEach(function(c){total+=c.h.length;
      g.appendChild(h("a",{class:"it",href:"#x/"+c.k,"data-k":"x/"+c.k},catIco(c),h("span",{class:"t",text:c.n}),h("span",{class:"cnt",text:String(c.h.length)})))});
    $("#cnt-x").textContent=total}
  $("#cnt-vagas").textContent="";
  $("#cnt-breve").textContent=document.querySelectorAll("#em-breve .panel").length;

  /* Busca na barra lateral: seções, times, categorias e perfis do X */
  function norm(t){return t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()}
  var DEST=[];
  document.querySelectorAll(".side a.it[data-k]").forEach(function(a){DEST.push({t:a.querySelector(".t").textContent,href:a.getAttribute("href"),ico:a.querySelector(".ico"),el:a})});
  XCATS.forEach(function(c){if(!c.priv)c.h.forEach(function(x){DEST.push({t:"@"+x+" · "+c.n,href:"https://x.com/"+x,ext:true,av:x})})});
  var teamsAdded=false;
  $("#busca").addEventListener("focus",function(){
    if(teamsAdded)return;teamsAdded=true;
    getTeams().then(function(ts){ts.forEach(function(t){DEST.push({t:t.name,href:"#esportes/beisebol/time-"+t.id,logo:logoUrl(t.id)})})}).catch(function(){teamsAdded=false})});
  var buscaVez=0;
  function searchDraw(){
    var bruto=$("#busca").value.trim(),q=norm(bruto),box=$("#results");box.innerHTML="";var vez=++buscaVez;
    if(!q)return;
    /* além das seções, procura no conteúdo (registros, treinos, MBA, vagas, notícias, produtos, datas) */
    if(q.length>=2&&SB)setTimeout(function(){if(vez!==buscaVez)return;precisa(["sistema"]).then(function(){return buscar(bruto)}).then(function(l){if(vez!==buscaVez)return;
      var fecha=function(){$("#busca").value="";box.innerHTML="";if(typeof setSide==="function")setSide(false)};
      if(l.length){var nada=box.querySelector(".semres");if(nada)nada.remove();box.appendChild(h("p",{class:"sub",style:"padding:6px 8px 2px;margin:0",text:"No conteúdo"}));
        var ul=h("ul",{class:"wl buscares"},l.slice(0,6).map(function(x){return linhaResultado(x,fecha)}));box.appendChild(ul)}
      var todos=h("a",{class:"it",href:"#busca/"+encodeURIComponent(bruto)},h("span",{class:"t",text:l.length?"Ver todos os "+l.length+" resultados":"Buscar “"+bruto+"” em tudo"}));
      todos.addEventListener("click",function(){$("#busca").value="";box.innerHTML="";if(typeof setSide==="function")setSide(false)});box.appendChild(todos)})},250);
    var hits=DEST.filter(function(d){return !(d.el&&d.el.hidden)&&norm(d.t).indexOf(q)>=0}).slice(0,8);
    if(!hits.length){box.appendChild(h("p",{class:"sub semres",style:"padding:4px 8px;margin:0",text:"Nenhuma seção com esse nome."}));return}
    hits.forEach(function(d){
      var icon=d.ico?d.ico.cloneNode(true):d.logo?img(d.logo,"ico"):d.av?avatar(d.av,"ico"):null;
      var a=h("a",{class:"it",href:d.href,role:"listitem",target:d.ext?"_blank":null,rel:d.ext?"noopener":null},icon,h("span",{class:"t",text:d.t}));
      a.addEventListener("click",function(){$("#busca").value="";box.innerHTML=""});
      box.appendChild(a)})}
  $("#busca").addEventListener("input",searchDraw);
  $("#busca").addEventListener("keydown",function(e){if(e.key==="Enter"){var f=$("#results a");if(f)f.click()}});

  /* Tempo em Sorocaba (Open-Meteo, sem chave) */
  var WX={sun:'<svg viewBox="0 0 24 24" fill="none" stroke="#F2A900" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="#FFC83D"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    part:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="4" fill="#FFC83D"/><path d="M8 19h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 8 19z" fill="#AEB9C4"/></svg>',
    cloud:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 19h10a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 2A3.5 3.5 0 0 0 7 19z" fill="#AEB9C4"/></svg>',
    rain:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 15h10a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 2A3.5 3.5 0 0 0 7 15z" fill="#AEB9C4"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="#3A8DFF" stroke-width="2" stroke-linecap="round"/></svg>',
    storm:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14h10a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 2A3.5 3.5 0 0 0 7 14z" fill="#97A3AF"/><path d="M12 14l-2 4h3l-2 4" stroke="#F2A900" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'};
  function wxKind(c){return c===0?"sun":c<=2?"part":c<=48?"cloud":c>=95?"storm":"rain"}
  var WXTXT={sun:"céu limpo",part:"parcialmente nublado",cloud:"nublado",rain:"chuva",storm:"tempestade"};
  getJson("https://api.open-meteo.com/v1/forecast?latitude=-23.50&longitude=-47.46&daily=weather_code,temperature_2m_max,temperature_2m_min&current=temperature_2m&timezone=America%2FSao_Paulo&forecast_days=1").then(function(d){
    var k=wxKind(d.daily.weather_code[0]),box=$("#tempo");box.innerHTML="";
    var ic=h("span");ic.innerHTML=WX[k];box.appendChild(ic.firstChild);
    box.appendChild(h("span",null,h("b",{text:Math.round(d.daily.temperature_2m_max[0])+"°"})," / "+Math.round(d.daily.temperature_2m_min[0])+"° · "+WXTXT[k]+" em Sorocaba · agora "+Math.round(d.current.temperature_2m)+"°"))
  }).catch(function(){var box=$("#tempo");box.innerHTML="";box.appendChild(h("span",{text:"Não consegui carregar o tempo em Sorocaba agora."}))});

  /* ===== Utilidades comuns ===== */
  var TZ="America/Sao_Paulo";
  var memo={};
  function once(k,fn){if(!memo[k])memo[k]=fn().catch(function(e){delete memo[k];throw e});return memo[k]}
  function getJson(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})}
  function pad(n){return n<10?"0"+n:""+n}
  function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
  function addDays(d,n){var x=new Date(d.getTime());x.setDate(x.getDate()+n);return x}
  function dash(x){return (x===undefined||x===null||x==="")?"–":x}
  function cap(t){return t.charAt(0).toUpperCase()+t.slice(1)}
  function hm(d){return d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:TZ}).replace(":","h")}
  function dayTitle(d){return cap(d.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",timeZone:TZ}))}
  function dayShort(d){return cap(d.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",timeZone:TZ}).replace(".",""))}
  function dateEn(d){return d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"America/New_York"})}
  function fmtDur(x){
    if(typeof x==="number"){return Math.floor(x/60)+":"+pad(x%60)}
    if(typeof x==="string")return x.replace(/^00:/,"").replace(/^0(\d:)/,"$1");
    return ""}

  function h(tag,attrs){
    var e=document.createElement(tag);
    if(attrs)Object.keys(attrs).forEach(function(k){
      var v=attrs[k];
      if(v===undefined||v===null||v===false)return;
      if(k==="class")e.className=v;else if(k==="text")e.textContent=v;else e.setAttribute(k,v)});
    function add(c){
      if(c===null||c===undefined||c===false)return;
      if(Array.isArray(c)){c.forEach(add);return}
      e.appendChild((typeof c==="string"||typeof c==="number")?document.createTextNode(String(c)):c)}
    for(var i=2;i<arguments.length;i++)add(arguments[i]);
    return e}
  function svg(markup){var s=h("span");s.innerHTML=markup;return s.firstChild}
  function ext(href,text,cls){return h("a",{class:cls||"link",href:urlAbs(href),target:"_blank",rel:"noopener",text:text})}
  function img(src,cls){
    var i=h("img",{class:cls,src:src,alt:"",loading:"lazy"});
    i.onerror=function(){i.style.visibility="hidden"};return i}
  function panel(title,sub){
    var p=h("div",{class:"panel"});
    if(title)p.appendChild(h("h2",{text:title}));
    if(sub)p.appendChild(h("p",{class:"sub",style:"margin:-6px 0 10px",text:sub}));
    return p}
  function loading(){return h("p",{class:"empty",text:"Carregando…"})}
  function failed(retry,err){
    var b=h("button",{type:"button",class:"ghost",text:"tentar de novo"});b.onclick=retry;
    return h("div",{class:"empty"},"Não consegui carregar agora. ",b,err?h("div",{class:"diag",text:"Detalhe técnico: "+(err.message||err)}):null)}
  /* Bloco com título de editoria (verde, caixa alta) que carrega sozinho */
  function section(title,sub,fn){
    var s=h("div",{class:"blk"},h("h2",{class:"sec"},title,sub?h("small",{text:sub}):null)),body=h("div",null,loading());s.appendChild(body);
    function load(){body.innerHTML="";body.appendChild(loading());
      Promise.resolve().then(function(){return fn(body)}).catch(function(e){body.innerHTML="";body.appendChild(failed(load,e))})}
    load();return s}
  function lazyPanel(title,sub,fn){
    var p=panel(title,sub),body=h("div",null,loading());p.appendChild(body);
    function load(){body.innerHTML="";body.appendChild(loading());
      Promise.resolve().then(function(){return fn(body)}).catch(function(e){body.innerHTML="";body.appendChild(failed(load,e))})}
    load();return p}
  function table(cols,rows,nf,cls){nf=nf===undefined?2:nf;
    var thead=h("tr",null,cols.map(function(c,i){return h("th",{class:i>=nf?"num":"",text:c})}));
    var tbody=rows.map(function(r){return h("tr",null,r.map(function(c,i){return h("td",{class:i>=nf?"num":""},c)}))});
    return h("div",{class:"tblwrap"},h("table",{class:"tbl"+(cls?" "+cls:"")},h("thead",null,thead),h("tbody",null,tbody)))}

  var US={AL:"Alabama",AK:"Alasca",AZ:"Arizona",AR:"Arkansas",CA:"Califórnia",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"Distrito de Colúmbia",FL:"Flórida",GA:"Geórgia",HI:"Havaí",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"Nova Jersey",NM:"Novo México",NY:"Nova York",NC:"Carolina do Norte",ND:"Dakota do Norte",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pensilvânia",RI:"Rhode Island",SC:"Carolina do Sul",SD:"Dakota do Sul",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virgínia",WA:"Washington",WV:"Virgínia Ocidental",WI:"Wisconsin",WY:"Wyoming",ON:"Ontário",QC:"Quebec",BC:"Colúmbia Britânica"};
  var USFULL={California:"Califórnia",Florida:"Flórida",Georgia:"Geórgia",Pennsylvania:"Pensilvânia","New York":"Nova York","New Jersey":"Nova Jersey","North Carolina":"Carolina do Norte","District of Columbia":"Distrito de Colúmbia",Ontario:"Ontário"};
  function stateName(s){return US[s]||USFULL[s]||s||""}
  function venueText(v){if(!v||!v.name)return "";
    var place=[v.city,stateName(v.state)||v.country].filter(Boolean).join(", ");
    return v.name+(place?" · "+place:"")}

  /* ===== Datas, números e banco: usados por todas as seções ===== */
  function hojeISO(){var d=new Date();return d.getFullYear()+"-"+dd(d.getMonth()+1)+"-"+dd(d.getDate())}
  function dataBR(iso){var p=String(iso).split("-");return p[2]+"/"+p[1]+"/"+p[0]}
  function sbOk(r){if(r.error)throw new Error(r.error.message);return r.data}
  /* Foto grande do celular vira JPEG de até 2000 px (exame continua legível e ocupa bem menos) */
  function encolher(f){
    if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type)||f.size<700e3)return Promise.resolve(f);
    return createImageBitmap(f).then(function(b){
      var k=Math.min(1,2000/Math.max(b.width,b.height)),c=document.createElement("canvas");c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);
      c.getContext("2d").drawImage(b,0,0,c.width,c.height);
      return new Promise(function(res){c.toBlob(function(bl){res(bl&&bl.size<f.size?new File([bl],f.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}):f)},"image/jpeg",.85)})
    }).catch(function(){return f})}
  /* ----- leitura dos dados de saúde guardados em registros.dados (005_registros_dados.sql) ----- */
  function fmtN(v){return typeof v==="number"?v.toLocaleString("pt-BR",{maximumFractionDigits:2}):String(v)}
  function maisDias(iso,n){var d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return d.getFullYear()+"-"+dd(d.getMonth()+1)+"-"+dd(d.getDate())}
  function brl(v){return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
  /* ===== Login do site =====
     O site é pessoal: sem login só aparece a tela de entrar. Usa as mesmas contas do Mercado (Supabase).
     Quem está na tabela "membros" (a esposa) é "casa" e vê só o Mercado; o dono vê tudo. */
  var PAPEL=null,SB=null,EU=null,DONO=null,PESSOAL={},SEM_TABELA=false;
  function isOwner(){return PAPEL==="dono"}
  /* Dados pessoais: um JSON por chave na tabela "pessoal", que só a conta do dono lê e grava */
  /* Cópia de segurança neste aparelho: se a conta falhar ou vier sem o dado, nada se perde.
     Cada chave guarda {v:valor, t:quando mudou, ok:já chegou na conta} */
  function copiaLer(chave){try{return JSON.parse(localStorage.getItem("rac-p-"+chave)||"null")}catch(e){return null}}
  function copiaGravar(chave,valor,ok,base){try{localStorage.setItem("rac-p-"+chave,JSON.stringify({v:valor,t:Date.now(),ok:!!ok,b:base||(typeof SIS!=="undefined"&&SIS.versao[chave])||null}))}catch(e){}}
  function vazio(v){return v==null||(Array.isArray(v)&&!v.length)}
  /* lê a conta e compara com as cópias deste aparelho:
     - alteração daqui que ainda não subiu e a conta não mudou desde então: sobe;
     - a conta mudou depois da base da alteração daqui e os valores são diferentes: vira conflito, e você escolhe na página Sistema. */
  function pessoalCarregar(){
    return SB.from("pessoal").select("chave,valor,atualizado").then(function(r){
      if(r.error)throw new Error(r.error.message);
      var locais={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.indexOf("rac-p-")===0)locais[k.slice(6)]=copiaLer(k.slice(6))}
      var naConta={};(r.data||[]).forEach(function(x){naConta[x.chave]=x;PESSOAL[x.chave]=x.valor;SIS.versao[x.chave]=x.atualizado});
      Object.keys(naConta).forEach(function(ch){var cp=locais[ch],cc=naConta[ch];
        if(cp&&!cp.ok&&!vazio(cp.v)&&JSON.stringify(cp.v)!==JSON.stringify(cc.valor)){
          var contaMudou=cp.b?Date.parse(cc.atualizado)>Date.parse(cp.b):Date.parse(cc.atualizado)>cp.t;
          if(!contaMudou){PESSOAL[ch]=cp.v;pessoalGravar(ch,cp.v);return}
          SIS.conflitos[ch]={local:cp.v,conta:cc.valor,tLocal:cp.t,tConta:cc.atualizado};return}
        copiaGravar(ch,cc.valor,true,cc.atualizado)});
      /* o que só existe neste aparelho (a conta perdeu ou nunca recebeu) sobe */
      Object.keys(locais).forEach(function(ch){var cp=locais[ch];if(naConta[ch]||!cp||vazio(cp.v))return;PESSOAL[ch]=cp.v;pessoalGravar(ch,cp.v)});
      SIS.ultimaSinc=Date.now();SIS.falhaSinc=null;syncSelo()})}
  /* sem a conta (falha de rede ou tabela), usa o que este aparelho guardou */
  function pessoalDaCopia(){for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.indexOf("rac-p-")===0){var cp=copiaLer(k.slice(6));if(cp)PESSOAL[k.slice(6)]=cp.v}}}
  var gravando={};
  /* grava na conta sem sobrescrever às cegas: se a conta mudou desde a versão que este aparelho conhece, vira conflito */
  function pessoalGravar(chave,valor,pronto){
    PESSOAL[chave]=valor;copiaGravar(chave,valor,false);syncSelo();
    if(!SB||!isOwner()||SEM_TABELA){if(pronto)pronto("Guardado só neste aparelho (a conta não respondeu).");return}
    clearTimeout(gravando[chave]);
    gravando[chave]=setTimeout(function tentar(n){
      SB.from("pessoal").select("valor,atualizado").eq("chave",chave).then(function(r){
        if(r.error)throw new Error(r.error.message);
        var cc=(r.data||[])[0],base=SIS.versao[chave];
        if(cc&&base&&Date.parse(cc.atualizado)>Date.parse(base)&&JSON.stringify(cc.valor)!==JSON.stringify(valor)){
          SIS.conflitos[chave]={local:valor,conta:cc.valor,tLocal:Date.now(),tConta:cc.atualizado};syncSelo();
          if(pronto)pronto("Esse dado mudou em outro aparelho. Escolha qual versão vale em Sistema.");return}
        var agora=new Date().toISOString();
        return SB.from("pessoal").upsert({user_id:EU.id,chave:chave,valor:valor,atualizado:agora}).then(function(r2){
          if(r2.error)throw new Error(r2.error.message);
          SIS.versao[chave]=agora;copiaGravar(chave,valor,true,agora);SIS.ultimaSinc=Date.now();SIS.falhaSinc=null;syncSelo();if(pronto)pronto("")})
      }).catch(function(e){
        if((n||0)<2){setTimeout(function(){tentar((n||0)+1)},3000);return}
        SIS.falhaSinc="A conta não respondeu ("+e.message+"). O que mudou ficou neste aparelho e sobe sozinho.";logErro("sincronização",e,{chave:chave});
        if(pronto)pronto("Não salvou na conta ("+e.message+"). Ficou guardado neste aparelho e sobe sozinho na próxima vez.")})},400)}
  /* O que estava guardado só no navegador (aniversários, amigos do X) sobe uma vez para a conta */
  function migrarDoNavegador(){
    if(SEM_TABELA)return;
    try{var velha=JSON.parse(localStorage.getItem(AMIGOSLS)||"[]");if(vazio(PESSOAL["x-amigos"])&&velha.length)pessoalGravar("x-amigos",velha)}catch(e){}
    /* junta a lista antiga deste navegador (ex.: o CSV do Facebook) com a da conta, sem repetir ninguém */
    var ant=lsRead();if(!ant.length)return;
    var conta=PESSOAL.aniversarios||[],tem={};conta.forEach(function(x){tem[bkey(x)]=1});
    var novos=ant.filter(function(x){return !tem[bkey(x)]});
    if(novos.length)pessoalGravar("aniversarios",conta.concat(novos));
  }
  function mostrarGate(texto){
    document.documentElement.classList.remove("logado");
    $("#gate").hidden=false;$("#gate-msg").textContent=texto||"";
    setTimeout(function(){$("#gate-email").focus()},50)}
  function entrar(){
    window.RACmercado.client().then(function(sb){SB=sb;return sb.auth.getSession()}).then(function(r){
      var ses=r.data&&r.data.session;
      if(!ses){mostrarGate();return}
      EU=ses.user;
      return SB.from("membros").select("dono").eq("membro",EU.id).then(function(m){
        PAPEL=m.data&&m.data.length?"casa":"dono";
        DONO=PAPEL==="casa"?m.data[0].dono:EU.id;
        if(PAPEL!=="dono")return;
        return pessoalCarregar().catch(function(e){SEM_TABELA=true;SIS.falhaSinc="Não consegui ler a conta ("+e.message+").";logErro("sincronização",e);pessoalDaCopia()}).then(migrarDoNavegador)
      }).then(iniciar)
    }).catch(function(e){mostrarGate("Não consegui conectar agora ("+(e.message||e)+"). Tente de novo.")})}
  function iniciar(){
    var html=document.documentElement;
    html.classList.add("logado");html.classList.toggle("casa",PAPEL==="casa");
    $("#gate").hidden=true;$("#quem").textContent=EU.email;syncSelo();
    if(!$(".capbtn")){var cb=h("button",{type:"button",class:"capbtn","aria-label":"Anotar rápido",title:"Anotar rápido (lista, tarefa, lembrete, ideia, link, peso, gasto, km)",text:"+"});cb.onclick=function(){abrirCaptura()};document.body.appendChild(cb)}
    processarFila();setTimeout(capturaCompartilhada,400);
    if(isOwner()){items=SEM_TABELA?lsRead():(PESSOAL.aniversarios||[]);render();montarSideX()}
    else $("#bdalert").hidden=true;
    route()}
  $("#gate-form").addEventListener("submit",function(e){
    e.preventDefault();
    var b=$("#gate-enter"),m=$("#gate-msg");b.disabled=true;m.textContent="Entrando…";
    window.RACmercado.client().then(function(sb){return sb.auth.signInWithPassword({email:$("#gate-email").value.trim(),password:$("#gate-pw").value})}).then(function(res){
      b.disabled=false;
      if(res.error){m.textContent=/invalid/i.test(res.error.message)?"E-mail ou senha incorretos.":"Não consegui entrar: "+res.error.message;return}
      $("#gate-pw").value="";m.textContent="";entrar()
    }).catch(function(err){b.disabled=false;m.textContent="Não consegui entrar agora ("+(err.message||err)+")."})});
  /* ao sair, apaga deste aparelho as cópias que já estão salvas na conta */
  $("#sair").addEventListener("click",function(){
    Object.keys(localStorage).forEach(function(k){if(k.indexOf("rac-p-")===0){var cp=copiaLer(k.slice(6));if(cp&&cp.ok)localStorage.removeItem(k)}});
    SB.auth.signOut().then(function(){location.reload()})});

  /* Vagas de Análise de Dados e BI (vagas.json, coletado do portal Mentora Dados).
     Remoto de qualquer lugar; presencial ou híbrido só em São Paulo ou Sorocaba. */
  var VG={all:[],mod:"",nivel:"",q:"",verOcultas:false};
  /* Vagas marcadas como encerradas: guardadas neste navegador pelo código da vaga no portal,
     então continuam escondidas quando o robô atualiza a lista. */
  var VGHID="rac-vagas-encerradas",vgHidden=(function(){try{return JSON.parse(localStorage.getItem(VGHID)||"{}")}catch(e){return {}}})();
  function vgSaveHidden(){try{localStorage.setItem(VGHID,JSON.stringify(vgHidden))}catch(e){}}
  function vgToggleHidden(id){if(vgHidden[id])delete vgHidden[id];else vgHidden[id]=Date.now();vgSaveHidden();vgDraw()}
  var NIVEIS=["Estágio","Júnior","Pleno","Sênior","Especialista","Líder"];
  function vgLink(v){
    var ap=v.ap||"";
    if(/^mailto:/.test(ap))return [ap,"Enviar e-mail"];
    if(/^https?:\/\/\(/.test(ap)||/mentoradados\.com\/portal-de-vagas-v2\/#?$/.test(ap)||!ap)return ["https://mentoradados.com/portal-de-vagas-v2/","Ver no portal"];
    return [ap,"Candidatar-se"]}
  function vgCard(v){
    var cls=v.m==="Remoto"?"rem":v.m==="Híbrido"?"hib":"pre",lk=vgLink(v);
    var sal=v.s&&!/^A combinar$/i.test(v.s)?h("div",{class:"vsal",text:v.s}):null;
    return h("article",{class:"panel vcard"},
      h("div",{class:"vpills"},v.d<=3?h("span",{class:"vp new",text:"Nova"}):null,h("span",{class:"vp "+cls,text:v.m}),v.nv?h("span",{class:"vp",text:v.nv}):null,h("span",{class:"when vage",text:v.a})),
      h("h3",{text:v.t}),
      h("div",{class:"emp"},v.e||"Empresa não informada",v.cidade?h("span",{text:" · "+v.cidade.replace(/\s*\((Presencial|Híbrido)\)\s*$/,"")}):null),
      sal,
      vgCompat(v),
      h("div",{class:"vfoot"},ext(lk[0],lk[1],"ghostbtn pri"),v.or?ext(v.or,"Post original","ghostbtn"):null,vgFunilBtn(v),vgHideBtn(v)))}
  /* carreira: nota pelo título (o portal não traz a descrição) e botão para levar a vaga ao funil */
  function vgCompat(v){if(!isOwner())return null;var cp=NUCLEO.compatVaga(v.t+" "+(v.nv||""),((PESSOAL.perfilCarreira||{}).skills)||["sql","powerbi","excel","negocio","estat"]);
    return cp.nota==null?null:h("div",{class:"vcompat "+(cp.nota>=70?"bom":cp.nota<40?"ruim":""),title:"Calculado pelo título. Para a nota exata, salve no funil e cole a descrição.",text:cp.nota+"% compatível"+(cp.falta.length?" · falta "+cp.falta.length:"")})}
  function carSalvarVaga(v){var l=(PESSOAL.candidaturas||[]).slice();if(l.some(function(c){return c.vagaId===v.id}))return false;
    l.unshift({id:"v"+v.id,vagaId:v.id,t:v.t,e:v.e||"",link:vgLink(v)[0],coluna:"salva",datas:{salva:hojeISO()}});pessoalGravar("candidaturas",l);return true}
  function vgFunilBtn(v){if(!isOwner())return null;var ja=(PESSOAL.candidaturas||[]).some(function(c){return c.vagaId===v.id});
    var b=h("button",{type:"button",class:"ghostbtn",text:ja?"✓ No funil":"Salvar no funil"});b.disabled=ja;b.onclick=function(){carSalvarVaga(v);b.textContent="✓ No funil";b.disabled=true};return b}
  function vgHideBtn(v){
    var off=!!vgHidden[v.id];
    var b=h("button",{type:"button",class:"vhide",title:off?"Mostrar esta vaga de novo":"Esconder esta vaga (já encerrada)","aria-label":(off?"Mostrar de novo: ":"Marcar como encerrada: ")+v.t,text:off?"↺":"✕"});
    b.onclick=function(){vgToggleHidden(v.id)};return b}
  function vgDraw(){
    var q=norm(VG.q),box=$("#vg-list");box.innerHTML="";
    var nHid=VG.all.filter(function(v){return vgHidden[v.id]}).length;
    $("#vg-hidwrap").hidden=!nHid;$("#vg-hidtxt").textContent="ver encerradas ("+nHid+")";
    if(!nHid)VG.verOcultas=false;$("#vg-hid").checked=VG.verOcultas;
    $("#cnt-vagas").textContent=VG.all.length-nHid;
    var base=VG.all.filter(function(v){return (VG.verOcultas?!!vgHidden[v.id]:!vgHidden[v.id])&&(!VG.nivel||v.nv===VG.nivel)&&(!q||norm(v.t+" "+v.e+" "+(v.cidade||"")).indexOf(q)>=0)});
    var seg=$("#vg-mod");seg.innerHTML="";
    [["","Todas"],["Remoto","Remoto"],["Híbrido","Híbrido"],["Presencial","Presencial"]].forEach(function(o){
      var n=base.filter(function(v){return !o[0]||v.m===o[0]}).length;
      var b=h("button",{type:"button","aria-pressed":VG.mod===o[0]?"true":"false",text:o[1]+" ("+n+")"});
      b.onclick=function(){VG.mod=o[0];vgDraw()};seg.appendChild(b)});
    var list=base.filter(function(v){return !VG.mod||v.m===VG.mod});
    if(!list.length){box.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Nenhuma vaga com esse filtro."})));return}
    list.forEach(function(v){box.appendChild(vgCard(v))})}
  var vgPronto;
  function vgLoad(){
    vgPronto=getJson("vagas.json?v="+Date.now()).then(function(d){
      VG.all=(d.vagas||[]).slice().sort(function(a,b){return a.d-b.d});
      var nv=NIVEIS.filter(function(n){return VG.all.some(function(v){return v.nv===n})});
      nv.forEach(function(n){var o=document.createElement("option");o.value=n;o.textContent=n;$("#vg-nivel").appendChild(o)});
      var dt=new Date(d.coletado);
      $("#vg-info").textContent=VG.all.length+" vagas publicadas há menos de 2 meses · remotas de qualquer lugar e presenciais ou híbridas em São Paulo e Sorocaba · atualizado em "+dt.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+".";
      $("#cnt-vagas").textContent=VG.all.length;
      vgDraw()
    });vgPronto.catch(function(){$("#vg-info").textContent="Não consegui carregar as vagas agora."})}
  $("#vg-nivel").addEventListener("change",function(e){VG.nivel=e.target.value;vgDraw()});
  $("#vg-q").addEventListener("input",function(e){VG.q=e.target.value;vgDraw()});
  $("#vg-hid").addEventListener("change",function(e){VG.verOcultas=e.target.checked;vgDraw()});
  vgLoad();

  /* Aniversários */
  var sel=$("#f-mes");
  MESES.forEach(function(m,i){var o=document.createElement("option");o.value=i+1;o.textContent=m;sel.appendChild(o)});
  sel.value=now.getMonth()+1;

  /* Aniversários: guardados só no navegador (localStorage). O CSV exportado do Facebook é lido aqui mesmo,
     sem sair do computador; nada disso vai para o GitHub. */
  var items=[],LS="painel-aniversarios";
  function nextDate(d,m){
    var t=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    var n=new Date(now.getFullYear(),m-1,d);
    if(n<t)n=new Date(now.getFullYear()+1,m-1,d);
    return {days:Math.round((n-t)/86400000),year:n.getFullYear()}}
  function dd(n){return String(n).padStart(2,"0")}
  function countTxt(x){return x.dias===0?"hoje":x.dias===1?"amanhã":"em "+x.dias+" dias"}
  function idade(x){return x.ano?(x.prox-x.ano):null}
  function fbLink(x,cls){
    return x.link?h("a",{class:cls,href:x.link,target:"_blank",rel:"noopener",text:x.nome}):h("span",{class:cls,text:x.nome})}
  function sumCard(title,list,emptyTxt,cls){
    var c=h("div",{class:"panel bdcard "+cls},h("h3",null,title,h("span",{class:"cnt",text:String(list.length)})));
    if(!list.length){c.appendChild(h("p",{class:"sub",text:emptyTxt}));return c}
    var ul=h("ul",{class:"bdmini"});
    list.forEach(function(x){var a=idade(x);
      ul.appendChild(h("li",null,fbLink(x,"who"),h("span",{class:"sub",text:dd(x.dia)+"/"+dd(x.mes)+(a?" · faz "+a:"")})))});
    c.appendChild(ul);
    return c}
  function withDates(){return items.map(function(x){var n=nextDate(x.dia,x.mes);return Object.assign({},x,{dias:n.days,prox:n.year})})}
  /* Aviso no topo do site: marcados que fazem aniversário hoje ou amanhã */
  function bdAlert(list){
    var bar=$("#bdalert"),favs=isOwner()?list.filter(function(x){return x.fav&&x.dias<=1}):[];
    if(!favs.length){bar.hidden=true;return}
    function names(arr){return arr.map(function(x){var a=idade(x);return x.nome+(a?" ("+a+")":"")}).join(", ")}
    var hoje=favs.filter(function(x){return x.dias===0}),amanha=favs.filter(function(x){return x.dias===1});
    bar.innerHTML="";bar.appendChild(h("span",{class:"cake",text:"🎂"}));
    var t=h("span");
    if(hoje.length)t.appendChild(h("span",null,h("b",{text:"Hoje: "}),names(hoje)));
    if(hoje.length&&amanha.length)t.appendChild(document.createTextNode(" · "));
    if(amanha.length)t.appendChild(h("span",null,h("b",{text:"Amanhã: "}),names(amanha)));
    bar.appendChild(t);bar.hidden=false}
  function render(){
    var box=$("#bdays"),sum=$("#bd-summary");box.innerHTML="";sum.innerHTML="";
    $("#cnt-aniv").textContent=items.length;
    var list=withDates().sort(function(a,b){return a.dias-b.dias||(b.fav?1:0)-(a.fav?1:0)||a.nome.localeCompare(b.nome)});
    bdAlert(list);
    var nfav=items.filter(function(x){return x.fav}).length;
    $("#bd-favcnt").textContent=nfav?"⭐ "+nfav+(nfav===1?" marcado":" marcados"):"Ninguém marcado ainda";
    $("#bd-ics").disabled=$("#bd-csv").disabled=!nfav;
    function pref(arr){return arr.slice().sort(function(a,b){return (b.fav?1:0)-(a.fav?1:0)||a.dias-b.dias})}
    sum.appendChild(sumCard("Hoje",pref(list.filter(function(x){return x.dias===0})),"Ninguém faz aniversário hoje.","hoje"));
    sum.appendChild(sumCard("Próximos 7 dias",pref(list.filter(function(x){return x.dias>0&&x.dias<=7})),"Nenhum nos próximos 7 dias.","semana"));
    sum.appendChild(sumCard("Próximos 30 dias",pref(list.filter(function(x){return x.dias>7&&x.dias<=30})),"Nenhum entre 8 e 30 dias.","mes"));
    $("#bd-clear").hidden=!items.length;
    if(!items.length){
      box.appendChild(h("div",{class:"empty",text:"Nenhum aniversário ainda. Importe o CSV do Facebook ou adicione um por um aqui em cima."}));
      $("#bnote").textContent="";return}
    var q=norm($("#bd-busca").value.trim()),mes=+$("#bd-mes").value,soFav=$("#bd-fav").checked;
    var shown=list.filter(function(x){return (!q||norm(x.nome).indexOf(q)>=0)&&(!mes||x.mes===mes)&&(!soFav||x.fav)});
    /* "Por mês": janeiro a dezembro, separado por dia; "Próximos": a partir de hoje */
    if(bdModo==="mes")shown.sort(function(a,b){return a.mes-b.mes||a.dia-b.dia||(b.fav?1:0)-(a.fav?1:0)||a.nome.localeCompare(b.nome)});
    $$("#bd-modo button").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.m===bdModo))});
    /* atalhos dos meses com a quantidade de cada um */
    var chips=$("#bd-meses");chips.innerHTML="";
    var base=list.filter(function(x){return (!q||norm(x.nome).indexOf(q)>=0)&&(!soFav||x.fav)});
    [0].concat(MESES.map(function(m,i){return i+1})).forEach(function(n){
      var qt=n?base.filter(function(x){return x.mes===n}).length:base.length;
      var b=h("button",{type:"button",class:n===now.getMonth()+1?"agora":null,"aria-pressed":String(n===mes)},n?MESES[n-1].slice(0,3):"Todos",h("span",{text:String(qt)}));
      b.onclick=function(){$("#bd-mes").value=String(n);render()};
      chips.appendChild(b)});
    visiveis=shown;
    if(!shown.length){box.appendChild(h("p",{class:"empty",text:soFav&&!nfav?"Você ainda não marcou ninguém. Clique na ⭐ ao lado do nome.":"Ninguém com esse filtro."}))}
    var lastMes=null,lastDia=null;
    shown.forEach(function(x){
      var grupo=bdModo==="mes"?x.mes:x.mes+"-"+x.prox;
      if(grupo!==lastMes){lastMes=grupo;lastDia=null;
        var noMes=shown.filter(function(y){return y.mes===x.mes}).length;
        box.appendChild(h("h3",{class:"dayh"+(x.mes===now.getMonth()+1?" agora":"")},MESES[x.mes-1]+(bdModo!=="mes"&&x.prox!==now.getFullYear()?" "+x.prox:""),h("span",{class:"cnt",text:String(noMes)})))}
      var mesmoDia=lastDia===x.dia;lastDia=x.dia;
      var sem=new Date(x.prox,x.mes-1,x.dia).toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","");
      var a=idade(x),b=h("button",{type:"button",class:"ghost","aria-label":"Remover "+x.nome,text:"remover"});
      b.onclick=function(){remove(x.id)};
      var st=h("button",{type:"button",class:"star","aria-pressed":x.fav?"true":"false","aria-label":(x.fav?"Desmarcar ":"Marcar ")+x.nome,title:x.fav?"Desmarcar":"Marcar como importante",text:"★"});
      st.onclick=function(){toggleFav(x.id)};
      box.appendChild(h("div",{class:"bdrow"+(x.fav?" fav":"")+(mesmoDia?" mesmo":"")+(x.dias===0?" hojerow":"")},st,
        bdModo==="mes"?h("span",{class:"when dia"},mesmoDia?null:h("b",{text:dd(x.dia)}),mesmoDia?null:h("small",{text:sem})):h("span",{class:"when",text:dd(x.dia)+"/"+dd(x.mes)}),
        h("span",{class:"bdn"},fbLink(x,"who"),a?h("span",{class:"sub",text:" faz "+a}):null),
        h("span",{class:"count"+(x.dias===0?" hoje":x.dias<=7?" soon":""),text:countTxt(x)}),b))});
    var doMes=list.filter(function(x){return x.mes===now.getMonth()+1}).length;
    $("#bnote").textContent=items.length+" aniversários guardados · "+doMes+" em "+MESES[now.getMonth()].toLowerCase()+"."}
  var visiveis=[],bdModo="mes";
  try{bdModo=localStorage.getItem("rac-bd-modo")||"mes"}catch(e){}
  $$("#bd-modo button").forEach(function(b){b.onclick=function(){bdModo=b.dataset.m;try{localStorage.setItem("rac-bd-modo",bdModo)}catch(e){}render()}});
  function toggleFav(id){items.forEach(function(x){if(x.id===id)x.fav=!x.fav});lsWrite();render()}
  MESES.forEach(function(m,i){var o=document.createElement("option");o.value=i+1;o.textContent=m;$("#bd-mes").appendChild(o)});
  $("#bd-mes").addEventListener("change",render);
  $("#bd-fav").addEventListener("change",render);
  $("#bd-markall").addEventListener("click",function(){
    var ids={};visiveis.forEach(function(x){ids[x.id]=1});
    items.forEach(function(x){if(ids[x.id])x.fav=true});lsWrite();render()});

  /* Arquivos gerados no navegador: calendário .ics com alertas e lista .csv dos marcados */
  function baixar(nome,tipo,conteudo){
    var a=h("a",{href:URL.createObjectURL(new Blob([conteudo],{type:tipo})),download:nome});
    document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000)}
  function marcados(){return withDates().filter(function(x){return x.fav}).sort(function(a,b){return a.mes-b.mes||a.dia-b.dia})}
  function icsTxt(t){return String(t).replace(/([,;\\])/g,"\\$1").replace(/\n/g,"\\n")}
  $("#bd-ics").addEventListener("click",function(){
    var stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
    var L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Dia a Dia RAC//Aniversarios//PT-BR","CALSCALE:GREGORIAN","X-WR-CALNAME:Aniversários (Dia a Dia RAC)"];
    marcados().forEach(function(x){
      var nome=icsTxt(x.nome),uid="rac-"+norm(x.nome).replace(/[^a-z0-9]+/g,"-")+"-"+dd(x.mes)+dd(x.dia);
      L.push("BEGIN:VEVENT","UID:"+uid+"@diaadia-rac","DTSTAMP:"+stamp,
        "DTSTART;VALUE=DATE:"+x.prox+dd(x.mes)+dd(x.dia),"RRULE:FREQ=YEARLY","SUMMARY:🎂 Aniversário de "+nome,
        "DESCRIPTION:"+icsTxt((x.ano?"Nasceu em "+x.ano+"\n":"")+(x.link||"")),"TRANSP:TRANSPARENT",
        "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Amanhã é aniversário de "+nome,"TRIGGER:-PT15H","END:VALARM",
        "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Hoje é aniversário de "+nome,"TRIGGER:PT9H","END:VALARM",
        "END:VEVENT")});
    L.push("END:VCALENDAR");
    baixar("aniversarios-marcados.ics","text/calendar;charset=utf-8",L.join("\r\n")+"\r\n")});
  $("#bd-csv").addEventListener("click",function(){
    function q(v){return '"'+String(v).replace(/"/g,'""')+'"'}
    var out=["Nome,Ano,Mes,Dia,Perfil"].concat(marcados().map(function(x){return [q(x.nome),x.ano||"",x.mes,x.dia,q(x.link||"")].join(",")}));
    baixar("aniversarios-marcados.csv","text/csv;charset=utf-8","﻿"+out.join("\r\n"))});
  function lsRead(){try{return JSON.parse(localStorage.getItem(LS)||"[]")}catch(e){return[]}}
  function lsWrite(){if(SEM_TABELA){try{localStorage.setItem(LS,JSON.stringify(items))}catch(e){}}else pessoalGravar("aniversarios",items)}
  function bkey(x){return norm(x.nome)+"|"+x.dia+"|"+x.mes}
  function add(it){items.push(it);lsWrite();render()}
  function remove(id){items=items.filter(function(x){return x.id!==id});lsWrite();render()}
  $("#form").addEventListener("submit",function(e){
    e.preventDefault();
    var nome=$("#f-nome").value.trim(),dia=parseInt($("#f-dia").value,10),mes=parseInt(sel.value,10);
    if(!nome||!(dia>=1&&dia<=31))return;
    add({id:"b"+Date.now().toString(36),nome:nome,dia:dia,mes:mes});
    $("#f-nome").value="";$("#f-dia").value="";
  });
  $("#bd-busca").addEventListener("input",render);

  /* Importa o CSV do Facebook: "Name","Year","Month","Day","Link to Profile" */
  function parseCsv(text){
    var rows=[],row=[],f="",q=false;
    for(var i=0;i<text.length;i++){var c=text[i];
      if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
      else if(c==='"')q=true;
      else if(c===","){row.push(f);f=""}
      else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(f);rows.push(row);row=[];f=""}
      else f+=c}
    if(f||row.length){row.push(f);rows.push(row)}
    return rows.filter(function(r){return r.some(function(x){return x.trim()})})}
  function importCsv(text){
    var rows=parseCsv(text.replace(/^﻿/,""));
    if(!rows.length)throw new Error("arquivo vazio");
    var head=rows[0].map(function(x){return x.trim().toLowerCase()});
    function col(n){return head.indexOf(n)}
    var cN=col("name"),cY=col("year"),cM=col("month"),cD=col("day"),cL=col("link to profile");
    if(cN<0||cM<0||cD<0)throw new Error("não achei as colunas Name, Month e Day");
    var seen={},added=0,dup=0,bad=0;
    items.forEach(function(x){seen[bkey(x)]=1});
    rows.slice(1).forEach(function(r,i){
      var nome=(r[cN]||"").replace(/^['"\-\s]+|['"\s]+$/g,"").trim(),mes=parseInt(r[cM],10),dia=parseInt(r[cD],10),ano=parseInt(r[cY],10);
      if(!nome||!(mes>=1&&mes<=12)||!(dia>=1&&dia<=31)){bad++;return}
      var it={id:"fb"+Date.now().toString(36)+i,nome:nome,dia:dia,mes:mes};
      if(ano>1900&&ano<=now.getFullYear())it.ano=ano;
      var link=(r[cL]||"").trim();if(/^https:\/\/(www\.)?facebook\.com\//.test(link))it.link=link;
      var k=bkey(it);if(seen[k]){dup++;return}
      seen[k]=1;items.push(it);added++});
    lsWrite();render();
    return {added:added,dup:dup,bad:bad}}
  $("#bd-file").addEventListener("change",function(e){
    var f=e.target.files&&e.target.files[0],msg=$("#bd-imp");if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){
      try{var r=importCsv(String(rd.result));
        msg.textContent="Importei "+r.added+(r.added===1?" aniversário":" aniversários")+(r.dup?" e pulei "+r.dup+(r.dup===1?" repetido":" repetidos"):"")+(r.bad?" ("+r.bad+(r.bad===1?" linha sem data)":" linhas sem data)"):"")+". Ficam guardados na sua conta."}
      catch(err){msg.textContent="Não consegui ler esse arquivo ("+err.message+"). Use o CSV de datas de nascimento exportado do Facebook."}
      e.target.value=""};
    rd.onerror=function(){msg.textContent="Não consegui abrir o arquivo."};
    rd.readAsText(f,"utf-8")});
  /* Apagar tudo pede uma segunda confirmação na própria página */
  var clearArmed=false;
  $("#bd-clear").addEventListener("click",function(){
    var b=$("#bd-clear");
    if(!clearArmed){clearArmed=true;b.textContent="Clique de novo para apagar os "+items.length;b.classList.add("danger");
      setTimeout(function(){clearArmed=false;b.textContent="Apagar todos";b.classList.remove("danger")},5000);return}
    clearArmed=false;b.textContent="Apagar todos";b.classList.remove("danger");
    items=[];lsWrite();render();$("#bd-imp").textContent="Lista apagada."});

  /* ===== Tela inicial: a visão do dia num lugar só ===== */
  var ICOS={
    link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 7 8.5-7"/></svg>',
    mba:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10.5V15c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.5M21 8v6"/></svg>',
    bola:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><path d="M7.2 5.6c2 3.6 2 9.2 0 12.8M16.8 5.6c-2 3.6-2 9.2 0 12.8"/></svg>',
    carro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.2" fill="currentColor"/><circle cx="17" cy="20" r="1.2" fill="currentColor"/></svg>',
    jornal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 16h3"/></svg>',
    bolo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16v-8H4zM4 16.5c2.6 1.6 5.4 1.6 8 0 2.6 1.6 5.4 1.6 8 0M12 13V9.5"/></svg>',
    mala:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4.5h6V7M3 13h18"/></svg>',
    livro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'};
  function wCard(title,ico,cor,more,cls){
    var ic=h("span",{class:"ico",style:"--ic:"+cor});ic.innerHTML=ICOS[ico];
    var p=h("div",{class:"panel "+(cls||"")},h("div",{class:"wh"},ic,h("h2",{text:title}),more?h("a",{class:"more",href:more[0],text:more[1]}):null));
    return p}
  function quando(d){return new Date(d).toLocaleString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(",","")}
  function saudacao(){var hr=new Date().getHours();return hr<5?"Boa noite":hr<12?"Bom dia":hr<18?"Boa tarde":"Boa noite"}
  var relogio=null;
  function renderInicio(){
    var root=$("#inicio-view");root.innerHTML="";
    var clock=h("div",{class:"clock"}),wx=h("p",{class:"sub",text:"Sorocaba"});
    function tick(){clock.textContent=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
    tick();clearInterval(relogio);relogio=setInterval(tick,15000);
    root.appendChild(h("div",{class:"home"},
      h("div",{class:"hi"},h("div",null,h("h2",{text:saudacao()+", Rayner"}),h("p",{class:"sub",text:new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})})),h("div",null,clock,wx)),
      h("div",{class:"hgrid"},wEmail(),wLazy(["sistema"],"wAgenda"),wLazy(["conexoes"],"wConexoes"),wLazy(["esportes"],"wEsportes"),wNoticias(),wX(),wMercado(),wLazy(["mba"],"wMba"),wAniv(),wVagas(),wEstudos())));
    getJson("https://api.open-meteo.com/v1/forecast?latitude=-23.50&longitude=-47.46&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&hourly=precipitation_probability,precipitation&timezone=America%2FSao_Paulo&forecast_days=2").then(function(d){
      wx.textContent=Math.round(d.current.temperature_2m)+"° agora em Sorocaba · "+WXTXT[wxKind(d.current.weather_code)]+" · máx. "+Math.round(d.daily.temperature_2m_max[0])+"°, mín. "+Math.round(d.daily.temperature_2m_min[0])+"°";
      /* aviso de chuva nas próximas 12 horas, em cima dos cartões */
      var c=NUCLEO.chuvaAviso(d.hourly,d.current.time);if(!c)return;
      var g=root.querySelector(".hgrid");if(g)g.parentNode.insertBefore(h("div",{class:"chuva",role:"status"},h("b",{text:"☔ "+c.texto}),h("span",{class:"sub",text:c.agora?"Se for sair, leve o guarda-chuva.":"Bom saber antes de sair."})),g)}).catch(function(){})}

  /* E-mail: as duas contas do Gmail, com a caixa de entrada aqui dentro */
  var EMAILS_PADRAO=[{n:"Rayner Carvalho",u:"https://mail.google.com/mail/u/0/#inbox"},{n:"Raynim Carvalho",u:"https://mail.google.com/mail/u/1/#inbox"}];
  function wEmail(){
    var p=wCard("E-mail","mail","#D93F2F"),contas=(PESSOAL.emails||EMAILS_PADRAO).filter(function(c){return /mail\.google\.com/.test(c.u)}).map(function(c){var n={"Gmail 1":"Rayner Carvalho","Gmail 2":"Raynim Carvalho"}[c.n];return n?Object.assign({},c,{n:n}):c});
    var ul=h("div");
    contas.forEach(function(c,i){
      if(/mail\.google\.com/.test(c.u)){ul.appendChild(gmailBloco(contas,i));return}
      ul.appendChild(h("ul",{class:"wl"},h("li",null,h("span",{class:"grow"},h("b",{text:c.n}),h("span",{class:"sub",text:c.e||"caixa de entrada"})),ext(c.u,"Abrir","ghostbtn"))))});
    p.appendChild(ul);
    var ed=h("button",{type:"button",class:"ghostbtn",text:"Dar nomes às contas"});
    ed.onclick=function(){
      var f=h("div",{class:"wform"});
      var ins=contas.map(function(c){var a=h("input",{type:"text",value:c.n,"aria-label":"Nome da conta"}),b=h("input",{type:"text",value:c.e||"",placeholder:"endereço (opcional)","aria-label":"Endereço"});f.appendChild(h("div",{class:"two"},a,b));return [a,b]});
      var ok=h("button",{type:"button",text:"Salvar"});
      ok.onclick=function(){pessoalGravar("emails",contas.map(function(c,i){return {n:ins[i][0].value.trim()||c.n,e:ins[i][1].value.trim(),u:c.u}}));renderInicio()};
      f.appendChild(ok);ul.replaceWith(f);ed.remove()};
    p.appendChild(h("p",{class:"note",text:"Gmail: conecte cada conta uma vez; depois é só tocar em Atualizar (o Google pede de novo a cada hora)."}));
    p.appendChild(ed);
    return p}

  /* ===== Gmail: lê a caixa de entrada direto do navegador (Google Identity Services + Gmail API, só leitura).
     Nada passa por servidor nosso; o acesso dura 1 hora e fica só neste aparelho. ===== */
  var GOOGLE_CLIENT_ID="266486773468-3nndrpaqv0q25ea3s3llpjv5ibvav20l.apps.googleusercontent.com";
  var GSI_JS="https://accounts.google.com/gsi/client",GM_SCOPE="https://www.googleapis.com/auth/gmail.readonly";
  function carregarScript(src){return new Promise(function(res,rej){if(document.querySelector('script[src="'+src+'"]')){res();return}
    var sc=document.createElement("script");sc.src=src;sc.onload=res;sc.onerror=function(){rej(new Error("não carregou "+src))};document.head.appendChild(sc)})}
  if(GOOGLE_CLIENT_ID)carregarScript(GSI_JS).catch(function(){});
  function gmToken(slot){try{var t=JSON.parse(localStorage.getItem("rac-gm-"+slot)||"null");return t&&t.exp>Date.now()+60000?t.tk:null}catch(e){return null}}
  function gmApi(tk,path){return fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{headers:{Authorization:"Bearer "+tk}}).then(function(r){
    if(r.status===401)throw new Error("expirou");if(!r.ok)throw new Error("Gmail respondeu "+r.status);return r.json()})}
  /* Pede o acesso (precisa de um toque: o Google abre uma janelinha) */
  function gmConectar(slot,email){
    return carregarScript(GSI_JS).then(function(){return new Promise(function(res,rej){
      var cli=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:GM_SCOPE,login_hint:email||undefined,
        callback:function(r){if(r.error){rej(new Error(r.error));return}
          try{localStorage.setItem("rac-gm-"+slot,JSON.stringify({tk:r.access_token,exp:Date.now()+(+r.expires_in||3600)*1000}))}catch(e){}
          res(r.access_token)},
        error_callback:function(e){rej(new Error(e&&e.type==="popup_closed"?"janela fechada":"não abriu a janela do Google"))}});
      cli.requestAccessToken({prompt:email?"":"select_account"})})})}
  function cab(m,n){var x=(m.payload&&m.payload.headers||[]).filter(function(y){return y.name.toLowerCase()===n})[0];return x?x.value:""}
  function remetente(v){var m=/^\s*"?([^"<]+?)"?\s*<.*>\s*$/.exec(v);return (m?m[1]:v).trim()}
  function gmailBloco(contas,i){
    var c=contas[i],slot="g"+i,box=h("div",{class:"gmbox"});
    var head=h("div",{class:"gmhead"}),corpo=h("ul",{class:"wl"});
    box.appendChild(head);box.appendChild(corpo);
    /* encolher: esconde a lista e deixa só o nome e os não lidos (lembra neste aparelho) */
    var chMin="rac-gm-min-"+slot,min=false;try{min=localStorage.getItem(chMin)==="1"}catch(e){}
    function aplicarMin(){box.classList.toggle("min",min);tg.setAttribute("aria-expanded",String(!min));tg.title=min?"Mostrar os e-mails":"Encolher"}
    var tg=h("button",{type:"button",class:"gmtg"});
    tg.onclick=function(){min=!min;try{localStorage.setItem(chMin,min?"1":"0")}catch(e){}aplicarMin()};
    aplicarMin();
    function cabecalho(txt,botao){head.innerHTML="";head.appendChild(tg);head.appendChild(h("span",{class:"grow"},h("b",{text:c.n}),h("span",{class:"sub",text:txt})));if(botao)head.appendChild(botao);head.appendChild(ext(c.u,"Abrir","ghostbtn"))}
    function botao(rot){var b=h("button",{type:"button",class:"ghostbtn pri",text:rot});
      b.onclick=function(){b.disabled=true;gmConectar(slot,c.e).then(function(tk){return carregar(tk)}).catch(function(e){b.disabled=false;cabecalho("Não conectou ("+e.message+")",b)})};return b}
    function carregar(tk){
      cabecalho("Carregando…");
      return Promise.all([gmApi(tk,"profile"),gmApi(tk,"labels/INBOX"),gmApi(tk,"messages?labelIds=INBOX&maxResults=6")]).then(function(r){
        var email=r[0].emailAddress,naoLidos=r[1].messagesUnread||0;
        /* guarda o endereço para o Google já sugerir a conta certa da próxima vez */
        if(email&&c.e!==email){var l=contas.map(function(x,k){return k===i?Object.assign({},x,{e:email}):x});pessoalGravar("emails",l);c.e=email}
        var link="https://mail.google.com/mail/?authuser="+encodeURIComponent(email);
        c.u=link+"#inbox";
        var at=h("button",{type:"button",class:"ghostbtn",text:"Atualizar"});at.onclick=function(){var t=gmToken(slot);if(t)carregar(t);else botao("Atualizar").click()};
        cabecalho(email+" · "+naoLidos+(naoLidos===1?" não lido":" não lidos"),at);
        return Promise.all((r[2].messages||[]).map(function(m){return gmApi(tk,"messages/"+m.id+"?format=metadata&metadataHeaders=From&metadataHeaders=Subject")})).then(function(ms){
          corpo.innerHTML="";
          ms.forEach(function(m){var nl=(m.labelIds||[]).indexOf("UNREAD")>=0,d=new Date(+m.internalDate);
            var hojeMsg=d.toDateString()===new Date().toDateString();
            corpo.appendChild(h("li",{class:nl?"gmnl":null},h("span",{class:"grow"},
              h("a",{href:link+"#inbox/"+m.threadId,target:"_blank",rel:"noopener",text:cab(m,"subject")||"(sem assunto)"}),
              h("span",{class:"sub",text:remetente(cab(m,"from"))})),
              h("span",{class:"end sub",text:hojeMsg?d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})})))});
          if(!ms.length)corpo.appendChild(h("li",null,h("span",{class:"sub",text:"Caixa de entrada vazia."})))})
      }).catch(function(e){
        if(e.message==="expirou"){try{localStorage.removeItem("rac-gm-"+slot)}catch(x){}cabecalho("O acesso expirou",botao("Atualizar"))}
        else cabecalho("Não consegui ler ("+e.message+")",botao("Tentar de novo"))})}
    if(!GOOGLE_CLIENT_ID){cabecalho(c.e||"falta configurar o acesso do Google");return box}
    var tk=gmToken(slot);
    if(tk)carregar(tk);else cabecalho(c.e?c.e+" · toque para ver os e-mails":"ainda não conectado",botao(c.e?"Atualizar":"Conectar"));
    return box}

  /* Esportes: último resultado e próximo jogo de cada time */
  function wEsportes(){
    var p=wCard("Esportes","bola","#005A9C",["#esportes","ver tudo"]);
    /* MLB primeiro: os jogos mais recentes da liga (e o que está rolando ou vem a seguir) */
    var mlb=h("ul",{class:"wl"},h("li",null,h("span",{class:"sub",text:"Carregando a MLB…"})));
    p.appendChild(h("div",{class:"cat",text:"MLB"}));p.appendChild(mlb);
    var ul=h("ul",{class:"wl"});
    p.appendChild(h("div",{class:"cat",text:"Meus times"}));p.appendChild(ul);
    var hoje=Date.now(),ini=new Date(hoje-21*864e5).toISOString().slice(0,10),fim=new Date(hoje+45*864e5).toISOString().slice(0,10);
    function curto(n){var w=n.split(" ");return /^(Sox|Jays)$/.test(w[w.length-1])?w.slice(-2).join(" "):w[w.length-1]}
    function placar(g){
      var a=g.away,b=g.home,fim=g.state==="post";
      function lado(t){return h("span",{class:"tn"+(fim&&t.winner?" win":"")},logoImg(t.id,"sm"),curto(t.name)+(g.state!=="pre"?" "+t.score:""))}
      return h("li",null,h("span",{class:"grow"},h("a",{href:g.detail},lado(a)," × ",lado(b)),
        h("span",{class:"sub",text:[g.label,g.state==="live"?"ao vivo":g.state==="pre"?quando(g.date):new Date(g.date).toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"})].filter(Boolean).join(" · ")})))}
    mlbSched("startDate="+new Date(hoje-4*864e5).toISOString().slice(0,10)+"&endDate="+new Date(hoje+2*864e5).toISOString().slice(0,10)).then(function(gs){
      var fin=gs.filter(function(g){return g.state==="post"}).reverse().slice(0,3),agora=gs.filter(function(g){return g.state!=="post"}).slice(0,2);
      mlb.innerHTML="";fin.concat(agora.slice(0,1)).forEach(function(g){mlb.appendChild(placar(g))});
      if(!mlb.children.length)mlb.appendChild(h("li",null,h("span",{class:"sub",text:"Nenhum jogo da MLB nos últimos dias."})))
    }).catch(function(){mlb.innerHTML="";mlb.appendChild(h("li",null,h("span",{class:"sub",text:"Não consegui carregar a MLB agora."})))});
    function linha(nome,logo,href,gs,meu,soComJogo){
      var fin=gs.filter(function(g){return g.state==="post"}),nx=gs.filter(function(g){return g.state!=="post"})[0],u=fin[fin.length-1];
      if(soComJogo&&!nx)return null;
      var txt="Sem jogos recentes";
      if(u){var eu=meu(u.away)?u.away:u.home,ele=eu===u.away?u.home:u.away;
        txt=(eu.winner?"V ":"D ")+eu.score+"–"+ele.score+(eu===u.away?" em ":" vs ")+(ele.abbr||ele.name)}
      return h("li",null,img(logo,"lg"),h("span",{class:"grow"},h("a",{href:href,text:nome}),h("span",{class:"sub",text:txt})),
        h("span",{class:"end"},nx?h("a",{href:nx.detail,text:nx.state==="live"?"Ao vivo":quando(nx.date)}):h("span",{class:"sub",text:"sem próximo jogo"})))}
    Promise.all([
      mlbSched("teamId=119&startDate="+ini+"&endDate="+fim).then(function(gs){return linha("Dodgers",logoUrl(119),"#esportes/beisebol/dodgers",gs,function(t){return t.id===119},true)}).catch(function(){return null}),
      espnSchedule("nba").then(function(d){return linha("Lakers",espnLogo("nba",d.team),"#esportes/basquete",d.games,function(t){return t.abbr===d.team.abbreviation})}).catch(function(){return null}),
      espnSchedule("nfl").then(function(d){return linha("Packers",espnLogo("nfl",d.team),"#esportes/futebol-americano",d.games,function(t){return t.abbr===d.team.abbreviation})}).catch(function(){return null})
    ]).then(function(r){ul.innerHTML="";r.filter(Boolean).forEach(function(li){ul.appendChild(li)});if(!ul.children.length)ul.appendChild(h("li",null,h("span",{class:"sub",text:"Não consegui carregar os jogos agora."})))});
    return p}

  /* Mercado do mês */
  function wMercado(){
    var p=wCard("Mercado do mês","carro","#0E8A6A",["#mercado","abrir"]),b=h("div",null,h("p",{class:"sub",text:"Carregando…"}));p.appendChild(b);
    window.RACmercado.resumo().then(function(r){var M=window.RACmercado.money;b.innerHTML="";
      b.appendChild(h("p",{class:"wbig",text:M(r.total)}));
      b.appendChild(h("p",{class:"sub",text:r.compras+(r.compras===1?" compra":" compras")+" em "+r.mes}));
      if(r.ultima)b.appendChild(h("ul",{class:"wl"},h("li",null,h("span",{class:"grow"},h("b",{text:"Última compra: "+r.ultima.mercado}),h("span",{class:"sub",text:r.ultima.data+" · "+r.ultima.itens+" itens"})),h("span",{class:"end",text:M(r.ultima.total)}))))
    }).catch(function(){b.innerHTML="";b.appendChild(h("p",{class:"sub",text:"Não consegui carregar o mercado agora."}))});
    return p}

  /* MBA: aulas, progresso, links e parte financeira (preenchidos por você, guardados na sua conta) */
  function proxVenc(dia){if(!dia)return null;var t=new Date(),d=new Date(t.getFullYear(),t.getMonth(),dia);if(d<new Date(t.getFullYear(),t.getMonth(),t.getDate()))d=new Date(t.getFullYear(),t.getMonth()+1,dia);return d}
  function num2(v){var s=String(v||"").replace(/[R$\s]/g,"");if(/,\d{1,2}$/.test(s))s=s.replace(/\./g,"").replace(",",".");return parseFloat(s)||0}
  function BRL(v){return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}

  /* Notícias de Sorocaba (noticias.json, atualizado pelo robô do GitHub a cada 3 horas) */
  function wNoticias(){
    var p=wCard("Notícias de Sorocaba","jornal","#C2410C",null),ul=h("ul",{class:"wl"},h("li",null,h("span",{class:"sub",text:"Carregando…"})));p.appendChild(ul);
    getJson("noticias.json?v="+Date.now()).then(function(d){ul.innerHTML="";
      (d.noticias||[]).slice(0,7).forEach(function(n){ul.appendChild(h("li",null,h("span",{class:"grow"},h("a",{href:n.u,target:"_blank",rel:"noopener",text:n.t}),h("span",{class:"sub",text:n.f+" · "+new Date(n.d).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}))))});
      if(!ul.children.length)ul.appendChild(h("li",null,h("span",{class:"sub",text:"Nenhuma notícia nas últimas horas."})))
    }).catch(function(){ul.innerHTML="";ul.appendChild(h("li",null,h("span",{class:"sub",text:"As notícias ainda não foram coletadas."})))});
    return p}

  function wAniv(){
    var p=wCard("Aniversários","bolo","#D6283B",["#aniversarios","ver todos"],"w3");
    var l=withDates().sort(function(a,b){return a.dias-b.dias||(b.fav?1:0)-(a.fav?1:0)}).slice(0,5);
    if(!l.length){p.appendChild(h("p",{class:"sub",text:"Nenhum aniversário cadastrado ainda."}));return p}
    p.appendChild(h("ul",{class:"wl"},l.map(function(x){return h("li",null,h("span",{class:"grow"},h("b",{text:(x.fav?"⭐ ":"")+x.nome}),h("span",{class:"sub",text:dd(x.dia)+"/"+dd(x.mes)})),h("span",{class:"end",text:countTxt(x)}))})));
    return p}

  function wVagas(){
    var p=wCard("Vagas","mala","#2E8BD8",["#vagas","ver todas"]),b=h("div",null,h("p",{class:"sub",text:"Carregando…"}));p.appendChild(b);
    vgPronto.then(function(){b.innerHTML="";
      var l=VG.all.filter(function(v){return !vgHidden[v.id]}),novas=l.filter(function(v){return v.d<=3});
      b.appendChild(h("p",{class:"sub",text:l.length+" vagas abertas · "+novas.length+(novas.length===1?" nova":" novas")+" nos últimos 3 dias"}));
      b.appendChild(h("ul",{class:"wl"},l.slice(0,4).map(function(v){return h("li",null,h("span",{class:"grow"},h("a",{href:vgLink(v)[0],target:"_blank",rel:"noopener",text:v.t}),h("span",{class:"sub",text:(v.e||"Empresa não informada")+" · "+v.m})),v.d<=3?h("span",{class:"vp new",text:"Nova"}):null)})))
    }).catch(function(){b.innerHTML="";b.appendChild(h("p",{class:"sub",text:"Não consegui carregar as vagas agora."}))});
    return p}

  function wX(){
    var p=wCard("Perfis no X","x","#1F2328",["#x","abrir"],"w3");
    p.appendChild(h("ul",{class:"wl"},xCats().filter(function(c){return c.h.length}).map(function(c){return h("li",null,catIco(c),h("span",{class:"grow"},h("a",{href:"#x/"+c.k,text:c.n})),x36link(c.h,"36h","ghostbtn"))})));
    return p}

  /* ===== Sistema: registro de falhas, sincronização, backup, agenda e busca ===== */
  var SIS={erros:[],conflitos:{},falhaSinc:null,ultimaSinc:null,semTabelaErros:false,n:0,versao:{}};
  try{SIS.erros=JSON.parse(localStorage.getItem("rac-erros")||"[]")}catch(e){}
  /* toda falha fica guardada (neste aparelho e na conta) e aparece na página Sistema */
  function logErro(origem,e,detalhe){
    var msg=String((e&&e.message)||e||"").slice(0,500);if(!msg||/ResizeObserver|^Script error/.test(msg))return;
    SIS.erros.unshift({quando:new Date().toISOString(),origem:origem,mensagem:msg});SIS.erros=SIS.erros.slice(0,40);
    try{localStorage.setItem("rac-erros",JSON.stringify(SIS.erros))}catch(x){}
    if(SB&&EU&&isOwner()&&!SIS.semTabelaErros&&++SIS.n<=20)
      SB.from("erros").insert({origem:origem,mensagem:msg,detalhe:detalhe||null,aparelho:navigator.userAgent.slice(0,140)}).then(function(r){if(r.error)SIS.semTabelaErros=true});
    syncSelo()}
  window.addEventListener("error",function(ev){if(ev.filename&&ev.filename.indexOf(location.origin)!==0)return;logErro("página",ev.error||ev.message,{arquivo:ev.filename,linha:ev.lineno})});
  window.addEventListener("unhandledrejection",function(ev){logErro("página",ev.reason)});

  /* selo de sincronização no rodapé do menu: pendências, conflitos e quando sincronizou */
  function pendentes(){var l=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.indexOf("rac-p-")===0){var cp=copiaLer(k.slice(6));if(cp&&!cp.ok&&!SIS.conflitos[k.slice(6)])l.push(k.slice(6))}}filaLer().forEach(function(op){l.push("fila: "+op.t)});return l}
  function syncSelo(){
    var el=$("#syncst");if(!el||!isOwner())return;var nc=Object.keys(SIS.conflitos).length,np=pendentes().length,txt,cls;
    if(nc){txt="⚠ "+nc+(nc===1?" conflito":" conflitos")+": resolver";cls="ruim"}
    else if(SIS.falhaSinc){txt="⚠ Sem conexão com a conta"+(np?" · "+np+" pendente"+(np>1?"s":""):"");cls="ruim"}
    else if(np){txt="⏳ "+np+(np===1?" alteração pendente":" alterações pendentes");cls="pend"}
    else{txt="✓ Sincronizado"+(SIS.ultimaSinc?" · "+new Date(SIS.ultimaSinc).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"");cls="bom"}
    el.textContent=txt;el.className="syncst "+cls}
  /* o que ficou pendente sobe quando a internet volta e a cada 5 minutos */
  function reenviarPendentes(){processarFila();if(!SB||!isOwner()||SEM_TABELA)return;pendentes().forEach(function(ch){if(ch.indexOf("fila: ")===0)return;var cp=copiaLer(ch);if(cp)pessoalGravar(ch,cp.v)})}
  window.addEventListener("online",reenviarPendentes);setInterval(reenviarPendentes,5*60e3);
  var NOMES_CHAVE={mba:"MBA",mbaFeito:"MBA (o que já foi feito)",mbaLinks:"Links das aulas",aniversarios:"Aniversários","x-amigos":"Amigos do X",projetos:"Projetos",salvos:"Guardados",lembretes:"Lembretes",exercicios:"Estudos",emails:"E-mails",googleMaps:"Chave do Google Maps",ultimoBackup:"Último backup"};
  function resumoValor(v){if(Array.isArray(v))return v.length+(v.length===1?" item":" itens");if(v&&typeof v==="object")return Object.keys(v).length+" campos";return String(v).slice(0,40)}


  /* ===== Fila sem internet: gravações no banco que esperam a conexão voltar ===== */
  var FILA_LS="rac-fila";
  function novoId(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,function(c){return (c^Math.random()*16>>c/4).toString(16)})}
  function filaLer(){try{return JSON.parse(localStorage.getItem(FILA_LS)||"[]")}catch(e){return []}}
  function filaGravar(l){try{localStorage.setItem(FILA_LS,JSON.stringify(l))}catch(e){}syncSelo()}
  function semRede(e){return !navigator.onLine||/Failed to fetch|NetworkError|Load failed|network|fetch/i.test(String(e&&e.message||e))}
  function executarOp(op){var q=SB.from(op.t),p=op.acao==="insert"?q.insert(op.dados):op.acao==="update"?q.update(op.dados).eq("id",op.id):q.delete().eq("id",op.id);
    return p.then(function(r){if(r.error)throw new Error(r.error.message);return r})}
  /* tenta gravar agora; se for falta de rede, guarda na fila deste aparelho e manda quando a internet voltar */
  function bancoOuFila(op){
    if(!navigator.onLine){filaGravar(filaLer().concat([Object.assign({quando:Date.now()},op)]));return Promise.resolve({enfileirado:true})}
    return executarOp(op).catch(function(e){if(semRede(e)){filaGravar(filaLer().concat([Object.assign({quando:Date.now()},op)]));return {enfileirado:true}}throw e})}
  var filaRodando=false;
  function processarFila(){
    var l=filaLer();if(!l.length||!SB||!navigator.onLine||filaRodando)return;filaRodando=true;var resto=[];
    l.reduce(function(p,op){return p.then(function(){return executarOp(op).catch(function(e){if(semRede(e))resto.push(op);else logErro("fila",e,{t:op.t,acao:op.acao})})})},Promise.resolve())
      .then(function(){filaGravar(resto.concat(filaLer().slice(l.length)));filaRodando=false})}
  window.addEventListener("online",processarFila);setInterval(processarFila,60e3);

  /* ===== Captura rápida: botão "+" para anotar em segundos (lista, tarefa, lembrete, ideia, link, peso, gasto, km) ===== */
  function capOpcoes(){
    var dono=isOwner(),o=[["compra","🛒","Item na lista de compras"],["tarefa","✅","Tarefa da casa"]];
    if(dono)o.push(["lembrete","📌","Lembrete com data"],["ideia","💡","Ideia ou projeto"],["link","🔗","Guardar um link"]);
    o.push(["peso","⚖️","Peso (Eddie ou Olivia)"],["gasto","💸","Gasto (família ou veículo)"],["km","🚗","Quilometragem do veículo"]);
    return o}
  function abrirCaptura(inicial,pre){
    fecharCaptura();pre=pre||{};
    var fundo=h("div",{class:"capfundo",id:"capfundo"}),folha=h("div",{class:"capfolha panel",role:"dialog","aria-label":"Captura rápida"});
    fundo.onclick=function(e){if(e.target===fundo)fecharCaptura()};
    var corpo=h("div");folha.appendChild(h("div",{class:"caph"},h("b",{text:"Anotar rápido"}),h("button",{type:"button",class:"ghostbtn",text:"Fechar",onclick:null})));
    folha.querySelector(".caph button").onclick=fecharCaptura;folha.appendChild(corpo);fundo.appendChild(folha);document.body.appendChild(fundo);
    function menu(){corpo.innerHTML="";corpo.appendChild(h("div",{class:"capgrid"},capOpcoes().map(function(op){var b=h("button",{type:"button",class:"capop"},h("span",{class:"capico",text:op[1]}),h("span",{text:op[2]}));b.onclick=function(){form(op[0])};return b})))}
    function campo(rot,el){return h("label",null,rot,el)}
    function pronto(msg){corpo.innerHTML="";corpo.appendChild(h("p",{class:"capok",text:msg}));var mais=h("button",{type:"button",class:"ghostbtn",text:"Anotar outra coisa"});mais.onclick=menu;corpo.appendChild(h("div",{class:"vfil"},mais));setTimeout(function(){if(document.getElementById("capfundo")===fundo&&corpo.querySelector(".capok"))fecharCaptura()},2200)}
    function registro(quem,tipo,titulo,valor,dados,detalhes){
      return bancoOuFila({t:"registros",acao:"insert",dados:{id:novoId(),quem:quem,tipo:tipo,data:hojeISO(),titulo:titulo,valor:valor||null,detalhes:detalhes||null,dados:dados||null}})}
    function form(tipo){
      corpo.innerHTML="";var f=h("div",{class:"wform"}),st=h("p",{class:"sub",role:"status"}),ok=h("button",{type:"button",text:"Salvar"}),volta=h("button",{type:"button",class:"ghostbtn",text:"Voltar"});volta.onclick=menu;
      var a=h("input",{type:"text"}),b=h("input",{type:"text",inputmode:"decimal"}),d=h("input",{type:"date",value:hojeISO()}),sel=h("select");
      function opcoes(l){sel.innerHTML="";l.forEach(function(x){sel.appendChild(h("option",{value:x[0],text:x[1]}))})}
      var fim=function(r,msg){pronto((r&&r.enfileirado?"⏳ Sem internet: guardado neste aparelho, sobe sozinho. ":"✓ ")+msg)};
      if(tipo==="compra"||tipo==="tarefa"){a.placeholder=tipo==="compra"?"Ex.: 2 leite (vírgula separa vários)":"Ex.: trocar a lâmpada da cozinha";a.value=pre.texto||"";f.appendChild(campo(tipo==="compra"?"O que comprar":"O que fazer",a));
        ok.onclick=function(){var v=a.value.trim();if(!v)return a.focus();var itens=v.split(tipo==="compra"?/\s*[,;\n]\s*/:/\s*[;\n]\s*/).filter(Boolean).map(function(t){return {id:novoId(),tipo:tipo,item:t.slice(0,200)}});
          bancoOuFila({t:"lista",acao:"insert",dados:itens}).then(function(r){fim(r,itens.length+(itens.length===1?" item adicionado":" itens adicionados")+(tipo==="compra"?" à lista.":" às tarefas."))}).catch(function(e){st.textContent="Não consegui salvar: "+e.message})}}
      else if(tipo==="lembrete"){a.placeholder="Ex.: pagar o IPVA";f.appendChild(campo("O quê",a));f.appendChild(campo("Quando",d));
        ok.onclick=function(){if(!a.value.trim())return a.focus();pessoalGravar("lembretes",[{id:"l"+Date.now().toString(36),data:d.value||hojeISO(),t:a.value.trim()}].concat(PESSOAL.lembretes||[]));pronto("✓ Lembrete na Agenda para "+dataBR(d.value||hojeISO())+".")}}
      else if(tipo==="ideia"){var tx=h("textarea",{rows:"3",placeholder:"Detalhes (cite as tecnologias para entrar nas Conexões)"});a.placeholder="Nome da ideia";f.appendChild(campo("Ideia",a));f.appendChild(campo("Detalhes",tx));
        ok.onclick=function(){if(!a.value.trim())return a.focus();pessoalGravar("projetos",[{id:"p"+Date.now().toString(36),t:a.value.trim(),txt:tx.value.trim(),atualizado:hojeISO()}].concat(PESSOAL.projetos||[]));pronto("✓ Ideia guardada em Conexões do dia → projetos.")}}
      else if(tipo==="link"){var u=h("input",{type:"url",placeholder:"https://…",value:pre.link||""});a.placeholder="Título (opcional)";a.value=pre.titulo||"";f.appendChild(campo("Link",u));f.appendChild(campo("Título",a));
        ok.onclick=function(){var url=urlAbs(u.value);if(!url)return u.focus();var l=(PESSOAL.salvos||[]).slice();if(!l.some(function(x){return x.u===url}))l.unshift({tipo:"link",t:a.value.trim()||url,u:url,f:"",quando:hojeISO()});pessoalGravar("salvos",l);pronto("✓ Link guardado em Conexões do dia → Guardados.")}}
      else if(tipo==="peso"){opcoes([["olivia","Olivia"],["eddie","Eddie"]]);b.placeholder="Ex.: 6,8";f.appendChild(campo("De quem",sel));f.appendChild(campo("Peso (kg)",b));
        ok.onclick=function(){var v=b.value.trim().replace(",",".");if(!(+v>0))return b.focus();registro(sel.value,"peso","Pesagem",String(v).replace(".",","),null).then(function(r){fim(r,"Peso de "+FAM_NOMES[sel.value]+" anotado.")}).catch(function(e){st.textContent="Não consegui salvar: "+e.message})}}
      else if(tipo==="gasto"){opcoes([["olivia","Olivia"],["eddie","Eddie"],["civic","Civic"],["moto","Moto"]]);a.placeholder="Ex.: pacote de fraldas";b.placeholder="Ex.: 59,90";f.appendChild(campo("Com quem",sel));f.appendChild(campo("O quê",a));f.appendChild(campo("Valor (R$)",b));
        f.appendChild(h("p",{class:"sub"},"Compra de mercado com nota? Use ",h("a",{href:"#mercado",class:"link",text:"Mercado → Adicionar nota"}),"."));
        ok.onclick=function(){var v=+b.value.trim().replace(/\./g,"").replace(",",".");if(!a.value.trim())return a.focus();if(!(v>0))return b.focus();
          var veic=/civic|moto/.test(sel.value),tp=veic?"manutencao":sel.value==="olivia"?"produto":"outro";
          registro(sel.value,tp,a.value.trim(),null,{custo:Math.round(v*100)/100,itensCusto:[[a.value.trim(),Math.round(v*100)/100]]}).then(function(r){fim(r,"Gasto de "+v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+" anotado em "+FAM_NOMES[sel.value]+".")}).catch(function(e){st.textContent="Não consegui salvar: "+e.message})}}
      else if(tipo==="km"){opcoes([["civic","Civic"],["moto","Moto"]]);b.placeholder="Ex.: 104308";b.setAttribute("inputmode","numeric");f.appendChild(campo("Veículo",sel));f.appendChild(campo("Quilometragem total do painel",b));
        ok.onclick=function(){var k=parseInt(b.value.replace(/\D/g,""),10);if(!(k>0))return b.focus();registro(sel.value,"outro","Quilometragem",null,{km:k}).then(function(r){fim(r,FAM_NOMES[sel.value]+": "+k.toLocaleString("pt-BR")+" km anotados.")}).catch(function(e){st.textContent="Não consegui salvar: "+e.message})}}
      f.appendChild(h("div",{class:"vfil"},ok,volta));f.appendChild(st);corpo.appendChild(f);
      setTimeout(function(){var el=f.querySelector("input,select");if(el)el.focus()},50);
      [a,b].forEach(function(el){el.addEventListener("keydown",function(e){if(e.key==="Enter"&&el.tagName==="INPUT"){e.preventDefault();ok.click()}})})}
    if(inicial)form(inicial);else menu()}
  var FAM_NOMES={eddie:"Eddie",olivia:"Olivia",civic:"Civic",moto:"Moto",c3:"C3"};
  function fecharCaptura(){var f=document.getElementById("capfundo");if(f)f.remove()}
  document.addEventListener("keydown",function(e){if(e.key==="Escape")fecharCaptura()});
  /* compartilhado de outro app para o RAC (PWA instalado): link vira "Guardar link"; texto vira itens da lista */
  function capturaCompartilhada(){
    var q=new URLSearchParams(location.search),link=q.get("link")||"",texto=q.get("texto")||"",titulo=q.get("titulo")||"";if(!link&&!texto&&!titulo)return;
    history.replaceState(null,"",location.pathname+location.hash);
    var m=/https?:\/\/\S+/.exec(texto);if(!link&&m){link=m[0];texto=texto.replace(link,"").trim()}
    if(link&&isOwner())abrirCaptura("link",{link:link,titulo:titulo||texto});else abrirCaptura("compra",{texto:[titulo,texto].filter(Boolean).join(", ")})}
  /* ===== Estudos: listas de exercícios para analista de dados (SQL, BI e Python) ===== */
  var TRILHAS=[
    {k:"sql",n:"SQL",c:"#2E8BD8",itens:[
      ["sqlbolt","SQLBolt: as 18 lições interativas","Do SELECT básico a JOINs e agregações, direto no navegador.","https://sqlbolt.com/"],
      ["murder","SQL Murder Mystery","Resolver um crime só com consultas. Ótimo para treinar JOIN e filtro.","https://mystery.knightlab.com/"],
      ["selectstar","Select Star SQL","Livro interativo com dados reais; vai até subconsultas.","https://selectstarsql.com/"],
      ["hackerrank-sql","HackerRank: trilha de SQL","Exercícios do básico ao avançado, com correção automática.","https://www.hackerrank.com/domains/sql"],
      ["mode","Mode: SQL Tutorial (window functions)","A parte avançada: funções de janela, CTEs e performance.","https://mode.com/sql-tutorial/"],
      ["leetcode-sql50","LeetCode: Top SQL 50","As 50 questões de SQL mais pedidas em entrevista.","https://leetcode.com/studyplan/top-sql-50/"],
      ["datalemur","DataLemur: perguntas de entrevista","Questões reais de empresas, com nível de dificuldade.","https://datalemur.com/questions"],
      ["pgexercises","PostgreSQL Exercises","Treino com um banco de clube esportivo, do fácil ao difícil.","https://pgexercises.com/"]]},
    {k:"bi",n:"BI",c:"#E8A317",itens:[
      ["pl300","Microsoft Learn: trilha de Analista de Dados (Power BI)","A trilha oficial da certificação PL-300, em português.","https://learn.microsoft.com/pt-br/training/career-paths/data-analyst"],
      ["daxguide","DAX Guide","Referência de todas as funções DAX, com exemplos.","https://dax.guide/"],
      ["maven","Maven Analytics: Data Playground","Bases prontas para montar dashboards de portfólio.","https://mavenanalytics.io/data-playground"],
      ["workout","Workout Wednesday","Um desafio de dashboard por semana para recriar.","https://workout-wednesday.com/"],
      ["swd","Storytelling with Data: desafios","Treino de visualização e de contar a história dos dados.","https://community.storytellingwithdata.com/challenges"],
      ["kaggle-ds","Kaggle Datasets: um dashboard completo","Escolha uma base e monte um painel do zero até publicar.","https://www.kaggle.com/datasets"]]},
    {k:"python",n:"Python",c:"#3776AB",itens:[
      ["kaggle-py","Kaggle Learn: Python","O básico da linguagem em exercícios curtos.","https://www.kaggle.com/learn/python"],
      ["kaggle-pandas","Kaggle Learn: Pandas","Ler, filtrar, agrupar e juntar tabelas.","https://www.kaggle.com/learn/pandas"],
      ["kaggle-viz","Kaggle Learn: Data Visualization","Gráficos com seaborn.","https://www.kaggle.com/learn/data-visualization"],
      ["pandas-ex","Pandas Exercises (guipsamora)","Exercícios práticos de pandas com bases reais.","https://github.com/guipsamora/pandas_exercises"],
      ["pandas100","100 Pandas Puzzles","Cem desafios curtos para fixar o pandas.","https://github.com/ajcr/100-pandas-puzzles"],
      ["hackerrank-py","HackerRank: trilha de Python","Lógica e estruturas de dados com correção automática.","https://www.hackerrank.com/domains/python"],
      ["exercism","Exercism: trilha de Python","Exercícios com mentoria gratuita.","https://exercism.org/tracks/python"],
      ["kaggle-ml","Kaggle Learn: Intro to Machine Learning","O primeiro passo depois da análise.","https://www.kaggle.com/learn/intro-to-machine-learning"]]}];
  function feitos(){return PESSOAL.exercicios||{}}
  function wEstudos(){
    var p=wCard("Estudos de dados","livro","#B5641B",["#estudos","lista completa"],"w5"),f=feitos();
    TRILHAS.forEach(function(t){
      var n=t.itens.filter(function(i){return f[i[0]]}).length,prox=t.itens.filter(function(i){return !f[i[0]]})[0];
      p.appendChild(h("div",{class:"trilha"},h("div",{class:"top"},h("span",{text:t.n}),h("span",{class:"sub",text:n+" de "+t.itens.length})),
        h("div",{class:"bar"},h("i",{style:"width:"+Math.round(n/t.itens.length*100)+"%;background:"+t.c})),
        prox?h("span",{class:"sub"},"Próximo: ",ext(prox[3],prox[1])):h("span",{class:"sub",text:"Trilha concluída 🎉"})))});
    return p}
  function renderEstudos(){
    var root=$("#estudos-view");root.innerHTML="";var f=feitos();
    $("#cnt-estudos").textContent=Object.keys(f).length;
    root.appendChild(h("p",{class:"sub",style:"color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.5);margin:0",text:"Marque o que já terminou. O progresso fica guardado na sua conta e aparece na tela inicial."}));
    TRILHAS.forEach(function(t){
      var n=t.itens.filter(function(i){return f[i[0]]}).length,p=panel(t.n,n+" de "+t.itens.length+" concluídos");
      var l=h("div",{class:"exl"});
      t.itens.forEach(function(i){var cb=h("input",{type:"checkbox"});cb.checked=!!f[i[0]];
        cb.onchange=function(){var o=Object.assign({},feitos());if(cb.checked)o[i[0]]=new Date().toISOString().slice(0,10);else delete o[i[0]];pessoalGravar("exercicios",o);renderEstudos()};
        l.appendChild(h("label",{class:cb.checked?"done":null},cb,h("span",{class:"grow"},h("b",{text:i[1]}),h("span",{class:"sub",style:"display:block",text:i[2]})),ext(i[3],"Abrir","ghostbtn")))});
      p.appendChild(l);root.appendChild(p)})}

  entrar();
  /* App instalável (ícone RAC na tela inicial). O service worker busca sempre a versão nova na rede. */
  if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost")){
    navigator.serviceWorker.register("sw.js").catch(function(){})}
