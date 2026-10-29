-- Sistema do site: registro de falhas, diário da rotina automática, cofre de backups e o agendamento diário.
-- Rode uma vez no SQL Editor, depois do 007_garmin.sql. Não tem nenhum segredo para colar: o que é secreto é
-- gerado aqui mesmo, guardado no Vault do Supabase e nunca aparece no site nem no repositório.

-- 1) Falhas que o site (ou a rotina) encontrou: aparecem na página Sistema
create table if not exists public.erros (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quando   timestamptz not null default now(),
  origem   text not null,
  mensagem text not null,
  detalhe  jsonb,
  aparelho text
);
create index if not exists erros_quando on public.erros (user_id, quando desc);
alter table public.erros enable row level security;
drop policy if exists "so o dono" on public.erros;
create policy "so o dono" on public.erros for all to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.membros where membro = auth.uid()))
  with check (user_id = auth.uid() and not exists (select 1 from public.membros where membro = auth.uid()));
grant select, insert, delete on public.erros to authenticated;
revoke all on public.erros from anon;

-- 2) Diário da rotina automática (Garmin, alertas, backup semanal): só o dono lê; quem grava é a função
create table if not exists public.rotina_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  quando  timestamptz not null default now(),
  ok      boolean not null,
  resumo  jsonb
);
alter table public.rotina_log enable row level security;
drop policy if exists "dono le" on public.rotina_log;
create policy "dono le" on public.rotina_log for select to authenticated using (user_id = auth.uid());
grant select on public.rotina_log to authenticated;
revoke all on public.rotina_log from anon;

-- 3) Cofre dos backups semanais (privado; cada um na pasta da própria conta)
insert into storage.buckets (id, name, public) values ('backups', 'backups', false) on conflict (id) do nothing;
drop policy if exists "backups do dono" on storage.objects;
create policy "backups do dono" on storage.objects for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Senha da rotina: gerada aqui, guardada no Vault; a função confere sem nunca ver o valor
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'rac_rotina') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'rac_rotina');
  end if;
end $$;
create or replace function public.rac_rotina_ok(segredo text) returns boolean
  language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'rac_rotina' and decrypted_secret = segredo)
$$;
revoke all on function public.rac_rotina_ok(text) from public, anon, authenticated;
grant execute on function public.rac_rotina_ok(text) to service_role;

-- 5) Todo dia às 6h de Brasília (9h UTC): chama a função "garmin" no modo rotina
select cron.unschedule('rac-rotina') where exists (select 1 from cron.job where jobname = 'rac-rotina');
select cron.schedule('rac-rotina', '0 9 * * *', $$
  select net.http_post(
    url := 'https://hofnhbxnfebfnncwxrds.supabase.co/functions/v1/garmin',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-rac-rotina', (select decrypted_secret from vault.decrypted_secrets where name = 'rac_rotina')),
    body := '{"tipo":"rotina"}'::jsonb,
    timeout_milliseconds := 120000)
$$);

notify pgrst, 'reload schema';
