import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  Pause,
  Play,
  Square,
  TrendingDown,
  TrendingUp,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSentinelaVoice } from "@/hooks/useSentinelaVoice";
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

  const voice = useSentinelaVoice();

  // Build a natural spoken text in Brazilian Portuguese
  function buildSpokenAnalysis(): string {
    const parts: string[] = [];

    parts.push(
      `Análise da Sentinela para o assunto ${result.topicName}.`,
      `Sua nota foi ${result.score} de 100, com nível ${result.level}.`,
    );

    if (result.summary) {
      parts.push(result.summary);
    }

    if (result.diagnosis) {
      parts.push(`Diagnóstico de estudo: ${result.diagnosis}`);
    }

    const errors = result.items.filter((i) => i.type === "error");
    if (errors.length > 0) {
      parts.push(
        `Pontos de atenção e correções: ${errors
          .slice(0, 3)
          .map((e) => `${e.title}. ${e.correction ? "O correto é: " + e.correction : ""}`)
          .join(" ")}`,
      );
    }

    const correct = result.items.filter((i) => i.type === "correct");
    if (correct.length > 0) {
      parts.push(
        `Principais acertos na sua explicação: ${correct
          .slice(0, 3)
          .map((c) => c.title)
          .join(", ")}.`,
      );
    }

    if (result.followupQuestion) {
      parts.push(`Para aprofundar seu conhecimento, responda a esta pergunta: ${result.followupQuestion}`);
    }

    return parts.join(" ");
  }

  function handlePlayAudio() {
    if (voice.state === "paused") {
      voice.resume();
    } else {
      voice.speak(buildSpokenAnalysis());
    }
  }

  return (
    <div className="space-y-6">
      {/* Voice Reader Bar */}
      <div className="card-surface flex flex-wrap items-center justify-between gap-4 border-primary/30 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex size-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary",
            voice.state === "playing" && "animate-pulse ring-2 ring-primary/30"
          )}>
            <Volume2 className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Voz da Sentinela (pt-BR)</h3>
            <p className="text-xs text-muted-foreground">
              {voice.state === "playing"
                ? "Sentinela lendo sua análise em voz alta..."
                : voice.state === "paused"
                ? "Leitura pausada."
                : "Ouça o diagnóstico e o feedback da sua explicação."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {voice.state === "idle" && (
            <Button onClick={handlePlayAudio} className="gap-2">
              <Volume2 className="size-4" />
              OUVIR ANÁLISE
            </Button>
          )}

          {voice.state === "playing" && (
            <>
              <Button variant="secondary" size="sm" onClick={voice.pause} className="gap-1.5">
                <Pause className="size-4" />
                Pausar
              </Button>
              <Button variant="destructive" size="sm" onClick={voice.stop} className="gap-1.5">
                <Square className="size-4" />
                Parar
              </Button>
            </>
          )}

          {voice.state === "paused" && (
            <>
              <Button size="sm" onClick={voice.resume} className="gap-1.5">
                <Play className="size-4" />
                Continuar
              </Button>
              <Button variant="ghost" size="sm" onClick={voice.stop} className="gap-1.5">
                <Square className="size-4" />
                Parar
              </Button>
            </>
          )}
        </div>
      </div>

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
