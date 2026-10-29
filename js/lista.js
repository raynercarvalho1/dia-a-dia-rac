/* Dia a Dia RAC — módulo carregado quando a seção abre. Lista de compras e tarefas da casa, compartilhada em tempo real
   com quem está na casa (tabela "lista", 009_lista.sql). Funciona sem internet: o que mudar entra na fila e sobe depois.
   Usa as funções do núcleo (js/app.js), que ficam no escopo global. */
  var COMPRAS={tipo:"compra",itens:[],canal:null,sugestoes:null,carregou:false};
  /* "2 leite", "leite x2" ou "leite 2 un" viram item + quantidade */
  function listaItemDe(txt){txt=String(txt||"").replace(/^\s*(?:[-*•·]|☐|☑|✅|✓|\[[ xX]?\])\s*/,"").trim();if(!txt)return null;
    var m=/^(\d+(?:[.,]\d+)?\s*(?:x|un|kg|g|l|ml|pct|cx)?)\s+(.+)$/i.exec(txt)||null,q=null,t=txt;
    if(m){q=m[1];t=m[2]}else{m=/^(.+?)\s+(?:x\s*)?(\d+(?:[.,]\d+)?\s*(?:un|kg|g|l|ml|pct|cx)?)$/i.exec(txt);if(m&&!/\d$/.test(m[1])){t=m[1];q=m[2]}}
    return {item:t.slice(0,200),qtd:q}}
  function listaCarregar(){return SB.from("lista").select("id,tipo,item,qtd,feito,feito_em,criado").order("criado",{ascending:true}).then(sbOk).then(function(l){COMPRAS.itens=l;COMPRAS.carregou=true;return l})}
  /* sugestões: produtos do Mercado (mais comprados primeiro) e o que já entrou na lista antes */
  function listaSugestoes(){
    if(COMPRAS.sugestoes)return Promise.resolve(COMPRAS.sugestoes);
    return SB.from("produtos").select("nome").limit(2000).then(function(r){var s={};(r.data||[]).forEach(function(p){s[p.nome]=1});COMPRAS.itens.forEach(function(i){s[i.item]=1});COMPRAS.sugestoes=Object.keys(s).sort();return COMPRAS.sugestoes}).catch(function(){return []})}
  function listaOp(op){return bancoOuFila(op).then(function(r){if(r&&r.enfileirado)listaAviso("Sem internet: guardado neste aparelho, sobe sozinho quando voltar.");return r}).catch(function(e){logErro("lista",e);listaAviso("Não consegui salvar ("+e.message+").")})}
  var listaAvisoEl=null;function listaAviso(t){if(listaAvisoEl)listaAvisoEl.textContent=t}
  function listaAdicionar(textos,tipo){
    var novos=[].concat(textos).map(listaItemDe).filter(Boolean).map(function(x){return {id:novoId(),tipo:tipo,item:x.item,qtd:x.qtd,feito:false,criado:new Date().toISOString()}});
    if(!novos.length)return Promise.resolve();
    COMPRAS.itens=COMPRAS.itens.concat(novos);desenharLista();
    return listaOp({t:"lista",acao:"insert",dados:novos.map(function(x){return {id:x.id,tipo:x.tipo,item:x.item,qtd:x.qtd}})})}
  function renderLista(sub){
    COMPRAS.tipo=sub==="tarefas"?"tarefa":"compra";
    var root=$("#lista-view");root.innerHTML="";
    var seg=h("div",{class:"seg famseg"},h("a",{href:"#lista","aria-pressed":String(COMPRAS.tipo==="compra"),text:"🛒 Compras"}),h("a",{href:"#lista/tarefas","aria-pressed":String(COMPRAS.tipo==="tarefa"),text:"✅ Tarefas da casa"}));
    root.appendChild(seg);
    var p=panel(null),inp=h("input",{type:"text",class:"listainp",placeholder:COMPRAS.tipo==="compra"?"Adicionar à lista (ex.: 2 leite)":"Nova tarefa (ex.: trocar o filtro da água)",autocomplete:"off",list:"lista-sug",enterkeyhint:"done"});
    var dl=h("datalist",{id:"lista-sug"}),add=h("button",{type:"button",text:"Adicionar"});listaAvisoEl=h("p",{class:"sub",role:"status"});
    function enviar(){var v=inp.value.trim();if(!v){inp.focus();return}inp.value="";listaAdicionar(v.split(/\s*[;\n]\s*/),COMPRAS.tipo);inp.focus()}
    add.onclick=enviar;inp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();enviar()}});
    p.appendChild(h("div",{class:"listaadd"},inp,add));p.appendChild(dl);p.appendChild(listaAvisoEl);
    var box=h("div",{class:"listabox",id:"listabox"},h("p",{class:"sub",text:"Carregando…"}));p.appendChild(box);root.appendChild(p);
    /* vinda do Notas: cola a lista inteira de uma vez */
    var ta=h("textarea",{rows:"5",placeholder:"Cole aqui a lista do Notas (um item por linha; marcadores e caixinhas são ignorados)"}),imp=h("button",{type:"button",class:"ghostbtn",text:"Adicionar todos"});
    imp.onclick=function(){var linhas=ta.value.split(/\n/).filter(function(l){return l.trim()&&!/^\s*(?:☑|✅|✓|\[[xX]\])/.test(l)});ta.value="";listaAdicionar(linhas,COMPRAS.tipo)};
    root.appendChild(h("details",{class:"panel famvals"},h("summary",{text:"Colar a lista do Notas"}),h("div",{class:"wform"},ta,h("div",{class:"vfil"},imp),h("p",{class:"sub",text:"Itens já marcados no Notas (☑) ficam de fora."}))));
    listaCarregar().then(function(){desenharLista();return listaSugestoes()}).then(function(s){dl.innerHTML="";s.slice(0,1500).forEach(function(n){dl.appendChild(h("option",{value:n}))})})
      .catch(function(e){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:/lista|relation|schema cache/i.test(e.message)?"Falta rodar o supabase/009_lista.sql no Supabase para ligar a lista.":"Não consegui carregar ("+e.message+")."}));logErro("lista",e)});
    /* tempo real: o que a outra pessoa marcar ou adicionar aparece aqui na hora */
    if(!COMPRAS.canal&&SB.channel){COMPRAS.canal=SB.channel("lista-casa").on("postgres_changes",{event:"*",schema:"public",table:"lista"},function(){
      if(location.hash.indexOf("#lista")===0)listaCarregar().then(desenharLista)}).subscribe()}
    setTimeout(function(){if(innerWidth>860)inp.focus()},50)}
  function desenharLista(){
    var box=$("#listabox");if(!box)return;box.innerHTML="";
    var l=COMPRAS.itens.filter(function(i){return i.tipo===COMPRAS.tipo}),abertos=l.filter(function(i){return !i.feito}),feitos=l.filter(function(i){return i.feito});
    function linha(i){var cb=h("input",{type:"checkbox","aria-label":i.item});cb.checked=i.feito;
      cb.onchange=function(){i.feito=cb.checked;i.feito_em=cb.checked?new Date().toISOString():null;desenharLista();listaOp({t:"lista",acao:"update",id:i.id,dados:{feito:i.feito,feito_em:i.feito_em}})};
      var rm=h("button",{type:"button",class:"listarm","aria-label":"Tirar "+i.item,text:"×"});
      rm.onclick=function(){COMPRAS.itens=COMPRAS.itens.filter(function(x){return x.id!==i.id});desenharLista();listaOp({t:"lista",acao:"delete",id:i.id})};
      return h("li",{class:i.feito?"feito":null},h("label",null,cb,h("span",{class:"grow"},h("span",{class:"listat",text:i.item}),i.qtd?h("span",{class:"listaq",text:i.qtd}):null)),rm)}
    if(!l.length){box.appendChild(h("p",{class:"empty",text:COMPRAS.tipo==="compra"?"Lista vazia. O que está faltando?":"Nenhuma tarefa. 🎉"}));return}
    box.appendChild(h("ul",{class:"listaul"},abertos.map(linha)));
    if(feitos.length){var lim=h("button",{type:"button",class:"ghostbtn",text:"Limpar "+(COMPRAS.tipo==="compra"?"o que já está no carrinho":"as feitas")+" ("+feitos.length+")"});
      lim.onclick=function(){var ids=feitos.map(function(i){return i.id});COMPRAS.itens=COMPRAS.itens.filter(function(x){return ids.indexOf(x.id)<0});desenharLista();ids.forEach(function(id){listaOp({t:"lista",acao:"delete",id:id})})};
      box.appendChild(h("h3",{class:"mbag",text:(COMPRAS.tipo==="compra"?"No carrinho":"Feitas")+" ("+feitos.length+")"}));box.appendChild(h("ul",{class:"listaul"},feitos.map(linha)));box.appendChild(h("div",{class:"vfil"},lim))}}
