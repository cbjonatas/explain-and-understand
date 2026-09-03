import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  UserCheck,
  UserCog,
  Users,
  UserX,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/sentinela/Shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  batchUpdateAccess,
  listUsers,
  sendUserPasswordReset,
  setUserPassword,
  updateUser,
} from "@/lib/admin.functions";
import type { ManagedUser } from "@/lib/admin.server";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Gestão de Usuários — SENTINELA" },
      {
        name: "description",
        content: "Gerenciamento de liberação de acesso, senhas e cadastro de alunos.",
      },
      { property: "og:title", content: "Gestão de Usuários — SENTINELA" },
      { property: "og:description", content: "Painel administrativo de controle de usuários." },
    ],
  }),
  component: UsersManagementPage,
});

function UsersManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const runListUsers = useServerFn(listUsers);
  const runUpdateUser = useServerFn(updateUser);
  const runSetPassword = useServerFn(setUserPassword);
  const runSendPasswordReset = useServerFn(sendUserPasswordReset);
  const runBatchUpdateAccess = useServerFn(batchUpdateAccess);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "expired">("all");

  // Multi-selection state for Batch operations
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchDaysOption, setBatchDaysOption] = useState<"30" | "60" | "90" | "custom">("30");
  const [batchCustomDays, setBatchCustomDays] = useState("30");

  // Modal states
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAcessoLiberado, setEditAcessoLiberado] = useState(false);
  const [editAcessoExpiraEm, setEditAcessoExpiraEm] = useState("");
  const [editObservacao, setEditObservacao] = useState("");

  // Password modal state
  const [passwordModalUser, setPasswordModalUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Password reset email confirmation state
  const [emailResetTarget, setEmailResetTarget] = useState<ManagedUser | null>(null);

  // Protect route: only admin can access
  useEffect(() => {
    if (!authLoading && !adminLoading && !isAdmin) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [authLoading, adminLoading, isAdmin, navigate]);

  // Query: list of all registered users
  const usersQuery = useQuery({
    queryKey: ["admin-users-list"],
    enabled: Boolean(isAdmin),
    queryFn: async (): Promise<ManagedUser[]> => {
      const response = await runListUsers();
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
  });

  // Mutation: update user profile & access
  const updateUserMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      nome?: string | null;
      email?: string;
      acessoLiberado?: boolean;
      acessoExpiraEm?: string;
      observacao?: string | null;
    }) => {
      const response = await runUpdateUser({ data });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Dados e acesso do usuário atualizados com sucesso!");
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["user-access-status"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar usuário.");
    },
  });

  // Mutation: Batch Update Access
  const batchUpdateMutation = useMutation({
    mutationFn: async ({ userIds, dias }: { userIds: string[]; dias: number }) => {
      const response = await runBatchUpdateAccess({
        data: {
          userIds,
          dias,
          acessoLiberado: true,
        },
      });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Acesso liberado com sucesso para ${data.count} aluno(s)!`);
      setSelectedUserIds(new Set());
      setIsBatchModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["user-access-status"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro na liberação em lote.");
    },
  });

  // Mutation: set user password directly
  const setPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; password: string }) => {
      const response = await runSetPassword({ data });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Senha do usuário alterada com sucesso!");
      setPasswordModalUser(null);
      setNewPassword("");
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao definir nova senha.");
    },
  });

  // Mutation: send password reset email
  const sendPasswordResetMutation = useMutation({
    mutationFn: async (userTarget: ManagedUser) => {
      if (!userTarget.email) throw new Error("Usuário não possui e-mail cadastrado.");
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const response = await runSendPasswordReset({
        data: {
          email: userTarget.email,
          redirectTo: `${origin}/auth`,
        },
      });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success(`E-mail de redefinição de senha enviado para ${emailResetTarget?.email}!`);
      setEmailResetTarget(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar e-mail de redefinição.");
    },
  });

  // Quick toggle access mutation
  const toggleAccessMutation = useMutation({
    mutationFn: async ({ userId, liberado }: { userId: string; liberado: boolean }) => {
      const response = await runUpdateUser({
        data: {
          userId,
          acessoLiberado: liberado,
        },
      });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.liberado
          ? "Acesso do usuário liberado!"
          : "Acesso do usuário bloqueado!",
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["user-access-status"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar liberação de acesso.");
    },
  });

  // Helper to open edit modal
  function handleOpenEdit(u: ManagedUser) {
    setEditingUser(u);
    setEditNome(u.nome || "");
    setEditEmail(u.email || "");
    setEditAcessoLiberado(u.acesso_liberado);
    setEditObservacao(u.observacao_admin || "");

    // Format date string for datetime-local input
    if (u.acesso_expira_em) {
      try {
        const dateObj = new Date(u.acesso_expira_em);
        const iso = dateObj.toISOString().slice(0, 16);
        setEditAcessoExpiraEm(iso);
      } catch {
        setEditAcessoExpiraEm("");
      }
    } else {
      setEditAcessoExpiraEm("");
    }
  }

  // Quick extension presets
  function addDaysToExpiration(days: number) {
    const base = new Date();
    base.setDate(base.getDate() + days);
    setEditAcessoExpiraEm(base.toISOString().slice(0, 16));
  }

  // Generate random secure password
  function generateRandomPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
  }

  // Filtered users list
  const filteredUsers = useMemo(() => {
    const list = usersQuery.data ?? [];
    const now = new Date();

    return list.filter((u) => {
      // Search term filter
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        (u.nome && u.nome.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.observacao_admin && u.observacao_admin.toLowerCase().includes(term));

      if (!matchSearch) return false;

      // Status filter
      const isExpired = u.acesso_expira_em ? new Date(u.acesso_expira_em) < now : false;

      if (statusFilter === "active") {
        return u.acesso_liberado && !isExpired;
      }
      if (statusFilter === "blocked") {
        return !u.acesso_liberado;
      }
      if (statusFilter === "expired") {
        return isExpired;
      }

      return true;
    });
  }, [usersQuery.data, searchTerm, statusFilter]);

  // Overall statistics
  const stats = useMemo(() => {
    const list = usersQuery.data ?? [];
    const now = new Date();
    let totalLiberados = 0;
    let totalBloqueados = 0;
    let totalExpirados = 0;
    let totalAdmins = 0;

    for (const u of list) {
      if (u.is_admin) totalAdmins++;
      const isExpired = u.acesso_expira_em ? new Date(u.acesso_expira_em) < now : false;
      if (isExpired) totalExpirados++;
      if (u.acesso_liberado && !isExpired) totalLiberados++;
      if (!u.acesso_liberado) totalBloqueados++;
    }

    return {
      total: list.length,
      liberados: totalLiberados,
      bloqueados: totalBloqueados,
      expirados: totalExpirados,
      admins: totalAdmins,
    };
  }, [usersQuery.data]);

  // Toggle selection for a single user
  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  // Toggle select all filtered users
  function toggleSelectAll() {
    if (selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  }

  // Calculate batch days
  const effectiveBatchDays = useMemo(() => {
    if (batchDaysOption === "custom") {
      const parsed = parseInt(batchCustomDays, 10);
      return isNaN(parsed) || parsed < 1 ? 30 : parsed;
    }
    return parseInt(batchDaysOption, 10);
  }, [batchDaysOption, batchCustomDays]);

  const batchExpirationPreview = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + effectiveBatchDays);
    return d;
  }, [effectiveBatchDays]);

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Shield className="size-3 text-primary" /> Painel do Administrador
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Gestão de Usuários & Acessos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de liberação de acesso, bloqueio em tempo real, liberação em lote e senhas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedUserIds.size > 0 && (
            <Button
              onClick={() => setIsBatchModalOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm animate-fade-in"
            >
              <Zap className="size-3.5" />
              Liberar em Lote ({selectedUserIds.size})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-users-list"] })}
            disabled={usersQuery.isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar lista
          </Button>
        </div>
      </div>

      {/* Batch Selection Banner */}
      {selectedUserIds.size > 0 && (
        <div className="card-surface mt-4 flex flex-wrap items-center justify-between gap-3 border-emerald-500/40 bg-emerald-500/10 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckSquare className="size-4" />
            <span>{selectedUserIds.size} aluno(s) selecionado(s) para ações em lote.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsBatchModalOpen(true)}
              className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <Zap className="size-3.5" />
              Definir validade em lote
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUserIds(new Set())}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Desmarcar todos
            </Button>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="card-surface p-5 border-l-4 border-l-primary">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total de Cadastros</p>
            <Users className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">{stats.total}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{stats.admins} administrador(es)</p>
        </div>

        <div className="card-surface p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Acessos Liberados</p>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-500">{stats.liberados}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Alunos com vigência ativa</p>
        </div>

        <div className="card-surface p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Acessos Bloqueados</p>
            <UserX className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-amber-500">{stats.bloqueados}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Acesso barrado na entrada</p>
        </div>

        <div className="card-surface p-5 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Acessos Expirados</p>
            <Clock className="size-4 text-rose-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-rose-500">{stats.expirados}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Prazo de 30 dias vencido</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[280px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 p-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              statusFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              statusFilter === "active" ? "bg-background text-emerald-500 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Liberados ({stats.liberados})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("blocked")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              statusFilter === "blocked" ? "bg-background text-amber-500 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bloqueados ({stats.bloqueados})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("expired")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              statusFilter === "expired" ? "bg-background text-rose-500 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Expirados ({stats.expirados})
          </button>
        </div>
      </div>

      {/* Users Table / List with Multi-selection */}
      <div className="mt-4 card-surface overflow-hidden p-0 border border-border/80 shadow-sm">
        {usersQuery.isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 text-base font-semibold">Nenhum usuário encontrado</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {searchTerm ? "Tente buscar com outro termo." : "Ainda não há usuários nesta categoria."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleSelectAll}
                      className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      title="Selecionar todos os alunos visíveis"
                    />
                  </th>
                  <th className="px-4 py-3">Aluno / Usuário</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Liberação de Acesso</th>
                  <th className="px-4 py-3">Vigência / Expiração</th>
                  <th className="px-4 py-3">Data Cadastro</th>
                  <th className="px-4 py-3">Observações</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredUsers.map((u) => {
                  const now = new Date();
                  const isExpired = u.acesso_expira_em ? new Date(u.acesso_expira_em) < now : false;
                  const expDate = u.acesso_expira_em ? new Date(u.acesso_expira_em) : null;
                  const isSelected = selectedUserIds.has(u.id);

                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors ${
                        isSelected ? "bg-primary/5" : "hover:bg-muted/10"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUserSelection(u.id)}
                          className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          aria-label={`Selecionar ${u.nome || u.email}`}
                        />
                      </td>

                      {/* Name & Email */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase shrink-0">
                            {u.nome ? u.nome.charAt(0) : u.email?.charAt(0) || "U"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground text-sm">
                                {u.nome || "Sem nome cadastrado"}
                              </span>
                              {u.email_confirmado ? (
                                <span title="E-mail confirmado" className="text-emerald-500">
                                  <CheckCircle2 className="size-3.5" />
                                </span>
                              ) : (
                                <span title="E-mail pendente de confirmação" className="text-amber-500 text-[10px]">
                                  (pendente)
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground">{u.email || "—"}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-3.5">
                        {u.is_admin ? (
                          <Badge className="bg-primary/20 text-primary border-primary/30 font-semibold gap-1 text-[11px]">
                            <ShieldCheck className="size-3" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[11px]">
                            Aluno
                          </Badge>
                        )}
                      </td>

                      {/* Access Toggle */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={u.acesso_liberado}
                            onCheckedChange={(checked) =>
                              toggleAccessMutation.mutate({ userId: u.id, liberado: checked })
                            }
                            disabled={toggleAccessMutation.isPending || u.is_admin}
                            aria-label="Liberar ou bloquear acesso"
                          />
                          <span
                            className={`font-semibold ${
                              u.acesso_liberado ? "text-emerald-500" : "text-amber-500"
                            }`}
                          >
                            {u.acesso_liberado ? "Liberado" : "Bloqueado"}
                          </span>
                        </div>
                      </td>

                      {/* Expiration Date */}
                      <td className="px-4 py-3.5">
                        {expDate ? (
                          <div>
                            <span
                              className={`font-medium ${
                                isExpired ? "text-rose-500 font-semibold" : "text-foreground"
                              }`}
                            >
                              {expDate.toLocaleDateString("pt-BR")} às {expDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              {isExpired ? "⚠️ Acesso expirado" : `Válido até ${expDate.toLocaleDateString("pt-BR")}`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sem expiração definida</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        {u.ultimo_acesso && (
                          <p className="text-[10px] text-muted-foreground">
                            Último login: {new Date(u.ultimo_acesso).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </td>

                      {/* Observation */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        {u.observacao_admin ? (
                          <span className="truncate block text-muted-foreground italic" title={u.observacao_admin}>
                            {u.observacao_admin}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(u)}
                            title="Editar dados e liberação"
                          >
                            <Edit2 className="size-3" />
                            Editar
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                                <MoreVertical className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => handleOpenEdit(u)}>
                                <UserCog className="mr-2 size-3.5 text-primary" /> Editar Dados & Acesso
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setPasswordModalUser(u);
                                  setNewPassword("");
                                }}
                              >
                                <KeyRound className="mr-2 size-3.5 text-amber-500" /> Alterar Senha Diretamente
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setEmailResetTarget(u)}
                                disabled={!u.email}
                              >
                                <Mail className="mr-2 size-3.5 text-emerald-500" /> Reenviar Nova Senha por E-mail
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleAccessMutation.mutate({
                                    userId: u.id,
                                    liberado: !u.acesso_liberado,
                                  })
                                }
                              >
                                {u.acesso_liberado ? (
                                  <>
                                    <UserX className="mr-2 size-3.5 text-amber-500" /> Bloquear Acesso
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="mr-2 size-3.5 text-emerald-500" /> Liberar Acesso
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Batch Access Release */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-emerald-500" />
              Liberar Acesso em Lote
            </DialogTitle>
            <DialogDescription>
              Você está definindo a liberação de acesso para <strong>{selectedUserIds.size} aluno(s) selecionado(s)</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Label className="text-xs font-semibold">Escolha a quantidade de dias de acesso:</Label>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: "30", label: "30 dias", desc: "Padrão 1 mês" },
                { id: "60", label: "60 dias", desc: "2 meses" },
                { id: "90", label: "90 dias", desc: "3 meses" },
                { id: "custom", label: "Personalizado", desc: "Definir dias" },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setBatchDaysOption(opt.id as any)}
                  className={`cursor-pointer rounded-lg border p-3 text-left transition-all ${
                    batchDaysOption === opt.id
                      ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{opt.label}</span>
                    <span className="size-2 rounded-full bg-emerald-500" style={{ opacity: batchDaysOption === opt.id ? 1 : 0 }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              ))}
            </div>

            {batchDaysOption === "custom" && (
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="custom-days-input" className="text-xs font-semibold">
                  Quantidade de dias personalizada:
                </Label>
                <Input
                  id="custom-days-input"
                  type="number"
                  min="1"
                  max="3650"
                  value={batchCustomDays}
                  onChange={(e) => setBatchCustomDays(e.target.value)}
                  placeholder="Ex: 45, 120, 365..."
                  autoFocus
                />
              </div>
            )}

            {/* Expiration Date Preview */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <p className="text-muted-foreground">
                Os alunos selecionados terão acesso liberado até:
              </p>
              <p className="mt-1 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                📅 {batchExpirationPreview.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} (+{effectiveBatchDays} dias)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={batchUpdateMutation.isPending || selectedUserIds.size === 0 || effectiveBatchDays < 1}
              onClick={() => {
                batchUpdateMutation.mutate({
                  userIds: Array.from(selectedUserIds),
                  dias: effectiveBatchDays,
                });
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
            >
              {batchUpdateMutation.isPending ? (
                "Atualizando..."
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Confirmar Liberação ({selectedUserIds.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit User & Access Details */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-primary" />
              Editar Usuário & Liberação de Acesso
            </DialogTitle>
            <DialogDescription>
              Altere o nome, e-mail, status de liberação, prazo de validade e observações internas.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-2">
              {/* Nome & Email */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="user-nome">Nome Completo</Label>
                  <Input
                    id="user-nome"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    placeholder="Ex: João da Silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-email">E-mail de Acesso</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="aluno@email.com"
                  />
                </div>
              </div>

              {/* Status de Liberação */}
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="user-liberacao" className="font-semibold text-sm cursor-pointer">
                      Acesso Liberado à Plataforma
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quando desativado, o aluno é barrado imediatamente na entrada.
                    </p>
                  </div>
                  <Switch
                    id="user-liberacao"
                    checked={editAcessoLiberado}
                    onCheckedChange={setEditAcessoLiberado}
                  />
                </div>
              </div>

              {/* Data de Expiração / Validade */}
              <div className="space-y-2">
                <Label htmlFor="user-expiracao" className="flex items-center justify-between text-xs font-semibold">
                  <span>Data de Expiração do Acesso</span>
                  <span className="text-muted-foreground font-normal">Padrão: 30 dias</span>
                </Label>
                <Input
                  id="user-expiracao"
                  type="datetime-local"
                  value={editAcessoExpiraEm}
                  onChange={(e) => setEditAcessoExpiraEm(e.target.value)}
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => addDaysToExpiration(30)}
                  >
                    +30 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => addDaysToExpiration(60)}
                  >
                    +60 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => addDaysToExpiration(90)}
                  >
                    +90 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => addDaysToExpiration(365)}
                  >
                    +1 ano
                  </Button>
                </div>
              </div>

              {/* Observações Internas */}
              <div className="space-y-1.5">
                <Label htmlFor="user-observacao">Observações do Administrador</Label>
                <Textarea
                  id="user-observacao"
                  value={editObservacao}
                  onChange={(e) => setEditObservacao(e.target.value)}
                  placeholder="Ex: Aluno da Turma PMBA 2026, acesso concedido por bônus..."
                  className="min-h-20 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button
              disabled={updateUserMutation.isPending || !editingUser}
              onClick={() => {
                if (!editingUser) return;
                updateUserMutation.mutate({
                  userId: editingUser.id,
                  nome: editNome.trim() || null,
                  email: editEmail.trim() || undefined,
                  acessoLiberado: editAcessoLiberado,
                  acessoExpiraEm: editAcessoExpiraEm ? new Date(editAcessoExpiraEm).toISOString() : undefined,
                  observacao: editObservacao.trim() || null,
                });
              }}
            >
              {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Change Password Directly */}
      <Dialog open={Boolean(passwordModalUser)} onOpenChange={(open) => !open && setPasswordModalUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-amber-500" />
              Alterar Senha do Usuário
            </DialogTitle>
            <DialogDescription>
              Defina uma nova senha de acesso para <strong>{passwordModalUser?.nome || passwordModalUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass-input">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-pass-input"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={generateRandomPassword}
              >
                <Sparkles className="size-3 text-primary" />
                Gerar Senha Segura
              </Button>

              {newPassword && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs h-8"
                  onClick={() => {
                    navigator.clipboard.writeText(newPassword);
                    toast.success("Senha copiada para a área de transferência!");
                  }}
                >
                  <Copy className="size-3" />
                  Copiar Senha
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModalUser(null)}>
              Cancelar
            </Button>
            <Button
              disabled={setPasswordMutation.isPending || !newPassword || newPassword.length < 6 || !passwordModalUser}
              onClick={() => {
                if (!passwordModalUser) return;
                setPasswordMutation.mutate({
                  userId: passwordModalUser.id,
                  password: newPassword,
                });
              }}
            >
              {setPasswordMutation.isPending ? "Alterando..." : "Definir Nova Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmation Dialog for Sending Password Reset Email */}
      <AlertDialog open={Boolean(emailResetTarget)} onOpenChange={(open) => !open && setEmailResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-emerald-500" />
              Reenviar Link de Nova Senha?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Um e-mail de redefinição de senha será enviado imediatamente para:
              <br />
              <strong className="text-foreground text-sm font-semibold">{emailResetTarget?.email}</strong>
              <br />
              <br />
              O aluno receberá o link seguro oficial para definir sua própria senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendPasswordResetMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => emailResetTarget && sendPasswordResetMutation.mutate(emailResetTarget)}
              disabled={sendPasswordResetMutation.isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {sendPasswordResetMutation.isPending ? (
                "Enviando..."
              ) : (
                <>
                  <Send className="size-3.5" /> Enviar E-mail
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
