-- Update handle_new_user trigger to grant 30 days of access automatically on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    nome,
    email,
    acesso_liberado,
    acesso_expira_em
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name'),
    NEW.email,
    true, -- Automaticamente liberado no cadastro
    (now() + interval '30 days') -- 30 dias calculados a partir da data do cadastro
  )
  ON CONFLICT (id) DO UPDATE SET
    acesso_liberado = COALESCE(public.profiles.acesso_liberado, true),
    acesso_expira_em = COALESCE(public.profiles.acesso_expira_em, now() + interval '30 days');
  RETURN NEW;
END; $$;

-- Update defaults on profiles table
ALTER TABLE public.profiles
  ALTER COLUMN acesso_liberado SET DEFAULT true,
  ALTER COLUMN acesso_expira_em SET DEFAULT (now() + interval '30 days');
