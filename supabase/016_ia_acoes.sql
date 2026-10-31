-- RAC Intelligence: modo REAL liberado por ação e por papel, no banco (docs/rac-intelligence.md, "Liberação por ação").
-- Rode este arquivo inteiro no SQL Editor depois do 015; pode rodar de novo sem estragar nada. Ele NÃO liga o REAL:
-- as listas novas nascem vazias e o modo da casa continua como está (DEMO).
--
--   acoes_reais        ações que podem rodar em REAL nesta casa. O banco só aceita 'abastecimento.interpretar':
--                      o Mercado fica obrigatoriamente em DEMO (liberar exige um arquivo SQL novo, de propósito).
--   acoes_reais_casa   das liberadas, as que quem é da casa (papel casa) também usa em REAL; precisa estar em acoes_reais.
--
-- O site não altera mais modo, listas, margens de contagem nem fator de correção: o UPDATE pelo site fica limitado
-- aos campos de limite do painel do Sistema. O modo e as listas só mudam aqui, no SQL Editor.
--
-- Se o 015 for rodado de novo, rode este arquivo e o 017 logo depois (o 015 traz as versões antigas das funções).
begin;

-- 1) As listas por ação, vazias: nada fica REAL por causa deste arquivo
alter table public.ia_config add column if not exists acoes_reais text[] not null default '{}';
alter table public.ia_config add column if not exists acoes_reais_casa text[] not null default '{}';
alter table public.ia_config drop constraint if exists ia_config_acoes_reais_permitidas;
alter table public.ia_config add constraint ia_config_acoes_reais_permitidas
  check (acoes_reais <@ array['abastecimento.interpretar']::text[]);
alter table public.ia_config drop constraint if exists ia_config_acoes_reais_casa_liberadas;
alter table public.ia_config add constraint ia_config_acoes_reais_casa_liberadas
  check (acoes_reais_casa <@ acoes_reais);

-- 2) O site só altera os campos de limite (a política "dono altera" do 015 continua: só o dono, só a linha dele)
revoke update on public.ia_config from anon, authenticated;
grant update (limite_brl, cambio_brl_usd, margem_impostos, margem_seguranca, atualizado_em) on public.ia_config to authenticated;

-- 3) ia_reservar: as mesmas regras do 015 e, logo depois do modo REAL, a ação e o papel liberados.
--    Quem chama sem ser o dono da casa (p_user diferente de p_dono) é da casa: precisa de acoes_reais_casa.
create or replace function public.ia_reservar(p_dono uuid, p_user uuid, p_idempotencia text, p_modulo text, p_acao text,
                                              p_modelo text, p_reservado_usd numeric, p_tokens_contados integer, p_contagem_oficial boolean)
  returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_mes date := public.ia_mes_atual();
  v_modo text;
  v_reais text[];
  v_reais_casa text[];
  v_ex public.ia_uso%rowtype;
  v_teto numeric;
  v_comp numeric;
  v_id uuid;
begin
  if p_reservado_usd is null or p_reservado_usd <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'entrada_invalida');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rac-ia:' || p_dono::text, 0));

  /* sem linha em ia_config: nada de reserva; com linha em DEMO (ou qualquer valor que não seja REAL): também não */
  select c.modo into v_modo from public.ia_config c where c.dono = p_dono;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'configuracao_ausente');
  end if;
  if v_modo is distinct from 'REAL' then
    return jsonb_build_object('ok', false, 'codigo', 'modo_demo');
  end if;

  /* a ação precisa estar liberada em REAL; e, para quem é da casa, liberada também para a casa */
  select c.acoes_reais, c.acoes_reais_casa into v_reais, v_reais_casa from public.ia_config c where c.dono = p_dono;
  if p_acao is null or not (p_acao = any (coalesce(v_reais, '{}'))) then
    return jsonb_build_object('ok', false, 'codigo', 'acao_em_demo');
  end if;
  if p_user is distinct from p_dono and not (p_acao = any (coalesce(v_reais_casa, '{}'))) then
    return jsonb_build_object('ok', false, 'codigo', 'papel_em_demo');
  end if;

  select * into v_ex from public.ia_uso where user_id = p_user and idempotencia = p_idempotencia;
  if found then
    return jsonb_build_object('ok', false, 'id', v_ex.id,
      'codigo', case when v_ex.estado in ('reservado', 'enviando') then 'em_andamento' else 'repetida' end);
  end if;

  if (select count(*) from public.ia_uso where user_id = p_user and estado in ('reservado', 'enviando')) >= 2
     or (select count(*) from public.ia_uso where user_id = p_user and criado_em > pg_catalog.now() - interval '1 minute') >= 10
     or (select count(*) from public.ia_uso where dono = p_dono and criado_em > pg_catalog.now() - interval '1 day') >= 150 then
    return jsonb_build_object('ok', false, 'codigo', 'limite_de_uso');
  end if;

  v_teto := public.ia_teto_usd(p_dono);
  v_comp := public.ia_comprometido_usd(p_dono, v_mes);
  if v_comp + p_reservado_usd > v_teto then
    return jsonb_build_object('ok', false, 'codigo', 'orcamento_esgotado', 'comprometido_usd', v_comp, 'teto_usd', v_teto);
  end if;

  insert into public.ia_uso (dono, user_id, idempotencia, modulo, acao, modelo, mes, reservado_usd, tokens_entrada_contados, contagem_oficial)
  values (p_dono, p_user, p_idempotencia, p_modulo, p_acao, p_modelo, v_mes, p_reservado_usd, p_tokens_contados, coalesce(p_contagem_oficial, false))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'comprometido_usd', v_comp + p_reservado_usd, 'teto_usd', v_teto);
end $$;

-- create or replace mantém as permissões; repetidas aqui para o arquivo valer sozinho
revoke execute on function public.ia_reservar(uuid, uuid, text, text, text, text, numeric, integer, boolean) from public, anon, authenticated;
grant execute on function public.ia_reservar(uuid, uuid, text, text, text, text, numeric, integer, boolean) to service_role;

commit;
