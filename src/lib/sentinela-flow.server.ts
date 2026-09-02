import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AiError,
  EVAL_SYSTEM,
  QUESTION_SYSTEM,
  TOPICS_SYSTEM,
  callAiJson,
  clampInt,
  levelFromScore,
  relevantMaterial,
  transcribeAudioFile,
  weightedScore,
} from "./sentinela.server";
import { buildStyleGuide } from "./training.server";
import type {
  EvaluationItem,
  EvaluationResult,
  MaterialStructure,
  TopicSummary,
} from "./sentinela-types";

type Db = SupabaseClient<any, "public", any>;

export async function analyzeMaterialStructureFlow(
  _supabase: Db,
  _userId: string,
  data: { nome: string; paginas: number; texto: string },
): Promise<MaterialStructure> {
  const texto = data.texto.trim();
  if (texto.length < 200) {
    throw new AiError(
      422,
      "Este PDF não tem texto suficiente para análise. Envie um PDF com conteúdo selecionável.",
    );
  }

  const parsed = await callAiJson<{
    grupo?: string | undefined;
    concurso?: string | undefined;
    disciplina?: string | undefined;
    assunto?: string | undefined;
    topics?: Array<{ nome?: string; descricao?: string; conceitos_principais?: string[] }>;
  }>(TOPICS_SYSTEM, `Texto do material "${data.nome}":\n\n${texto.slice(0, 90000)}`);

  const rawTopics = parsed.topics ?? [];
  const topics = rawTopics
    .filter((t) => t.nome && t.nome.trim().length > 1)
    .slice(0, 12)
    .map((t, index) => ({
      tempId: `topic-${index + 1}-${Date.now()}`,
      nome: t.nome!.trim().slice(0, 80),
      descricao: t.descricao?.trim() ?? null,
      conceitos_principais: (t.conceitos_principais ?? []).slice(0, 8).map((c) => String(c)),
      selected: true,
    }));

  if (topics.length === 0) {
    throw new AiError(422, "Não conseguimos identificar assuntos neste material. Tente outro PDF.");
  }

  return {
    grupo: parsed.grupo?.trim() || `Grupo ${data.nome}`,
    concurso: parsed.concurso?.trim() || "Geral",
    disciplina: parsed.disciplina?.trim() || "Geral",
    assunto: parsed.assunto?.trim() || data.nome,
    topics,
  };
}

export async function saveCustomMaterialStructureFlow(
  supabase: Db,
  userId: string,
  data: {
    nome: string;
    arquivo: string | null;
    paginas: number;
    texto: string;
    grupo?: string | undefined;
    concurso?: string | undefined;
    disciplina?: string | undefined;
    assunto?: string | undefined;
    topics: Array<{ nome: string; descricao: string | null; conceitos_principais: string[] }>;
  },
) {
  const texto = data.texto.trim();
  if (data.topics.length === 0) {
    throw new AiError(422, "Selecione pelo menos um tópico para estudar.");
  }

  const displayName = data.assunto?.trim() || data.nome;

  const insertPayload: Record<string, any> = {
    user_id: userId,
    nome: displayName,
    arquivo: data.arquivo,
    quantidade_paginas: data.paginas,
    texto_extraido: texto.slice(0, 400000),
  };
  if (data.grupo) insertPayload['grupo'] = data.grupo.trim();
  if (data.concurso) insertPayload['concurso'] = data.concurso.trim();
  if (data.disciplina) insertPayload['disciplina'] = data.disciplina.trim();

  let { data: material, error } = await supabase
    .from("study_materials")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error && (error.message?.includes("column") || (error as any).code === "PGRST204")) {
    delete insertPayload['grupo'];
    delete insertPayload['concurso'];
    delete insertPayload['disciplina'];
    const retry = await supabase
      .from("study_materials")
      .insert(insertPayload)
      .select("id")
      .single();
    material = retry.data;
    error = retry.error;
  }

  if (error || !material) throw new AiError(500, "Não foi possível salvar o material.");

  const topicsToInsert = data.topics.map((t) => ({
    material_id: material.id,
    user_id: userId,
    nome: t.nome.trim().slice(0, 80),
    descricao: t.descricao?.trim() ?? null,
    conceitos_principais: t.conceitos_principais.slice(0, 8).map((c) => String(c)),
  }));

  const { data: inserted, error: topicError } = await supabase
    .from("topics")
    .insert(topicsToInsert)
    .select("id, nome, descricao, conceitos_principais");
  if (topicError || !inserted) throw new AiError(500, "Não foi possível salvar os tópicos.");

  return { materialId: material.id as string, topics: inserted as TopicSummary[] };
}

