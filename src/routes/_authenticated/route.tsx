import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LogOut, Radar, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const accessQuery = useQuery({
    queryKey: ["user-access-status", user?.id],
    enabled: Boolean(user?.id) && !isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("acesso_liberado, acesso_expira_em, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) {
        console.warn("Aviso ao verificar acesso:", error);
        return { acesso_liberado: true, acesso_expira_em: null };
      }
      return data;
    },
  });

  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Radar className="size-8 animate-pulse text-primary" />
          <p className="text-xs text-muted-foreground">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  // Admins always have unrestricted access
  if (isAdmin) {
    return <Outlet />;
  }

  const profile = accessQuery.data;
  const now = new Date();
  const isExpired = profile?.acesso_expira_em ? new Date(profile.acesso_expira_em) < now : false;
  const isBlocked = profile ? !profile.acesso_liberado : false;

  // Real Block View for blocked or expired students
  if (!accessQuery.isLoading && (isBlocked || isExpired)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
        <div className="card-surface w-full max-w-md border-amber-500/40 bg-card p-8 text-center shadow-xl">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-500/10 text-amber-500">
            <AlertTriangle className="size-8" />
          </div>

          <h1 className="mt-5 text-xl font-bold tracking-tight text-foreground">
            ⚠️ Seu acesso não está mais válido.
          </h1>

          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Entre em contato com o administrador para renovar seu acesso.
          </p>

          <div className="mt-4 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>
              <strong>Motivo:</strong>{" "}
              {isExpired
                ? `Período de acesso expirado em ${new Date(profile!.acesso_expira_em!).toLocaleDateString("pt-BR")}.`
                : "Acesso bloqueado pelo professor/administrador."}
            </p>
            <p className="mt-1">
              <strong>Conta:</strong> {user?.email}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["user-access-status", user?.id] })}
              disabled={accessQuery.isFetching}
              className="w-full gap-2"
            >
              <RefreshCw className={`size-3.5 ${accessQuery.isFetching ? "animate-spin" : ""}`} />
              Verificar liberação novamente
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="w-full gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Sair da conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
