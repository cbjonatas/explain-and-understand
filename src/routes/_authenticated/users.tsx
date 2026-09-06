import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, KeyRound, Loader2, Mail, Pencil, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/sentinela/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  listUsers,
  sendUserPasswordReset,
  setUserPassword,
  updateUser,
} from "@/lib/admin.functions";
import type { ManagedUser } from "@/lib/admin.server";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Usuários da plataforma — SENTINELA" },
      {
        name: "description",
        content:
          "Área administrativa para liberar acesso, editar dados e redefinir senhas dos alunos da SENTINELA.",
      },
      { property: "og:title", content: "Usuários — SENTINELA" },
      {
        property: "og:description",
        content: "Gerencie liberação de acesso, dados e senhas dos alunos.",
      },
    ],
  }),
  component: UsersPage,
});

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function statusOf(user: ManagedUser) {
  if (user.acesso_liberado) return { label: "Liberado", variant: "default" as const };
  const restante = new Date(user.acesso_expira_em).getTime() - Date.now();
  if (restante > 0) {
    return {
      label: `Teste · ${Math.ceil(restante / 86400000)} dia(s)`,
      variant: "secondary" as const,
    };
  }
  return { label: "Bloqueado", variant: "destructive" as const };
}

function UsersPage() {
  const { loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchUsers = useServerFn(listUsers);
  const saveUser = useServerFn(updateUser);
  const savePassword = useServerFn(setUserPassword);
  const sendReset = useServerFn(sendUserPasswordReset);

  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [expira, setExpira] = useState("");
  const [observacao, setObservacao] = useState("");
  const [novaSenha, setNovaSenha] = useState("");

  useEffect(() => {
    if (!loading && !adminLoading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [loading, adminLoading, isAdmin, navigate]);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async (): Promise<ManagedUser[]> => {
      const result = await fetchUsers({ data: {} });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const toggleAccess = useMutation({
    mutationFn: async ({ user, liberado }: { user: ManagedUser; liberado: boolean }) => {
      const result = await saveUser({ data: { userId: user.id, acessoLiberado: liberado } });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      toast.success("Acesso atualizado.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveEdits = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const result = await saveUser({
        data: {
          userId: editing.id,
          nome: nome.trim() || null,
          ...(email.trim() && email.trim() !== editing.email ? { email: email.trim() } : {}),
          ...(expira ? { acessoExpiraEm: new Date(`${expira}T23:59:59`).toISOString() } : {}),
          observacao: observacao.trim() || null,
        },
      });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      toast.success("Dados do usuário atualizados.");
      setEditing(null);
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const result = await savePassword({ data: { userId: editing.id, password: novaSenha } });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      toast.success("Senha alterada. Informe a nova senha ao usuário.");
      setNovaSenha("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetEmail = useMutation({
    mutationFn: async (user: ManagedUser) => {
      if (!user.email) throw new Error("Este usuário não tem e-mail cadastrado.");
      const result = await sendReset({
        data: {
          email: user.email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => toast.success("E-mail de redefinição de senha enviado."),
    onError: (error: Error) => toast.error(error.message),
  });

  function openEditor(user: ManagedUser) {
    setEditing(user);
    setNome(user.nome ?? "");
    setEmail(user.email ?? "");
    setExpira(new Date(user.acesso_expira_em).toISOString().slice(0, 10));
    setObservacao(user.observacao_admin ?? "");
    setNovaSenha("");
  }

  if (loading || adminLoading) {
    return (
      <AppShell>
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }
  if (!isAdmin) return null;

  const users = (usersQuery.data ?? []).filter((u) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return `${u.nome ?? ""} ${u.email ?? ""}`.toLowerCase().includes(termo);
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Users className="size-3.5 text-primary" aria-hidden />
            Área administrativa
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Usuários cadastrados
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cada novo aluno tem 30 dias de acesso. Depois desse período, o acesso só continua se
            você liberar aqui.
          </p>
        </header>

        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="max-w-sm"
          />
        </div>

        {usersQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : usersQuery.isError ? (
          <p className="text-sm text-destructive">
            {(usersQuery.error as Error).message}
          </p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {users.map((user) => {
              const status = statusOf(user);
              return (
                <li key={user.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {user.nome || "Sem nome"}
                      {user.is_admin && <Badge variant="outline">Admin</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email ?? "sem e-mail"} · cadastro em {formatDate(user.created_at)} ·
                      acesso até {formatDate(user.acesso_expira_em)} · último acesso{" "}
                      {formatDate(user.ultimo_acesso)}
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" aria-hidden />
                      <Switch
                        checked={user.acesso_liberado}
                        aria-label="Liberar acesso permanente"
                        disabled={toggleAccess.isPending}
                        onCheckedChange={(checked) =>
                          toggleAccess.mutate({ user, liberado: checked })
                        }
                      />
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar usuário"
                      onClick={() => openEditor(user)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Enviar e-mail de nova senha"
                      disabled={resetEmail.isPending}
                      onClick={() => resetEmail.mutate(user)}
                    >
                      <Mail className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-nome">Nome</Label>
              <Input id="user-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">E-mail</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-expira">Acesso válido até</Label>
              <Input
                id="user-expira"
                type="date"
                value={expira}
                onChange={(e) => setExpira(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-obs">Observação interna</Label>
              <Textarea
                id="user-obs"
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor="user-senha" className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" aria-hidden />
                Definir nova senha
              </Label>
              <div className="flex gap-2">
                <Input
                  id="user-senha"
                  type="text"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  variant="outline"
                  disabled={changePassword.isPending || novaSenha.trim().length < 6}
                  onClick={() => changePassword.mutate()}
                >
                  {changePassword.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Alterar"
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={resetEmail.isPending || !editing?.email}
                onClick={() => editing && resetEmail.mutate(editing)}
              >
                <Mail className="mr-2 size-4" aria-hidden />
                Enviar e-mail para o usuário criar nova senha
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={() => saveEdits.mutate()} disabled={saveEdits.isPending}>
              {saveEdits.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
