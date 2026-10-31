# RAC Intelligence

A camada de IA do RAC: um serviço único (`supabase/functions/rac-ia`) que todos os módulos usam pela mesma porta
(`racIA()` em `js/app.js`). Provedor atual: Anthropic (Claude). Plano aprovado em 30/10/2026 (v2 com os ajustes finais).

## Princípios

- **Uma porta só.** Nenhum arquivo do site fala com a Anthropic; só a função `rac-ia` (há teste).
- **O servidor decide.** Quem chama e o papel vêm do login e da tabela `membros`; o modo DEMO/REAL vem de `ia_config`
  e da existência da chave. O que o site mandar em `modo`, `modelo`, `user_id` etc. é ignorado e avisado.
- **A IA nunca grava.** Ela só devolve JSON validado; o RAC mostra a conferência de sempre e só o clique em Salvar grava.
- **DEMO isolado.** Resposta simulada só aparece numa prévia de leitura e nunca chega às funções que salvam.
- **Orçamento em camadas.** Reserva transacional + limite no Console + margens + bloqueio + reconciliação.
  A estimativa do RAC não é a fatura.
- **Sem repetição paga.** SDK com `maxRetries: 0`, chave de idempotência por clique, nada é repetido sozinho.
- **Conteúdo é dado.** Fotos, textos, notícias e e-mails entram entre `<dados>` e nunca mudam as instruções.

## Peças

| Arquivo | Papel |
|---|---|
| `supabase/015_ia.sql` | Tabelas `ia_config`, `ia_precos`, `ia_uso`, `ia_cobranca`, RLS e as funções do orçamento |
| `supabase/functions/rac-ia/index.ts` | Único arquivo com Deno, Supabase e SDK: HTTP, CORS, login, ligação com o banco |
| `supabase/functions/rac-ia/servico.ts` | O caminho de um pedido (banco e provedor injetados; testado com versões falsas) |
| `supabase/functions/rac-ia/contrato.ts` | Contrato v1: validação da requisição, códigos de erro, formato da resposta |
| `supabase/functions/rac-ia/acoes.ts` | Catálogo fechado de ações: modelo, papéis, limites, instruções, JSON obrigatório, validação |
| `supabase/functions/rac-ia/orcamento.ts` | Teto, custo, reserva, alertas, decisão de modo, destino de cada erro |
| `supabase/functions/rac-ia/provedores.ts` | Interface `ProvedorIA` e o adaptador da Anthropic (trocar de provedor = outro adaptador) |
| `supabase/functions/rac-ia/demo.ts` | Respostas simuladas, marcadas como DEMO |
| `js/app.js` | `IA_LIGADA` (feature flag), `racIA()`, `iaFoto()`, `iaBotao()`, `iaPrevia()` |
| `js/sistema.js` | Painel RAC Intelligence (gasto, alertas, modo, incertas, preços, cobrança) |
| `nucleo.js` | `iaAbastTexto()` e `iaNotaTexto()`: resultado REAL → o mesmo texto do fluxo manual |
| `tests/ia.test.mjs` | Testes sem rede e sem custo |

## Ações (v1)

| Ação | Módulo | Modelo | Papéis | Saída máxima | Entrada |
|---|---|---|---|---|---|
| `abastecimento.interpretar` | abastecimento | `claude-haiku-5-5` | dono, casa | 3.000 tokens | até 4 fotos + texto (2.000 caracteres); contexto `veiculo_sugerido`, `ultima_km` |
| `mercado.nota` | mercado | `claude-sonnet-5-5` | dono, casa | 12.000 tokens | até 4 fotos + texto (4.000 caracteres) |

Sem Opus. Sem troca automática de modelo na recusa (`fallbacks` não é enviado). Esforço `low` nas duas.
Quem é da casa (papel `casa`) só usa as ações listadas em `ia_config.acoes_casa`.

## Contrato v1

Requisição (o site nunca manda quem é, nem o modo):

```json
{ "versao": 1, "modulo": "abastecimento", "acao": "abastecimento.interpretar", "idempotencia": "uuid-por-clique",
  "entrada": { "texto": "6,1 litros a 6,29", "imagens": [{ "tipo": "image/jpeg", "base64": "…" }] },
  "contexto": { "veiculo_sugerido": "moto", "ultima_km": 18172 } }
```

Limites: imagens JPEG/PNG/WebP, até ~4,5 MB cada e ~6 MB juntas (o site reduz para 1.568 px antes de mandar);
contexto até 2.000 caracteres e só com as chaves declaradas pela ação; corpo até 8 MB.

