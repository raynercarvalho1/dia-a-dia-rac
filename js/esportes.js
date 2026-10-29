/* Dia a Dia RAC — módulo carregado quando a seção abre. Esportes: beisebol (API da MLB), basquete e futebol americano (ESPN), redes dos jogadores e onde assistir.
   Usa as funções do núcleo (js/app.js), que ficam no escopo global. */
  /* ===== Redes sociais dos jogadores (Wikidata: Instagram P2003, X P2002) ===== */
  var SOCP={mlb:"P3541",nba:"P3685",nfl:"P3686"},SOCLS="rac-redes-v1";
  var socCache=(function(){try{return JSON.parse(localStorage.getItem(SOCLS)||"{}")}catch(e){return {}}})();
  var socWait=[],socQ={mlb:{},nba:{},nfl:{}},socTimer=null;
  var IG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
  var XI='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  var YT='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8z"/><path fill="#fff" d="M9.7 15.1V8.9l5.8 3.1z"/></svg>';
  var PLAY='<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>';
  function fillSoc(s,c){
    s.innerHTML="";if(!c)return;
    var n=s.dataset.name||"jogador";
    if(c.ig){var a=h("a",{href:"https://www.instagram.com/"+encodeURIComponent(c.ig)+"/",target:"_blank",rel:"noopener",title:"Instagram de "+n,"aria-label":"Instagram de "+n});a.innerHTML=IG;s.appendChild(a)}
    if(c.x){var b=h("a",{href:"https://x.com/"+encodeURIComponent(c.x),target:"_blank",rel:"noopener",title:"X (Twitter) de "+n,"aria-label":"X de "+n});b.innerHTML=XI;s.appendChild(b)}}
  function soc(kind,id,name){
    var k=kind+":"+id,s=h("span",{class:"soc"});s.dataset.k=k;if(name)s.dataset.name=name;
    if(Object.prototype.hasOwnProperty.call(socCache,k))fillSoc(s,socCache[k]);
    else{socWait.push(s);socQ[kind][id]=1;if(!socTimer)socTimer=setTimeout(socFlush,60)}
    return s}
  function socFlush(){
    socTimer=null;
    Object.keys(socQ).forEach(function(kind){
      var ids=Object.keys(socQ[kind]);socQ[kind]={};
      for(var i=0;i<ids.length;i+=80)socFetch(kind,ids.slice(i,i+80))})}
  function socFetch(kind,ids){
    if(!ids.length)return;
    var q='SELECT ?id ?ig ?x WHERE { VALUES ?id {'+ids.map(function(x){return '"'+String(x).replace(/\D/g,"")+'"'}).join(" ")+'} ?p wdt:'+SOCP[kind]+' ?id . OPTIONAL{?p wdt:P2003 ?ig} OPTIONAL{?p wdt:P2002 ?x} }';
    getJson("https://query.wikidata.org/sparql?format=json&query="+encodeURIComponent(q)).then(function(d){
      ids.forEach(function(id){socCache[kind+":"+id]=null});
      (d.results.bindings||[]).forEach(function(b){
        var k=kind+":"+b.id.value,c=socCache[k]||{};
        if(b.ig&&!c.ig)c.ig=b.ig.value;if(b.x&&!c.x)c.x=b.x.value;
        socCache[k]=(c.ig||c.x)?c:null});
      try{localStorage.setItem(SOCLS,JSON.stringify(socCache))}catch(e){}
      socWait=socWait.filter(function(s){
        if(!Object.prototype.hasOwnProperty.call(socCache,s.dataset.k))return true;
        fillSoc(s,socCache[s.dataset.k]);return false})
    }).catch(function(){})}
  function hydrateSoc(root){root.querySelectorAll("[data-soc]").forEach(function(el){
    var p=el.getAttribute("data-soc").split(":");el.replaceWith(soc(p[0],p[1]))})}
  function jogadorUrl(kind,id){return kind==="mlb"?"https://www.mlb.com/player/"+id:/^(nba|nfl)$/.test(kind)?"https://www.espn.com.br/"+kind+"/jogador/_/id/"+id:""}
  function pcell(src,name,kind,id,extra){var u=id&&jogadorUrl(kind,id);
    return h("span",{class:"pc"},img(src,"ph"),u?h("a",{class:"pn",href:u,target:"_blank",rel:"noopener",title:"Página de "+name,text:name}):h("span",{class:"pn",text:name}),extra?h("span",{class:"sub",text:extra}):null,id?soc(kind,id,name):null)}

  /* ===== Onde assistir no Brasil ===== */
  var DISNEY="https://www.disneyplus.com/pt-br";
  var WATCH={
    mlb:function(g){return [["MLB.TV","https://www.mlb.com/tv/g"+g.id],["Disney+ (ESPN)",DISNEY]]},
    nba:function(){return [["League Pass","https://www.nba.com/watch/league-pass-stream"],["Disney+ (ESPN)",DISNEY],["Prime Video","https://www.primevideo.com/"]]},
    nfl:function(g){var l=[["Game Pass (DAZN)","https://www.dazn.com/pt-BR/home"],["Disney+ (ESPN)",DISNEY],["ge tv","https://ge.globo.com/ge-tv/"]];
      if((g.tv||[]).some(function(x){return /netflix/i.test(x)}))l.unshift(["Netflix","https://www.netflix.com/"]);return l}};
  var WATCHNOTE="Os botões abrem os serviços que transmitem a liga no Brasil. Confira no app qual deles tem cada jogo.";
  function ytUrl(g){
    var q=g.away.name+" vs "+g.home.name+" "+(g.ytLabel||dateEn(new Date(g.date)))+" highlights";
    return "https://www.youtube.com/results?search_query="+encodeURIComponent(q)}

  /* ===== Imagens dos jogos: foto dos melhores momentos (MLB e ESPN) =====
     Jogo normalizado: {sport,id,date,tbd,state:"pre"|"live"|"post",away,home,label,venue,detail,tv,venueImg}
     Time: {id,name,logo,score,winner,href,color} */
  function media(g){
    return once("m-"+g.sport+g.id,function(){
      if(g.sport==="mlb")return mlbContent(g.id).then(function(c){
        var v=mlbVideos(c),rc=c&&c.editorial&&c.editorial.recap&&c.editorial.recap.mlb;
        return {img:v[0]&&v[0].poster,dur:v[0]&&v[0].dur,vids:v,headline:rc&&rc.headline}});
      return espnSummary(g.sport,g.id).then(function(s){
        var v=espnVideos(s),vimg=s.gameInfo&&s.gameInfo.venue&&s.gameInfo.venue.images&&s.gameInfo.venue.images[0];
        return {img:(v[0]&&v[0].poster)||null,dur:v[0]&&v[0].dur,vids:v,headline:s.article&&s.article.headline,venueImg:vimg&&vimg.href}})})}
  function vsBox(g){
    return h("div",{class:"vs"},img(g.away.logo,"lg"),h("span",{text:"x"}),img(g.home.logo,"lg"))}
  function splitStyle(g){return "--ca:"+(g.away.color||"#2B3A33")+";--cb:"+(g.home.color||"#1B2420")}
  /* Topo de card: cores dos dois times + escudos; troca pela foto quando ela chega */
  function thumb(g){
    var t=h("div",{class:"thumb",style:splitStyle(g)},h("div",{class:"split"}),vsBox(g));
    if(g.label)t.appendChild(h("span",{class:"chipl",text:g.label}));
    function put(src,cls,after){
      var i=h("img",{class:"cover",src:src,alt:"",loading:"lazy"});
      i.onload=function(){t.classList.add(cls);if(after)after()};
      i.onerror=function(){i.remove()};
      t.insertBefore(i,t.querySelector(".vs"));
      t.insertBefore(h("div",{class:"shade"}),t.querySelector(".vs"))}
    if(g.state==="post")media(g).then(function(m){
      if(!m.img)return;
      put(m.img,"photo",function(){
        t.appendChild(h("span",{class:"play"},h("i",null,svg(PLAY)),"Melhores momentos"+(m.dur?" · "+m.dur:"")))})}).catch(function(){});
    else if(g.venueImg)put(g.venueImg,"venue");
    else if(g.sport!=="mlb")espnSummary(g.sport,g.id).then(function(s){
      /* a agenda da ESPN não traz a foto do estádio nem as cores; o resumo do jogo traz */
      var c=s.header.competitions[0];
      (c.competitors||[]).forEach(function(x){if(x.team.color)t.style.setProperty(x.homeAway==="away"?"--ca":"--cb","#"+x.team.color)});
      var vi=s.gameInfo&&s.gameInfo.venue&&s.gameInfo.venue.images;
      if(vi&&vi[0])put(vi[0].href,"venue")}).catch(function(){});
    return t}

  function resultCard(g){
    var live=g.state==="live";
    function line(t,o){var lose=g.state==="post"&&!t.winner&&o.winner;
      return h("div",{class:"bl"+(lose?" lose":"")},img(t.logo,"lg"),h("span",{class:"nm",text:t.name}),h("span",{class:"pt",text:dash(t.score)}))}
    return h("a",{class:"card",href:g.detail,title:"Como foi o jogo"},
      thumb(g),
      h("div",{class:"board"},line(g.away,g.home),line(g.home,g.away)),
      h("div",{class:"cfoot"},h("span",{class:"st"+(live?" live":""),text:live?"Ao vivo":"Final"}),h("span",{text:dayShort(new Date(g.date))}),g.venue&&g.venue.name?h("span",{text:venueText(g.venue)}):null))}
  function upcomingCard(g){
    var d=new Date(g.date);
    function nm(t){return t.href?h("a",{href:t.href,text:t.name}):h("span",{text:t.name})}
    var w=h("div",{class:"watch"},h("span",{text:"Assistir"}));
    WATCH[g.sport](g).forEach(function(x){w.appendChild(ext(x[1],x[0],""))});
    return h("div",{class:"card"},
      thumb(g),
      h("div",{class:"when2",text:dayTitle(d)+(g.tbd?" · horário a definir":" · "+hm(d))}),
      h("div",{class:"match"},nm(g.away),h("span",{class:"x",text:" x "}),nm(g.home)),
      g.venue&&g.venue.name?h("div",{class:"cvenue",text:venueText(g.venue)}):null,
      w)}
  function cards(games,newestFirst){
    var list=newestFirst?games.slice().reverse():games;
    return h("div",{class:"cards"},list.map(function(g){return g.state==="pre"?upcomingCard(g):resultCard(g)}))}
  /* Destaque: o jogo mais recente com foto grande dos melhores momentos */
  function hero(g){
    var a=h("a",{class:"hero",href:g.detail,style:splitStyle(g)},h("div",{class:"thumb",style:"position:absolute;inset:0;aspect-ratio:auto;"+splitStyle(g)},h("div",{class:"split"}),vsBox(g)),h("div",{class:"shade"}));
    var aw=g.away,hm_=g.home,post=g.state==="post";
    var hl=h("p",{class:"hl"});
    a.appendChild(h("div",{class:"ov"},
      h("div",{class:"hchips"},g.label?h("span",{class:"chipl",text:g.label}):null,h("span",{class:"chipl hdate",text:dayTitle(new Date(g.date))})),
      h("div",{class:"hs"},img(aw.logo,"lg"),h("span",{class:post&&!aw.winner?"lo":"",text:aw.name.split(" ").pop()+" "+dash(aw.score)}),h("span",{class:"lo",text:"x"}),h("span",{class:post&&!hm_.winner?"lo":"",text:dash(hm_.score)+" "+hm_.name.split(" ").pop()}),img(hm_.logo,"lg")),
      hl,
      h("span",{class:"cta"},h("i",null,svg(PLAY)),"Ver melhores momentos")));
    media(g).then(function(m){
      if(m.headline)hl.textContent=m.headline;
      var th=a.querySelector(".thumb");
      if(m.img){var i=h("img",{class:"cover",src:m.img,alt:""});i.onload=function(){th.classList.add("photo")};th.appendChild(i)}
      else if(m.venueImg){var j=h("img",{class:"cover",src:m.venueImg,alt:""});th.appendChild(j)}
    }).catch(function(){});
    return a}
  /* Faixa na cor do time, com escudo grande de marca d'água */
  function banner(o){
    var b=h("div",{class:"banner",style:"--tc:"+(o.color||"#2B3A33")},
      img(o.logo,"wm"),img(o.logo,"lg huge"),
      h("div",{class:"bt"},h("h2",{text:o.name}),o.meta?h("div",{class:"meta"},o.meta):null),
      o.links&&o.links.length?h("div",{class:"blinks"},o.links.map(function(l){return /^#/.test(l[1])?h("a",{href:l[1],text:l[0]}):ext(l[1],l[0],"")})):null);
    return b}

  /* ===== Beisebol: dados ao vivo da API oficial da MLB ===== */
  var API="https://statsapi.mlb.com/api/v1",SEASON=2026;
  var DODGERS=119,BREWERS=158,OHTANI=660271;
  var MLBC={108:"#BA0021",109:"#A71930",110:"#DF4601",111:"#BD3039",112:"#0E3386",113:"#C6011F",114:"#00385D",115:"#333366",116:"#0C2340",117:"#002D62",118:"#004687",119:"#005A9C",120:"#AB0003",121:"#002D72",133:"#003831",134:"#27251F",135:"#2F241D",136:"#0C2C56",137:"#FD5A1E",138:"#C41E3A",139:"#092C5C",140:"#003278",141:"#134A8E",142:"#002B5C",143:"#E81828",144:"#CE1141",145:"#27251F",146:"#00A3E0",147:"#0C2340",158:"#12284B"};
  function api(u){return getJson(API+u)}
  function logoUrl(id){return "https://www.mlbstatic.com/team-logos/"+id+".svg"}
  function headUrl(id){return "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_96,q_auto:best/v1/people/"+id+"/headshot/67/current"}
  function logoImg(id,cls){return img(logoUrl(id),"lg "+(cls||""))}
  function photo(id){return img(headUrl(id),"ph")}
  function mlbCell(id,name,extra){return pcell(headUrl(id),name,"mlb",id,extra)}
  function mlbContent(pk){return once("mc"+pk,function(){return api("/game/"+pk+"/content")})}
  function mlbVideos(c){
    var items=(((c||{}).highlights||{}).highlights||{}).items||[],out=[];
    items.forEach(function(it){
      var pb=(it.playbacks||[]).filter(function(p){return p.name==="mp4Avc"||/\.mp4$/.test(p.url)})[0];
      if(!pb)return;
      var cuts=(it.image&&it.image.cuts)||[],cut=cuts.filter(function(x){return x.width===960})[0]||cuts.filter(function(x){return x.width>=640&&x.width<=1280})[0]||cuts[0];
      out.push({title:it.headline||it.title,src:pb.url,poster:cut&&cut.src,dur:fmtDur(it.duration)})});
    /* o resumo do jogo ("Game Highlights") vem primeiro */
    out.sort(function(a,b){return (/highlights$/i.test(b.title)?1:0)-(/highlights$/i.test(a.title)?1:0)});
    return out}
  function mlbSlug(t){
    var n=(t.teamName||"").toLowerCase();
    if(n==="diamondbacks"||n==="d-backs")return "dbacks";
    return n.replace(/[^a-z]/g,"")}
  function getTeams(){
    return once("teams",function(){return api("/teams?sportId=1&season="+SEASON).then(function(d){
      return d.teams.filter(function(t){return t.active!==false}).map(function(t){
        return {id:t.id,name:t.name,teamName:t.teamName,abbr:t.abbreviation,
          division:(t.division&&t.division.name)||"",league:(t.league&&t.league.name)||""}})})})}
  function statOf(person,group){
    var s=(person.stats||[]).filter(function(x){return x.group&&x.group.displayName===group})[0];
    return s&&s.splits&&s.splits[0]?s.splits[0].stat:null}

  var SERIES={"Regular Season":"Temporada regular","Wild Card Series":"Wild Card","Wild Card Game":"Wild Card","Division Series":"Série Divisional","League Championship Series":"Final da Liga","World Series":"Série Mundial","Spring Training":"Treino de primavera",
    "AL Wild Card Series":"Wild Card da Liga Americana","NL Wild Card Series":"Wild Card da Liga Nacional","AL Division Series":"Série Divisional da Liga Americana","NL Division Series":"Série Divisional da Liga Nacional",
    "AL Championship Series":"Final da Liga Americana","NL Championship Series":"Final da Liga Nacional"};
  function serie(x){return SERIES[x]||x||""}
  /* Normaliza um jogo da agenda da MLB (pedir com hydrate=venue(location)) */
  function mlbGame(g){
    var st=g.status.abstractGameState,a=g.teams.away,hm_=g.teams.home,post=/^[FDLW]$/.test(g.gameType);
    var loc=(g.venue&&g.venue.location)||{};
    function tm(x){return {id:x.team.id,name:x.team.name,logo:logoUrl(x.team.id),score:x.score,winner:x.isWinner,href:"#esportes/beisebol/time-"+x.team.id,color:MLBC[x.team.id]}}
    var n=post&&g.seriesGameNumber?g.seriesGameNumber:null;
    return {sport:"mlb",id:g.gamePk,date:g.gameDate,tbd:!!g.status.startTimeTBD,
      state:st==="Final"?"post":st==="Live"?"live":"pre",away:tm(a),home:tm(hm_),
      label:g.gameType!=="R"?serie(g.seriesDescription)+(n?" · Jogo "+n:""):"",
      ytLabel:n?g.seriesDescription+" Game "+n:"",
      venue:{name:g.venue&&g.venue.name,city:loc.city,state:loc.state||loc.stateAbbrev,country:loc.country},
      detail:"#esportes/beisebol/jogo-"+g.gamePk,raw:g}}
  function mlbSched(q){
    return api("/schedule?sportId=1&hydrate=venue(location)&"+q).then(function(d){
      var out=[];
      (d.dates||[]).forEach(function(x){x.games.forEach(function(g){
        var c=g.status.codedGameState;if(c==="D"||c==="C"||g.status.detailedState==="Postponed")return;
        out.push(mlbGame(g))})});
      out.sort(function(a,b){return a.date.localeCompare(b.date)});return out})}

  /* Nomes de times da MLB no meio de um texto ganham o escudo na frente */
  var POS_PT={RHP:"arremessador destro",LHP:"arremessador canhoto","1B":"primeira base","2B":"segunda base","3B":"terceira base",SS:"interbases",LF:"campista esquerdo",CF:"campista central",RF:"campista direito",OF:"campista",IF:"jogador de linha (infield)",INF:"jogador de linha (infield)",DH:"rebatedor designado",C:"receptor",P:"arremessador"};
  function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
  function teamNodes(text,teams,pessoa){
    var by={},alt=[];(teams||[]).forEach(function(t){by[t.name]=t.id;alt.push(esc(t.name))});
    if(pessoa&&pessoa.fullName)alt.push(esc(pessoa.fullName));
    alt.sort(function(a,b){return b.length-a.length});
    var re=new RegExp("("+alt.concat(["\\b(?:RHP|LHP|1B|2B|3B|SS|LF|CF|RF|OF|INF|IF|DH)\\b"]).join("|")+")");
    return text.split(re).filter(function(p){return p!==""&&p!=null}).map(function(p){
      if(by[p])return h("a",{class:"tn",href:"#esportes/beisebol/time-"+by[p],title:"Página do "+p},logoImg(by[p],"sm"),p);
      if(pessoa&&p===pessoa.fullName)return h("a",{class:"link",href:"https://www.mlb.com/player/"+pessoa.id,target:"_blank",rel:"noopener",text:p});
      if(POS_PT[p])return h("abbr",{title:POS_PT[p]},p);
      return p})}

  var HIT=["Jogador","Pos","AVG","HR","RBI","OPS"],PIT=["Jogador","Fun","ERA","V-D","K","WHIP"];
  function hitRow(p,pos){var s=statOf(p,"hitting")||{};
    return [mlbCell(p.id,p.fullName),pos||"",dash(s.avg),dash(s.homeRuns),dash(s.rbi),dash(s.ops)]}
  function pitRow(p,role){var s=statOf(p,"pitching")||{};
    return [mlbCell(p.id,p.fullName),role||"",dash(s.era),dash(s.wins)+"-"+dash(s.losses),dash(s.strikeOuts),dash(s.whip)]}

  /* ---- Tradução das movimentações (posições como 3B, LHP, RHP ficam em inglês) ---- */
  var P="(?:RHP|LHP|1B|2B|3B|SS|LF|CF|RF|OF|IF|INF|DH|C|P)";
  var MES={January:"janeiro",February:"fevereiro",March:"março",April:"abril",May:"maio",June:"junho",July:"julho",August:"agosto",September:"setembro",October:"outubro",November:"novembro",December:"dezembro"};
  var NUM={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  var LISTA={"restricted":"lista de restritos","bereavement":"lista de luto","paternity":"lista de paternidade","suspended":"lista de suspensos","family medical emergency":"lista de emergência médica familiar","paternity leave":"lista de paternidade"};
  var RULES=[
    [new RegExp("^("+P+") (.+?) elected free agency"),"o $1 $2 virou agente livre"],
    [new RegExp("\\bdeclined the (\\d{4}) (club|mutual|player) option on ("+P+") (.+)"),function(m,a,b,c,d){return "recusou a opção de "+a+" ("+({club:"do clube",mutual:"mútua",player:"do jogador"})[b]+") do "+c+" "+d}],
    [new RegExp("\\bexercised the (\\d{4}) (club|mutual|player) option on ("+P+") (.+)"),function(m,a,b,c,d){return "exerceu a opção de "+a+" ("+({club:"do clube",mutual:"mútua",player:"do jogador"})[b]+") do "+c+" "+d}],
    [new RegExp("^("+P+") (.+?) (?:exercised|picked up) (?:his|the) (\\d{4}) player option"),"o $1 $2 exerceu a opção de $3 (do jogador)"],
    [new RegExp("^("+P+") (.+?) declined (?:his|the) (\\d{4}) player option"),"o $1 $2 recusou a opção de $3 (do jogador)"],
    [new RegExp("^("+P+") (.+?) retired"),"o $1 $2 se aposentou"],
    [new RegExp("\\bplaced ("+P+") (.+?) on the (\\d+)-day (?:injured list|IL)"),"colocou o $1 $2 na lista de lesionados de $3 dias"],
    [new RegExp("\\bactivated ("+P+") (.+?) from the (\\d+)-day (?:injured list|IL)"),"ativou o $1 $2 da lista de lesionados de $3 dias"],
    [new RegExp("\\btransferred ("+P+") (.+?) from the (\\d+)-day (?:injured list|IL) to the (\\d+)-day (?:injured list|IL)"),"transferiu o $1 $2 da lista de lesionados de $3 dias para a de $4 dias"],
    [new RegExp("\\bplaced ("+P+") (.+?) on the (restricted|bereavement|paternity|suspended|family medical emergency) list"),function(m,a,b,c){return "colocou o "+a+" "+b+" na "+(LISTA[c]||c)}],
    [new RegExp("\\breinstated ("+P+") (.+?) from the (restricted|bereavement|paternity|suspended|family medical emergency) list"),function(m,a,b,c){return "reativou o "+a+" "+b+" da "+(LISTA[c]||c)}],
    [new RegExp("\\bactivated ("+P+") (.+)"),"ativou o $1 $2"],
    [new RegExp("^("+P+") (.+?) roster status changed by (.+)"),"$3 mudou o status do $1 $2 no elenco"],
    [new RegExp("\\bdesignated ("+P+") (.+?) for assignment"),"designou o $1 $2 para reavaliação (DFA)"],
    [new RegExp("\\bselected the contract of ("+P+") (.+?) from (.+)"),"promoveu à MLB o $1 $2, vindo de $3"],
    [new RegExp("\\boptioned ("+P+") (.+?) to (.+)"),"enviou o $1 $2 para $3 (option)"],
    [new RegExp("\\brecalled ("+P+") (.+?) from (.+)"),"chamou de volta o $1 $2, de $3"],
    [new RegExp("\\bsent ("+P+") (.+?) outright to (.+)"),"enviou o $1 $2 diretamente para $3"],
    [new RegExp("\\breleased ("+P+") (.+)"),"dispensou o $1 $2"],
    [new RegExp("\\bclaimed ("+P+") (.+?) off waivers from (.+)"),"pegou via waivers o $1 $2, vindo de $3"],
    [new RegExp("\\bclaimed ("+P+") (.+?) off waivers"),"pegou via waivers o $1 $2"],
    [new RegExp("\\btraded ("+P+") (.+?) to (.+?) for (.+)"),"trocou o $1 $2 para $3 por $4"],
    [new RegExp("\\btraded ("+P+") (.+?) to (.+)"),"trocou o $1 $2 para $3"],
    [/\btraded (.+?) to (.+?) for (.+)/,"trocou $1 para $2 por $3"],
    [new RegExp("\\bsigned free agent ("+P+") (.+?) to a minor league contract"),"assinou com o agente livre $1 $2 (contrato de liga menor)"],
    [new RegExp("\\bsigned free agent ("+P+") (.+?) to a (\\w+)-year contract"),function(m,a,b,c){var n=NUM[c]||c;return "assinou com o agente livre "+a+" "+b+" (contrato de "+n+" "+(n==1?"ano":"anos")+")"}],
    [new RegExp("\\bsigned free agent ("+P+") (.+)"),"assinou com o agente livre $1 $2"],
    [new RegExp("\\bre-signed ("+P+") (.+)"),"renovou com o $1 $2"],
    [new RegExp("\\bsigned ("+P+") (.+?) to a (\\w+)-year contract extension"),function(m,a,b,c){var n=NUM[c]||c;return "estendeu o contrato do "+a+" "+b+" por "+n+" "+(n==1?"ano":"anos")}],
    [new RegExp("\\bsigned ("+P+") (.+)"),"assinou com o $1 $2"],
    [new RegExp("\\bagreed to terms with ("+P+") (.+)"),"fechou acordo com o $1 $2"],
    [new RegExp("\\bacquired ("+P+") (.+?) from (.+)"),"adquiriu o $1 $2, vindo de $3"],
    [new RegExp("\\bdeclined (?:the )?(?:club |team )?option (?:on|of) ("+P+") (.+)"),"recusou a opção do clube sobre o $1 $2"],
    [new RegExp("\\bexercised (?:the )?(?:club |team )?option (?:on|of) ("+P+") (.+)"),"exerceu a opção do clube sobre o $1 $2"],
    [new RegExp("\\b("+P+") (.+?) retired"),"o $1 $2 se aposentou"],
    [/\bannounced (?:his )?retirement/,"anunciou a aposentadoria"],
    [/\bsuspended\b/,"suspendeu"]
  ];
  var PARTS={elbow:["cotovelo","no",0],shoulder:["ombro","no",0],knee:["joelho","no",0],ankle:["tornozelo","no",0],wrist:["pulso","no",0],hamstring:["posterior da coxa","no",1],oblique:["oblíquo","no",0],back:["costas","nas",1],hip:["quadril","no",0],groin:["virilha","na",1],calf:["panturrilha","na",1],forearm:["antebraço","no",0],finger:["dedo","no",0],thumb:["polegar","no",0],hand:["mão","na",1],foot:["pé","no",0],quadriceps:["quadríceps","no",0],quad:["quadríceps","no",0],neck:["pescoço","no",0],rib:["costela","na",1],ribs:["costelas","nas",1],toe:["dedo do pé","no",0],hamstrings:["posterior da coxa","no",1],lat:["grande dorsal","no",0],glute:["glúteo","no",0],shin:["canela","na",1],heel:["calcanhar","no",0],bicep:["bíceps","no",0],biceps:["bíceps","no",0],triceps:["tríceps","no",0],thigh:["coxa","na",1],abdominal:["abdômen","no",0],"abdomen":["abdômen","no",0],knuckle:["nó do dedo","no",0],eye:["olho","no",0],head:["cabeça","na",1],lumbar:["lombar","na",1]};
  var COND={strain:"Distensão",sprain:"Entorse",inflammation:"Inflamação",fracture:"Fratura",fractured:"Fratura",soreness:"Dor",tightness:"Rigidez",tear:"Rompimento",torn:"Rompimento",contusion:"Contusão",surgery:"Cirurgia",tendinitis:"Tendinite",discomfort:"Desconforto",fatigue:"Fadiga",impingement:"Impacto",bruise:"Hematoma",spasms:"Espasmos",spasm:"Espasmo",irritation:"Irritação",tendonitis:"Tendinite"};
  function injuryPt(sent){
    var t=sent.replace(/\.$/,"").toLowerCase().split(/\s+/);
    var side="",part=null,cond=null;
    t.forEach(function(w){if(w==="right"||w==="left")side=w;else if(PARTS[w])part=PARTS[w];else if(COND[w])cond=COND[w]});
    if(part&&cond){
      var lado=side?(side==="right"?(part[2]?"direita":"direito"):(part[2]?"esquerda":"esquerdo")):"";
      return cond+" "+part[1]+" "+part[0]+(lado?" "+lado:"")}
    if(/tommy john/i.test(sent))return "Cirurgia Tommy John";
    if(/concussion/i.test(sent))return "Concussão";
    if(/illness|sick/i.test(sent))return "Doença";
    return sent.replace(/\.$/,"")}
  function ptTx(desc){
    if(!desc)return "";
    var parts=desc.split(/(?<![A-Z])\.\s+(?=[A-Z])/),first=parts[0].replace(/\.$/,""),rest=parts.slice(1);
    var out=first,done=false;
    for(var i=0;i<RULES.length&&!done;i++){
      if(RULES[i][0].test(out)){out=out.replace(RULES[i][0],RULES[i][1]);done=true}}
    out=out.replace(/\bretroactive to (\w+) (\d+)(?:, (\d{4}))?/,function(m,mo,d){return "retroativo a "+d+" de "+(MES[mo]||mo)})
           .replace(/\bretroactive to /,"retroativo a ");
    out=out.replace(/\band cash considerations\b/,"e contrapartida financeira").replace(/\band cash\b/,"e dinheiro").replace(/\bcash considerations\b/,"contrapartida financeira").replace(/\bplayer to be named later\b/,"jogador a ser definido");
    var tail=rest.map(injuryPt).join(". ");
    return out+(tail?". "+tail:"")+"."}
  var MINOR=/minor league|outright|Triple-A|Double-A|Single-A|High-A|Low-A|Complex|Dominican|optioned|assigned|Charlotte Knights|Storm Chasers|Salt Lake|Sugar Land|Las Vegas Aviators|Sacramento River Cats/i;
  function txKind(t){var d=t.description||"";
    if(/traded|acquired/i.test(d)||t.typeCode==="TR")return "troca";
    if(/signed|re-signed|agreed|extension|contract/i.test(d)&&!/minor league contract/i.test(d))return "contrato";
    return "outras"}
  function txPanel(title,path,opts){
    var p=panel(title,opts&&opts.sub),state={kind:"todas",minor:false,all:[],teams:[]};
    var chips=h("div",{class:"chips"}),list=h("div",{class:"txlist"}),body=h("div",null,loading());
    p.appendChild(body);
    function draw(){
      list.innerHTML="";
      var rows=state.all.filter(function(t){
        if(!state.minor&&MINOR.test(t.description||""))return false;
        return state.kind==="todas"||txKind(t)===state.kind});
      if(!rows.length){list.appendChild(h("p",{class:"empty",text:"Nada nesse filtro nos últimos dias."}));return}
      var fonte=(opts&&opts.fonte)||"https://www.mlb.com/transactions";
      rows.slice(0,60).forEach(function(t){
        list.appendChild(h("div",{class:"tx"},
          h("a",{class:"when",href:fonte,target:"_blank",rel:"noopener",title:"Ver na lista oficial da MLB",text:(t.date||"").slice(8,10)+"/"+(t.date||"").slice(5,7)}),
          t.person?mlbCell(t.person.id,t.person.fullName):h("span"),
          h("span",{class:"txd",title:t.description||""},teamNodes(ptTx(t.description||""),state.teams,t.person),
            " ",h("a",{class:"txsrc",href:fonte,target:"_blank",rel:"noopener",title:"Original: "+(t.description||""),text:"fonte ↗"}))))})}
    function load(){
      body.innerHTML="";body.appendChild(loading());chips.innerHTML="";
      Promise.all([api(path),getTeams().catch(function(){return []})]).then(function(r){
        var d=r[0];state.teams=r[1];
        state.all=(d.transactions||[]).slice().sort(function(a,b){return (b.date||"").localeCompare(a.date||"")});
        body.innerHTML="";
        [["todas","Todas"],["troca","Trocas"],["contrato","Contratos"],["outras","Outras"]].forEach(function(k){
          var b=h("button",{type:"button",class:"chipb"+(k[0]===state.kind?" on":""),text:k[1]});
          b.onclick=function(){state.kind=k[0];chips.querySelectorAll("button.chipb").forEach(function(x){x.classList.remove("on")});b.classList.add("on");draw()};
          chips.appendChild(b)});
        var lab=h("label",{class:"chk"},h("input",{type:"checkbox"}),"incluir ligas menores");
        lab.querySelector("input").onchange=function(e){state.minor=e.target.checked;draw()};
        chips.appendChild(lab);
        body.appendChild(chips);body.appendChild(list);
        body.appendChild(h("p",{class:"note",text:"Textos traduzidos automaticamente. Passe o mouse sobre uma linha para ver o original em inglês."}));
        draw()
      }).catch(function(e){body.innerHTML="";body.appendChild(failed(load,e))})}
    load();return p}

  /* mercado de inverno dos Dodgers: direto das transações oficiais da MLB (contratações, trocas, dispensas), sem curadoria manual */
  function mercadoDodgers(){var hj=new Date();return txPanel("Mercado de inverno","/transactions?teamId="+DODGERS+"&startDate="+ymd(addDays(hj,-60))+"&endDate="+ymd(hj),{sub:"Contratações, trocas e dispensas dos últimos 60 dias, direto da MLB. Atualiza sozinho. Toque no jogador, no time ou em \"fonte\" para abrir a página de cada um.",fonte:"https://www.mlb.com/dodgers/roster/transactions"})}
  /* rumores do MLB Trade Rumors (rumores.json, coletado pelo robô a cada 3 horas): dos Dodgers ou da liga */
  function rumoresMlb(qual,n){
    var p=panel(qual==="dodgers"?"Rumores dos Dodgers":"Rumores da liga","Do MLB Trade Rumors, em inglês; toque na manchete para ler a matéria. Atualiza a cada 3 horas."),box=h("div",null,loading());p.appendChild(box);
    getJson("rumores.json?v="+Math.floor(Date.now()/36e5)).then(function(d){box.innerHTML="";var l=(d[qual]||[]).slice(0,n||10);
      if(!l.length){box.appendChild(h("p",{class:"empty",text:"Nenhum rumor nas últimas semanas."}));return}
      box.appendChild(h("ul",{class:"wl rumores"},l.map(function(r){var dt=new Date(r.data);
        return h("li",null,h("span",{class:"grow"},h("a",{class:"link",href:r.link,target:"_blank",rel:"noopener",text:r.t}),
          h("span",{class:"sub",text:dt.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+" · "+r.resumo}),
          r.tags&&r.tags.length?h("span",{class:"rtags"},r.tags.filter(function(t){return !/^(Notes|Newsstand|Transactions)$/i.test(t)}).slice(0,4).map(function(t){return h("span",{class:"vp",text:t})})):null))})));
      box.appendChild(h("p",{class:"note"},"Coletado "+new Date(d.coletado).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+" · ",ext(qual==="dodgers"?"https://www.mlbtraderumors.com/los-angeles-dodgers":"https://www.mlbtraderumors.com/","Ver tudo no MLB Trade Rumors")))
    }).catch(function(){box.innerHTML="";box.appendChild(h("p",{class:"empty"},"Os rumores ainda não foram coletados. ",ext("https://www.mlbtraderumors.com/","Abrir o MLB Trade Rumors")))});
    return p}
  /* prêmios da temporada (saem em novembro) e as datas oficiais da próxima */
  var PREMIOS=[["ALMVP","MVP · Liga Americana"],["NLMVP","MVP · Liga Nacional"],["ALCY","Cy Young · Liga Americana"],["NLCY","Cy Young · Liga Nacional"],["ALROY","Novato do ano · Liga Americana"],["NLROY","Novato do ano · Liga Nacional"]];
  function premiosPanel(){
    var p=panel("Prêmios de "+SEASON,"MVP, Cy Young e Novato do ano. São anunciados em novembro; até lá, aparecem os vencedores do ano passado."),box=h("div",null,loading());p.appendChild(box);
    function ano(s){return Promise.all(PREMIOS.map(function(a){return api("/awards/"+a[0]+"/recipients?season="+s).then(function(d){return (d.awards||[])[0]||null},function(){return null})}))}
    ano(SEASON).then(function(l){return l.some(Boolean)?[SEASON,l]:ano(SEASON-1).then(function(x){return [SEASON-1,x]})}).then(function(r){box.innerHTML="";
      if(r[0]!==SEASON)box.appendChild(h("p",{class:"sub",text:"Os de "+SEASON+" ainda não saíram. Vencedores de "+r[0]+":"}));
      box.appendChild(h("ul",{class:"wl"},PREMIOS.map(function(a,i){var w=r[1][i];return w?h("li",null,h("span",{class:"grow"},h("b",{text:a[1]}),h("span",{class:"sub"},mlbCell(w.player.id,w.player.nameFirstLast))),
        w.team?h("a",{class:"end",href:"#esportes/beisebol/time-"+w.team.id,title:"Página do time"},logoImg(w.team.id,"sm")):null):null}).filter(Boolean)))})
      .catch(function(){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:"Não consegui carregar os prêmios agora."}))});
    return p}
  function datasPanel(){
    var p=panel("Temporada "+(SEASON+1),"Datas oficiais da MLB."),box=h("div",null,loading());p.appendChild(box);
    api("/seasons/"+(SEASON+1)+"?sportId=1").then(function(d){var s=(d.seasons||[])[0]||{};box.innerHTML="";
      function dt(x){return x?new Date(x+"T12:00:00").toLocaleDateString("pt-BR",{day:"numeric",month:"long"}):"—"}
      var hj=hojeISO(),dias=s.regularSeasonStartDate?Math.round((new Date(s.regularSeasonStartDate+"T12:00:00")-new Date(hj+"T12:00:00"))/864e5):null;
      box.appendChild(h("ul",{class:"wl"},[["Spring training (treinos de pré-temporada)",s.springStartDate],["Dia de abertura",s.regularSeasonStartDate],["Jogo das Estrelas",s.allStarDate],["Fim da temporada regular",s.regularSeasonEndDate],["Começo dos playoffs",s.postSeasonStartDate]]
        .map(function(x){return h("li",null,h("span",{class:"grow",text:x[0]}),h("span",{class:"end",text:dt(x[1])}))})));
      if(dias>0)box.appendChild(h("p",{class:"sub",text:"Faltam "+dias+" dias para o dia de abertura."}))}).catch(function(){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:"Datas ainda não divulgadas."}))});
    return p}
  function foraDeTemporada(){var m=new Date().getMonth();return m>=10||m<=1}
  function rumorPanel(){
    var p=panel("Rumores");
    p.appendChild(h("h3",{class:"dayh"},img(logoUrl(DODGERS),"lg sm"),"Dodgers no mercado de inverno"));
    p.appendChild(h("p",null,h("a",{class:"link",href:"#esportes/beisebol/dodgers",text:"Movimentações oficiais dos últimos 60 dias, na página dos Dodgers"})," · ",ext("https://www.mlbtraderumors.com/los-angeles-dodgers","Rumores no MLB Trade Rumors")));
    p.appendChild(h("h3",{class:"dayh",text:"Onde acompanhar a liga toda"}));
    p.appendChild(h("ul",{class:"clean"},
      [["MLB Trade Rumors: tudo sobre trocas e contratos","https://www.mlbtraderumors.com/"],
       ["MLB.com: notícias da liga","https://www.mlb.com/news"]]
      .map(function(r){return h("li",null,ext(r[1],r[0]))})));
    return p}

  /* ---- Tela inicial do beisebol: destaque, resultados, próximos jogos, Dodgers, mudanças e rumores ---- */
  function viewLiga(root){
    var now=new Date();
    var sched=once("liga-"+ymd(now),function(){return mlbSched("startDate="+ymd(addDays(now,-30))+"&endDate="+ymd(addDays(now,10)))});
    function finished(gs){
      var fin=gs.filter(function(g){return g.state!=="pre"}),keys=[];
      fin.forEach(function(g){var k=ymd(new Date(g.date));if(keys.indexOf(k)<0)keys.push(k)});
      var keep=keys.slice(-3);return fin.filter(function(g){return keep.indexOf(ymd(new Date(g.date)))>=0})}
    root.appendChild(section("Destaque",null,function(body){
      return sched.then(function(gs){var fin=finished(gs);body.innerHTML="";
        if(!fin.length){body.appendChild(h("p",{class:"empty",text:"Nenhum jogo nos últimos 30 dias."}));return}
        var top=fin[fin.length-1],more=h("div",{class:"stack",style:"margin-top:16px"},h("div",{class:"panel"},loading()));
        body.appendChild(hero(top));body.appendChild(more);
        mlbFeed(top.id).then(function(feed){more.innerHTML="";
          more.appendChild(mlbLinePanel(top,feed));more.appendChild(mlbBoxPanel(top,feed))
        }).catch(function(){more.innerHTML="";more.appendChild(h("div",{class:"panel"},h("p",{class:"empty",text:"Não consegui carregar o placar deste jogo agora."})))})})}));
    root.appendChild(section("Últimos resultados","Clique no card para ver como foi o jogo",function(body){
      return sched.then(function(gs){var fin=finished(gs).slice(0,-1);body.innerHTML="";
        if(!fin.length){body.appendChild(h("p",{class:"empty",text:"Sem outros jogos recentes."}));return}
        body.appendChild(cards(fin.slice(-6),true))})}));
    root.appendChild(section("Próximos jogos",WATCHNOTE,function(body){
      return sched.then(function(gs){var nx=gs.filter(function(g){return g.state==="pre"});body.innerHTML="";
        if(!nx.length){body.appendChild(h("p",{class:"empty",text:"Sem jogos nos próximos 10 dias. A temporada 2027 começa em março."}));return}
        body.appendChild(cards(nx,false))})}));
    root.appendChild(dodgersSummary());
    /* fora de temporada (novembro a fevereiro), o mercado ganha mais espaço: 30 dias de movimentações, rumores, prêmios e as datas da próxima */
    /* acabou a temporada quando não há jogo agendado nos próximos 10 dias (ou de novembro a fevereiro) */
    var resto=h("div",{class:"stack"});root.appendChild(resto);
    sched.then(function(gs){return !gs.some(function(g){return g.state!=="post"})},function(){return false}).then(function(semJogos){
      var off=foraDeTemporada()||semJogos;
      resto.appendChild(txPanel(off?"Mercado da liga":"Mudanças de jogadores","/transactions?sportId=1&startDate="+ymd(addDays(now,off?-30:-7))+"&endDate="+ymd(now),{sub:off?"Contratos, trocas, opções e agentes livres dos últimos 30 dias, liga toda":"Últimos 7 dias, liga toda"}));
      resto.appendChild(rumoresMlb("liga",off?12:6));
      if(off){resto.appendChild(premiosPanel());resto.appendChild(datasPanel())}
      resto.appendChild(rumorPanel())})}

  function dodgersRecord(){
    return once("std",function(){return api("/standings?leagueId=103,104&season="+SEASON).then(function(d){
      var r=null;(d.records||[]).forEach(function(x){(x.teamRecords||[]).forEach(function(t){if(t.team.id===DODGERS)r=t})});return r})})}
  function dodgersBanner(links){
    var meta=h("div",null,"Temporada encerrada: eliminados na final da Liga Nacional pelo ",h("span",{class:"tn"},logoImg(BREWERS,"sm"),"Milwaukee Brewers"));
    dodgersRecord().then(function(r){if(r)meta.appendChild(h("div",{text:"Campanha "+r.wins+"–"+r.losses+" · "+r.divisionRank+"º na NL Oeste"}))}).catch(function(){});
    return banner({name:"Los Angeles Dodgers",logo:logoUrl(DODGERS),color:MLBC[DODGERS],meta:meta,links:links})}
  function dodgersGames(n){
    return mlbSched("teamId="+DODGERS+"&gameType=R,F,D,L,W&startDate="+ymd(addDays(new Date(),-120))+"&endDate="+ymd(new Date())).then(function(gs){
      return gs.filter(function(g){return g.state==="post"}).slice(-n)})}
  function dodgersSummary(){
    var s=h("div",{class:"blk"},h("h2",{class:"sec",text:"Dodgers"}));
    s.appendChild(dodgersBanner([["Página dos Dodgers","#esportes/beisebol/dodgers"],["@Dodgers no X","https://x.com/Dodgers"]]));
    var row=h("div",{class:"cards",style:"margin-top:16px"});s.appendChild(row);
    var lastBox=h("div",null,loading());row.appendChild(lastBox);
    var oh=h("div",{class:"panel"},h("h2",{text:"Shohei Ohtani em "+SEASON}));row.appendChild(oh);
    var ohb=h("div");oh.appendChild(ohb);ohtaniLine(ohb);
    dodgersGames(1).then(function(fin){lastBox.innerHTML="";
      if(fin.length)lastBox.appendChild(resultCard(fin[0]));else lastBox.appendChild(h("p",{class:"empty",text:"Sem jogos recentes."}))
    }).catch(function(){lastBox.innerHTML="";lastBox.appendChild(h("p",{class:"empty",text:"Não consegui carregar agora."}))});
    return s}
  function ohtaniLine(box){
    box.appendChild(loading());
    api("/people/"+OHTANI+"?hydrate=stats(group=[hitting,pitching],type=season,season="+SEASON+")").then(function(d){
      var pl=d.people[0],hs=statOf(pl,"hitting"),ps=statOf(pl,"pitching");
      box.innerHTML="";
      box.appendChild(h("div",{class:"ohtani"},photo(pl.id),h("div",null,
        h("div",{class:"pc"},h("span",{class:"pn",text:pl.fullName}),soc("mlb",pl.id,pl.fullName)),
        hs?h("div",{class:"statline"},"Rebatendo: AVG "+dash(hs.avg)+" · HR "+dash(hs.homeRuns)+" · RBI "+dash(hs.rbi)+" · OPS "+dash(hs.ops)):null,
        ps?h("div",{class:"statline"},"Arremessando: ERA "+dash(ps.era)+" · "+dash(ps.wins)+"-"+dash(ps.losses)+" · "+dash(ps.strikeOuts)+" K · WHIP "+dash(ps.whip)):null)))
    }).catch(function(){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:"Não consegui carregar as estatísticas agora."}))})}

  /* ---- Times ---- */
  var DIVS=["American League East","American League Central","American League West","National League East","National League Central","National League West"];
  var DIVPT={"American League East":"Liga Americana · Leste","American League Central":"Liga Americana · Central","American League West":"Liga Americana · Oeste","National League East":"Liga Nacional · Leste","National League Central":"Liga Nacional · Central","National League West":"Liga Nacional · Oeste"};
  function viewTimes(root){
    root.appendChild(lazyPanel("Os 30 times","Clique no escudo para ver jogos, time titular, elenco e movimentações.",function(body){
      return getTeams().then(function(teams){
        body.innerHTML="";
        DIVS.forEach(function(dv){
          var ts=teams.filter(function(t){return t.division===dv}).sort(function(a,b){return a.name.localeCompare(b.name)});
          if(!ts.length)return;
          body.appendChild(h("h3",{class:"dayh",text:DIVPT[dv]}));
          body.appendChild(h("div",{class:"teamgrid"},ts.map(function(t){
            return h("a",{class:"tile",href:"#esportes/beisebol/time-"+t.id,title:t.name},logoImg(t.id,"big"),h("span",{text:t.teamName||t.name}))})))})})}))}

  /* ---- Página de um time ---- */
  function viewTeam(root,id){
    var now=new Date();
    root.appendChild(h("p",{style:"margin:0 0 -14px"},h("a",{class:"link",href:"#esportes/beisebol/times",text:"← Todos os times"})));
    var head=h("div",null,h("div",{class:"panel"},loading()));root.appendChild(head);
    getTeams().then(function(teams){
      var t=teams.filter(function(x){return x.id===id})[0];
      head.innerHTML="";
      if(!t){head.appendChild(h("p",{class:"empty",text:"Time não encontrado."}));return}
      var slug=mlbSlug(t);
      head.appendChild(banner({name:t.name,logo:logoUrl(t.id),color:MLBC[t.id],meta:DIVPT[t.division]||t.division,
        links:[["Site oficial","https://www.mlb.com/"+slug],["Notícias","https://www.mlb.com/"+slug+"/news"],["Rumores","https://www.mlbtraderumors.com/?s="+encodeURIComponent(t.teamName)]]}));
      buildTeamBody(root,t,now)
    }).catch(function(e){head.innerHTML="";head.appendChild(failed(function(){route()},e))})}

  function buildTeamBody(root,t,now){
    var id=t.id;
    var lBody=h("div",null,loading()),nBody=h("div",null,loading());
    root.appendChild(h("div",{class:"blk"},h("h2",{class:"sec",text:"Últimos jogos"}),lBody));
    root.appendChild(h("div",{class:"blk"},h("h2",{class:"sec"},"Próximos jogos",h("small",{text:WATCHNOTE})),nBody));
    var sPanel=panel("Time titular","Quem jogou em cada posição no último jogo disputado"),sBody=h("div",null,loading());sPanel.appendChild(sBody);
    var rPanel=panel("Elenco e estatísticas","Temporada "+SEASON),rBody=h("div",null,loading());rPanel.appendChild(rBody);
    root.appendChild(sPanel);
    root.appendChild(txPanel("Rumores e movimentações","/transactions?teamId="+id+"&startDate="+ymd(addDays(now,-30))+"&endDate="+ymd(now),{sub:"Últimos 30 dias, direto da MLB. Para rumores, use o botão “Rumores” na faixa do time."}));
    root.appendChild(rPanel);

    mlbSched("teamId="+id+"&gameType=R,F,D,L,W&startDate="+ymd(addDays(now,-90))+"&endDate="+ymd(addDays(now,30))).then(function(games){
      var fin=games.filter(function(g){return g.state==="post"});
      var next=games.filter(function(g){return g.state!=="post"}).slice(0,6);
      lBody.innerHTML="";nBody.innerHTML="";
      if(fin.length)lBody.appendChild(cards(fin.slice(-3),true));else lBody.appendChild(h("p",{class:"empty",text:"Sem jogos finalizados recentes."}));
      if(!next.length)nBody.appendChild(h("p",{class:"empty",text:"Nenhum jogo agendado. A temporada 2026 acabou para este time; a de 2027 começa em março."}));
      else nBody.appendChild(cards(next,false));
      var last=fin[fin.length-1];
      if(!last){sBody.innerHTML="";sBody.appendChild(h("p",{class:"empty",text:"Sem jogos finalizados em 2026."}));return}
      return api("/game/"+last.id+"/boxscore").then(function(box){
        var side=box.teams.home.team.id===id?"home":"away",ts=box.teams[side];
        var order=ts.battingOrder||[],pit=(ts.pitchers||[])[0];
        var ids=order.concat(pit?[pit]:[]);
        return api("/people?personIds="+ids.join(",")+"&hydrate=stats(group=[hitting,pitching],type=season,season="+SEASON+")").then(function(pp){
          var by={};(pp.people||[]).forEach(function(x){by[x.id]=x});
          var home=last.home.id===id,opp=home?last.away:last.home;
          var when=new Date(last.date).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",timeZone:TZ});
          sBody.innerHTML="";
          sBody.appendChild(h("p",{class:"sub",style:"margin:0 0 8px"},when+(home?" vs ":" @ "),h("span",{class:"tn"},logoImg(opp.id,"sm"),opp.name),last.label?" · "+last.label:"",
            " · ",h("a",{class:"link",href:last.detail,text:"como foi"})));
          var rows=order.map(function(pid,i){
            var pl=by[pid],bp=ts.players["ID"+pid];
            if(!pl)return null;
            var r=hitRow(pl,"");
            return [String(i+1),bp&&bp.position?bp.position.abbreviation:"",r[0],r[2],r[3],r[4],r[5]]}).filter(Boolean);
          sBody.appendChild(table(["#","Pos","Jogador","AVG","HR","RBI","OPS"],rows,3));
          var subs=Object.keys(ts.players).map(function(k){return ts.players[k]}).filter(function(x){return x.battingOrder&&!/00$/.test(x.battingOrder)}).sort(function(a,b){return +a.battingOrder-+b.battingOrder});
          if(subs.length)sBody.appendChild(h("p",{class:"note",text:"Entraram durante o jogo: "+subs.map(function(x){return x.person.fullName+" ("+(x.position?x.position.abbreviation:"")+")"}).join(", ")+"."}));
          if(pit&&by[pit]){
            sBody.appendChild(h("h3",{class:"dayh",text:"Arremessador titular"}));
            sBody.appendChild(table(PIT,[pitRow(by[pit],"SP")]))}
        })})
    }).catch(function(){
      [lBody,sBody,nBody].forEach(function(b){b.innerHTML="";b.appendChild(h("p",{class:"empty",text:"Não consegui carregar os jogos agora."}))})});

    api("/teams/"+id+"/roster?rosterType=active&hydrate=person(stats(group=[hitting,pitching],type=season,season="+SEASON+"))").then(function(d){
      var ppl=(d.roster||[]).map(function(r){return {p:r.person,pos:(r.position&&r.position.abbreviation)||"",type:(r.position&&r.position.type)||""}});
      var hit=ppl.filter(function(x){return x.type!=="Pitcher"}).filter(function(x){return statOf(x.p,"hitting")})
        .sort(function(a,b){return (statOf(b.p,"hitting").plateAppearances||0)-(statOf(a.p,"hitting").plateAppearances||0)});
      var pit=ppl.filter(function(x){return x.type==="Pitcher"||x.type==="Two-Way Player"}).filter(function(x){return statOf(x.p,"pitching")})
        .sort(function(a,b){return parseFloat(statOf(b.p,"pitching").inningsPitched||0)-parseFloat(statOf(a.p,"pitching").inningsPitched||0)});
      rBody.innerHTML="";
      rBody.appendChild(h("h3",{class:"dayh",text:"Rebatedores"}));
      rBody.appendChild(table(HIT,hit.map(function(x){return hitRow(x.p,x.pos)})));
      rBody.appendChild(h("h3",{class:"dayh",text:"Arremessadores"}));
      rBody.appendChild(table(PIT,pit.map(function(x){return pitRow(x.p,x.pos)})));
      rBody.appendChild(h("p",{class:"note",text:"Elenco ativo de hoje, ordenado por tempo de jogo. AVG média de rebatidas, HR home runs, RBI corridas impulsionadas, OPS on-base mais slugging, ERA média de corridas limpas, V-D vitórias e derrotas, K strikeouts, WHIP corredores por entrada."}))
    }).catch(function(){rBody.innerHTML="";rBody.appendChild(h("p",{class:"empty",text:"Não consegui carregar o elenco agora."}))})}

  /* ---- Dodgers ---- */
  function viewDodgers(root){
    root.appendChild(dodgersBanner([["Elenco e estatísticas","#esportes/beisebol/time-"+DODGERS],["@Dodgers no X","https://x.com/Dodgers"],["Instagram","https://www.instagram.com/dodgers/"]]));
    root.appendChild(mercadoDodgers());
    root.appendChild(rumoresMlb("dodgers",10));
    root.appendChild(section("Últimos jogos dos Dodgers",null,function(body){
      return dodgersGames(6).then(function(fin){body.innerHTML="";
        if(!fin.length){body.appendChild(h("p",{class:"empty",text:"Sem jogos recentes."}));return}
        body.appendChild(cards(fin,true))})}));
    var p=panel("Ohtani em "+SEASON),b=h("div");p.appendChild(b);root.appendChild(p);ohtaniLine(b);
    root.appendChild(xCatHead(XCATS.filter(function(c){return c.k==="dodgers"})[0],true))}

  /* ---- Página de um jogo da MLB: placar, vídeos, resumo, placar por entrada e box score ---- */
  function viewMlbGame(root,pk){
    root.appendChild(h("p",{style:"margin:0 0 -14px"},h("a",{class:"link",href:"#esportes/beisebol",text:"← Beisebol"})));
    var box=h("div",{class:"stack"},h("div",{class:"panel"},loading()));root.appendChild(box);
    function load(){
      Promise.all([
        mlbFeed(pk),
        mlbSched("gamePk="+pk).catch(function(){return []}),
        mlbContent(pk).catch(function(){return null})
      ]).then(function(r){
        var feed=r[0],g=r[1][0],content=r[2];
        box.innerHTML="";
        var gd=feed.gameData,ld=feed.liveData,ls=ld.linescore||{};
        if(!g){var loc=(gd.venue.location)||{};
          var mk=function(s){return {id:gd.teams[s].id,name:gd.teams[s].name,logo:logoUrl(gd.teams[s].id),color:MLBC[gd.teams[s].id],score:ls.teams&&ls.teams[s].runs}};
          g={sport:"mlb",id:pk,date:gd.datetime.dateTime,state:gd.status.abstractGameState==="Final"?"post":gd.status.abstractGameState==="Live"?"live":"pre",
            away:mk("away"),home:mk("home"),label:"",venue:{name:gd.venue.name,city:loc.city,state:loc.state}}}
        var dec=ld.decisions||{},decBox=null;
        if(dec.winner||dec.loser){
          decBox=h("div",{class:"dec"});
          [["winner","Vencedor"],["loser","Perdedor"],["save","Save"]].forEach(function(k){var p=dec[k[0]];if(p)decBox.appendChild(h("div",null,h("span",{class:"sub",text:k[1]}),mlbCell(p.id,p.fullName)))})}
        box.appendChild(scoreBand(g,[
          (gd.gameInfo&&gd.gameInfo.attendance)?"Público: "+gd.gameInfo.attendance.toLocaleString("pt-BR"):null,
          (gd.gameInfo&&gd.gameInfo.gameDurationMinutes)?"Duração: "+Math.floor(gd.gameInfo.gameDurationMinutes/60)+"h"+pad(gd.gameInfo.gameDurationMinutes%60):null],decBox));
        if(g.state==="pre"){box.appendChild(watchBlock(g));return}
        box.appendChild(stage(g,mlbVideos(content),[["Gameday na MLB.com","https://www.mlb.com/gameday/"+pk]]));
        box.appendChild(mlbLinePanel(g,feed));
        /* resumo */
        var rc=content&&content.editorial&&content.editorial.recap&&content.editorial.recap.mlb;
        if(rc&&(rc.headline||rc.body))box.appendChild(recapPanel(rc.headline,rc.subhead||rc.seoTitle,rc.body,rc.url||("https://www.mlb.com/gameday/"+pk),"MLB.com"));
        box.appendChild(mlbBoxPanel(g,feed))
      }).catch(function(e){box.innerHTML="";box.appendChild(h("div",{class:"panel"},failed(load,e)))})}
    load()}

  function mlbFeed(pk){return once("feed"+pk,function(){return getJson("https://statsapi.mlb.com/api/v1.1/game/"+pk+"/feed/live")})}
  /* Placar entrada por entrada: corridas de cada time em cada entrada, mais R, H e E */
  function mlbLinePanel(g,feed){
    var gd=feed.gameData,ls=feed.liveData.linescore||{};
    var inns=ls.innings||[],n=Math.max(9,inns.length);
    var cols=["Time"];for(var i=1;i<=n;i++)cols.push(String(i));cols.push("R","H","E");
    function lrow(side){var t=g[side],tt=(ls.teams||{})[side]||{};
      var row=[h("span",{class:"tn"},logoImg(t.id,"sm"),gd.teams[side].abbreviation||t.name)];
      for(var i=0;i<n;i++){var x=inns[i]&&inns[i][side];row.push(x&&x.runs!==undefined?String(x.runs):(inns[i]&&side==="home"?"x":"–"))}
      row.push(dash(tt.runs),dash(tt.hits),dash(tt.errors));return row}
    var lp=panel("Placar por entrada");
    var tb=table(cols,[lrow("away"),lrow("home")],1,"ls");
    tb.querySelectorAll("tr").forEach(function(tr){var c=tr.children;if(c.length>3)c[c.length-3].classList.add("tot")});
    /* jogadas que valeram corrida, por entrada e time ("3|away") */
    var pontos={};
    ((feed.liveData.plays||{}).allPlays||[]).forEach(function(pl){
      if(!pl.about||!pl.about.isScoringPlay)return;
      var k=pl.about.inning+"|"+(pl.about.halfInning==="top"?"away":"home");(pontos[k]=pontos[k]||[]).push(pl)});
    /* entradas com corrida ficam em destaque; passar o mouse (ou tocar) mostra como saíram */
    tb.querySelectorAll("tbody tr").forEach(function(tr,ri){var side=ri===0?"away":"home";Array.prototype.forEach.call(tr.children,function(td,i){
      if(i>0&&i<=n&&/^[1-9]\d*$/.test(td.textContent)){var v=td.textContent;td.textContent="";
        var pls=pontos[i+"|"+side];
        if(!pls){td.appendChild(h("span",{class:"rb",text:v}));return}
        var b=h("button",{type:"button",class:"rb",text:v,"aria-label":v+" corrida(s) na "+i+"ª entrada: ver como saíram"});
        ligarDica(b,function(){return resumoEntrada(g,gd,side,i,pls)});
        td.appendChild(b)}})});
    lp.appendChild(tb);
    lp.appendChild(h("p",{class:"note",text:"R corridas, H rebatidas válidas, E erros. Em destaque, as entradas em que saíram corridas: passe o mouse (ou toque) para ver como cada corrida saiu. “x” quando o time da casa não precisou rebater na última entrada."}));
    return lp}
  var EVENTO={"Single":"Simples","Double":"Duplo","Triple":"Triplo","Home Run":"Home run","Walk":"Walk","Intent Walk":"Walk intencional","Hit By Pitch":"Rebatedor atingido",
    "Sac Fly":"Sac fly","Sac Bunt":"Sac bunt","Field Error":"Erro","Fielders Choice":"Escolha do defensor","Fielders Choice Out":"Escolha do defensor","Groundout":"Roller",
    "Flyout":"Bola alta","Lineout":"Linha","Pop Out":"Pop out","Forceout":"Out forçado","Grounded Into DP":"Queimada dupla","Double Play":"Queimada dupla",
    "Wild Pitch":"Wild pitch","Passed Ball":"Passed ball","Balk":"Balk","Stolen Base Home":"Roubo do home","Strikeout":"Strikeout","Catcher Interference":"Interferência do catcher"};
  /* Quadro com as jogadas que valeram corrida numa meia-entrada: tipo, descrição, placar depois e contagem */
  function resumoEntrada(g,gd,side,inn,pls){
    var t=gd.teams[side];
    var box=h("div",{class:"sctip-in"},h("div",{class:"sch"},logoImg(g[side].id,"sm"),h("b",{text:inn+"ª entrada, parte "+(side==="away"?"de cima":"de baixo")+" · "+(t.teamName||t.name)})));
    function bolas(n,tot,cls){var s=h("span",{class:"cnt "+cls});for(var i=0;i<tot;i++)s.appendChild(h("i",{class:i<n?"on":null}));return s}
    pls.forEach(function(pl){var r=pl.result||{},c=pl.count||{};
      box.appendChild(h("div",{class:"scp"},
        h("div",{class:"sct"},h("b",{text:EVENTO[r.event]||r.event||"Jogada"}),
          h("span",{class:"scs"},h("span",{class:side==="away"?"lead":null,text:String(r.awayScore)})," – ",h("span",{class:side==="home"?"lead":null,text:String(r.homeScore)}))),
        h("p",{text:r.description||""}),
        h("div",{class:"scc"},"B",bolas(c.balls||0,4,"b"),"S",bolas(c.strikes||0,3,"s"),"O",bolas(c.outs||0,3,"o"))))});
    return box}
  /* Dica flutuante: abre ao passar o mouse ou focar, e com toque no celular */
  var dicaEl=null,dicaDe=null;
  function fecharDica(){if(dicaEl){dicaEl.remove();dicaEl=null;dicaDe=null}}
  function ligarDica(alvo,montar){
    function abrir(){if(dicaDe===alvo)return;fecharDica();dicaDe=alvo;
      dicaEl=h("div",{class:"sctip",role:"tooltip"},montar());document.body.appendChild(dicaEl);
      var r=alvo.getBoundingClientRect(),w=dicaEl.offsetWidth,hh=dicaEl.offsetHeight,vw=document.documentElement.clientWidth;
      var x=Math.max(8,Math.min(vw-w-8,r.left+r.width/2-w/2)),y=r.bottom+8;
      if(y+hh>innerHeight-8&&r.top-hh-8>8)y=r.top-hh-8;
      dicaEl.style.left=x+"px";dicaEl.style.top=y+"px"}
    alvo.addEventListener("mouseenter",abrir);alvo.addEventListener("focus",abrir);
    alvo.addEventListener("mouseleave",fecharDica);alvo.addEventListener("blur",fecharDica);
    alvo.addEventListener("click",function(e){e.stopPropagation();abrir()})}
  document.addEventListener("click",fecharDica);
  document.addEventListener("keydown",function(e){if(e.key==="Escape")fecharDica()});
  addEventListener("scroll",fecharDica,{passive:true});addEventListener("hashchange",fecharDica);
  /* Box score: rebatedores e arremessadores dos dois times, com foto e redes sociais */
  function mlbBoxPanel(g,feed){
    var ld=feed.liveData,bp=panel("Box score");
    var cols=h("div",{class:"bxcols"});bp.appendChild(cols);
    ["away","home"].forEach(function(side){
      var col=h("div",{class:"bxcol"});cols.appendChild(col);
      var ts=ld.boxscore.teams[side];
      col.appendChild(h("div",{class:"teamh"},logoImg(g[side].id),h("h3",{text:g[side].name})));
      var bat=(ts.batters||[]).map(function(id){return ts.players["ID"+id]}).filter(function(p){return p&&p.battingOrder&&p.stats&&p.stats.batting&&p.stats.batting.atBats!==undefined});
      col.appendChild(h("div",{class:"cat",text:"Rebatedores"}));
      col.appendChild(table(["Jogador","Pos","AB","R","H","RBI","HR","BB","K"],bat.map(function(p){var s=p.stats.batting,sub=!/00$/.test(p.battingOrder);
        var pos=(p.allPositions||[]).map(function(x){return x.abbreviation}).join("-")||(p.position&&p.position.abbreviation)||"";
        return [mlbCell(p.person.id,(sub?"↳ ":"")+p.person.fullName),pos,dash(s.atBats),dash(s.runs),dash(s.hits),dash(s.rbi),dash(s.homeRuns),dash(s.baseOnBalls),dash(s.strikeOuts)]})));
      col.appendChild(h("div",{class:"cat",text:"Arremessadores"}));
      col.appendChild(table(["Jogador","IP","H","R","ER","BB","K","Arr."],(ts.pitchers||[]).map(function(id){var p=ts.players["ID"+id],s=(p&&p.stats&&p.stats.pitching)||{};
        if(!p)return null;
        var note=(s.note||"").replace("(W,","(V,").replace("(L,","(D,").replace("(S,","(SV,").replace("(H,","(HLD,");
        return [mlbCell(p.person.id,p.person.fullName,note?" "+note:""),dash(s.inningsPitched),dash(s.hits),dash(s.runs),dash(s.earnedRuns),dash(s.baseOnBalls),dash(s.strikeOuts),dash(s.numberOfPitches)]}).filter(Boolean)))});
    bp.appendChild(h("p",{class:"note",text:"AB vezes ao bastão, R corridas, H rebatidas, RBI corridas impulsionadas, HR home runs, BB walks, K strikeouts. IP entradas arremessadas, ER corridas limpas, Arr. arremessos. ↳ entrou durante o jogo. V vitória, D derrota, SV save, HLD hold."}));
    return bp}

  /* Peças comuns das páginas de jogo (MLB e ESPN) */
  function scoreBand(g,extra,more){
    var post=g.state==="post",live=g.state==="live",started=post||live;
    function t(x){var inner=[img(x.logo,"lg"),h("b",{text:x.name})];return x.href?h("a",{class:"t",href:x.href},inner):h("div",{class:"t"},inner)}
    var sc=started?h("div",{class:"sc"},h("span",{class:post&&!g.away.winner&&g.home.winner?"l":""},dash(g.away.score)),h("span",{class:"l",text:" x "}),h("span",{class:post&&!g.home.winner&&g.away.winner?"l":""},dash(g.home.score))):h("div",{class:"sc"},h("span",{class:"l",text:"x"}));
    var d=new Date(g.date);
    var meta=h("div",{class:"gmeta"},
      live?h("span",{class:"st live",text:"AO VIVO"}):post?h("span",{class:"st",text:"FINAL"}):null,
      [g.label||null,dayTitle(d)+(g.state==="pre"?(g.tbd?" · horário a definir":" · "+hm(d)):""),venueText(g.venue)||null].concat(extra||[]).filter(Boolean).map(function(m){return h("span",{text:m})}));
    return h("div",{class:"band",style:splitStyle(g)},h("div",{class:"bi"},h("div",{class:"gh"},t(g.away),sc,t(g.home)),meta,more||null))}
  function watchBlock(g){
    var p=panel("Onde assistir",WATCHNOTE),row=h("div",{class:"linksrow"});
    WATCH[g.sport](g).forEach(function(w,i){row.appendChild(ext(w[1],w[0],"btn"+(i?"":" pri")))});
    p.appendChild(row);return p}
  /* Vídeo em destaque com a lista ao lado; o primeiro item da lista abre o YouTube */
  function stage(g,vids,links){
    var s=h("div",{class:"blk"},h("h2",{class:"sec",text:"Melhores momentos"}));
    var poster=vids[0]&&vids[0].poster;
    function ytTile(){
      var a=h("a",{class:"pli yt",href:ytUrl(g),target:"_blank",rel:"noopener"});
      var th=h("span",{class:"pth"});if(poster)th.appendChild(img(poster));
      var yb=h("span",{class:"ytb"});yb.innerHTML=YT;th.appendChild(yb);
      a.appendChild(th);a.appendChild(h("span",null,h("b",{text:"Assistir no YouTube"}),"Melhores momentos completos no canal oficial"));
      return a}
    if(!vids.length){
      var big=h("a",{class:"ytbig",href:ytUrl(g),target:"_blank",rel:"noopener",style:splitStyle(g)},h("div",{class:"thumb",style:"position:absolute;inset:0;aspect-ratio:auto;"+splitStyle(g)},h("div",{class:"split"})));
      var yb=h("span",{class:"ytb"});yb.innerHTML=YT;yb.appendChild(h("span",{text:"Assistir aos melhores momentos no YouTube"}));big.appendChild(yb);
      s.appendChild(big);
      s.appendChild(h("p",{class:"note",text:"Os vídeos oficiais deste jogo ainda não saíram aqui. O YouTube já costuma ter os melhores momentos."}))}
    else{
      var v=h("video",{controls:"",preload:"none",playsinline:"",poster:vids[0].poster,src:vids[0].src});
      var cap_=h("div",{class:"now",text:vids[0].title||""});
      var list=h("div",{class:"plist"},ytTile());
      vids.slice(0,8).forEach(function(x,i){
        var b=h("button",{type:"button",class:"pli"+(i===0?" on":"")});
        var th=h("span",{class:"pth"},img(x.poster));if(x.dur)th.appendChild(h("span",{class:"dur",text:x.dur}));
        b.appendChild(th);b.appendChild(h("span",{text:x.title||""}));
        b.onclick=function(){v.poster=x.poster||"";v.src=x.src;cap_.textContent=x.title||"";v.play().catch(function(){});
          list.querySelectorAll(".pli").forEach(function(e){e.classList.remove("on")});b.classList.add("on")};
        list.appendChild(b)});
      s.appendChild(h("div",{class:"stage"},h("div",null,v,cap_),list));
      s.appendChild(h("p",{class:"note",text:"Vídeos oficiais, narração em inglês."}))}
    if(links&&links.length)s.appendChild(h("div",{class:"linksrow"},links.map(function(l){return ext(l[1],l[0],"btn")})));
    return s}
  function htmlParas(html){
    if(!html)return [];
    var doc=new DOMParser().parseFromString(html,"text/html");
    var ps=Array.prototype.map.call(doc.querySelectorAll("p"),function(p){return p.textContent});
    /* a ESPN manda o texto sem <p>, separado por linhas em branco */
    if(!ps.length)ps=(doc.body.textContent||"").split(/\n\s*\n/);
    return ps.map(function(t){return t.replace(/\s+/g," ").trim()}).filter(function(t){return t.length>40})}
  function recapPanel(title,sub,html,url,src){
    var p=panel("Como foi o jogo"),r=h("div",{class:"recap"});
    if(title)r.appendChild(h("h3",{text:title}));
    if(sub)r.appendChild(h("p",{class:"sub",text:sub}));
    htmlParas(html).slice(0,8).forEach(function(t){r.appendChild(h("p",{text:t}))});
    p.appendChild(r);
    p.appendChild(h("p",{class:"note"},"Texto original em inglês. ",url?ext(url,"Ler a matéria completa na "+src):null));
    return p}

  function renderMlb(view){
    var root=document.getElementById("mlb-view");root.innerHTML="";
    if(view==="times")viewTimes(root);
    else if(view==="dodgers")viewDodgers(root);
    else if(/^time-\d+$/.test(view))viewTeam(root,parseInt(view.slice(5),10));
    else if(/^jogo-\d+$/.test(view))viewMlbGame(root,parseInt(view.slice(5),10));
    else viewLiga(root)}

  /* ===== Basquete (Lakers) e futebol americano (Packers): dados ao vivo da ESPN ===== */
  var ESPN={
    nba:{path:"basketball/nba",team:"lal",route:"basquete",
      links:[["Site oficial","https://www.nba.com/lakers"],["@Lakers no X","https://x.com/Lakers"],["Instagram","https://www.instagram.com/lakers/"]]},
    nfl:{path:"football/nfl",team:"gb",route:"futebol-americano",
      links:[["Site oficial","https://www.packers.com/"],["@packers no X","https://x.com/packers"],["Instagram","https://www.instagram.com/packers/"]]}};
  function espn(sport,path){return getJson("https://site.api.espn.com/apis/site/v2/sports/"+ESPN[sport].path+path)}
  function espnSummary(sport,id){return once("es"+sport+id,function(){return espn(sport,"/summary?event="+id)})}
  function espnVideos(s){
    return (s.videos||[]).map(function(v){var l=v.links||{},src=l.source&&(l.source.HD&&l.source.HD.href||l.source.href);
      return src?{title:v.headline,src:src,poster:v.thumbnail,dur:v.duration?fmtDur(v.duration):""}:null}).filter(Boolean)}
  function espnLogo(sport,team){return (team.logos&&team.logos[0]&&team.logos[0].href)||team.logo||("https://a.espncdn.com/i/teamlogos/"+sport+"/500/"+String(team.abbreviation||"").toLowerCase()+".png")}
  function espnScore(s){return s&&typeof s==="object"?s.displayValue:s}
  function espnLabel(sport,stype,week,notes){
    if(stype===1)return "Pré-temporada";
    if(stype===3)return "Playoffs";
    if(notes&&notes[0]&&notes[0].headline)return notes[0].headline;
    if(sport==="nfl"&&week)return "Semana "+week;
    return ""}
  /* Normaliza um evento da ESPN (da agenda do time ou do cabeçalho do resumo) */
  function espnGame(sport,e,c,venue){
    var comps=c.competitors||[],a=comps.filter(function(x){return x.homeAway==="away"})[0]||comps[1],hm_=comps.filter(function(x){return x.homeAway==="home"})[0]||comps[0];
    function tm(x){return {abbr:x.team.abbreviation,name:x.team.displayName,logo:espnLogo(sport,x.team),score:espnScore(x.score),winner:!!x.winner,linescores:x.linescores||[],color:x.team.color?"#"+x.team.color:null}}
    var st=(c.status&&c.status.type&&c.status.type.state)||"pre";
    var v=venue||c.venue||{},ad=v.address||{};
    var stype=(e.seasonType&&(e.seasonType.type||+e.seasonType.id))||(e.season&&e.season.type);
    var week=e.week&&(typeof e.week==="object"?e.week.number:e.week);
    var vimg=(v.images&&v.images[0]&&v.images[0].href)||(v.id?"https://a.espncdn.com/i/venues/"+sport+"/day/"+v.id+".jpg":null);
    return {sport:sport,id:e.id||c.id,date:c.date||e.date,tbd:e.timeValid===false||c.timeValid===false,
      state:st==="post"?"post":st==="in"?"live":"pre",away:tm(a),home:tm(hm_),
      label:espnLabel(sport,stype,week,c.notes),
      venue:{name:v.fullName,city:ad.city,state:ad.state,country:ad.country},venueImg:vimg,
      tv:(c.broadcasts||[]).map(function(b){return (b.media&&b.media.shortName)||(b.names&&b.names[0])||""}),
      detail:"#esportes/"+ESPN[sport].route+"/jogo-"+(e.id||c.id)}}
  function espnSchedule(sport){
    return once("esch-"+sport,function(){return espn(sport,"/teams/"+ESPN[sport].team+"/schedule").then(function(d){
      var t=d.team||{},col=t.color?"#"+t.color:null;
      var gs=(d.events||[]).map(function(e){var g=espnGame(sport,e,e.competitions[0]);
        [g.away,g.home].forEach(function(x){if(col&&x.abbr===t.abbreviation)x.color=col});return g});
      gs.sort(function(a,b){return a.date.localeCompare(b.date)});
      return {team:t,games:gs}})})}
  var PLACE={North:"Norte",South:"Sul",East:"Leste",West:"Oeste",Pacific:"Pacífico",Central:"Central",Atlantic:"Atlântico",Northwest:"Noroeste",Southwest:"Sudoeste",Southeast:"Sudeste"};
  function standingPt(s){
    if(!s)return "";
    var m=/^(\d+)\w*\s+in\s+(.+)$/.exec(s);if(!m)return s;
    var conf=m[2].replace(/^(\w+) Division$/,"Divisão $1").replace(/^(\w+) Conference$/,"Conferência $1")
      .replace(/\b(North|South|East|West|Pacific|Central|Atlantic|Northwest|Southwest|Southeast)\b/,function(x){return PLACE[x]});
    return m[1]+"º na "+conf}

  function renderEspn(sport,v){
    var root=document.getElementById(sport+"-view");root.innerHTML="";
    if(/^jogo-\d+$/.test(v))viewEspnGame(root,sport,v.slice(5));else viewEspnTeam(root,sport)}

  function viewEspnTeam(root,sport){
    var head=h("div",null,h("div",{class:"panel"},loading()));root.appendChild(head);
    var heroB=h("div",null,loading()),resB=h("div"),nxtB=h("div",null,loading());
    root.appendChild(h("div",{class:"blk"},h("h2",{class:"sec",text:"Destaque"}),heroB));
    var resBlk=h("div",{class:"blk"},h("h2",{class:"sec",text:"Últimos resultados"}),resB);root.appendChild(resBlk);
    root.appendChild(h("div",{class:"blk"},h("h2",{class:"sec"},"Próximos jogos",h("small",{text:WATCHNOTE})),nxtB));
    var lastBox=h("div",{class:"stack"});root.appendChild(lastBox);
    function load(){
      espnSchedule(sport).then(function(d){
        var t=d.team||{};
        head.innerHTML="";
        head.appendChild(banner({name:t.displayName||"",logo:espnLogo(sport,t),color:t.color?"#"+t.color:null,
          meta:[t.recordSummary?"Campanha "+t.recordSummary.replace("-","–"):"",standingPt(t.standingSummary)].filter(Boolean).join(" · "),
          links:ESPN[sport].links}));
        var fin=d.games.filter(function(g){return g.state!=="pre"}),nx=d.games.filter(function(g){return g.state==="pre"});
        heroB.innerHTML="";nxtB.innerHTML="";
        if(fin.length)heroB.appendChild(hero(fin[fin.length-1]));else heroB.appendChild(h("p",{class:"empty",text:"A temporada ainda não começou."}));
        var prev=fin.slice(0,-1).slice(-3);
        if(prev.length)resB.appendChild(cards(prev,true));else resBlk.hidden=true;
        if(nx.length)nxtB.appendChild(cards(nx.slice(0,6),false));else nxtB.appendChild(h("p",{class:"empty",text:"Nenhum jogo agendado."}));
        [espnClassificacao(sport,t),espnTabela(sport,d.games),espnNoticias(sport,t)].forEach(function(x){root.insertBefore(x,lastBox)});
        var last=fin.filter(function(g){return g.state==="post"}).pop();
        if(last)espnSummary(sport,last.id).then(function(s){
          var g=espnFromSummary(sport,s);
          lastBox.appendChild(h("div",{class:"blk"},h("h2",{class:"sec"},"Último jogo em detalhes",h("small",null,dayTitle(new Date(g.date))+" · ",h("a",{class:"link",href:g.detail,text:"página do jogo, com vídeos e resumo →"})))));
          lastBox.appendChild(periodPanel(g));
          lastBox.appendChild(espnBoxPanel(sport,s,g))
        }).catch(function(){})
      }).catch(function(e){head.innerHTML="";head.appendChild(failed(load,e));heroB.innerHTML="";nxtB.innerHTML=""})}
    load()}

  /* classificação: NBA na conferência do time (a outra fica recolhida); NFL na divisão e, recolhida, a conferência pela vaga nos playoffs */
  function espnClassificacao(sport,t){
    var p=panel("Classificação",sport==="nba"?"Conferência do "+(t.shortDisplayName||t.displayName)+", pela posição de playoffs.":"Divisão do "+(t.shortDisplayName||t.displayName)+" e a conferência."),box=h("div",null,loading());p.appendChild(box);
    getJson("https://site.api.espn.com/apis/v2/sports/"+ESPN[sport].path+"/standings"+(sport==="nfl"?"?level=3":"")).then(function(d){box.innerHTML="";
      function st(e,n){var x=(e.stats||[]).filter(function(s){return s.name===n||s.type===n||s.abbreviation===n})[0];return x?x.displayValue:"—"}
      function tabela(entries,cols){var tb=h("table",{class:"famtab stand"});
        tb.appendChild(h("thead",null,h("tr",null,[h("th",{text:"#"}),h("th",{text:"Time"})].concat(cols.map(function(c){return h("th",{text:c[0],title:c[2]||""})})))));
        tb.appendChild(h("tbody",null,entries.map(function(e,i){var tm=e.team||{},eu=tm.abbreviation===t.abbreviation;
          return h("tr",{class:eu?"eu":null},h("td",{text:String(i+1)}),h("td",null,h("span",{class:"tn"},img((tm.logos&&tm.logos[0]&&tm.logos[0].href)||"","lg sm"),tm.shortDisplayName||tm.displayName)),cols.map(function(c){return h("td",{text:st(e,c[1])})}))})));
        return h("div",{class:"famtabw"},tb)}
      function seed(a,b){return (+st(a,"playoffSeed")||99)-(+st(b,"playoffSeed")||99)}
      var temTime=function(g){return (g.standings&&g.standings.entries||[]).some(function(e){return e.team.abbreviation===t.abbreviation})};
      if(sport==="nba"){var CN=[["V","wins","Vitórias"],["D","losses","Derrotas"],["%","winPercent","Aproveitamento"],["JA","gamesBehind","Jogos atrás do líder"],["Seq.","streak","Sequência"],["Últ. 10","Last Ten Games","Últimos 10 jogos"]];
        (d.children||[]).sort(function(a,b){return temTime(b)-temTime(a)}).forEach(function(c,i){var es=c.standings.entries.slice().sort(seed),nome=c.name.replace("Eastern Conference","Conferência Leste").replace("Western Conference","Conferência Oeste");
          if(i===0){box.appendChild(h("h3",{class:"dayh",text:nome}));box.appendChild(tabela(es,CN))}else box.appendChild(h("details",{class:"famvals"},h("summary",{text:nome}),tabela(es,CN)))})}
      else{var CF=[["V","wins","Vitórias"],["D","losses","Derrotas"],["E","ties","Empates"],["%","winPercent","Aproveitamento"],["Div.","divisionRecord","Campanha na divisão"],["Seq.","streak","Sequência"]];
        (d.children||[]).forEach(function(conf){var divs=conf.children||[],minha=divs.filter(temTime)[0];if(!minha)return;
          var nd=minha.name.replace(/^(AFC|NFC) /,"$1 · ").replace("North","Norte").replace("South","Sul").replace("East","Leste").replace("West","Oeste");
          box.appendChild(h("h3",{class:"dayh",text:"Divisão "+nd}));box.appendChild(tabela(minha.standings.entries.slice().sort(function(a,b){return (+st(b,"winPercent")||0)-(+st(a,"winPercent")||0)}),CF));
          var todos=[];divs.forEach(function(dv){todos=todos.concat(dv.standings.entries)});
          box.appendChild(h("details",{class:"famvals"},h("summary",{text:conf.name.replace("National Football Conference","Conferência Nacional (NFC)").replace("American Football Conference","Conferência Americana (AFC)")+" · ordem dos playoffs"}),tabela(todos.sort(seed),CF)))})}
      if(!box.children.length)box.appendChild(h("p",{class:"empty",text:"Classificação ainda não disponível."}))
    }).catch(function(){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:"Não consegui carregar a classificação agora."}))});
    return p}
  /* todos os jogos da temporada, por mês (o mês atual aberto); cada linha abre a página do jogo */
  function espnTabela(sport,games){
    var p=panel("Tabela da temporada",games.length+" jogos · toque num jogo para ver os detalhes"),meus=ESPN[sport].team.toUpperCase(),por={},hj=hojeISO().slice(0,7);
    games.forEach(function(g){var k=g.date.slice(0,7);(por[k]=por[k]||[]).push(g)});
    Object.keys(por).sort().forEach(function(k){var d0=new Date(k+"-15T12:00:00"),ul=h("ul",{class:"wl tabjogos"});
      por[k].forEach(function(g){var casa=g.home.abbr===meus,adv=casa?g.away:g.home,eu=casa?g.home:g.away,dt=new Date(g.date);
        var res=g.state==="post"?(eu.winner?"V ":adv.winner?"D ":"E ")+eu.score+"–"+adv.score:g.state==="live"?"ao vivo":g.tbd?"a definir":dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
        ul.appendChild(h("li",{class:"clic"+(g.state==="post"?(eu.winner?" ganhou":" perdeu"):"")},h("span",{class:"when",text:dt.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"})}),
          h("span",{class:"grow tn"},h("span",{class:"sub",text:casa?"vs":"@"}),img(adv.logo,"lg sm"),adv.name),h("a",{class:"end",href:g.detail,text:res})))});
      var nome=d0.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
      p.appendChild(h("details",{class:"famvals",open:k===hj?"":null},h("summary",{text:nome.charAt(0).toUpperCase()+nome.slice(1)+" ("+por[k].length+")"}),ul))});
    return p}
  /* notícias do time na ESPN (em inglês) */
  function espnNoticias(sport,t){
    var p=panel("Notícias do "+(t.shortDisplayName||t.displayName||"time"),"Da ESPN, em inglês."),box=h("div",null,loading());p.appendChild(box);
    espn(sport,"/news?team="+t.id+"&limit=8").then(function(d){box.innerHTML="";var l=d.articles||[];
      if(!l.length){box.appendChild(h("p",{class:"empty",text:"Sem notícias agora."}));return}
      box.appendChild(h("ul",{class:"wl rumores"},l.map(function(a){var u=a.links&&a.links.web&&a.links.web.href,im=(a.images||[])[0];
        return h("li",null,im?img(im.url,"nimg"):null,h("span",{class:"grow"},h("a",{class:"link",href:u||"#",target:"_blank",rel:"noopener",text:a.headline}),
          h("span",{class:"sub",text:(a.published?new Date(a.published).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+" · ":"")+(a.description||"")})))})))})
      .catch(function(){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:"Não consegui carregar as notícias agora."}))});
    return p}
  function espnFromSummary(sport,s){
    var c=s.header.competitions[0];
    var e={id:s.header.id,season:s.header.season,week:s.header.week};
    return espnGame(sport,e,c,(s.gameInfo&&s.gameInfo.venue)||c.venue)}

  function periodPanel(g){
    var n=Math.max(4,g.away.linescores.length,g.home.linescores.length),cols=["Time"];
    for(var i=0;i<n;i++)cols.push(i<4?(i+1)+"º":(n-4>1?"Prorr. "+(i-3):"Prorr."));
    cols.push("Total");
    function row(t){var r=[h("span",{class:"tn"},img(t.logo,"lg sm"),t.abbr)];
      for(var i=0;i<n;i++){var l=t.linescores[i];r.push(l?String(l.displayValue!==undefined?l.displayValue:l.value):"–")}
      r.push(dash(t.score));return r}
    var p=panel("Pontuação por quarto");
    var tb=table(cols,[row(g.away),row(g.home)],1,"ls");
    tb.querySelectorAll("tr").forEach(function(tr){tr.lastChild.classList.add("tot")});
    p.appendChild(tb);return p}

  var NBACOLS=["MIN","PTS","REB","AST","FG","3PT","FT","STL","BLK","TO","+/-"];
  var NFLCATS=[["passing","Passes"],["rushing","Corridas"],["receiving","Recepções"],["defensive","Defesa"],["interceptions","Interceptações"],["kicking","Chutes"],["punting","Punts"]];
  function athCell(sport,a){var at=a.athlete||{};
    return pcell((at.headshot&&at.headshot.href)||"",at.displayName||at.shortName||"",sport,at.id,at.position&&at.position.abbreviation?" "+at.position.abbreviation:"")}
  function espnBoxPanel(sport,s,g){
    var p=panel("Box score","Todos os jogadores que entraram em quadra, com foto");
    var teams=(s.boxscore&&s.boxscore.players)||[];
    if(!teams.length){p.appendChild(h("p",{class:"empty",text:"Box score ainda não disponível."}));return p}
    var order=[g.away.abbr,g.home.abbr];
    var cols=h("div",{class:"bxcols"});p.appendChild(cols);
    teams.slice().sort(function(a,b){return order.indexOf(a.team.abbreviation)-order.indexOf(b.team.abbreviation)}).forEach(function(t){
      var col=h("div",{class:"bxcol"});cols.appendChild(col);
      col.appendChild(h("div",{class:"teamh"},img(espnLogo(sport,t.team),"lg"),h("h3",{text:t.team.displayName})));
      if(sport==="nba"){
        var st=t.statistics[0]||{labels:[],athletes:[]},idx=NBACOLS.map(function(c){return (st.labels||[]).indexOf(c)});
        var played=(st.athletes||[]).filter(function(a){return !a.didNotPlay&&a.stats&&a.stats.length});
        [["Titulares",true],["Reservas",false]].forEach(function(grp){
          var rows=played.filter(function(a){return !!a.starter===grp[1]}).map(function(a){
            return [athCell(sport,a)].concat(idx.map(function(i){return i<0?"–":dash(a.stats[i])}))});
          if(!rows.length)return;
          col.appendChild(h("div",{class:"cat",text:grp[0]}));
          col.appendChild(table(["Jogador"].concat(NBACOLS),rows,1))});
        var dnp=(st.athletes||[]).filter(function(a){return a.didNotPlay});
        if(dnp.length)col.appendChild(h("p",{class:"sub",text:"Não jogaram: "+dnp.map(function(a){return a.athlete.displayName}).join(", ")+"."}))}
      else{
        NFLCATS.forEach(function(cat){
          var st=t.statistics.filter(function(x){return x.name===cat[0]})[0];
          if(!st||!st.athletes||!st.athletes.length)return;
          col.appendChild(h("div",{class:"cat",text:cat[1]}));
          col.appendChild(table(["Jogador"].concat(st.labels),st.athletes.map(function(a){return [athCell(sport,a)].concat(a.stats.map(dash))}),1))})}});
    p.appendChild(h("p",{class:"note",text:sport==="nba"
      ?"MIN minutos, PTS pontos, REB rebotes, AST assistências, FG arremessos de quadra (certos-tentados), 3PT de três, FT lances livres, STL roubos, BLK tocos, TO erros, +/- saldo com ele em quadra."
      :"C/ATT passes completos/tentados, YDS jardas, AVG média, TD touchdowns, INT interceptações, CAR corridas, REC recepções, TGTS alvos, TOT tackles, SACKS sacks, FG field goals, XP pontos extras."}));
    return p}

  function viewEspnGame(root,sport,id){
    root.appendChild(h("p",{style:"margin:0 0 -14px"},h("a",{class:"link",href:"#esportes/"+ESPN[sport].route,text:"← "+(sport==="nba"?"Lakers":"Packers")})));
    var box=h("div",{class:"stack"},h("div",{class:"panel"},loading()));root.appendChild(box);
    function load(){
      espnSummary(sport,id).then(function(s){
        var g=espnFromSummary(sport,s);
        box.innerHTML="";
        var gi=s.gameInfo||{};
        box.appendChild(scoreBand(g,[gi.attendance?"Público: "+gi.attendance.toLocaleString("pt-BR"):null]));
        if(g.state==="pre"){box.appendChild(watchBlock(g));return}
        box.appendChild(stage(g,espnVideos(s),[["Página do jogo na ESPN","https://www.espn.com/"+sport+"/game/_/gameId/"+id]]));
        box.appendChild(periodPanel(g));
        var a=s.article;
        if(a&&(a.headline||a.story))box.appendChild(recapPanel(a.headline,(a.description||"").replace(/^—\s*/,""),a.story,a.links&&a.links.web&&a.links.web.href,"ESPN"));
        if(sport==="nfl"&&s.scoringPlays&&s.scoringPlays.length){
          var sp=panel("Como saíram os pontos");
          sp.appendChild(table(["Quarto","Tempo","Time","Jogada","Placar"],s.scoringPlays.map(function(x){
            return [(x.period&&x.period.number?x.period.number+"º":""),(x.clock&&x.clock.displayValue)||"",h("span",{class:"tn"},img(x.team&&x.team.logo||"","lg sm"),(x.team&&x.team.abbreviation)||""),x.text||"",dash(x.awayScore)+"–"+dash(x.homeScore)]}),5));
          box.appendChild(sp)}
        box.appendChild(espnBoxPanel(sport,s,g))
      }).catch(function(e){box.innerHTML="";box.appendChild(h("div",{class:"panel"},failed(load,e)))})}
    load()}
