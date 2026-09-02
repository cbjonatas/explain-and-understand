export const TRAINING_CATEGORIES = [
  "linguagem",
  "explicacao",
  "questao_comentada",
  "resumo",
  "material_didatico",
  "metodologia",
] as const;

export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];

export const TRAINING_CATEGORY_LABELS: Record<TrainingCategory, string> = {
  linguagem: "Linguagem e comunicação",
  explicacao: "Explicação de conteúdo",
  questao_comentada: "Questão comentada",
  resumo: "Resumo",
  material_didatico: "Material didático",
  metodologia: "Metodologia",
};

export const PROFILE_FIELDS = [
  "resumo",
  "vocabulario",
  "tom",
  "forma_explicar",
  "estrutura",
  "exemplos_analogias",
  "destaques",
  "questoes_comentadas",
  "organizacao_materiais",
  "metodologia",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  resumo: "Resumo do estilo",
  vocabulario: "Vocabulário utilizado",
  tom: "Tom de comunicação",
  forma_explicar: "Forma de explicar",
  estrutura: "Estrutura dos conteúdos",
  exemplos_analogias: "Uso de exemplos e analogias",
  destaques: "Como destaco o que é importante",
  questoes_comentadas: "Forma de comentar questões",
  organizacao_materiais: "Organização e preenchimento dos materiais",
  metodologia: "Metodologia de ensino",
};

export type LanguageProfile = {
  user_id: string;
  exemplos_analisados: number;
  editado_manualmente: boolean;
  updated_at: string;
} & Record<ProfileField, string | null>;

export type TrainingExample = {
  id: string;
  titulo: string;
  categoria: string;
  origem: string;
  arquivo: string | null;
  quantidade_paginas: number | null;
  texto: string;
  ativo: boolean;
  created_at: string;
};
