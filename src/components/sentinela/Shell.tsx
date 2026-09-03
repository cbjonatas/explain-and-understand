import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Radar,
  Shield,
  User,
  UserCog,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  // Query user profile for avatar and name in header
  const profileQuery = useQuery({
    queryKey: ["header-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const profile = profileQuery.data;
  const userName = profile?.nome || (user?.user_metadata?.nome as string) || (user?.user_metadata?.full_name as string) || "";
  const userEmail = profile?.email || user?.email || "";
  const avatarUrl = profile?.avatar_url || (user?.user_metadata?.avatar_url as string) || null;

  const initials = userName
    ? userName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : userEmail.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/dashboard">
            <Brand compact />
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <LayoutDashboard className="size-3.5 hidden sm:inline" />
                Painel
              </Button>
            </Link>

            <Link to="/history">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <History className="size-3.5 hidden sm:inline" />
                Histórico
              </Button>
            </Link>

            {isAdmin && (
              <>
                <Link to="/training">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <GraduationCap className="size-3.5 hidden sm:inline" />
                    Treinamento
                  </Button>
                </Link>
                <Link to="/users">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <Users className="size-3.5 hidden sm:inline" />
                    Usuários
                  </Button>
                </Link>
              </>
            )}

            {/* Direct Perfil Button */}
            <Link to="/profile">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <User className="size-3.5" />
                Meu Perfil
              </Button>
            </Link>

            {/* User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full p-0.5 ring-offset-background transition-all hover:ring-2 hover:ring-primary/40 focus:outline-hidden focus:ring-2 focus:ring-primary"
                  title="Menu do Usuário"
                >
                  <Avatar className="size-8 border border-border bg-muted">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={userName || userEmail} className="object-cover" />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none text-foreground truncate">
                      {userName || "Aluno Sentinela"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {userEmail}
                    </p>
                    {isAdmin && (
                      <Badge className="w-fit mt-1 text-[10px] bg-primary/20 text-primary border-primary/30">
                        <Shield className="size-2.5 mr-1" /> Administrador
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center cursor-pointer">
                    <User className="mr-2 size-4 text-primary" />
                    <span>Meu Perfil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="flex items-center cursor-pointer">
                    <LayoutDashboard className="mr-2 size-4 text-muted-foreground" />
                    <span>Painel de Estudos</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/history" className="flex items-center cursor-pointer">
                    <History className="mr-2 size-4 text-muted-foreground" />
                    <span>Histórico de Análises</span>
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/training" className="flex items-center cursor-pointer">
                        <GraduationCap className="mr-2 size-4 text-primary" />
                        <span>Treinamento da Sentinela</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/users" className="flex items-center cursor-pointer">
                        <Users className="mr-2 size-4 text-primary" />
                        <span>Gestão de Usuários</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-error focus:text-error cursor-pointer"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  <span>Sair da Conta</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
