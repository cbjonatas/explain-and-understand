import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Eye,
  History,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ResultView } from "@/components/sentinela/ResultView";
import { AppShell } from "@/components/sentinela/Shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { EvaluationResult } from "@/lib/sentinela-types";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Histórico — SENTINELA" },
      { name: "description", content: "Todas as suas explicações avaliadas pelo SENTINELA." },
    ],
  }),
  component: HistoryPage,
});

type HistoryRow = {
  id: string;
  pergunta: string;
  score: number | null;
  level: string | null;
  attempt: number;
  created_at: string;
  transcription: string | null;
  topic: { nome: string } | null;
};

function scoreTone(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-correct";
  if (score >= 50) return "text-missing";
  return "text-error";
}

function HistoryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedExplanationId, setSelectedExplanationId] = useState<string | null>(null);
  const [deleteSingleId, setDeleteSingleId] = useState<string | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  // Fetch list of evaluations
  const { data, isLoading } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("explanations")
        .select("id, pergunta, score, level, attempt, created_at, transcription, topic:topics(nome)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as HistoryRow[];
    },
  });

  // Fetch full details for a selected evaluation
  const selectedDetailQuery = useQuery({
    queryKey: ["explanation-detail", selectedExplanationId],
    enabled: !!selectedExplanationId,
    queryFn: async () => {
      if (!selectedExplanationId) return null;
      const { data: exp, error: expErr } = await supabase
        .from("explanations")
        .select("id, pergunta, score, level, attempt, created_at, transcription, topic:topics(nome)")
        .eq("id", selectedExplanationId)
        .single();
      if (expErr || !exp) throw expErr || new Error("Análise não encontrada.");

      const { data: evaluation } = await supabase
        .from("evaluations")
        .select("id, conceptual_accuracy, fundamental_concepts, completeness, conceptual_relationship, depth, diagnosis, progress_note, followup_question")
        .eq("explanation_id", selectedExplanationId)
        .maybeSingle();

      let items: any[] = [];
      if (evaluation?.id) {
        const { data: evalItems } = await supabase
          .from("evaluation_items")
          .select("id, type, title, description, quote, correction, source_reference, severity")
          .eq("evaluation_id", evaluation.id);
        items = evalItems ?? [];
      }

      const res: EvaluationResult = {
        explanationId: exp.id,
        attempt: exp.attempt,
        topicName: (exp as any).topic?.nome ?? "Assunto",
        pergunta: exp.pergunta,
        transcription: exp.transcription ?? "",
        score: exp.score ?? 0,
        level: exp.level ?? "—",
        depthLabel: null,
        summary: null,
        diagnosis: evaluation?.diagnosis ?? null,
        followupQuestion: evaluation?.followup_question ?? null,
        progressNote: evaluation?.progress_note ?? null,
        previousScore: null,
        scores: {
          conceptual_accuracy: evaluation?.conceptual_accuracy ?? 0,
          fundamental_concepts: evaluation?.fundamental_concepts ?? 0,
          completeness: evaluation?.completeness ?? 0,
          conceptual_relationship: evaluation?.conceptual_relationship ?? 0,
          depth: evaluation?.depth ?? 0,
        },
        items,
      };

      return res;
    },
  });

  // Delete single explanation mutation
  const deleteSingleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("explanations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteSingleId(null);
      if (selectedExplanationId === deleteSingleId) {
        setSelectedExplanationId(null);
      }
      toast.success("Análise excluída do histórico com sucesso.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir análise.");
    },
  });

  // Delete all history mutation
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase.from("explanations").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setIsDeleteAllOpen(false);
      setSelectedExplanationId(null);
      toast.success("Todo o histórico foi apagado com sucesso.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao apagar histórico.");
    },
  });

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Histórico de Análises</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as suas explicações avaliadas pela Sentinela.
          </p>
        </div>

        {data && data.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteAllOpen(true)}
            className="gap-1.5 text-xs text-error hover:bg-error/10 hover:text-error"
          >
            <Trash2 className="size-3.5" />
            Limpar histórico
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="card-surface flex items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin text-primary" />
          Carregando histórico...
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <History className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm text-muted-foreground">
            Você ainda não gravou nenhuma explicação.
          </p>
          <Link to="/study" className="mt-6 inline-block">
            <Button>Começar a estudar</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((row) => (
            <li
              key={row.id}
              className="card-surface flex items-center justify-between gap-4 p-4 transition-colors hover:border-primary/50"
            >
              <button
                type="button"
                onClick={() => setSelectedExplanationId(row.id)}
                className="flex flex-1 items-center gap-4 text-left min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.pergunta}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.topic?.nome ?? "Assunto"} · Tentativa {row.attempt} ·{" "}
                    {new Date(row.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {row.level && (
                  <span className="hidden rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground sm:inline">
                    {row.level}
                  </span>
                )}
                <span className={`font-display text-xl font-bold tabular-nums ${scoreTone(row.score)}`}>
                  {row.score ?? "—"}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>

              <div className="flex items-center gap-1 pl-2 border-l border-border/50">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedExplanationId(row.id)}
                  title="Visualizar análise completa"
                >
                  <Eye className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-error hover:bg-error/10"
                  onClick={() => setDeleteSingleId(row.id)}
                  title="Excluir esta análise"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Confirmation Dialog: Delete Single Item */}
      <AlertDialog open={!!deleteSingleId} onOpenChange={(open) => !open && setDeleteSingleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir análise do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A gravação, transcrição e avaliação desta explicação serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSingleMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSingleId && deleteSingleMutation.mutate(deleteSingleId)}
              disabled={deleteSingleMutation.isPending}
              className="bg-error text-error-foreground hover:bg-error/90"
            >
              {deleteSingleMutation.isPending ? "Excluindo..." : "Sim, excluir análise"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete All History */}
      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todo o histórico de análises?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá todas as suas explicações, notas e relatórios salvos até o momento. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAllMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
              className="bg-error text-error-foreground hover:bg-error/90"
            >
              {deleteAllMutation.isPending ? "Apagando..." : "Sim, apagar todo o histórico"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog: Full Result View */}
      <Dialog
        open={!!selectedExplanationId}
        onOpenChange={(open) => !open && setSelectedExplanationId(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Relatório da Sentinela</DialogTitle>
          </DialogHeader>

          {selectedDetailQuery.isLoading ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin text-primary" />
              Carregando detalhes da análise...
            </div>
          ) : selectedDetailQuery.data ? (
            <div className="mt-4">
              <ResultView result={selectedDetailQuery.data} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Não foi possível carregar a análise.</p>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
