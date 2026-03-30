-- ============================================================
-- Correção de Foreign Keys para Relacionamentos no Supabase
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Para permitir que o front-end faça o join (relacionamento) com a tabela de perfis (profiles),
-- precisamos que as chaves estrangeiras apontem para public.profiles e não auth.users.

ALTER TABLE public.equipamentos
  DROP CONSTRAINT IF EXISTS equipamentos_user_id_fkey,
  ADD CONSTRAINT equipamentos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.protocolos
  DROP CONSTRAINT IF EXISTS protocolos_user_id_fkey,
  ADD CONSTRAINT protocolos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.manutencoes
  DROP CONSTRAINT IF EXISTS manutencoes_tecnico_id_fkey,
  ADD CONSTRAINT manutencoes_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.profiles(id);
