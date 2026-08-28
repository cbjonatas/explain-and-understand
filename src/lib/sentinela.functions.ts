import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  analyzeMaterialStructureFlow,
  evaluateFlow,
  generateQuestionFlow,
  processMaterialFlow,
  saveCustomMaterialStructureFlow,
  transcribeFlow,
} from "./sentinela-flow.server";
import { toFlowResult } from "./sentinela-result";
import type { EvaluationResult, MaterialStructure, TopicSummary } from "./sentinela-types";

export const analyzeMaterialStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        nome: z.string().min(1).max(300),
        paginas: z.number().int().min(0).max(5000),
        texto: z.string().min(1).max(600000),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; data: MaterialStructure } | { ok: false; message: string }> =>
      toFlowResult(() => analyzeMaterialStructureFlow(context.supabase, context.userId, data)),
  );

export const saveCustomMaterialStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        nome: z.string().min(1).max(300),
        arquivo: z.string().nullable().default(null),
        paginas: z.number().int().min(0).max(5000),
        texto: z.string().min(1).max(600000),
        grupo: z.string().optional(),
        concurso: z.string().optional(),
        disciplina: z.string().optional(),
        assunto: z.string().optional(),
        topics: z.array(
          z.object({
            nome: z.string().min(1).max(100),
            descricao: z.string().nullable(),
            conceitos_principais: z.array(z.string()),
          }),
        ),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { ok: true; data: { materialId: string; topics: TopicSummary[] } } | { ok: false; message: string }
    > =>
      toFlowResult(() => saveCustomMaterialStructureFlow(context.supabase, context.userId, data)),
  );

export const processMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        nome: z.string().min(1).max(300),
        arquivo: z.string().nullable().default(null),
        paginas: z.number().int().min(0).max(5000),
        texto: z.string().min(1).max(600000),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { ok: true; data: { materialId: string; topics: TopicSummary[] } } | { ok: false; message: string }
    > =>
      toFlowResult(() => processMaterialFlow(context.supabase, context.userId, data)),
  );

export const generateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ topicId: z.string().uuid() }).parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { ok: true; data: { pergunta: string; topicName: string; materialId: string } }
      | { ok: false; message: string }
    > => toFlowResult(() => generateQuestionFlow(context.supabase, data.topicId)),
  );

export const transcribeExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ path: z.string().min(1).max(500) }).parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; data: { text: string } } | { ok: false; message: string }> =>
      toFlowResult(() => transcribeFlow(context.supabase, data.path)),
  );

export const evaluateExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        topicId: z.string().uuid(),
        pergunta: z.string().min(5).max(2000),
        transcription: z.string().min(1).max(40000),
        audioPath: z.string().max(500).nullable().default(null),
        previousExplanationId: z.string().uuid().nullable().default(null),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; data: EvaluationResult } | { ok: false; message: string }> =>
      toFlowResult(() => evaluateFlow(context.supabase, context.userId, data)),
  );