Resposta (sempre o mesmo formato; `modo` vem do servidor):

```json
{ "ok": true, "versao": 1, "id": "uuid-da-chamada", "modulo": "abastecimento", "acao": "abastecimento.interpretar",
  "modo": "REAL", "estado": "concluido",
  "resultado": { "veiculo": "moto", "data": null, "km": 18240, "litros": 6.1, "preco_litro": 6.29, "total": 38.37,
                 "combustivel": "gasolina", "posto": "", "alertas": [] },
  "mensagem": "Confira os dados antes de salvar.", "avisos": [],
  "consumo": { "modelo": "claude-haiku-5-5", "uso_api": { "tokens_entrada": 3810, "tokens_saida": 412 },
               "reservado_usd": 0.0031, "estimado_rac_usd": 0.0006, "cobranca_efetiva": null,
               "observacao": "Estimativa do RAC (…). Não é a fatura…",
               "mes": { "comprometido_usd": 1.92, "teto_usd": 6.696429, "percentual": 29, "alerta": 0 } } }
```

DEMO: `"modo": "DEMO"`, `"estado": "demo"`, `resultado._demo: true`, valores obviamente falsos ("POSTO DEMONSTRAÇÃO",
"MERCADO DEMONSTRAÇÃO", km 0), `consumo.uso_api: null`. Erros: `ok: false` e `erro: { codigo, mensagem }` com
`nao_autenticado` (401), `sem_permissao` (403), `entrada_invalida` (400), `muito_grande` (413), `em_andamento` e
`repetida` (409), `limite_de_uso` (429), `orcamento_esgotado` (402), `configuracao` (503), `tempo_esgotado` (504,
estado `incerto`), `provedor_indisponivel` (502), `provedor_ocupado` (503), `provedor_recusou_pedido` (502),
`resposta_invalida` (502), `recusado` (422), `interno` (500).

## Orçamento

- **Teto interno:** `limite_brl ÷ (cambio × (1 + margem_impostos)) × (1 − margem_seguranca)` = 50 ÷ (6,00 × 1,12) × 0,90
  ≈ **US$ 6,70** (configurável em `ia_config`, só o dono altera).
- **Limite no provedor:** US$ 7,00 no Console da Anthropic, sem recarga automática (configurado pelo dono).
- **Reserva antes de cada chamada:** (tokens de entrada × preço de entrada + saída máxima × preço de saída) ×
  (1 + margem de contagem 15%) × fator de correção. Os tokens de entrada vêm da contagem oficial da Anthropic
  (gratuita, mas é uma **estimativa** que pode diferir um pouco do faturado; por isso a margem). Sem a contagem
  oficial, usa a estimativa por excesso: 2 caracteres por token, **4.784 tokens por imagem** e 1.500 de folga.
- **Três números separados:** `reservado_usd` (teto travado), `estimado_usd` (uso informado pela API × `ia_precos`:
  estimativa do RAC, não é fatura) e `ia_cobranca` (o que a Anthropic cobrou, digitado pelo dono do Console).
- **Concorrência:** `ia_reservar()` roda com `pg_advisory_xact_lock` por casa; dentro da trava soma o comprometido do mês
  e só reserva se couber. Duas chamadas ao mesmo tempo esperam a vez. Limites: 2 em andamento por pessoa, 10 por minuto
  por pessoa, 150 por dia por casa.
- **Alertas:** 50%, 80% e 100% na resposta e no painel do Sistema. A 100% a reserva não cabe e a chamada é bloqueada
  (`orcamento_esgotado`); o fluxo manual continua.
- **Preços:** em `ia_precos`, com fonte e data. Conferidos na página oficial em 30/10/2026: Haiku 5.5 US$ 0,10 / 0,50
  por milhão de tokens (até 100 mil tokens de entrada; a função recusa pedidos maiores), Sonnet 5.5 US$ 2 / 10.
  O painel avisa quando a conferência passa de 30 dias.

## Máquina de estados (`ia_uso.estado`)

```
reservado ──► enviando ──► concluido            (resposta da API: sucesso, recusa, resposta inválida, 4xx de pedido)
    │             └──────► incerto ──► reconciliado   (tempo esgotado, rede, 408/409/5xx: pode ter havido cobrança)
    └──► falhou_sem_envio                         (só antes do envio: libera a reserva)
```

- Nada sai de `enviando` ou `incerto` por prazo. `incerto` conta a reserva cheia até o dono reconciliar.
- Reconciliação: só o dono, no Sistema, pelo id da chamada, depois de olhar o uso no Console
  (`ia_reconciliar(id, cobrado, valor)`); também vale para uma chamada parada em `enviando` há mais de 10 minutos.
