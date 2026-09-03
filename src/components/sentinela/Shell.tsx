import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Radar, User } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <Radar className="size-5 text-primary" aria-hidden />
      <span className="font-display text-lg font-bold tracking-tight">SENTINELA</span>
      {!compact && (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Explique. Entenda. Domine.
        </span>
      )}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/dashboard">
            <Brand compact />
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                Painel
              </Button>
            </Link>
            <Link to="/history">
              <Button variant="ghost" size="sm">
                Histórico
              </Button>
            </Link>
            {isAdmin && (
              <>
                <Link to="/training">
                  <Button variant="ghost" size="sm">
                    Treinamento
                  </Button>
                </Link>
                <Link to="/users">
                  <Button variant="ghost" size="sm">
                    Usuários
                  </Button>
                </Link>
              </>
            )}
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="gap-1.5" title="Meu Perfil">
                <User className="size-4" />
                <span className="hidden sm:inline">Perfil</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
