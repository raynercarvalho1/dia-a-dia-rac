-- status: pendente (rodar na Fase B do RAC Intelligence; enquanto isto estiver aqui, tests/banco.test.mjs só lista as tabelas abaixo como pendentes)
-- RAC Intelligence (camada de IA): configuração por casa, preços, uso de cada chamada, cobrança informada pelo dono
-- e as funções que reservam o orçamento. Rode este arquivo inteiro no SQL Editor; pode rodar de novo sem estragar nada.
--
-- Três números que nunca se misturam (docs/rac-intelligence.md):
--   reservado_usd   teto travado antes da chamada (contagem oficial de tokens, que é estimativa, + saída máxima + margens)
--   estimado_usd    uso informado pela API (tokens) × tabela ia_precos  → estimativa do RAC, não é fatura
--   ia_cobranca     o que a Anthropic cobrou de fato, digitado pelo dono a partir do Console
--
-- Máquina de estados de ia_uso.estado:
--   reservado → enviando → concluido
--   reservado → falhou_sem_envio            (só antes do envio: libera a reserva)
--   enviando  → incerto                     (tempo esgotado, rede, erro 5xx: a reserva CONTINUA valendo)
--   incerto   → reconciliado                (só o dono, pelo id da chamada, no Sistema; idem "enviando" parado há 10+ min)
-- Nada sai de "enviando" ou "incerto" por prazo.
--
-- Quem usa a IA: só a casa que tiver uma linha em ia_config. O site NÃO cria essa linha (não há permissão de inserir):
-- o administrador cria a do dono uma única vez no SQL Editor, na Fase B (docs/rac-intelligence.md). Sem linha, a função
-- rac-ia responde só em DEMO, então uma conta nova não consegue consumir a IA.
--
-- Tudo dentro de uma transação: se qualquer comando falhar, nada fica criado pela metade.
begin;

-- 1) Configuração por casa (só o dono altera; quem é da casa lê; ninguém cria pelo site)
create table if not exists public.ia_config (
  dono              uuid primary key references auth.users(id) on delete cascade,
  modo              text not null default 'DEMO' check (modo in ('DEMO', 'REAL')),
  limite_brl        numeric(10,2) not null default 50    check (limite_brl >= 0 and limite_brl <= 500),
  cambio_brl_usd    numeric(10,4) not null default 6.00  check (cambio_brl_usd > 0),
  margem_impostos   numeric(5,4)  not null default 0.12  check (margem_impostos >= 0 and margem_impostos <= 1),
  margem_seguranca  numeric(5,4)  not null default 0.10  check (margem_seguranca >= 0 and margem_seguranca <= 0.9),
  margem_contagem   numeric(5,4)  not null default 0.15  check (margem_contagem >= 0 and margem_contagem <= 1),
  fator_correcao    numeric(6,4)  not null default 1.0   check (fator_correcao >= 1 and fator_correcao <= 3),
  acoes_casa        text[] not null default array['abastecimento.interpretar', 'mercado.nota'],
  atualizado_em     timestamptz not null default now()
);
alter table public.ia_config enable row level security;
drop policy if exists "casa le" on public.ia_config;
create policy "casa le" on public.ia_config for select to authenticated using (dono = public.dono_da_casa());
-- sem política de inserção: a linha da casa só nasce pelo SQL Editor (o drop remove a de versões anteriores deste arquivo)
drop policy if exists "dono cria" on public.ia_config;
drop policy if exists "dono altera" on public.ia_config;
create policy "dono altera" on public.ia_config for update to authenticated
  using (dono = auth.uid() and not exists (select 1 from public.membros m where m.membro = auth.uid()))
  with check (dono = auth.uid());
revoke all on public.ia_config from anon, authenticated;
grant select, update on public.ia_config to authenticated;

-- 2) Preços por modelo (USD por milhão de tokens). Conferidos na página oficial; trocar aqui quando mudarem.
create table if not exists public.ia_precos (
  modelo            text primary key,
  provedor          text not null default 'anthropic',
  entrada_usd_mtok  numeric(10,4) not null check (entrada_usd_mtok > 0),
  saida_usd_mtok    numeric(10,4) not null check (saida_usd_mtok > 0),
  max_entrada_tokens integer not null check (max_entrada_tokens > 0),
  fonte             text not null,
  conferido_em      date not null
);
alter table public.ia_precos enable row level security;
drop policy if exists "logados leem" on public.ia_precos;
create policy "logados leem" on public.ia_precos for select to authenticated using (true);
revoke all on public.ia_precos from anon, authenticated;
grant select on public.ia_precos to authenticated;
-- Haiku 5.5: este preço vale para pedidos de até 100.000 tokens; a função recusa pedidos maiores (max_entrada_tokens).
insert into public.ia_precos (modelo, entrada_usd_mtok, saida_usd_mtok, max_entrada_tokens, fonte, conferido_em) values
  ('claude-haiku-5-5',  0.10,  0.50, 100000, 'https://platform.claude.com/docs/en/about-claude/pricing', '2026-10-30'),
  ('claude-sonnet-5-5', 2.00, 10.00, 200000, 'https://platform.claude.com/docs/en/about-claude/pricing', '2026-10-30')
