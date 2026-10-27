-- Eddie e Olivia: guarda os detalhes de saúde de cada registro (valores dos exames, laudo do ultrassom por órgão,
-- remédios da receita, custo da consulta) para a página comparar "como estava × como está".
-- Rode uma vez no SQL Editor, depois do 004_familia.sql.

alter table public.registros add column if not exists dados jsonb;

-- avisa a API do Supabase que a tabela ganhou coluna nova
notify pgrst, 'reload schema';
