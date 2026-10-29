-- Atalhos do iPhone (Siri e a nota compartilhada) e o aviso "deve estar acabando":
-- garante que a função do servidor (papel service_role) lê e grava a lista, os dados pessoais e as compras.
-- Rode uma vez no SQL Editor. Pode rodar de novo sem problema.
grant select, insert, update, delete on public.lista, public.pessoal to service_role;
grant select on public.notas, public.itens, public.produtos, public.mercados to service_role;
notify pgrst, 'reload schema';
