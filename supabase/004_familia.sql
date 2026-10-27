-- Eddie e Olivia: registros (exames, vacinas, consultas, peso, momentos) e os arquivos deles (fotos, PDFs, vídeos curtos).
-- Rode uma vez no SQL Editor, depois do 002_casa_compartilhada.sql.
--
-- Fica tudo na "casa": o Rayner e a esposa veem e lançam juntos (mesma regra do Mercado).
-- Os arquivos ficam num cofre privado (bucket "familia"); só abrem por links temporários para quem está logado.

create table if not exists public.registros (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default public.dono_da_casa() references auth.users(id) on delete cascade,
  quem       text not null check (quem in ('eddie', 'olivia')),
  tipo       text not null,          -- exame, vacina, consulta, peso, momento, midia, nascimento, outro
  data       date not null,
  titulo     text not null,
  detalhes   text,
  valor      text,                   -- resultado, peso, dose…
  proxima    date,                   -- reforço da vacina ou retorno da consulta
  arquivos   jsonb not null default '[]'::jsonb,   -- [{path, nome, tipo, tamanho}]
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index if not exists registros_quem_data on public.registros (user_id, quem, data desc);
alter table public.registros enable row level security;
drop policy if exists "casa" on public.registros;
create policy "casa" on public.registros for all to authenticated
  using (user_id = public.dono_da_casa()) with check (user_id = public.dono_da_casa());
grant select, insert, update, delete on public.registros to authenticated;
revoke all on public.registros from anon;

-- Cofre de arquivos: privado, até 50 MB por arquivo (limite do plano grátis), só imagem, vídeo e PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('familia', 'familia', false, 52428800, array['image/*', 'video/*', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Cada arquivo fica na pasta do dono da casa: <dono>/<eddie|olivia>/<arquivo>
drop policy if exists "familia da casa" on storage.objects;
create policy "familia da casa" on storage.objects for all to authenticated
  using (bucket_id = 'familia' and (storage.foldername(name))[1] = (select public.dono_da_casa())::text)
  with check (bucket_id = 'familia' and (storage.foldername(name))[1] = (select public.dono_da_casa())::text);
