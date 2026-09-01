import type { SupabaseClient } from "@supabase/supabase-js";

import { AiError, callAiJson } from "./sentinela.server";
import type { LanguageProfile } from "./training-types";
import { PROFILE_FIELDS, TRAINING_CATEGORY_LABELS } from "./training-types";

type Db = SupabaseClient<any, "public", any>;

export const TRAINING_SYSTEM = `Você é o motor de aprendizagem de estilo do SENTINELA, em português do Brasil.
Receberá exemplos de materiais e textos escritos pelo próprio usuário (professor/estudante).
Sua tarefa é identificar o ESTILO de linguagem, comunicação e organização dele — nunca julgar o conteúdo factual.

Analise e descreva, de forma objetiva e aplicável (cada campo com 2 a 5 frases, em português do Brasil):
- vocabulario: palavras, termos e expressões recorrentes; nível de formalidade do vocabulário.
- tom: tom de comunicação (direto, acolhedor, professoral, informal...), uso de pessoa verbal, ritmo das frases.
- forma_explicar: como ele conduz uma explicação (do geral ao específico, por perguntas, por comparação...).
- estrutura: estrutura típica dos conteúdos (títulos, tópicos, numeração, blocos, ordem das partes).
- exemplos_analogias: como usa exemplos, casos práticos e analogias.
- destaques: como destaca informações importantes (negrito, caixa alta, "atenção", esquemas, resumos finais...).
- questoes_comentadas: como comenta questões (ordem do raciocínio, tratamento das alternativas, referência à lei/material).
- organizacao_materiais: como organiza e preenche os materiais (campos, rótulos, sequência, padrões de nomeação).
- metodologia: princípios pedagógicos e método de ensino que aparecem nos exemplos.
- resumo: 2 a 4 frases resumindo o estilo dele, como um guia rápido.

Responda SOMENTE com JSON no formato:
{"vocabulario":"...","tom":"...","forma_explicar":"...","estrutura":"...","exemplos_analogias":"...","destaques":"...","questoes_comentadas":"...","organizacao_materiais":"...","metodologia":"...","resumo":"..."}

Se algum aspecto não aparecer nos exemplos, escreva "Ainda sem evidências nos exemplos enviados." nesse campo.`;

const PROFILE_LABELS: Record<string, string> = {
  resumo: "Resumo do estilo",
  vocabulario: "Vocabulário",
  tom: "Tom de comunicação",
  forma_explicar: "Forma de explicar",
  estrutura: "Estrutura dos conteúdos",
  exemplos_analogias: "Exemplos e analogias",
  destaques: "Destaque de informações importantes",
  questoes_comentadas: "Forma de comentar questões",
  organizacao_materiais: "Organização dos materiais",
  metodologia: "Metodologia",
};

const MAX_EXAMPLE_CHARS = 14000;
const MAX_TOTAL_CHARS = 90000;

export async function analyzeLanguageProfileFlow(
  supabase: Db,
  userId: string,
): Promise<LanguageProfile> {
  const { data: examples, error } = await supabase
    .from("training_examples")
    .select("titulo, categoria, texto")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (error) throw new AiError(500, "Não foi possível carregar seus exemplos de treinamento.");

  const usable = (examples ?? []).filter((e: any) => (e.texto ?? "").trim().length >= 100);
  if (usable.length === 0) {
    throw new AiError(
      422,
      "Adicione pelo menos um exemplo ativo com conteúdo suficiente antes de analisar.",
    );
  }

  const blocks: string[] = [];
  let total = 0;
  for (const example of usable) {
    const label =
      TRAINING_CATEGORY_LABELS[example.categoria as keyof typeof TRAINING_CATEGORY_LABELS] ??
      example.categoria;
    const texto = String(example.texto).trim().slice(0, MAX_EXAMPLE_CHARS);
    const block = `--- EXEMPLO (${label}) — "${example.titulo}" ---\n${texto}`;
    if (total + block.length > MAX_TOTAL_CHARS) break;
    blocks.push(block);
    total += block.length;
  }

  const parsed = await callAiJson<Record<string, unknown>>(
    TRAINING_SYSTEM,
    `Exemplos escritos pelo usuário (${blocks.length} de ${usable.length}):\n\n${blocks.join("\n\n")}`,
  );

  const payload: Record<string, unknown> = {
    user_id: userId,
    exemplos_analisados: usable.length,
    editado_manualmente: false,
  };
  for (const field of PROFILE_FIELDS) {
    const value = parsed[field];
    payload[field] = typeof value === "string" && value.trim() ? value.trim().slice(0, 4000) : null;
  }

  const { data: saved, error: saveError } = await supabase
    .from("language_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
  if (saveError || !saved) throw new AiError(500, "Não foi possível salvar o perfil de linguagem.");

  return saved as LanguageProfile;
}

/**
 * Style reference injected into other SENTINELA prompts. Never overrides the
 * factual source (the study material) — it only shapes how the AI writes.
 */
export async function buildStyleGuide(supabase: Db, userId: string | null): Promise<string> {
  if (!userId) return "";
  try {
    const { data } = await supabase
      .from("language_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return "";

    const lines: string[] = [];
    for (const [field, label] of Object.entries(PROFILE_LABELS)) {
      const value = (data as any)[field];
      if (typeof value === "string" && value.trim()) {
        lines.push(`- ${label}: ${value.trim().slice(0, 900)}`);
      }
    }
    if (lines.length === 0) return "";

    return [
      "",
      "ESTILO DE COMUNICAÇÃO DO USUÁRIO (use como referência de linguagem, nunca como fonte de fatos):",
      ...lines,
      "Escreva imitando esse estilo (vocabulário, tom, forma de explicar e de destacar), mas mantenha o rigor factual baseado apenas no material de estudo.",
    ].join("\n");
  } catch (err) {
    console.warn("Aviso ao carregar perfil de linguagem:", err);
    return "";
  }
}
