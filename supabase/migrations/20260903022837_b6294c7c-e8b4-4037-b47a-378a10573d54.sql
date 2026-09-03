ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acesso_liberado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acesso_expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS observacao_admin text;

UPDATE public.profiles SET acesso_expira_em = created_at + interval '30 days';

CREATE POLICY "admins can read all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));