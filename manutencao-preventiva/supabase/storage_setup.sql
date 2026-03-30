-- ==============================================
-- CRIAR BUCKETS DE STORAGE
-- Execute no SQL Editor do Supabase Dashboard
-- ==============================================

-- Bucket para fotos de equipamentos (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipamentos', 'equipamentos', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para evidências de manutenção (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- POLÍTICAS DE ACESSO (RLS)
-- ==============================================

-- Qualquer pessoa pode VER as imagens (bucket público)
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id IN ('equipamentos', 'evidencias'));

-- Usuários autenticados podem FAZER UPLOAD
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('equipamentos', 'evidencias'));

-- Usuários autenticados podem ATUALIZAR seus uploads
CREATE POLICY "Authenticated update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('equipamentos', 'evidencias'));

-- Usuários autenticados podem DELETAR seus uploads
CREATE POLICY "Authenticated delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('equipamentos', 'evidencias'));
