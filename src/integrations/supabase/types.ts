export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      evaluation_items: {
        Row: {
          correction: string | null
          created_at: string
          description: string | null
          evaluation_id: string
          id: string
          quote: string | null
          severity: string | null
          source_reference: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          correction?: string | null
          created_at?: string
          description?: string | null
          evaluation_id: string
          id?: string
          quote?: string | null
          severity?: string | null
          source_reference?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          correction?: string | null
          created_at?: string
          description?: string | null
          evaluation_id?: string
          id?: string
          quote?: string | null
          severity?: string | null
          source_reference?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_items_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          completeness: number | null
          conceptual_accuracy: number | null
          conceptual_relationship: number | null
          created_at: string
          depth: number | null
          diagnosis: string | null
          explanation_id: string
          followup_question: string | null
          fundamental_concepts: number | null
          id: string
          progress_note: string | null
          user_id: string
        }
        Insert: {
          completeness?: number | null
          conceptual_accuracy?: number | null
          conceptual_relationship?: number | null
          created_at?: string
          depth?: number | null
          diagnosis?: string | null
          explanation_id: string
          followup_question?: string | null
          fundamental_concepts?: number | null
          id?: string
          progress_note?: string | null
          user_id: string
        }
        Update: {
          completeness?: number | null
          conceptual_accuracy?: number | null
          conceptual_relationship?: number | null
          created_at?: string
          depth?: number | null
          diagnosis?: string | null
          explanation_id?: string
          followup_question?: string | null
          fundamental_concepts?: number | null
          id?: string
          progress_note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_explanation_id_fkey"
            columns: ["explanation_id"]
            isOneToOne: false
            referencedRelation: "explanations"
            referencedColumns: ["id"]
          },
        ]
      }
      explanations: {
        Row: {
          attempt: number
          audio_url: string | null
          created_at: string
          id: string
          level: string | null
          material_id: string
          pergunta: string
          score: number | null
          topic_id: string
          transcription: string | null
          user_id: string
        }
        Insert: {
          attempt?: number
          audio_url?: string | null
          created_at?: string
          id?: string
          level?: string | null
          material_id: string
          pergunta: string
          score?: number | null
          topic_id: string
          transcription?: string | null
          user_id: string
        }
        Update: {
          attempt?: number
          audio_url?: string | null
          created_at?: string
          id?: string
          level?: string | null
          material_id?: string
          pergunta?: string
          score?: number | null
          topic_id?: string
          transcription?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "explanations_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "study_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explanations_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      language_profiles: {
        Row: {
          created_at: string
          destaques: string | null
          editado_manualmente: boolean
          estrutura: string | null
          exemplos_analisados: number
          exemplos_analogias: string | null
          forma_explicar: string | null
          metodologia: string | null
          organizacao_materiais: string | null
          questoes_comentadas: string | null
          resumo: string | null
          tom: string | null
          updated_at: string
          user_id: string
          vocabulario: string | null
        }
        Insert: {
          created_at?: string
          destaques?: string | null
          editado_manualmente?: boolean
          estrutura?: string | null
          exemplos_analisados?: number
          exemplos_analogias?: string | null
          forma_explicar?: string | null
          metodologia?: string | null
          organizacao_materiais?: string | null
          questoes_comentadas?: string | null
          resumo?: string | null
          tom?: string | null
          updated_at?: string
          user_id: string
          vocabulario?: string | null
        }
        Update: {
          created_at?: string
          destaques?: string | null
          editado_manualmente?: boolean
          estrutura?: string | null
          exemplos_analisados?: number
          exemplos_analogias?: string | null
          forma_explicar?: string | null
          metodologia?: string | null
          organizacao_materiais?: string | null
          questoes_comentadas?: string | null
          resumo?: string | null
          tom?: string | null
          updated_at?: string
          user_id?: string
          vocabulario?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          arquivo: string | null
          concurso: string | null
          created_at: string
          disciplina: string | null
          grupo: string | null
          id: string
          nome: string
          quantidade_paginas: number | null
          texto_extraido: string
          user_id: string
        }
        Insert: {
          arquivo?: string | null
          concurso?: string | null
          created_at?: string
          disciplina?: string | null
          grupo?: string | null
          id?: string
          nome: string
          quantidade_paginas?: number | null
          texto_extraido?: string
          user_id: string
        }
        Update: {
          arquivo?: string | null
          concurso?: string | null
          created_at?: string
          disciplina?: string | null
          grupo?: string | null
          id?: string
          nome?: string
          quantidade_paginas?: number | null
          texto_extraido?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          conceitos_principais: string[]
          created_at: string
          descricao: string | null
          id: string
          material_id: string
          nome: string
          user_id: string
        }
        Insert: {
          conceitos_principais?: string[]
          created_at?: string
          descricao?: string | null
          id?: string
          material_id: string
          nome: string
          user_id: string
        }
        Update: {
          conceitos_principais?: string[]
          created_at?: string
          descricao?: string | null
          id?: string
          material_id?: string
          nome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "study_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      training_examples: {
        Row: {
          arquivo: string | null
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          origem: string
          quantidade_paginas: number | null
          texto: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivo?: string | null
          ativo?: boolean
          categoria: string
          created_at?: string
          id?: string
          origem?: string
          quantidade_paginas?: number | null
          texto?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivo?: string | null
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          origem?: string
          quantidade_paginas?: number | null
          texto?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