export async function processMaterialFlow(
  supabase: Db,
  userId: string,
  data: { nome: string; arquivo: string | null; paginas: number; texto: string },
) {
  const texto = data.texto.trim();
  if (texto.length < 400) {
    throw new AiError(
      422,
      "Este PDF não tem texto suficiente para análise. Ele pode ser digitalizado (apenas imagens). Envie um PDF com texto selecionável.",
    );
  }

  const { data: material, error } = await supabase
    .from("study_materials")
    .insert({
      user_id: userId,
      nome: data.nome,
      arquivo: data.arquivo,
      quantidade_paginas: data.paginas,
      texto_extraido: texto.slice(0, 400000),
    })
    .select("id")
    .single();
  if (error || !material) throw new AiError(500, "Não foi possível salvar o material.");

  const parsed = await callAiJson<{
    topics?: Array<{ nome?: string; descricao?: string; conceitos_principais?: string[] }>;
  }>(TOPICS_SYSTEM, `Texto do material "${data.nome}":\n\n${texto.slice(0, 90000)}`);

  const topics = (parsed.topics ?? [])
    .filter((t) => t.nome && t.nome.trim().length > 1)
    .slice(0, 10)
    .map((t) => ({
      material_id: material.id,
      user_id: userId,
      nome: t.nome!.trim().slice(0, 80),
      descricao: t.descricao?.trim() ?? null,
      conceitos_principais: (t.conceitos_principais ?? []).slice(0, 8).map((c) => String(c)),
    }));

  if (topics.length === 0) {
    throw new AiError(422, "Não conseguimos identificar assuntos neste material. Tente outro PDF.");
  }

  const { data: inserted, error: topicError } = await supabase
    .from("topics")
    .insert(topics)
    .select("id, nome, descricao, conceitos_principais");
  if (topicError || !inserted) throw new AiError(500, "Não foi possível salvar os assuntos.");

  return { materialId: material.id as string, topics: inserted as TopicSummary[] };
}

async function getAggregatedSubjectText(
  supabase: Db,
  materialId: string,
  initialText: string,
): Promise<string> {
  try {
    const { data: currentMat } = await supabase
      .from("study_materials")
      .select("nome, grupo")
      .eq("id", materialId)
      .single();

    if (!currentMat?.nome) return initialText;

    let query = supabase
      .from("study_materials")
      .select("texto_extraido")
      .eq("nome", currentMat.nome);

    if (currentMat.grupo) {
      query = query.eq("grupo", currentMat.grupo);
    }

    const { data: siblings } = await query;
    if (siblings && siblings.length > 1) {
      const texts = siblings.map((s) => s.texto_extraido).filter(Boolean);
      if (texts.length > 0) return texts.join("\n\n---\n\n");
    }
  } catch (err) {
    console.warn("Aviso ao agregar materiais do mesmo assunto:", err);
  }
  return initialText;
}

export async function generateQuestionFlow(supabase: Db, topicId: string, userId?: string | null) {
  const { data: topic, error } = await supabase
    .from("topics")
    .select("nome, descricao, conceitos_principais, material_id, study_materials(texto_extraido)")
    .eq("id", topicId)
    .single();
  if (error || !topic) throw new AiError(404, "Assunto não encontrado.");

  const rawText = (topic as any).study_materials?.texto_extraido ?? "";
  const materialText = await getAggregatedSubjectText(supabase, topic.material_id, rawText);
  const trecho = relevantMaterial(materialText, topic.nome, topic.conceitos_principais ?? []);
  const styleGuide = await buildStyleGuide(supabase, userId ?? null);

  const parsed = await callAiJson<{ pergunta?: string }>(
    QUESTION_SYSTEM,
    `Assunto: ${topic.nome}\nDescrição: ${topic.descricao ?? "-"}\nConceitos que importam: ${(topic.conceitos_principais ?? []).join(", ")}\n\nTrecho do material:\n${trecho.slice(0, 20000)}${styleGuide}`,
  );

  const pergunta = parsed.pergunta?.trim();
  if (!pergunta) throw new AiError(502, "Não conseguimos gerar a pergunta. Tente novamente.");
  return { pergunta, topicName: topic.nome as string, materialId: topic.material_id as string };
}

export async function transcribeFlow(supabase: Db, path: string) {
  const { data: file, error } = await supabase.storage.from("explanation-audio").download(path);
  if (error || !file) throw new AiError(404, "Não encontramos o áudio enviado. Grave novamente.");
  if (file.size < 2048)
    throw new AiError(422, "A gravação ficou vazia. Verifique o microfone e grave novamente.");
  const text = await transcribeAudioFile(file, path.split("/").pop() ?? "recording.wav");
  return { text };
}