- Não há repetição: a mesma chave de idempotência devolve `em_andamento` ou `repetida`; tentar de novo é um novo clique,
  com nova reserva.

## Segurança

- `ANTHROPIC_API_KEY` só em Supabase → Edge Functions → Secrets. Nunca no site, JSON, README, Actions ou navegador.
- Funções do orçamento: `SECURITY DEFINER`, `search_path` vazio, EXECUTE revogado de `public`, `anon` e `authenticated`;
  só a chave de servidor (dentro da função) executa. Para quem está logado: só `ia_reconciliar` (checa que é o dono) e
  `ia_totais_mes` (só a casa de quem chama).
- RLS: `ia_config` a casa lê, só o dono altera (UPDATE) e **ninguém cria pelo site** (não há política nem permissão de
  INSERT); `ia_uso` o dono lê a casa, o membro lê o seu, ninguém grava pelo site; `ia_precos` leitura; `ia_cobranca` só o dono.
- **Quem pode usar a IA:** só a casa que tem linha em `ia_config`, e essa linha só nasce pelo SQL Editor (Fase B).
  Uma conta nova (sem ser membro de uma casa, o RAC a trata como dona de uma casa vazia) não tem linha, não consegue
  criar uma e recebe só DEMO: não reserva orçamento e não faz nenhuma chamada à Anthropic (nem a contagem). Há testes.
- **Dois tipos de chamada à Anthropic** (o fluxo REAL é: ler configuração → preço → contagem → reserva → envio → geração):
  - **Contagem de tokens** (`messages.countTokens`): gratuita; acontece **antes** da reserva, para calcular o valor a reservar.
  - **Geração** (`messages.create`): a única que pode gerar cobrança; só acontece **depois** de `ia_reservar` aprovar a
    reserva e de a chamada ser marcada como `enviando`.
- **Duas camadas para o modo REAL:**
  1. **Função rac-ia:** sem linha em `ia_config`, ou com ela fora do modo REAL no momento da leitura, responde DEMO antes
     de buscar o preço, contar tokens, reservar ou gerar: nenhuma chamada à Anthropic.
  2. **Banco:** `ia_reservar` também exige, logo depois da trava e antes da idempotência, dos limites, do teto e da
     gravação, que exista a linha da casa em `ia_config` com `modo = 'REAL'`. Sem linha devolve `configuracao_ausente`;
     com outro modo, `modo_demo`; nos dois casos não grava nada. Assim os valores padrão de `ia_teto_usd` (R$ 50 quando
     falta a linha) nunca servem de autorização, e **não há geração paga sem configuração REAL no momento da reserva**.
  - **A janela entre as duas camadas:** se a função leu REAL, contou os tokens e só então o dono voltou para DEMO (ou a
    configuração sumiu), o banco recusa a reserva. Nesse caso **a contagem gratuita já aconteceu**, mas não há reserva
    gravada nem geração paga. A segunda camada não impede a contagem: impede a geração paga.
  Os testes conferem a estrutura de `ia_reservar` (as verificações, a ordem e o caminho REAL) e falham com a versão antiga;
  e, no fluxo, contam separado as contagens e as gerações, e a ordem: contagem → reserva aprovada → envio → geração.
- A migração roda inteira dentro de `begin … commit` (se algo falhar, nada fica pela metade) e não mexe em tabelas,
  funções ou políticas existentes: só cria e altera objetos `ia_*` (a leitura de `membros` pelo servidor já vem do 014).
- `ia_uso` não guarda conteúdo (texto, foto, resposta): só números, códigos, módulo, ação, modelo e horários.
- Sem ferramentas, sem SQL e sem gravação pelo modelo. A saída é JSON obrigatório (`output_config.format`) e ainda
  passa pela validação do servidor (tipos, faixas, tamanhos, listas fechadas; campos desconhecidos descartados).
- A função `garmin` não foi tocada; a lista de origens do CORS foi copiada para a `rac-ia`.

## Implantação

| Fase | O quê | Quem |
|---|---|---|
| A | Código, testes e documento, num branch local, sem publicar (`IA_LIGADA = false`) | Claude |
| B | Rodar `supabase/015_ia.sql` no SQL Editor; criar a configuração da casa do dono (abaixo); tirar a linha `-- status: pendente` do arquivo; rodar os testes de banco | Dono, depois Claude |
| C | Publicar a `rac-ia` sem a chave, pela CLI (abaixo); trocar `RAC_IA_PUBLICADA` para `true` em `tests/seguranca.test.mjs` | Dono, depois Claude |
| D | Ligar `IA_LIGADA`, publicar o site e testar o DEMO no celular | Claude, depois Dono |
| E | Conta na Anthropic, limite de US$ 7 no Console, sem recarga automática, segredo `ANTHROPIC_API_KEY` | Dono |
| F | Ligar o modo REAL no Sistema; uma leitura de abastecimento; comparar com o Console | Dono |
| G | Nota do mercado em REAL | Dono |

