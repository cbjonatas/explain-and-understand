import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, History } from "lucide-react";

import { AppShell } from "@/components/sentinela/Shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

  const { data, isLoading } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("explanations")
        .select("id, pergunta, score, level, attempt, created_at, topic:topics(nome)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as HistoryRow[];
    },
  });

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as suas explicações, da mais recente para a mais antiga.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
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
            <li key={row.id} className="card-surface flex items-center gap-4 p-4">
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
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
