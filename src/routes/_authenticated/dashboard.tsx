import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";

import { AppShell } from "@/components/sentinela/Shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — SENTINELA" },
      {
        name: "description",
        content: "Seus materiais, assuntos e desempenho nas explicações gravadas.",
      },
      { property: "og:title", content: "Painel — SENTINELA" },
      { property: "og:description", content: "Acompanhe materiais, assuntos e notas." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const materials = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_materials")
        .select("id, nome, quantidade_paginas, created_at, topics(id, nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("explanations")
        .select("score, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const scores = (data ?? []).map((e) => e.score ?? 0);
      return {
        total: scores.length,
        media: scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null,
        ultima: scores[0] ?? null,
      };
    },
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie um material e explique um assunto com suas palavras.
          </p>
        </div>
        <Link to="/study">
          <Button>
            <Plus className="size-4" /> Nova sessão
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Explicações", value: stats.data?.total ?? 0 },
          { label: "Média geral", value: stats.data?.media ?? "—" },
          { label: "Última nota", value: stats.data?.ultima ?? "—" },
        ].map((card) => (
          <div key={card.label} className="card-surface p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Seus materiais</h2>
      <div className="mt-4 space-y-4">
        {materials.isLoading && <Skeleton className="h-24 w-full" />}
        {materials.data?.length === 0 && (
          <div className="card-surface p-8 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum material ainda. Comece enviando um PDF de estudo.
            </p>
            <Link to="/study" className="mt-4 inline-block">
              <Button>Enviar PDF</Button>
            </Link>
          </div>
        )}
        {materials.data?.map((material) => (
          <div key={material.id} className="card-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">{material.nome}</h3>
              <span className="text-xs text-muted-foreground">
                {material.quantidade_paginas ?? 0} páginas ·{" "}
                {new Date(material.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(material.topics ?? []).map((topic) => (
                <Link
                  key={topic.id}
                  to="/study"
                  search={{ topic: topic.id }}
                  className="rounded-full border border-border bg-elevated px-3 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
                >
                  {topic.nome}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
