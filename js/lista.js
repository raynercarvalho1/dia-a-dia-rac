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
    if(COMPRAS.tipo==="compra"){var prev=h("div",{class:"stack",id:"listaprev"});root.appendChild(prev);if(isOwner())root.appendChild(listaAtalhos())}
    listaCarregar().then(function(){desenharLista();if(COMPRAS.tipo==="compra")listaPrevisao();return listaSugestoes()}).then(function(s){dl.innerHTML="";s.slice(0,1500).forEach(function(n){dl.appendChild(h("option",{value:n}))})})
      .catch(function(e){box.innerHTML="";box.appendChild(h("p",{class:"empty",text:/lista|relation|schema cache/i.test(e.message)?"Falta rodar o supabase/009_lista.sql no Supabase para ligar a lista.":"Não consegui carregar ("+e.message+")."}));logErro("lista",e)});
    /* tempo real: o que a outra pessoa marcar ou adicionar aparece aqui na hora */
    if(!COMPRAS.canal&&SB.channel){COMPRAS.canal=SB.channel("lista-casa").on("postgres_changes",{event:"*",schema:"public",table:"lista"},function(){
      if(location.hash.indexOf("#lista")===0)listaCarregar().then(desenharLista)}).subscribe()}
    setTimeout(function(){if(innerWidth>860)inp.focus()},50)}
  /* ===== O que deve estar acabando (pelas notas do Mercado) e o padrão de compras ===== */
  function listaHistorico(){
    if(COMPRAS.hist)return Promise.resolve(COMPRAS.hist);
    var ini=maisDias(hojeISO(),-365);
    function pag(f,acc){return Promise.resolve().then(function(){return SB.from("compras").select("data,produto,quantidade,valor_total").gte("data",ini).order("data").range(f,f+999)}).then(sbOk)
      .then(function(l){acc=acc.concat(l);return l.length===1000?pag(f+1000,acc):acc})}
    return pag(0,[]).then(function(l){COMPRAS.hist=l.map(function(x){return {data:x.data,produto:x.produto,quantidade:+x.quantidade||1,valor:+x.valor_total||0}});return COMPRAS.hist})}
  function listaPrevisao(){
    var box=$("#listaprev");if(!box)return;
    listaHistorico().then(function(hist){
      box.innerHTML="";if(!hist.length)return;
      var abertos=COMPRAS.itens.filter(function(i){return i.tipo==="compra"&&!i.feito}),adiados=PESSOAL.acabandoAdiado||{};
      var l=NUCLEO.previsaoCompras(hist,hojeISO(),adiados).filter(function(x){return x.status!=="ok"&&!abertos.some(function(i){return NUCLEO.itemBate(i.item,x.produto)||NUCLEO.chaveProduto(i.item)===x.chave})});
      var p=panel("Deve estar acabando","Pelo intervalo entre as suas compras de cada produto (só entra o que você já comprou 3 vezes ou mais).");
      if(!l.length)p.appendChild(h("p",{class:"sub",text:"Nada parece estar acabando agora."}));
      var ul=h("ul",{class:"wl acab"}),MAX=8;l.forEach(function(x,i){
        var por=h("button",{type:"button",text:"+ Lista"}),tem=isOwner()?h("button",{type:"button",class:"ghostbtn",text:"Ainda tem"}):null;
        por.onclick=function(){listaAdicionar([x.produto],"compra");listaPrevisao()};
        if(tem)tem.onclick=function(){var a=Object.assign({},PESSOAL.acabandoAdiado||{});a[x.chave]=maisDias(hojeISO(),Math.max(3,Math.round(x.intervalo/2)));
          Object.keys(a).forEach(function(k){if(a[k]<hojeISO())delete a[k]});pessoalGravar("acabandoAdiado",a);listaPrevisao()};
        ul.appendChild(h("li",{class:x.status==="acabando"?"alerta":null,hidden:i>=MAX?"":null},h("span",{class:"grow"},h("b",{text:x.produto}),
          h("span",{class:"sub",text:"você compra a cada ~"+x.intervalo+" dias · a última foi há "+x.dias+(x.dias===1?" dia":" dias")+" ("+dataBR(x.ultima)+")"})),h("span",{class:"vfil"},por,tem)))});
      if(l.length)p.appendChild(ul);
      if(l.length>MAX){var mais=h("button",{type:"button",class:"ghostbtn",text:"Ver todos ("+l.length+")"});mais.onclick=function(){[].forEach.call(ul.children,function(li){li.hidden=false});mais.remove()};p.appendChild(mais)}
      box.appendChild(p);
      /* mais e menos comprados no último ano */
      var pd=NUCLEO.padraoCompras(hist),d=h("details",{class:"panel famvals"},h("summary",{text:"Mais e menos comprados (último ano)"}));
      function tab(lista,cols,fn){var t=h("table",{class:"famtab"});t.appendChild(h("thead",null,h("tr",null,cols.map(function(c){return h("th",{text:c})}))));
        t.appendChild(h("tbody",null,lista.map(function(x){return h("tr",null,fn(x).map(function(v){return h("td",{text:v})}))})));return h("div",{class:"famtabw"},t)}
      d.appendChild(h("h3",{class:"mbag",text:"Os que mais aparecem nas suas notas"}));
      d.appendChild(tab(pd.mais,["Produto","Compras","Gasto","Última"],function(x){return [x.produto,x.vezes+"×",brl(x.gasto),dataBR(x.ultima)]}));
      if(pd.menos.length){d.appendChild(h("h3",{class:"mbag",text:"Comprados uma vez só"}));d.appendChild(tab(pd.menos,["Produto","Gasto","Quando"],function(x){return [x.produto,brl(x.gasto),dataBR(x.ultima)]}))}
      d.appendChild(h("p",{class:"sub",text:pd.total+" produtos diferentes no último ano."}));box.appendChild(d)
    }).catch(function(e){logErro("lista (previsão)",e)})}
  /* ===== Atalhos do iPhone: a Siri e a nota compartilhada mandam itens direto para esta lista ===== */
  function listaAtalhos(){
    var d=h("details",{class:"panel famvals"},h("summary",{text:"📱 Siri e a nota do iPhone"}));
    var URL=((window.RACmercado||{}).url||"")+"/functions/v1/garmin",PUB=(window.RACmercado||{}).chave||"";
    d.appendChild(h("p",{class:"sub",text:"Dois atalhos no app Atalhos do iPhone: um para falar com a Siri (\"E aí Siri, Lista RAC\" → \"leite, pão e café\") e outro que lê a nota compartilhada \"Lista de compras\" toda vez que o Notas é fechado e traz para cá só o que for novo. A chave abaixo é o que libera os atalhos; ela vale para a casa toda (pode instalar no iPhone da Fernanda também)."}));
    var st=h("p",{class:"sub",role:"status"}),gerar=h("button",{type:"button",text:PESSOAL.atalho?"Criar uma chave nova":"Criar a chave dos atalhos"}),out=h("div",{class:"stack"});
    if(PESSOAL.atalho)st.textContent="Chave criada em "+dataBR(String(PESSOAL.atalho.criado).slice(0,10))+". Por segurança ela só aparece na hora de criar; se perdeu, crie uma nova (a antiga para de funcionar).";
    function campo(rot,val){var b=h("button",{type:"button",class:"ghostbtn",text:"Copiar"});b.onclick=function(){try{navigator.clipboard.writeText(val).then(function(){b.textContent="✓ Copiado"})}catch(e){}};
      return h("li",null,h("span",{class:"grow"},h("b",{text:rot}),h("code",{class:"atcod",text:val})),b)}
    gerar.onclick=function(){
      if(PESSOAL.atalho&&!confirm("Criar uma chave nova? Os atalhos que usam a antiga param até você trocar a chave neles."))return;
      var b=new Uint8Array(24);crypto.getRandomValues(b);var tok=btoa(String.fromCharCode.apply(null,b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
      crypto.subtle.digest("SHA-256",new TextEncoder().encode(tok)).then(function(hb){
        var hex=Array.prototype.map.call(new Uint8Array(hb),function(x){return ("0"+x.toString(16)).slice(-2)}).join("");
        pessoalGravar("atalho",{hash:hex,criado:new Date().toISOString()});st.textContent="✓ Chave criada. Copie agora: ela não aparece de novo.";
        out.innerHTML="";out.appendChild(h("ul",{class:"wl"},campo("Endereço (URL)",URL),campo("Cabeçalho apikey",PUB),campo("Cabeçalho x-rac-atalho (a chave)",tok)))})};
    d.appendChild(h("div",{class:"vfil"},gerar));d.appendChild(st);d.appendChild(out);
    var passos=[["Atalho 1 · \"Lista RAC\" (Siri)",["No app Atalhos, toque em + e dê o nome Lista RAC.","Adicione \"Pedir Entrada\" (Ask for Input): tipo Texto, pergunta \"O que precisa comprar?\".",
        "Adicione \"Obter Conteúdo do URL\" (Get Contents of URL) com o Endereço acima. Toque na seta: Método POST; em Cabeçalhos, adicione apikey e x-rac-atalho com os valores acima; Corpo da Solicitação: JSON, com três campos de texto: tipo = lista_add, texto = Entrada Fornecida, formato = texto.",
        "Adicione \"Mostrar Resultado\" (Show Result). Pronto: \"E aí Siri, Lista RAC\" e fale os itens."]],
      ["Atalho 2 · \"Nota para o RAC\" (a nota compartilhada)",["Novo atalho com o nome Nota para o RAC.","Adicione \"Encontrar Notas\" (Find Notes): filtro Nome é Lista de compras, limite 1.",
        "Adicione \"Obter Detalhes das Notas\" (Get Details of Notes) → Corpo (Body).","Adicione \"Obter Conteúdo do URL\" igual ao do atalho 1, mas com tipo = lista_notas e texto = Corpo.",
        "Na aba Automação, toque em +, escolha App → Notas → \"Está Fechado\" → \"Executar Imediatamente\", e como ação \"Executar Atalho\" → Nota para o RAC. Toda vez que vocês fecharem o Notas, o que for novo na nota entra aqui (título, seções como Farmácia: e o que já foi marcado ficam de fora)."]]];
    passos.forEach(function(p){d.appendChild(h("h3",{class:"mbag",text:p[0]}));d.appendChild(h("ol",{class:"how"},p[1].map(function(t){return h("li",{text:t})})))});
    d.appendChild(h("p",{class:"sub",text:"Quando a nota fiscal da compra for lançada no Mercado, o que estiver nesta lista e aparecer na nota é riscado sozinho."}));
    return d}
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
