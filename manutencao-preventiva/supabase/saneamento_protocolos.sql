-- ==============================================================================
-- SANEAMENTO E PADRONIZAÇÃO DE PROTOCOLOS DE MANUTENÇÃO - IPELab MAN
-- Execute este script no SQL Editor do Supabase Dashboard (Dashboard > SQL Editor)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CORREÇÃO DE INCONSISTÊNCIAS CRÍTICAS DE CONTEÚDO
-- ------------------------------------------------------------------------------

-- 1.1 Remover o protocolo FDM incorretamente atrelado à impressora de Resina LD-002H
DELETE FROM public.protocolos
WHERE titulo ILIKE '%Impressoras 3D FDM%'
  AND equipamento_id IN (
    SELECT id FROM public.equipamentos 
    WHERE nome ILIKE '%LD-002%' OR nome ILIKE '%Resina%'
  );

-- 1.2 Remover protocolos com título de "Fibra de corte à laser" que apontavam para CNC Router FCR 3000
-- (Os protocolos oficiais "Preventiva Semanal/Mensal - CNC Router FCR 3000" já existem)
DELETE FROM public.protocolos
WHERE (titulo ILIKE '%Fibra de corte%FCR%' OR titulo ILIKE '%Fibra de corte à laser - FCR 3000%');

-- 1.3 Corrigir periodicidade do protocolo Halot Mage que tem título 'Mensal' mas periodicidade 'semanal'
UPDATE public.protocolos
SET periodicidade = 'mensal'
WHERE titulo ILIKE '%Mensal%Halot Mage%' 
  AND periodicidade = 'semanal';

-- 1.4 Remover protocolo duplicado redundante da Halot Mage (aquele com apenas 4 tarefas residuais)
DELETE FROM public.protocolos
WHERE id IN (
  SELECT p.id 
  FROM public.protocolos p
  JOIN public.equipamentos e ON e.id = p.equipamento_id
  WHERE (e.nome ILIKE '%Halot Mage%' OR p.titulo ILIKE '%Halot Mage%')
    AND p.id IN (
      SELECT protocolo_id 
      FROM public.tarefas_protocolo 
      GROUP BY protocolo_id 
      HAVING count(*) = 4
    )
    AND p.titulo ILIKE '%Mensal%'
);

-- 1.5 Limpar protocolos duplicados em caixa baixa das impressoras de resina LD-002 e LD-006
DELETE FROM public.protocolos
WHERE titulo IN ('Preventiva semanal - LD-002', 'Preventiva semanal - LD-006');

-- ------------------------------------------------------------------------------
-- 2. INSERIR PROTOCOLOS SOB MEDIDA PARA OS NOVOS EQUIPAMENTOS ATIVOS
-- ------------------------------------------------------------------------------

-- 2.1 ELEGOO SATURN 4 ULTRA 16K (SEMANAL)
DO $$
DECLARE
  v_eq_id UUID;
  v_user_id UUID;
  v_cat_id UUID;
  v_proto_id UUID;
BEGIN
  SELECT id INTO v_eq_id FROM public.equipamentos WHERE nome ILIKE '%Saturn 4 Ultra%' LIMIT 1;
  SELECT user_id INTO v_user_id FROM public.equipamentos WHERE id = v_eq_id;
  SELECT id INTO v_cat_id FROM public.categorias WHERE nome ILIKE '%Resina%' LIMIT 1;

  IF v_eq_id IS NOT NULL THEN
    -- Evita duplicar se já existir
    IF NOT EXISTS (SELECT 1 FROM public.protocolos WHERE equipamento_id = v_eq_id AND periodicidade = 'semanal') THEN
      INSERT INTO public.protocolos (titulo, categoria_id, equipamento_id, periodicidade, status, data_inicio, user_id)
      VALUES ('Preventiva Semanal - Elegoo Saturn 4 Ultra 16K', v_cat_id, v_eq_id, 'semanal', 'ativo', CURRENT_DATE, v_user_id)
      RETURNING id INTO v_proto_id;

      INSERT INTO public.tarefas_protocolo (protocolo_id, descricao, ordem) VALUES
        (v_proto_id, 'Inspeção visual e teste de tensão do filme de liberação PFA/FEP do tanque (Vat)', 0),
        (v_proto_id, 'Limpeza da tela LCD de exposição 16K e vidro de proteção com lenço de microfibra e IPA', 1),
        (v_proto_id, 'Checagem e teste do sensor mecânico de detecção de resíduos sólidos no tanque', 2),
        (v_proto_id, 'Limpeza de respingos de resina na mesa de impressão, calhas e gabinete', 3),
        (v_proto_id, 'Verificação do aperto dos parafusos de retenção do tanque e mesa de impressão', 4);
    END IF;

    -- ELEGOO SATURN 4 ULTRA 16K (MENSAL)
    IF NOT EXISTS (SELECT 1 FROM public.protocolos WHERE equipamento_id = v_eq_id AND periodicidade = 'mensal') THEN
      INSERT INTO public.protocolos (titulo, categoria_id, equipamento_id, periodicidade, status, data_inicio, user_id)
      VALUES ('Preventiva Mensal - Elegoo Saturn 4 Ultra 16K', v_cat_id, v_eq_id, 'mensal', 'ativo', CURRENT_DATE, v_user_id)
      RETURNING id INTO v_proto_id;

      INSERT INTO public.tarefas_protocolo (protocolo_id, descricao, ordem) VALUES
        (v_proto_id, 'Limpeza e lubrificação do fuso de esferas e guias lineares duplas do eixo Z com graxa PTFE', 0),
        (v_proto_id, 'Inspeção e teste suave do mecanismo automático de liberação por inclinação (Tilt-Release)', 1),
        (v_proto_id, 'Verificação do ventilador de exaustão e inspeção/substituição do filtro de carvão ativado', 2),
        (v_proto_id, 'Calibração e checagem do nivelamento mecânico do prato de alumínio', 3),
        (v_proto_id, 'Inspeção elétrica da fonte de alimentação e conexões da câmera de monitoramento IA', 4);
    END IF;
  END IF;
