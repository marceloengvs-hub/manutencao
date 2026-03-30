-- ============================================================
-- Sistema de Manutenção Preventiva - Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Categorias (dynamic)
CREATE TABLE IF NOT EXISTS public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access to categorias"
  ON public.categorias FOR ALL
  USING (auth.role() = 'authenticated');

-- Seed default categories
INSERT INTO public.categorias (nome) VALUES
  ('Impressora 3D FDM'),
  ('Impressora 3D Resina'),
  ('Corte a Laser'),
  ('CNC Router'),
  ('Fresadora CNC'),
  ('Scanner 3D'),
  ('Outro')
ON CONFLICT (nome) DO NOTHING;

-- 3. Equipamentos
CREATE TABLE IF NOT EXISTS public.equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  modelo TEXT NOT NULL DEFAULT '',
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  patrimonio TEXT NOT NULL DEFAULT '',
  descricao TEXT,
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'manutencao')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id)
);

ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access to equipamentos"
  ON public.equipamentos FOR ALL
  USING (auth.role() = 'authenticated');

-- 4. Protocolos
CREATE TABLE IF NOT EXISTS public.protocolos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  periodicidade TEXT NOT NULL DEFAULT 'semanal' CHECK (periodicidade IN ('diaria', 'semanal', 'mensal')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id)
);

ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access to protocolos"
  ON public.protocolos FOR ALL
  USING (auth.role() = 'authenticated');

-- 5. Tarefas do Protocolo
CREATE TABLE IF NOT EXISTS public.tarefas_protocolo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0
);

ALTER TABLE public.tarefas_protocolo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access to tarefas_protocolo"
  ON public.tarefas_protocolo FOR ALL
  USING (auth.role() = 'authenticated');

-- 6. Manutenções (execuções)
CREATE TABLE IF NOT EXISTS public.manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  protocolo_id UUID REFERENCES public.protocolos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'preventiva' CHECK (tipo IN ('preventiva', 'corretiva')),
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  tecnico_id UUID NOT NULL REFERENCES public.profiles(id),
  checklist_json JSONB,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access to manutencoes"
  ON public.manutencoes FOR ALL
  USING (auth.role() = 'authenticated');

-- 7. Evidências fotográficas
CREATE TABLE IF NOT EXISTS public.evidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manutencao_id UUID NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  foto_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access to evidencias"
  ON public.evidencias FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE BUCKETS
-- Create these manually in Supabase Dashboard > Storage:
--   1. Bucket "equipamentos" (Public)
--   2. Bucket "evidencias" (Public)
--
-- Or run in SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('equipamentos', 'equipamentos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('evidencias', 'evidencias', true);
--
-- Storage Policies (allow authenticated uploads):
-- CREATE POLICY "Authenticated uploads" ON storage.objects
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Public read" ON storage.objects
--   FOR SELECT USING (true);
-- ============================================================
