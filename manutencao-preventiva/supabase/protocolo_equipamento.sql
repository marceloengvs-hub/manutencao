-- ============================================================
-- Relacionar Protocolo a Equipamento Específico
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Adiciona a coluna equipamento_id na tabela protocolos, permitindo
-- associar opcionalmente um protocolo a um ativo específico em vez
-- de apenas uma categoria inteira.

ALTER TABLE public.protocolos
  ADD COLUMN IF NOT EXISTS equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE;
