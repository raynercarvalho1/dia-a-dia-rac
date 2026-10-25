-- Casa compartilhada: o Rayner (dono) e quem ele liberar (ex.: a esposa) veem e lançam nas MESMAS compras.
-- Rode uma vez no SQL Editor, depois do schema.sql.
--
-- Como funciona: a tabela "membros" liga a conta de cada pessoa da casa à conta do dono.
-- Tudo o que alguém da casa grava fica no nome do dono, então existe um só histórico de compras.

create table if not exists public.membros (
  membro uuid primary key references auth.users(id) on delete cascade,
  dono   uuid not null references auth.users(id) on delete cascade,
  check (membro <> dono)
);
alter table public.membros enable row level security;
drop policy if exists "ver minha casa" on public.membros;
create policy "ver minha casa" on public.membros for select to authenticated using (membro = auth.uid() or dono = auth.uid());
grant select on public.membros to authenticated;

-- De quem é a casa de quem está logado: o próprio usuário, ou o dono que o liberou.
create or replace function public.dono_da_casa() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select dono from public.membros where membro = auth.uid()), auth.uid())
$$;
revoke all on function public.dono_da_casa() from public;
grant execute on function public.dono_da_casa() to authenticated;

-- Novas linhas vão para a casa, e as regras de acesso passam a ser "mesma casa" em vez de "mesmo usuário"
do $$
declare t text;
begin
  foreach t in array array['mercados', 'produtos', 'notas', 'itens', 'orcamentos'] loop
    execute format('alter table public.%I alter column user_id set default public.dono_da_casa()', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format('drop policy if exists "casa" on public.%I', t);
    execute format('create policy "casa" on public.%I for all to authenticated using (user_id = public.dono_da_casa()) with check (user_id = public.dono_da_casa())', t);
  end loop;
end $$;

-- A categoria passa a vir do produto padronizado (trocar a categoria de um produto vale para todas as compras dele)
create or replace view public.compras
with (security_invoker = true) as
select i.id, i.user_id, n.data, date_trunc('month', n.data)::date as mes,
       m.nome as mercado, n.numero, n.forma_pagamento,
       coalesce(p.categoria, i.categoria) as categoria, i.descricao, coalesce(p.nome, i.descricao) as produto, i.produto_id,
       i.quantidade, i.unidade, i.valor_unitario, i.valor_total, i.desconto, i.observacao, i.nota_id
from public.itens i
join public.notas n on n.id = i.nota_id
join public.mercados m on m.id = n.mercado_id
left join public.produtos p on p.id = i.produto_id;
grant select on public.compras to authenticated;
revoke all on public.compras from anon;

-- ============================================================================================
-- LIBERAR A ESPOSA (rode esta parte depois de criar a conta dela em Authentication → Users):
-- troque EMAIL_DA_ESPOSA pelo e-mail que você usou para ela.
--
-- insert into public.membros (membro, dono)
-- select m.id, d.id from auth.users m, auth.users d
-- where m.email = 'EMAIL_DA_ESPOSA' and d.email = 'rayner.a.carvalho@gmail.com'
-- on conflict (membro) do update set dono = excluded.dono;
-- ============================================================================================
