import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFlowResult } from "./sentinela-result";
import type { ManagedUser } from "./admin.server";

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ ok: true; data: ManagedUser[] } | { ok: false; message: string }> =>
      toFlowResult(async () => {
        const { assertAdmin, listUsersFlow } = await import("./admin.server");
        await assertAdmin(context.supabase, context.userId);
        return listUsersFlow();
      }),
  );

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        nome: z.string().trim().max(120).nullable().optional(),
        email: z.string().trim().email().max(255).optional(),
        acessoLiberado: z.boolean().optional(),
        acessoExpiraEm: z.string().min(4).optional(),
        observacao: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    toFlowResult(async () => {
      const { assertAdmin, updateUserFlow } = await import("./admin.server");
      await assertAdmin(context.supabase, context.userId);
      return updateUserFlow(data);
    }),
  );

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).max(72) }).parse(data),
  )
  .handler(async ({ data, context }) =>
    toFlowResult(async () => {
      const { assertAdmin, setPasswordFlow } = await import("./admin.server");
      await assertAdmin(context.supabase, context.userId);
      return setPasswordFlow(data);
    }),
  );

export const sendUserPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        redirectTo: z.string().url().max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    toFlowResult(async () => {
      const { assertAdmin, sendPasswordResetFlow } = await import("./admin.server");
      await assertAdmin(context.supabase, context.userId);
      return sendPasswordResetFlow(data);
    }),
  );
