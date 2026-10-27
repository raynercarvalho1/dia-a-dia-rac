-- Dados pessoais do dono do site (aniversários, amigos no X, MBA, e-mails, exercícios).
-- Rode uma vez no SQL Editor, depois do 002_casa_compartilhada.sql.
--
-- Cada linha é um "pacote" (chave) com um JSON. Só a própria conta vê e grava as suas linhas,
-- e quem entrou como membro da casa (a esposa) não grava nada aqui: ela só usa o Mercado.

create table if not exists public.pessoal (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave      text not null,
  valor      jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now(),
  primary key (user_id, chave)
);
alter table public.pessoal enable row level security;

drop policy if exists "so o dono" on public.pessoal;
create policy "so o dono" on public.pessoal for all to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.membros where membro = auth.uid()))
  with check (user_id = auth.uid() and not exists (select 1 from public.membros where membro = auth.uid()));

grant select, insert, update, delete on public.pessoal to authenticated;
revoke all on public.pessoal from anon;
