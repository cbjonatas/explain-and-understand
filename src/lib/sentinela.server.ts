// Server-only helpers for the SENTINELA evaluation engine.
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "google/gemini-3.7-flash";

// Configurable scoring weights (backend-owned).
export const SCORE_WEIGHTS = {
  conceptual_accuracy: 0.3,
  fundamental_concepts: 0.25,
  completeness: 0.2,
  conceptual_relationship: 0.15,
  depth: 0.1,
} as const;

export const MAX_MATERIAL_CHARS = 60000;

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "A IA não está configurada neste projeto.");
  return key;
}

export async function callAiJson<T>(system: string, user: string): Promise<T> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429)
      throw new AiError(429, "Muitas análises ao mesmo tempo. Tente novamente em instantes.");
    if (res.status === 402)
      throw new AiError(402, "Os créditos de IA do projeto acabaram. Adicione créditos para continuar.");
    if (res.status === 403)
      throw new AiError(403, "O uso de IA está bloqueado neste projeto.");
    throw new AiError(res.status, `Falha na análise da IA (${res.status}). ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError(502, "A IA não retornou uma resposta válida.");
  try {
    return JSON.parse(content) as T;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new AiError(502, "A IA retornou uma resposta em formato inesperado.");
  }
}

export async function transcribeAudioFile(file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("model", "openai/gpt-4o-transcribe");
  form.append("language", "pt");
  form.append("prompt", "Transcrição de explicação oral de um estudante brasileiro em português do Brasil (pt-BR).");
  form.append("file", file, filename);

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429)
      throw new AiError(429, "Muitas transcrições ao mesmo tempo. Tente novamente em instantes.");
    if (res.status === 402)
      throw new AiError(402, "Os créditos de IA do projeto acabaram. Adicione créditos para continuar.");
    throw new AiError(res.status, `Falha na transcrição (${res.status}). ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (text.length < 15)
    throw new AiError(
      422,
      "Não conseguimos entender o áudio. Grave novamente em um lugar silencioso, falando perto do microfone.",
    );
  return text;
}

export const TOPICS_SYSTEM = `Você é o motor de análise de material do SENTINELA, uma ferramenta de estudo em português do Brasil.
Receberá o texto extraído de um PDF de estudo. Identifique os assuntos ensináveis do material.
Responda SOMENTE com JSON no formato:
{"topics":[{"nome":"...","descricao":"...","conceitos_principais":["..."]}]}
Regras:
- entre 4 e 10 assuntos, os mais relevantes e realmente presentes no material;
- "nome" curto (até 40 caracteres), sem numeração;
- "descricao" com 1 frase explicando o que o material diz sobre o assunto;
- "conceitos_principais": 3 a 8 conceitos, definições ou relações que uma boa explicação do assunto precisa conter;
- nunca invente assuntos ausentes do material.`;

export const QUESTION_SYSTEM = `Você é o SENTINELA, em português do Brasil.
Crie UMA pergunta que obrigue o estudante a explicar o assunto com as próprias palavras, cobrindo função, definição e consequências/relações — nunca uma pergunta de resposta curta ou de decorar termo.
Responda SOMENTE com JSON: {"pergunta":"..."}`;

export const EVAL_SYSTEM = `Você é o motor de avaliação do SENTINELA, em português do Brasil.

REGRA FUNDAMENTAL: NÃO CONFUNDIR REPETIÇÃO COM COMPREENSÃO.
- Avalie significado, precisão, contexto e relação entre conceitos — nunca correspondência de palavras-chave.
- Paráfrases, sinônimos e analogias corretas valem como acerto.
- Usar as palavras do material sem sentido correto NÃO vale como acerto.
- Toda correção e lacuna deve estar fundamentada no material fornecido. Nunca invente conteúdo ausente.
- Quando o trecho do material citar "[Página N]", registre "página N do material" em source_reference.
- A transcrição vem de fala: ignore erros de pontuação e pequenos ruídos de transcrição.

Notas de 0 a 100 por critério, com estes pesos na nota final:
precisão conceitual 30%, conceitos fundamentais 25%, completude 20%, relação entre conceitos 15%, profundidade 10%.

Responda SOMENTE com JSON:
{
 "scores":{"conceptual_accuracy":0,"fundamental_concepts":0,"completeness":0,"conceptual_relationship":0,"depth":0},
 "score":0,
 "level":"Insuficiente|Básico|Intermediário|Bom|Avançado",
 "depth_label":"memorização superficial|compreensão básica|compreensão intermediária|domínio avançado",
 "summary":"1 a 2 frases sobre o desempenho",
 "diagnosis":"diagnóstico curto e objetivo, dizendo o que revisar",
 "followup_question":"pergunta de aprofundamento baseada em algo que o estudante disse",
 "progress_note":"comparação com a tentativa anterior, ou null",
 "items":[
   {"type":"correct|error|missing|improvement","title":"...","description":"...","quote":"trecho da fala do estudante ou null","correction":"explicação correta baseada no material ou null","source_reference":"página N do material ou null","severity":"baixa|media|alta ou null"}
 ]
}
Inclua pelo menos: os acertos reais (type correct), cada erro conceitual (type error, com quote, description do problema e correction), e as lacunas importantes (type missing).`;

export function weightedScore(s: {
  conceptual_accuracy: number;
  fundamental_concepts: number;
  completeness: number;
  conceptual_relationship: number;
  depth: number;
}) {
  const total =
    s.conceptual_accuracy * SCORE_WEIGHTS.conceptual_accuracy +
    s.fundamental_concepts * SCORE_WEIGHTS.fundamental_concepts +
    s.completeness * SCORE_WEIGHTS.completeness +
    s.conceptual_relationship * SCORE_WEIGHTS.conceptual_relationship +
    s.depth * SCORE_WEIGHTS.depth;
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function levelFromScore(score: number) {
  if (score >= 90) return "Domínio avançado";
  if (score >= 75) return "Bom domínio";
  if (score >= 60) return "Compreensão intermediária";
  if (score >= 40) return "Compreensão básica";
  return "Insuficiente";
}

export function clampInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Keeps the most relevant slice of the material for the chosen topic.
export function relevantMaterial(fullText: string, topicName: string, concepts: string[]) {
  if (fullText.length <= MAX_MATERIAL_CHARS) return fullText;
  const terms = [topicName, ...concepts].map((t) => t.toLowerCase()).filter(Boolean);
  const blocks = fullText.split(/\n\n+/);
  const scored = blocks.map((block, index) => {
    const lower = block.toLowerCase();
    const score = terms.reduce((acc, term) => (lower.includes(term) ? acc + 1 : acc), 0);
    return { block, index, score };
  });
  const picked: typeof scored = [];
  let size = 0;
  for (const item of scored.filter((b) => b.score > 0).sort((a, b) => b.score - a.score)) {
    if (size + item.block.length > MAX_MATERIAL_CHARS) break;
    picked.push(item);
    size += item.block.length;
  }
  if (picked.length === 0) return fullText.slice(0, MAX_MATERIAL_CHARS);
  return picked.sort((a, b) => a.index - b.index).map((p) => p.block).join("\n\n");
}