on conflict (modelo) do nothing;

-- 3) Uma linha por chamada paga (o modo DEMO não grava aqui). Sem conteúdo: nada de texto, foto ou resposta.
create table if not exists public.ia_uso (
  id                       uuid primary key default gen_random_uuid(),
  dono                     uuid not null references auth.users(id) on delete cascade,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  idempotencia             text not null check (idempotencia ~ '^[A-Za-z0-9_-]{8,80}$'),
  modulo                   text not null check (modulo ~ '^[a-z_]{2,30}$'),
  acao                     text not null check (acao ~ '^[a-z_]{2,30}\.[a-z_]{2,30}$'),
  modelo                   text not null,
  estado                   text not null default 'reservado'
                             check (estado in ('reservado', 'enviando', 'concluido', 'falhou_sem_envio', 'incerto', 'reconciliado')),
  mes                      date not null,
  criado_em                timestamptz not null default now(),
  enviado_em               timestamptz,
  concluido_em             timestamptz,
  reservado_usd            numeric(12,6) not null check (reservado_usd >= 0),
  tokens_entrada_contados  integer check (tokens_entrada_contados >= 0),
  contagem_oficial         boolean not null default false,
  tokens_entrada           integer check (tokens_entrada >= 0),
  tokens_saida             integer check (tokens_saida >= 0),
  estimado_usd             numeric(12,6) check (estimado_usd >= 0),
  reconciliado_cobrado     boolean,
  reconciliado_usd         numeric(12,6) check (reconciliado_usd >= 0),
  reconciliado_em          timestamptz,
  reconciliado_por         uuid references auth.users(id) on delete set null,
  ms                       integer,
  erro_codigo              text check (erro_codigo is null or erro_codigo ~ '^[a-z_]{2,40}$'),
  unique (user_id, idempotencia)
);
create index if not exists ia_uso_mes on public.ia_uso (dono, mes, estado);
create index if not exists ia_uso_user_criado on public.ia_uso (user_id, criado_em desc);
alter table public.ia_uso enable row level security;
drop policy if exists "dono le a casa, membro le o seu" on public.ia_uso;
create policy "dono le a casa, membro le o seu" on public.ia_uso for select to authenticated
  using (user_id = auth.uid() or dono = auth.uid());
revoke all on public.ia_uso from anon, authenticated;
grant select on public.ia_uso to authenticated;

-- 4) Cobrança efetiva por mês, digitada pelo dono a partir do Console da Anthropic
create table if not exists public.ia_cobranca (
  dono          uuid not null references auth.users(id) on delete cascade,
  mes           date not null,
  valor_usd     numeric(12,4) check (valor_usd >= 0),
  valor_brl     numeric(12,2) check (valor_brl >= 0),
  observacao    text check (length(observacao) <= 300),
  informado_em  timestamptz not null default now(),
  primary key (dono, mes)
);
alter table public.ia_cobranca enable row level security;
drop policy if exists "so o dono" on public.ia_cobranca;
create policy "so o dono" on public.ia_cobranca for all to authenticated
  using (dono = auth.uid() and not exists (select 1 from public.membros m where m.membro = auth.uid()))
  with check (dono = auth.uid() and not exists (select 1 from public.membros m where m.membro = auth.uid()));
revoke all on public.ia_cobranca from anon, authenticated;
grant select, insert, update, delete on public.ia_cobranca to authenticated;

-- o servidor (função rac-ia) só lê configuração e preços; ia_uso ele muda pelas funções abaixo. A leitura de
-- public.membros pelo servidor já existe desde o 014_servidor.sql: este arquivo não mexe em tabelas existentes.
grant select on public.ia_config, public.ia_precos, public.ia_uso to service_role;

-- 5) Funções do orçamento. Todas: SECURITY DEFINER, search_path vazio (nomes completos), EXECUTE revogado de todos
--    e liberado só para quem precisa. As do servidor só a chave de servidor (dentro da Edge Function) executa.

-- teto em USD da casa: limite ÷ (câmbio × (1 + impostos)) × (1 − margem de segurança)
create or replace function public.ia_teto_usd(p_dono uuid) returns numeric
  language sql stable security definer set search_path = '' as $$
  select round(coalesce(c.limite_brl, 50) / (coalesce(c.cambio_brl_usd, 6) * (1 + coalesce(c.margem_impostos, 0.12)))
               * (1 - coalesce(c.margem_seguranca, 0.10)), 6)
  from (select 1) x left join public.ia_config c on c.dono = p_dono
