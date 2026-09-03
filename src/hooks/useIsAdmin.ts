import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/** Papel de administrador — verificado no banco (tabela user_roles), nunca no cliente. */
export function useIsAdmin() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await (supabase as any).rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return Boolean(data);
    },
  });

  return {
    isAdmin: query.data === true,
    loading: loading || (Boolean(user?.id) && query.isLoading),
  };
}
