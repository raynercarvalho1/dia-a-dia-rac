-- Controle de mercado do Dia a Dia RAC (Supabase / Postgres).
-- Rode este arquivo inteiro uma vez no SQL Editor do projeto.
-- Cada linha pertence a um usuário (user_id) e a segurança por linha (RLS) garante que
-- só o dono enxerga e altera os próprios dados, mesmo com a chave pública no site.

create extension if not exists pgcrypto;

-- Mercados onde as compras foram feitas
create table if not exists public.mercados (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  cidade     text,
  cnpj       text,
  created_at timestamptz not null default now(),
  unique (user_id, nome)
);

-- Produtos com nome padronizado (o cupom escreve "CAFE PILAO TRAD 500G"; aqui vira "Café Pilão Tradicional 500g")
create table if not exists public.produtos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  categoria  text not null,
  unidade    text not null default 'un' check (unidade in ('un', 'kg', 'l')),
  created_at timestamptz not null default now(),
  unique (user_id, nome)
);

-- Uma nota fiscal (cupom) por compra
create table if not exists public.notas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mercado_id      uuid not null references public.mercados(id) on delete restrict,
  data            date not null,
  numero          text,
  serie           text,
  chave_nfce      text,              -- chave de 44 dígitos do QR Code, quando houver
  forma_pagamento text,
  total           numeric(12,2),     -- total impresso na nota, para conferir com a soma dos itens
  fonte           text not null default 'manual' check (fonte in ('excel', 'qr', 'foto', 'manual')),
  observacao      text,
  created_at      timestamptz not null default now()
);
create unique index if not exists notas_chave_unica on public.notas (user_id, chave_nfce) where chave_nfce is not null;
create unique index if not exists notas_numero_unico on public.notas (user_id, mercado_id, numero, data) where numero is not null;
create index if not exists notas_data on public.notas (user_id, data);

-- Itens de cada nota
create table if not exists public.itens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nota_id         uuid not null references public.notas(id) on delete cascade,
  produto_id      uuid references public.produtos(id) on delete set null,
  descricao       text not null,     -- como veio na nota/Excel
  categoria       text not null,
  quantidade      numeric(12,3) not null,
  unidade         text not null default 'un' check (unidade in ('un', 'kg', 'l')),
  valor_unitario  numeric(12,2) not null,
  valor_total     numeric(12,2) not null,
  desconto        numeric(12,2) not null default 0,
  observacao      text,
  created_at      timestamptz not null default now()
);
create index if not exists itens_nota on public.itens (nota_id);
create index if not exists itens_produto on public.itens (user_id, produto_id);

-- Orçamento mensal por categoria
create table if not exists public.orcamentos (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria  text not null,
  valor      numeric(12,2) not null check (valor >= 0),
  primary key (user_id, categoria)
);

-- Segurança por linha: cada um só vê e mexe no que é seu
do $$
declare t text;
begin
  foreach t in array array['mercados', 'produtos', 'notas', 'itens', 'orcamentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format('create policy "dono" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Acesso pela API: só para quem está logado (o projeto foi criado sem expor tabelas automaticamente).
-- Visitantes sem login (papel anon) não recebem permissão nenhuma.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.mercados, public.produtos, public.notas, public.itens, public.orcamentos to authenticated;
revoke all on public.mercados, public.produtos, public.notas, public.itens, public.orcamentos from anon;

-- Visão pronta para o painel: um item por linha, com data, mercado e mês
create or replace view public.compras
with (security_invoker = true) as
select i.id, i.user_id, n.data, date_trunc('month', n.data)::date as mes,
       m.nome as mercado, n.numero, n.forma_pagamento,
       i.categoria, i.descricao, coalesce(p.nome, i.descricao) as produto, i.produto_id,
       i.quantidade, i.unidade, i.valor_unitario, i.valor_total, i.desconto, i.observacao
from public.itens i
join public.notas n on n.id = i.nota_id
join public.mercados m on m.id = n.mercado_id
left join public.produtos p on p.id = i.produto_id;

grant select on public.compras to authenticated;
revoke all on public.compras from anon;