END $$;

-- 2.2 ELEGOO MERCURY PLUS V3.0 (LAVAGEM E CURA UV)
DO $$
DECLARE
  v_eq_id UUID;
  v_user_id UUID;
  v_cat_id UUID;
  v_proto_id UUID;
BEGIN
  SELECT id INTO v_eq_id FROM public.equipamentos WHERE nome ILIKE '%Mercury Plus%' LIMIT 1;
  SELECT user_id INTO v_user_id FROM public.equipamentos WHERE id = v_eq_id;
  SELECT id INTO v_cat_id FROM public.categorias WHERE nome ILIKE '%Outro%' LIMIT 1;

  IF v_eq_id IS NOT NULL THEN
    -- Preventiva Semanal Mercury Plus
    IF NOT EXISTS (SELECT 1 FROM public.protocolos WHERE equipamento_id = v_eq_id AND periodicidade = 'semanal') THEN
      INSERT INTO public.protocolos (titulo, categoria_id, equipamento_id, periodicidade, status, data_inicio, user_id)
      VALUES ('Preventiva Semanal - Elegoo Mercury Plus V3.0', v_cat_id, v_eq_id, 'semanal', 'ativo', CURRENT_DATE, v_user_id)
      RETURNING id INTO v_proto_id;

      INSERT INTO public.tarefas_protocolo (protocolo_id, descricao, ordem) VALUES
        (v_proto_id, 'Inspeção visual e filtragem do solvente (IPA/Álcool) no recipiente de lavagem', 0),
        (v_proto_id, 'Limpeza do rotor magnético/hélice do fundo do balde para evitar travamentos por resina curada', 1),
        (v_proto_id, 'Limpeza dos espelhos refletores internos e da cúpula acrílica de proteção UV', 2);
    END IF;

    -- Preventiva Mensal Mercury Plus
    IF NOT EXISTS (SELECT 1 FROM public.protocolos WHERE equipamento_id = v_eq_id AND periodicidade = 'mensal') THEN
      INSERT INTO public.protocolos (titulo, categoria_id, equipamento_id, periodicidade, status, data_inicio, user_id)
      VALUES ('Preventiva Mensal - Elegoo Mercury Plus V3.0', v_cat_id, v_eq_id, 'mensal', 'ativo', CURRENT_DATE, v_user_id)
      RETURNING id INTO v_proto_id;

      INSERT INTO public.tarefas_protocolo (protocolo_id, descricao, ordem) VALUES
        (v_proto_id, 'Higienização profunda do tanque de lavagem selado e descarte/troca do solvente saturado', 0),
        (v_proto_id, 'Teste de funcionamento de todas as fileiras de LEDs UV (405nm) e precisão do timer digital', 1),
        (v_proto_id, 'Teste do sensor de segurança de intertravamento da tampa (desligamento automático dos LEDs)', 2),
        (v_proto_id, 'Inspeção e limpeza do rolamento central do prato giratório de cura 360°', 3);
    END IF;
  END IF;
END $$;

COMMIT;
