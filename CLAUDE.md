# Regras do projeto Dia a Dia RAC

Leia o README.md para a arquitetura. Estas são as regras de trabalho.

## Código
- JavaScript ES5 puro, sem framework, sem build e sem dependências novas no site. Bibliotecas só de CDN com versão exata.
- Tudo é global: antes de criar uma função ou variável de topo, procure se o nome já existe (`tests/estrutura` falha se repetir).
- Funções puras e testáveis vão em `nucleo.js` (expostas em `window.RACnucleo`, usadas como `NUCLEO.x`), com teste em `tests/nucleo.test.mjs`.
  Nada de tela nem de banco no núcleo.
- Siga o estilo dos arquivos vizinhos: `h(tag, attrs, ...filhos)`, `panel()`, `wCard()`, textos em português, comentários curtos.
- Todo gráfico novo usa `racDica.ligar`/`racDica.em`, com valor e rótulo fixos em cada barra (há teste).
- Em edições por script Python: caminho e regex como string crua (`r"..."`), senão `\b` vira caractere de controle (há teste).

## Publicação
- Sempre: `node --test tests/*.test.mjs` passando, e `VERSAO` (sw.js) e `MOD_VERSAO` (js/app.js) trocadas juntas.
- SQL novo: arquivo numerado em `supabase/` (pode rodar de novo sem erro), com RLS ligado, `revoke all ... from anon`
  e a tabela incluída em `tests/seguranca.test.mjs`. O dono roda no SQL Editor antes do site ir ao ar.
- Edge Function: o dono republica a função antes do site ir ao ar.
- Commits no `main` como `github-actions[bot]`; `git pull --rebase` antes do push (os robôs também publicam).

## IA (RAC Intelligence, docs/rac-intelligence.md)
- Toda IA passa pela função `rac-ia` e, no site, só por `racIA()`. Nenhum outro arquivo chama a Anthropic (há teste).
- Ação nova = entrada em `acoes.ts` (modelo, papéis, limites, JSON obrigatório, validação) + demonstração em `demo.ts` + testes.
- A IA nunca grava: o resultado vai para a conferência existente e só o clique em Salvar grava. Resposta DEMO nunca chega ao que salva.
- Nada de repetição paga automática, de troca de modelo na recusa nem de liberar reserva incerta por prazo.
- Preços só em `ia_precos` (com fonte e data), nunca no código.

## Segurança (o repositório é público)
- Nunca escrever senhas, chaves secretas, tokens, CPF, documentos, endereço, telefone, placas, chassi, fotos ou exames no repositório.
- A única chave no código é a pública (publishable) do Supabase; a segurança vem do RLS.
- Segredos do servidor só em Edge Functions → Secrets ou no Vault. Nunca pedir ao dono a chave secreta nem a senha do banco.
- Sem automação ou raspagem do LinkedIn; respeitar os termos de cada fonte.
