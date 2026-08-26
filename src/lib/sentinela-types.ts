export type EvaluationItemType = "correct" | "error" | "missing" | "improvement";

export type EvaluationItem = {
  type: EvaluationItemType;
  title: string;
  description: string | null;
  quote: string | null;
  correction: string | null;
  source_reference: string | null;
  severity: string | null;
};

export type CriteriaScores = {
  conceptual_accuracy: number;
  fundamental_concepts: number;
  completeness: number;
  conceptual_relationship: number;
  depth: number;
};

export type EvaluationResult = {
  explanationId: string;
  attempt: number;
  topicName: string;
  pergunta: string;
  transcription: string;
  score: number;
  level: string;
  depthLabel: string | null;
  summary: string | null;
  diagnosis: string | null;
  followupQuestion: string | null;
  progressNote: string | null;
  previousScore: number | null;
  scores: CriteriaScores;
  items: EvaluationItem[];
};

export type TopicSummary = {
  id: string;
  nome: string;
  descricao: string | null;
  conceitos_principais: string[];
};

export const CRITERIA_LABELS: Array<{ key: keyof CriteriaScores; label: string; weight: string }> = [
  { key: "conceptual_accuracy", label: "Precisão conceitual", weight: "30%" },
  { key: "fundamental_concepts", label: "Conceitos fundamentais", weight: "25%" },
  { key: "completeness", label: "Completude", weight: "20%" },
  { key: "conceptual_relationship", label: "Relação entre conceitos", weight: "15%" },
  { key: "depth", label: "Profundidade", weight: "10%" },
];
