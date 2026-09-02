import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFlowResult } from "./sentinela-result";
import { analyzeLanguageProfileFlow } from "./training.server";
import type { LanguageProfile } from "./training-types";

export const analyzeLanguageProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({}).optional().parse(data ?? {}))
  .handler(
    async ({
      context,
    }): Promise<{ ok: true; data: LanguageProfile } | { ok: false; message: string }> =>
      toFlowResult(() => analyzeLanguageProfileFlow(context.supabase, context.userId)),
  );
