-- Create study_groups table
CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL,
  concurso TEXT DEFAULT 'Geral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_groups TO authenticated;
GRANT ALL ON public.study_groups TO service_role;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_groups' AND policyname = 'own groups'
  ) THEN
    CREATE POLICY "own groups" ON public.study_groups
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create study_subjects table
CREATE TABLE IF NOT EXISTS public.study_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.study_groups ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL,
  disciplina TEXT DEFAULT 'Geral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_subjects TO authenticated;
GRANT ALL ON public.study_subjects TO service_role;
ALTER TABLE public.study_subjects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_subjects' AND policyname = 'own subjects'
  ) THEN
    CREATE POLICY "own subjects" ON public.study_subjects
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add columns to study_materials to link to group and subject
ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.study_groups ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.study_subjects ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS grupo TEXT DEFAULT 'Geral',
ADD COLUMN IF NOT EXISTS concurso TEXT DEFAULT 'Geral',
ADD COLUMN IF NOT EXISTS disciplina TEXT DEFAULT 'Geral';
