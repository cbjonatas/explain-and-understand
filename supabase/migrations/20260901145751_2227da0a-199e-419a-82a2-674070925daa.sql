CREATE TABLE public.training_examples (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  categoria text NOT NULL,
  origem text NOT NULL DEFAULT 'texto',
  arquivo text,
  quantidade_paginas integer,
  texto text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_examples TO authenticated;
GRANT ALL ON public.training_examples TO service_role;
ALTER TABLE public.training_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own training examples" ON public.training_examples FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX training_examples_user_idx ON public.training_examples (user_id, created_at DESC);

CREATE TABLE public.language_profiles (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vocabulario text,
  tom text,
  forma_explicar text,
  estrutura text,
  exemplos_analogias text,
  destaques text,
  questoes_comentadas text,
  organizacao_materiais text,
  resumo text,
  metodologia text,
  editado_manualmente boolean NOT NULL DEFAULT false,
  exemplos_analisados integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.language_profiles TO authenticated;
GRANT ALL ON public.language_profiles TO service_role;
ALTER TABLE public.language_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own language profile" ON public.language_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER training_examples_touch BEFORE UPDATE ON public.training_examples FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER language_profiles_touch BEFORE UPDATE ON public.language_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();