-- Garante que a função do servidor (papel service_role) lê tudo o que entra no backup de domingo e nos avisos.
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
grant select on public.registros, public.garmin_dia, public.garmin_ativ, public.mercados, public.produtos, public.notas, public.itens,
  public.orcamentos, public.lista, public.bebe, public.pessoal, public.membros to service_role;
grant insert, update on public.garmin_dia, public.garmin_ativ, public.rotina_log, public.erros, public.pessoal to service_role;
notify pgrst, 'reload schema';
