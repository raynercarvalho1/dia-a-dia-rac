-- Diário do bebê: cada evento do Napper (mamada, mamadeira, fralda, sono, despertar, ordenha, remédio) numa linha.
-- Compartilhado com quem está na casa. A "chave" evita duplicar quando o mesmo CSV é importado de novo.
-- Rode uma vez no SQL Editor, depois do 009_lista.sql.

create table if not exists public.bebe (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.dono_da_casa() references auth.users(id) on delete cascade,
  quem    text not null default 'olivia',
  tipo    text not null,
  inicio  timestamptz not null,
  fim     timestamptz,
  dados   jsonb not null default '{}'::jsonb,
  origem  text not null default 'napper',
  chave   text not null,
  unique (user_id, chave)
);
create index if not exists bebe_quem_inicio on public.bebe (user_id, quem, inicio desc);
alter table public.bebe enable row level security;
drop policy if exists "casa" on public.bebe;
create policy "casa" on public.bebe for all to authenticated
  using (user_id = public.dono_da_casa()) with check (user_id = public.dono_da_casa());
grant select, insert, update, delete on public.bebe to authenticated;
revoke all on public.bebe from anon;

notify pgrst, 'reload schema';
