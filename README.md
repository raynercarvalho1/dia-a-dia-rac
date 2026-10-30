# Dia a Dia RAC

Painel pessoal e da casa do Rayner, publicado em <https://raynercarvalho.com.br> (GitHub Pages).
Esportes, perfis no X, vagas e carreira, mercado, lista de compras, Olivia, Eddie, veículos, documentos,
saúde (relógio Garmin), MBA, agenda, resumo e notificações no celular.

## Como funciona

- **Site estático, sem build.** `index.html` (CSS e telas) + `nucleo.js` (funções puras, testadas) + `mercado.js`
  (Mercado e o cliente do Supabase) + `js/app.js` (rotas `#seção/sub`, login, Início). Os outros módulos de `js/`
  são carregados quando a seção abre (`ROTA_MODS`, `MOD_DEPS` e `precisa()` em `js/app.js`).
- **Os módulos conversam por nomes globais** (sem import/export). Por isso um teste proíbe nome repetido entre arquivos.
- **Dados no Supabase** (Postgres + Auth + Storage). O site usa só a chave pública; quem protege os dados é o RLS
  (cada linha é do dono; a casa compartilhada usa `dono_da_casa()`).
- **Servidor:** uma Edge Function, `supabase/functions/garmin/index.ts` (Garmin, rotina diária, push, atalhos do iPhone).
  Os segredos ficam em Edge Functions → Secrets e no Vault, nunca no repositório.
- **Robôs** (`scripts/*.py`, só biblioteca padrão) rodam no GitHub Actions e gravam `noticias.json`, `tecdados.json`,
  `rumores.json` e `vagas.json`.
- **PWA:** `manifest.webmanifest` + `sw.js` (rede primeiro para o site, cópia guardada para os JSON, push).

## Publicar

1. `node --test tests/*.test.mjs` (tem que passar tudo).
2. Mudar juntas `VERSAO` em `sw.js` e `MOD_VERSAO` em `js/app.js` (o teste confere).
3. Se tiver SQL novo: rodar no Supabase (SQL Editor) **antes** de publicar o site.
4. Se mexeu na Edge Function: publicar a função (Edge Functions → garmin → Code → Deploy) **antes** do site.
5. `git push` no `main`. O Pages publica em cerca de 1 minuto; a página Sistema mostra a versão em uso no aparelho.

## Banco (pasta `supabase/`)

`schema.sql` e depois `002` a `014`, em ordem, no SQL Editor. Cada arquivo pode rodar de novo sem estragar nada.

## Testes (`tests/`)

| Arquivo | O que confere |
|---|---|
| `nucleo.test.mjs`, `mercado.test.mjs`, `fit.test.mjs` | funções puras (leitura de notas, abastecimento, arquivos .FIT…) |
| `estrutura.test.mjs` | nomes repetidos, sintaxe de todos os arquivos, versões iguais, service worker, dados pessoais, padrão dos gráficos |
| `seguranca.test.mjs` | sem login nada é lido nem gravado; a função recusa quem não entrou |
| `banco.test.mjs` | o banco real tem as tabelas, views e funções que os arquivos SQL criam |
| `navegador.test.mjs` | abre o site num navegador de verdade (só no GitHub, com Playwright) e procura erros |

`SEM_REDE=1` pula os testes que acessam o Supabase. Os testes rodam a cada publicação e toda segunda (`.github/workflows/testes.yml`).

## O que nunca vai para este repositório (ele é público)

Senhas, chaves secretas, tokens, CPF, documentos, endereço, telefone, placas, fotos, exames e listas de amigos.
Esses dados ficam no Supabase (com login) ou em `privado/` (ignorado pelo git).