$$;

-- quanto do mês já está comprometido: estimado × fator de correção (concluídas), reserva cheia (abertas e incertas),
-- valor cobrado (reconciliadas como cobradas). Falhas antes do envio e reconciliadas como não cobradas não contam.
create or replace function public.ia_comprometido_usd(p_dono uuid, p_mes date) returns numeric
  language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case u.estado
           when 'concluido' then coalesce(u.estimado_usd, u.reservado_usd) * coalesce((select c.fator_correcao from public.ia_config c where c.dono = p_dono), 1)
           when 'reservado' then u.reservado_usd
           when 'enviando'  then u.reservado_usd
           when 'incerto'   then u.reservado_usd
           when 'reconciliado' then case when u.reconciliado_cobrado then coalesce(u.reconciliado_usd, u.reservado_usd) else 0 end
           else 0 end), 0)
  from public.ia_uso u where u.dono = p_dono and u.mes = p_mes
$$;

-- mês corrente no horário de Brasília
create or replace function public.ia_mes_atual() returns date
  language sql stable security definer set search_path = '' as $$
  select date_trunc('month', pg_catalog.now() at time zone 'America/Sao_Paulo')::date
$$;

-- reserva: trava por casa, confere repetição, limites de uso e orçamento, e só então grava "reservado"
create or replace function public.ia_reservar(p_dono uuid, p_user uuid, p_idempotencia text, p_modulo text, p_acao text,
                                              p_modelo text, p_reservado_usd numeric, p_tokens_contados integer, p_contagem_oficial boolean)
  returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_mes date := public.ia_mes_atual();
  v_ex public.ia_uso%rowtype;
  v_teto numeric;
  v_comp numeric;
  v_id uuid;
begin
  if p_reservado_usd is null or p_reservado_usd <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'entrada_invalida');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rac-ia:' || p_dono::text, 0));

  select * into v_ex from public.ia_uso where user_id = p_user and idempotencia = p_idempotencia;
  if found then
    return jsonb_build_object('ok', false, 'id', v_ex.id,
      'codigo', case when v_ex.estado in ('reservado', 'enviando') then 'em_andamento' else 'repetida' end);
  end if;

  if (select count(*) from public.ia_uso where user_id = p_user and estado in ('reservado', 'enviando')) >= 2
     or (select count(*) from public.ia_uso where user_id = p_user and criado_em > pg_catalog.now() - interval '1 minute') >= 10
     or (select count(*) from public.ia_uso where dono = p_dono and criado_em > pg_catalog.now() - interval '1 day') >= 150 then
    return jsonb_build_object('ok', false, 'codigo', 'limite_de_uso');
  end if;

  v_teto := public.ia_teto_usd(p_dono);
  v_comp := public.ia_comprometido_usd(p_dono, v_mes);
  if v_comp + p_reservado_usd > v_teto then
    return jsonb_build_object('ok', false, 'codigo', 'orcamento_esgotado', 'comprometido_usd', v_comp, 'teto_usd', v_teto);
  end if;

  insert into public.ia_uso (dono, user_id, idempotencia, modulo, acao, modelo, mes, reservado_usd, tokens_entrada_contados, contagem_oficial)
  values (p_dono, p_user, p_idempotencia, p_modulo, p_acao, p_modelo, v_mes, p_reservado_usd, p_tokens_contados, coalesce(p_contagem_oficial, false))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'comprometido_usd', v_comp + p_reservado_usd, 'teto_usd', v_teto);
end $$;

-- marca o envio (chamado logo antes de chamar a Anthropic)
create or replace function public.ia_marcar_envio(p_id uuid) returns boolean
  language sql security definer set search_path = '' as $$
  with x as (update public.ia_uso set estado = 'enviando', enviado_em = pg_catalog.now()
             where id = p_id and estado = 'reservado' returning 1)
  select exists (select 1 from x)
$$;

-- falhou antes do envio: só a partir de "reservado" (nunca de "enviando")
create or replace function public.ia_falhou_sem_envio(p_id uuid, p_erro text) returns boolean
  language sql security definer set search_path = '' as $$
  with x as (update public.ia_uso set estado = 'falhou_sem_envio', concluido_em = pg_catalog.now(), erro_codigo = p_erro
             where id = p_id and estado = 'reservado' returning 1)
  select exists (select 1 from x)
$$;

