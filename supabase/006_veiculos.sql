-- Veículos: o carro e a moto usam a mesma tabela "registros" (e o mesmo cofre de arquivos) do Eddie e da Olivia.
-- Rode uma vez no SQL Editor, depois do 005_registros_dados.sql.

-- a coluna "quem" só aceitava 'eddie' e 'olivia'; agora aceita qualquer nome curto (civic, moto, c3…)
alter table public.registros drop constraint if exists registros_quem_check;
alter table public.registros add constraint registros_quem_check check (quem ~ '^[a-z0-9-]{2,24}$');

notify pgrst, 'reload schema';
