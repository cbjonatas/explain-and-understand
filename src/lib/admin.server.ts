// Operações administrativas de usuários. Sempre chamadas por server functions
// que já verificaram o papel de admin do solicitante.
export type ManagedUser = {
  id: string;
  nome: string | null;
  email: string | null;
  created_at: string;
  acesso_liberado: boolean;
  acesso_expira_em: string;
  observacao_admin: string | null;
  is_admin: boolean;
  email_confirmado: boolean;
  ultimo_acesso: string | null;
};

export async function assertAdmin(supabase: unknown, userId: string) {
  const { data } = await (supabase as any).rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Área restrita ao administrador.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listUsersFlow(): Promise<ManagedUser[]> {
  const db = await admin();

  const [{ data: profiles, error }, { data: roles }, authList] = await Promise.all([
    db
      .from("profiles")
      .select("id, nome, email, created_at, acesso_liberado, acesso_expira_em, observacao_admin")
      .order("created_at", { ascending: false }),
    db.from("user_roles").select("user_id, role"),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (error) throw error;

  const adminIds = new Set(
    (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
  );
  const authUsers = new Map(
    (authList.data?.users ?? []).map((u) => [
      u.id,
      { confirmado: Boolean(u.email_confirmed_at), ultimo: u.last_sign_in_at ?? null },
    ]),
  );

  return (profiles ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    created_at: p.created_at,
    acesso_liberado: p.acesso_liberado,
    acesso_expira_em: p.acesso_expira_em,
    observacao_admin: p.observacao_admin,
    is_admin: adminIds.has(p.id),
    email_confirmado: authUsers.get(p.id)?.confirmado ?? false,
    ultimo_acesso: authUsers.get(p.id)?.ultimo ?? null,
  }));
}

export async function updateUserFlow(input: {
  userId: string;
  nome?: string | null;
  email?: string | null;
  acessoLiberado?: boolean;
  acessoExpiraEm?: string | null;
  observacao?: string | null;
}): Promise<{ ok: true }> {
  const db = await admin();

  const patch: {
    nome?: string | null;
    email?: string | null;
    acesso_liberado?: boolean;
    acesso_expira_em?: string;
    observacao_admin?: string | null;
  } = {};
  if (input.nome !== undefined) patch.nome = input.nome;
  if (input.email !== undefined) patch.email = input.email;
  if (input.acessoLiberado !== undefined) patch.acesso_liberado = input.acessoLiberado;
  if (input.acessoExpiraEm) patch.acesso_expira_em = input.acessoExpiraEm;
  if (input.observacao !== undefined) patch.observacao_admin = input.observacao;

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("profiles").update(patch).eq("id", input.userId);
    if (error) throw error;
  }

  if (input.email) {
    const { error } = await db.auth.admin.updateUserById(input.userId, { email: input.email });
    if (error) throw new Error(error.message);
  }

  return { ok: true };
}

export async function setPasswordFlow(input: {
  userId: string;
  password: string;
}): Promise<{ ok: true }> {
  const db = await admin();
  const { error } = await db.auth.admin.updateUserById(input.userId, {
    password: input.password,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function sendPasswordResetFlow(input: {
  email: string;
  redirectTo: string;
}): Promise<{ ok: true }> {
  const db = await admin();
  const { error } = await db.auth.resetPasswordForEmail(input.email, {
    redirectTo: input.redirectTo,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
