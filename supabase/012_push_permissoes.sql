-- Garante que a função do servidor (papel service_role) consegue ler e gravar as tabelas das notificações.
-- Rode uma vez no SQL Editor, depois do 011_push.sql. Pode rodar de novo sem problema.
grant select, insert, update, delete on public.push_inscricoes, public.rac_segredos to service_role;
notify pgrst, 'reload schema';
