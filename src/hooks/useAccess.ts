import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";

export type AccessInfo = {
  liberado: boolean;
  expiraEm: string | null;
  diasRestantes: number | null;
  emTeste: boolean;
};

/** Acesso do aluno: liberado manualmente pelo admin ou dentro dos 30 dias de teste. */
export function useAccess() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const query = useQuery({
    queryKey: ["meu-acesso", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<AccessInfo> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("acesso_liberado, acesso_expira_em")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;

      const expiraEm = data?.acesso_expira_em ?? null;
      const ms = expiraEm ? new Date(expiraEm).getTime() - Date.now() : 0;
      const dentroDoTeste = ms > 0;
      return {
        liberado: Boolean(data?.acesso_liberado) || dentroDoTeste,
        expiraEm,
        diasRestantes: expiraEm ? Math.max(0, Math.ceil(ms / 86400000)) : null,
        emTeste: dentroDoTeste && !data?.acesso_liberado,
      };
    },
  });

  return {
    access: query.data ?? null,
    hasAccess: isAdmin || query.data?.liberado === true,
    loading: loading || adminLoading || (Boolean(user?.id) && query.isLoading),
  };
}