export async function evaluateFlow(
  supabase: Db,
  userId: string,
  data: {
    topicId: string;
    pergunta: string;
    transcription: string;
    audioPath: string | null;
    previousExplanationId: string | null;
  },
) {
  if (data.transcription.trim().length < 40) {
    throw new AiError(
      422,
      "Sua explicação ficou curta demais para uma avaliação justa. Explique com mais detalhes.",
    );
  }

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("id, nome, descricao, conceitos_principais, material_id, study_materials(texto_extraido)")
    .eq("id", data.topicId)
    .single();
  if (topicError || !topic) throw new AiError(404, "Assunto não encontrado.");

  const rawText = (topic as any).study_materials?.texto_extraido ?? "";
  const materialText = await getAggregatedSubjectText(supabase, topic.material_id, rawText);
  const trecho = relevantMaterial(materialText, topic.nome, topic.conceitos_principais ?? []);

  let previous: { score: number | null; transcription: string | null; attempt: number } | null = null;
  if (data.previousExplanationId) {
    const { data: prev } = await supabase
      .from("explanations")
      .select("score, transcription, attempt")
      .eq("id", data.previousExplanationId)
      .maybeSingle();
    previous = prev ?? null;
  }

  const styleGuide = await buildStyleGuide(supabase, userId);

  const parsed = await callAiJson<any>(
    EVAL_SYSTEM,
    [
      `ASSUNTO ESCOLHIDO: ${topic.nome}`,
      `CONCEITOS QUE O MATERIAL EXIGE: ${(topic.conceitos_principais ?? []).join("; ")}`,
      `PERGUNTA FEITA AO ESTUDANTE: ${data.pergunta}`,
      previous?.transcription
        ? `TENTATIVA ANTERIOR (nota ${previous.score ?? "-"}): ${previous.transcription}`
        : "TENTATIVA ANTERIOR: nenhuma",
      `\nCONTEÚDO DO MATERIAL (fonte da verdade):\n${trecho.slice(0, 60000)}`,
      `\nEXPLICAÇÃO FALADA DO ESTUDANTE (transcrição):\n${data.transcription}`,
      styleGuide,
    ].join("\n"),
  );

  const scores = {
    conceptual_accuracy: clampInt(parsed?.scores?.conceptual_accuracy),
    fundamental_concepts: clampInt(parsed?.scores?.fundamental_concepts),
    completeness: clampInt(parsed?.scores?.completeness),
    conceptual_relationship: clampInt(parsed?.scores?.conceptual_relationship),
    depth: clampInt(parsed?.scores?.depth),
  };
  const computed = weightedScore(scores);
  const aiScore = clampInt(parsed?.score, computed);
  // The AI proposes the score, but the system's weights keep it honest.
  const score = Math.abs(aiScore - computed) > 8 ? computed : aiScore;
  const level = levelFromScore(score);

  const attempt = (previous?.attempt ?? 0) + 1;

  const { data: explanation, error: expError } = await supabase
    .from("explanations")
    .insert({
      user_id: userId,
      material_id: topic.material_id,
      topic_id: topic.id,
      pergunta: data.pergunta,
      audio_url: data.audioPath,
      transcription: data.transcription,
      score,
      level,
      attempt,
    })
    .select("id")
    .single();
  if (expError || !explanation) throw new AiError(500, "Não foi possível salvar sua explicação.");

  const { data: evaluation, error: evalError } = await supabase
    .from("evaluations")
    .insert({
      explanation_id: explanation.id,
      user_id: userId,
      ...scores,
      diagnosis: parsed?.diagnosis ?? null,
      progress_note: previous ? (parsed?.progress_note ?? null) : null,
      followup_question: parsed?.followup_question ?? null,
    })
    .select("id")
    .single();
  if (evalError || !evaluation) throw new AiError(500, "Não foi possível salvar a avaliação.");

  const rawItems: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
  const items: EvaluationItem[] = rawItems
    .filter((i) => ["correct", "error", "missing", "improvement"].includes(i?.type))
    .slice(0, 30)
    .map((i) => ({
      type: i.type,
      title: String(i.title ?? "").slice(0, 240) || "—",
      description: i.description ? String(i.description) : null,
      quote: i.quote ? String(i.quote) : null,
      correction: i.correction ? String(i.correction) : null,
      source_reference: i.source_reference ? String(i.source_reference) : null,
      severity: i.severity ? String(i.severity) : null,
    }));

  if (items.length > 0) {
    await supabase
      .from("evaluation_items")
      .insert(items.map((i) => ({ ...i, evaluation_id: evaluation.id, user_id: userId })));
  }

  const result: EvaluationResult = {
    explanationId: explanation.id,
    attempt,
    topicName: topic.nome,
    pergunta: data.pergunta,
    transcription: data.transcription,
    score,
    level,
    depthLabel: parsed?.depth_label ?? null,
    summary: parsed?.summary ?? null,
    diagnosis: parsed?.diagnosis ?? null,
    followupQuestion: parsed?.followup_question ?? null,
    progressNote: previous ? (parsed?.progress_note ?? null) : null,
    previousScore: previous?.score ?? null,
    scores,
    items,
  };

  return result;
}