-- resposta recebida da API (sucesso, recusa ou erro definitivo): grava o uso informado e a estimativa
create or replace function public.ia_concluir(p_id uuid, p_tokens_entrada integer, p_tokens_saida integer, p_estimado_usd numeric,
                                              p_ms integer, p_erro text) returns boolean
  language sql security definer set search_path = '' as $$
  with x as (update public.ia_uso set estado = 'concluido', concluido_em = pg_catalog.now(), tokens_entrada = p_tokens_entrada,
               tokens_saida = p_tokens_saida, estimado_usd = p_estimado_usd, ms = p_ms, erro_codigo = p_erro
             where id = p_id and estado = 'enviando' returning 1)
  select exists (select 1 from x)
$$;

-- sem resposta certa depois do envio: fica incerto, com a reserva cheia
create or replace function public.ia_marcar_incerto(p_id uuid, p_erro text, p_ms integer) returns boolean
  language sql security definer set search_path = '' as $$
  with x as (update public.ia_uso set estado = 'incerto', ms = p_ms, erro_codigo = p_erro
             where id = p_id and estado = 'enviando' returning 1)
  select exists (select 1 from x)
$$;

-- reconciliação pelo dono (pelo site, com o próprio login), pelo id da chamada: incerta (ou presa em "enviando" há mais
-- de 10 minutos, se a função caiu antes de registrar) → cobrada (com valor) ou não cobrada. Nunca acontece sozinha.
create or replace function public.ia_reconciliar(p_id uuid, p_cobrado boolean, p_valor_usd numeric) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if auth.uid() is null or exists (select 1 from public.membros m where m.membro = auth.uid()) then
    raise exception 'só o dono reconcilia' using errcode = '42501';
  end if;
  if p_cobrado is null or (p_cobrado and (p_valor_usd is null or p_valor_usd < 0 or p_valor_usd > 100)) then
    raise exception 'valor inválido' using errcode = '22023';
  end if;
  update public.ia_uso set estado = 'reconciliado', reconciliado_cobrado = p_cobrado,
         reconciliado_usd = case when p_cobrado then p_valor_usd else 0 end,
         reconciliado_em = pg_catalog.now(), reconciliado_por = auth.uid()
   where id = p_id and dono = auth.uid()
     and (estado = 'incerto' or (estado = 'enviando' and enviado_em < pg_catalog.now() - interval '10 minutes'));
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- totais do mês para a tela (casa de quem está logado): teto, comprometido, por módulo, por estado
create or replace function public.ia_totais_mes() returns jsonb
  language sql stable security definer set search_path = '' as $$
  with d as (select public.dono_da_casa() as dono, public.ia_mes_atual() as mes)
  select jsonb_build_object(
    'mes', d.mes,
    'teto_usd', public.ia_teto_usd(d.dono),
    'comprometido_usd', public.ia_comprometido_usd(d.dono, d.mes),
    'reservado_aberto_usd', coalesce((select sum(u.reservado_usd) from public.ia_uso u where u.dono = d.dono and u.mes = d.mes and u.estado in ('reservado', 'enviando', 'incerto')), 0),
    'estimado_usd', coalesce((select sum(u.estimado_usd) from public.ia_uso u where u.dono = d.dono and u.mes = d.mes and u.estado = 'concluido'), 0),
    'por_modulo', coalesce((select jsonb_object_agg(x.modulo, x.v) from (select u.modulo, sum(coalesce(u.estimado_usd, u.reservado_usd)) v
                    from public.ia_uso u where u.dono = d.dono and u.mes = d.mes and u.estado <> 'falhou_sem_envio' group by u.modulo) x), '{}'::jsonb),
    'por_estado', coalesce((select jsonb_object_agg(x.estado, x.n) from (select u.estado, count(*) n
                    from public.ia_uso u where u.dono = d.dono and u.mes = d.mes group by u.estado) x), '{}'::jsonb))
  from d
$$;

revoke all on function public.ia_teto_usd(uuid), public.ia_comprometido_usd(uuid, date), public.ia_mes_atual(),
  public.ia_reservar(uuid, uuid, text, text, text, text, numeric, integer, boolean), public.ia_marcar_envio(uuid),
  public.ia_falhou_sem_envio(uuid, text), public.ia_concluir(uuid, integer, integer, numeric, integer, text),
  public.ia_marcar_incerto(uuid, text, integer), public.ia_reconciliar(uuid, boolean, numeric), public.ia_totais_mes()
  from public, anon, authenticated;
grant execute on function public.ia_teto_usd(uuid), public.ia_comprometido_usd(uuid, date), public.ia_mes_atual(),
  public.ia_reservar(uuid, uuid, text, text, text, text, numeric, integer, boolean), public.ia_marcar_envio(uuid),
  public.ia_falhou_sem_envio(uuid, text), public.ia_concluir(uuid, integer, integer, numeric, integer, text),
  public.ia_marcar_incerto(uuid, text, integer) to service_role;
grant execute on function public.ia_reconciliar(uuid, boolean, numeric), public.ia_totais_mes() to authenticated;

commit;