### Fase B: criar a configuração da casa (uma vez, no SQL Editor; nada disto vai para o repositório)

1. Rode o `015_ia.sql` inteiro. Ele termina com `commit`; se aparecer erro, nada foi criado.
2. Descubra o UUID da conta do dono: Authentication → Users → a conta do dono → copie o "User UID"
   (não use o da conta de quem é da casa).
3. Confira que essa conta não é membro de outra casa (tem que voltar 0 linhas):
   `select count(*) from public.membros where membro = 'UUID-DO-DONO';`
4. Crie a configuração, que começa em DEMO, com R$ 50, câmbio 6,00, 12% de impostos e 10% de margem:
   `insert into public.ia_config (dono) values ('UUID-DO-DONO') on conflict (dono) do nothing;`
5. Confira: `select dono, modo, limite_brl from public.ia_config;` (uma linha, modo DEMO).
6. Confira a segunda camada no próprio banco (dentro de uma transação desfeita no fim; não grava nada):

   ```sql
   begin;
   -- uma casa sem configuração: esperado {"ok": false, "codigo": "configuracao_ausente"}
   select public.ia_reservar(gen_random_uuid(), gen_random_uuid(), 'teste-camada-1', 'abastecimento',
     'abastecimento.interpretar', 'claude-haiku-5-5', 0.01, 100, true);
   -- a casa do dono, ainda em DEMO: esperado {"ok": false, "codigo": "modo_demo"}
   select public.ia_reservar('UUID-DO-DONO', 'UUID-DO-DONO', 'teste-camada-2', 'abastecimento',
     'abastecimento.interpretar', 'claude-haiku-5-5', 0.01, 100, true);
   rollback;
   ```

O UUID e o e-mail ficam só no SQL Editor: não entram no repositório nem no site. Quem é da casa usa a mesma configuração
(o papel casa vem da tabela `membros`), limitado às ações de `acoes_casa`.

Publicação da função (no computador do dono, na pasta do projeto; o login abre o navegador):

```
npx supabase@2.121.0 login
npx supabase@2.121.0 functions deploy rac-ia --use-api --project-ref hofnhbxnfebfnncwxrds
```

O editor do painel do Supabase não tem controle de versão (a própria documentação recomenda só para protótipos), então a
`rac-ia` é publicada pela CLI a partir dos arquivos do GitHub. Na Fase C confirmar se a CLI pede `supabase/config.toml`
e se o navegador passa pela verificação de login do gateway (se não passar, publicar com `--no-verify-jwt`: a função
confere o login sozinha).

## Testes

`node --test tests/*.test.mjs` (nenhum gasta dinheiro):

- `ia.test.mjs`: orçamento, reserva com imagens e saída máxima, alertas, modo decidido no servidor, máquina de estados,
  contrato e tamanhos, validação das respostas, instruções contra conteúdo malicioso, DEMO, provedor com cliente falso
  (uma tentativa, JSON obrigatório, sem fallbacks), fluxo completo com banco e provedor falsos (DEMO não grava, sem
  chave vira DEMO, casa limitada, REAL completo, tempo esgotado fica incerto e não repete, 5xx/rede incertos,
  orçamento esgotado e repetição não fazem a geração paga (a contagem gratuita vem antes da reserva), resposta inválida
  não preenche nada, contagem por excesso, a geração só depois de uma reserva aprovada),
  concorrência (30 chamadas ao mesmo tempo nunca passam do teto; sem a trava o teste falha), SQL (search_path, EXECUTE,
  RLS, nenhuma expiração, sem INSERT em `ia_config`, `begin … commit`, `on delete set null`, nada fora dos objetos `ia_*`),
  conta nova sem configuração só em DEMO, a casa (Fernanda) usando as ações liberadas, o Sistema só com UPDATE, e segredos.
- `nucleo.test.mjs` e `mercado.test.mjs`: o resultado REAL passa pela mesma leitura do fluxo manual; DEMO não vira texto.
- `seguranca.test.mjs` e `banco.test.mjs`: depois das Fases B e C, a função recusa sem login, CORS só do site, tabelas e
  funções existem e estão fechadas.
