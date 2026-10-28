-- Relógio Garmin: um resumo por dia (sono, VFC, passos, Body Battery, estresse…) e um registro por atividade.
-- Quem grava é a função "garmin" (supabase/functions/garmin), sempre em nome do dono logado.
-- Rode uma vez no SQL Editor, depois do 003_pessoal.sql.

create table if not exists public.garmin_dia (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       date not null,
  dados      jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now(),
  primary key (user_id, data)
);

create table if not exists public.garmin_ativ (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         bigint not null,
  inicio     timestamp not null,
  tipo       text not null,
  dados      jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);
create index if not exists garmin_ativ_inicio on public.garmin_ativ (user_id, inicio desc);

alter table public.garmin_dia enable row level security;
alter table public.garmin_ativ enable row level security;

-- só o dono (quem não é membro da casa) vê e grava as próprias linhas
drop policy if exists "so o dono" on public.garmin_dia;
create policy "so o dono" on public.garmin_dia for all to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.membros where membro = auth.uid()))
  with check (user_id = auth.uid() and not exists (select 1 from public.membros where membro = auth.uid()));
drop policy if exists "so o dono" on public.garmin_ativ;
create policy "so o dono" on public.garmin_ativ for all to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.membros where membro = auth.uid()))
  with check (user_id = auth.uid() and not exists (select 1 from public.membros where membro = auth.uid()));

grant select, insert, update, delete on public.garmin_dia, public.garmin_ativ to authenticated;
revoke all on public.garmin_dia, public.garmin_ativ from anon;

notify pgrst, 'reload schema';
