-- Notificações push de verdade: cada aparelho que ativar em Sistema → Notificações vira uma linha aqui.
-- A rotina diária (função "garmin") manda o aviso do dia (chuva, agenda) e, no domingo, o resumo da semana.
-- As chaves VAPID são criadas pela própria função na primeira vez e ficam em rac_segredos, que só o servidor lê.
-- Rode uma vez no SQL Editor, depois do 010_bebe.sql.

create table if not exists public.push_inscricoes (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh   text not null,
  auth     text not null,
  aparelho text,
  criado   timestamptz not null default now()
);
alter table public.push_inscricoes enable row level security;
drop policy if exists "so o dono" on public.push_inscricoes;
create policy "so o dono" on public.push_inscricoes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_inscricoes to authenticated;
revoke all on public.push_inscricoes from anon;

-- guardado só para o servidor (sem política: o site não lê nem escreve)
create table if not exists public.rac_segredos (
  chave text primary key,
  valor jsonb not null,
  criado timestamptz not null default now()
);
alter table public.rac_segredos enable row level security;
revoke all on public.rac_segredos from anon, authenticated;

notify pgrst, 'reload schema';
