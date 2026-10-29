-- Lista de compras e tarefas da casa, compartilhada em tempo real entre o Rayner e quem está na casa (a Fernanda).
-- Rode uma vez no SQL Editor, depois do 008_sistema.sql.

create table if not exists public.lista (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default public.dono_da_casa() references auth.users(id) on delete cascade,
  tipo       text not null default 'compra' check (tipo in ('compra', 'tarefa')),
  item       text not null check (length(item) between 1 and 200),
  qtd        text,
  feito      boolean not null default false,
  feito_em   timestamptz,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  criado     timestamptz not null default now()
);
create index if not exists lista_casa on public.lista (user_id, tipo, feito, criado desc);
alter table public.lista enable row level security;
drop policy if exists "casa" on public.lista;
create policy "casa" on public.lista for all to authenticated
  using (user_id = public.dono_da_casa()) with check (user_id = public.dono_da_casa());
grant select, insert, update, delete on public.lista to authenticated;
revoke all on public.lista from anon;

-- tempo real: quando um marca ou adiciona, a tela do outro atualiza na hora
alter table public.lista replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lista') then
    alter publication supabase_realtime add table public.lista;
  end if;
end $$;

notify pgrst, 'reload schema';
