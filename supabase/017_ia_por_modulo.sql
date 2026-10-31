-- status: pendente
-- RAC Intelligence: o "Por módulo" do painel com as mesmas regras do "Comprometido no mês" (docs/rac-intelligence.md).
-- Rode este arquivo inteiro no SQL Editor depois do 015 e do 016; pode rodar de novo sem estragar nada.
--
-- O que muda: só a conta de por_modulo dentro de ia_totais_mes(). Antes ela somava estimado_usd (ou a reserva) de todas
-- as chamadas menos as que falharam antes do envio, então uma chamada conferida como NÃO cobrada continuava contando a
-- reserva, uma conferida como cobrada contava a reserva em vez do valor cobrado, e o fator de correção ficava de fora.
-- Agora cada módulo soma do mesmo jeito que ia_comprometido_usd(): concluída = estimado × fator de correção; reservada,
-- em andamento e incerta = reserva cheia; conferida = o valor cobrado (ou zero, se não foi cobrada). A soma dos módulos
-- passa a bater com o comprometido do mês.
--
-- O que NÃO muda: nenhuma tabela, política, permissão de tabela, reserva, idempotência, reconciliação, modo ou lista de
-- ações. Os outros campos de ia_totais_mes() (mes, teto_usd, comprometido_usd, reservado_aberto_usd, estimado_usd,
-- por_estado) ficam idênticos. Nada é gravado.
--
-- Se o 015 for rodado de novo, rode o 016 e este arquivo logo depois (o 015 traz as versões antigas das funções).
begin;

create or replace function public.ia_totais_mes() returns jsonb
  language sql stable security definer set search_path = '' as $$
  with d as (select public.dono_da_casa() as dono, public.ia_mes_atual() as mes)
  select jsonb_build_object(
    'mes', d.mes,
    'teto_usd', public.ia_teto_usd(d.dono),
    'comprometido_usd', public.ia_comprometido_usd(d.dono, d.mes),
    'reservado_aberto_usd', coalesce((select sum(u.reservado_usd) from public.ia_uso u where u.dono = d.dono and u.mes = d.mes and u.estado in ('reservado', 'enviando', 'incerto')), 0),
    'estimado_usd', coalesce((select sum(u.estimado_usd) from public.ia_uso u where u.dono = d.dono and u.mes = d.mes and u.estado = 'concluido'), 0),
    /* por módulo, com as regras de ia_comprometido_usd() (a soma dos módulos é o comprometido do mês) */
    'por_modulo', coalesce((select jsonb_object_agg(x.modulo, x.v) from (select u.modulo, coalesce(sum(case u.estado
           when 'concluido' then coalesce(u.estimado_usd, u.reservado_usd) * coalesce((select c.fator_correcao from public.ia_config c where c.dono = d.dono), 1)
           when 'reservado' then u.reservado_usd
           when 'enviando'  then u.reservado_usd
           when 'incerto'   then u.reservado_usd
           when 'reconciliado' then case when u.reconciliado_cobrado then coalesce(u.reconciliado_usd, u.reservado_usd) else 0 end
           else 0 end), 0) v
                    from public.ia_uso u where u.dono = d.dono and u.mes = d.mes group by u.modulo) x), '{}'::jsonb),
    'por_estado', coalesce((select jsonb_object_agg(x.estado, x.n) from (select u.estado, count(*) n
                    from public.ia_uso u where u.dono = d.dono and u.mes = d.mes group by u.estado) x), '{}'::jsonb))
  from d
$$;

-- create or replace mantém as permissões; repetidas aqui para o arquivo valer sozinho (só quem está logado; nunca anon)
revoke all on function public.ia_totais_mes() from public, anon, authenticated;
grant execute on function public.ia_totais_mes() to authenticated;

commit;
