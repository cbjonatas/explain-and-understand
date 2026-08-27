import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { CRITERIA_LABELS, type EvaluationResult } from "@/lib/sentinela-types";
import { cn } from "@/lib/utils";

const ITEM_STYLES = {
  correct: { label: "Acerto", icon: CheckCircle2, cls: "text-correct border-correct/40 bg-correct/10" },
  error: { label: "Erro", icon: AlertTriangle, cls: "text-error border-error/40 bg-error/10" },
  missing: { label: "Lacuna", icon: CircleHelp, cls: "text-missing border-missing/40 bg-missing/10" },
  improvement: { label: "Refinar", icon: Lightbulb, cls: "text-info border-info/40 bg-info/10" },
} as const;

const ORDER = ["correct", "error", "missing", "improvement"] as const;

export function ResultView({ result }: { result: EvaluationResult }) {
  const delta =
    result.previousScore === null ? null : result.score - result.previousScore;

  return (
    <div className="space-y-6">
      <div className="card-surface p-6 text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Tentativa {result.attempt} · {result.topicName}
        </p>
        <p className="mt-4 font-display text-6xl font-bold text-signal">{result.score}</p>
        <p className="mt-1 text-sm text-muted-foreground">de 100</p>
        <p className="mt-3 inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {result.level}
          {result.depthLabel ? ` · ${result.depthLabel}` : ""}
        </p>
        {delta !== null && (
          <p
            className={cn(
              "mt-4 flex items-center justify-center gap-2 text-sm font-medium",
              delta >= 0 ? "text-correct" : "text-error",
            )}
          >
            {delta >= 0 ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
            {delta >= 0 ? "+" : ""}
            {delta} pontos em relação à tentativa anterior ({result.previousScore})
          </p>
        )}
        {result.summary && (
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground">{result.summary}</p>
        )}
      </div>

      <div className="card-surface p-6">
        <h2 className="text-base font-semibold">Critérios avaliados</h2>
        <div className="mt-4 space-y-4">
          {CRITERIA_LABELS.map((criteria) => {
            const value = result.scores[criteria.key];
            return (
              <div key={criteria.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>
                    {criteria.label}{" "}
                    <span className="text-xs text-muted-foreground">({criteria.weight})</span>
                  </span>
                  <span className="font-semibold">{value}</span>
                </div>
                <Progress value={value} className="mt-2 h-2" />
              </div>
            );
          })}
        </div>
      </div>

      {result.progressNote && (
        <div className="card-surface border-info/40 p-6">
          <h2 className="text-base font-semibold">Sua evolução</h2>
          <p className="mt-2 text-sm text-muted-foreground">{result.progressNote}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ORDER.map((type) => {
          const items = result.items.filter((item) => item.type === type);
          if (items.length === 0) return null;
          const style = ITEM_STYLES[type];
          return (
            <div key={type} className="card-surface p-5">
              <h3 className={cn("flex items-center gap-2 text-sm font-semibold", style.cls.split(" ")[0])}>
                <style.icon className="size-4" />
                {style.label} ({items.length})
              </h3>
              <ul className="mt-4 space-y-3">
                {items.map((item, index) => (
                  <li key={index} className={cn("rounded-lg border p-3", style.cls)}>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    )}
                    {item.quote && (
                      <p className="mt-2 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                        “{item.quote}”
                      </p>
                    )}
                    {item.correction && (
                      <p className="mt-2 text-xs text-foreground">
                        <strong>Correto:</strong> {item.correction}
                      </p>
                    )}
                    {item.source_reference && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Fonte: {item.source_reference}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {result.diagnosis && (
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold">Diagnóstico</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {result.diagnosis}
          </p>
        </div>
      )}

      {result.followupQuestion && (
        <div className="card-surface border-primary/40 p-6">
          <h2 className="text-base font-semibold">Pergunta de aprofundamento</h2>
          <p className="mt-2 text-sm text-muted-foreground">{result.followupQuestion}</p>
        </div>
      )}

      <details className="card-surface p-6">
        <summary className="cursor-pointer text-sm font-semibold">Ver sua transcrição</summary>
        <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
          {result.transcription}
        </p>
      </details>
    </div>
  );
}
