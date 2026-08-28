import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ResultView } from "@/components/sentinela/ResultView";
import { AppShell } from "@/components/sentinela/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, MAX_RECORDING_SECONDS, useRecorder } from "@/hooks/useRecorder";
import { supabase } from "@/integrations/supabase/client";
import { extractPdfText } from "@/lib/pdf";
import {
  evaluateExplanation,
  generateQuestion,
  processMaterial,
  transcribeExplanation,
} from "@/lib/sentinela.functions";
import type { EvaluationResult, TopicSummary } from "@/lib/sentinela-types";

export const Route = createFileRoute("/_authenticated/study")({
  validateSearch: z.object({ topic: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Nova sessão de explicação — SENTINELA" },
      {
        name: "description",
        content:
          "Envie um PDF, escolha um assunto, grave sua explicação e receba avaliação com nota e diagnóstico.",
      },
      { property: "og:title", content: "Nova sessão — SENTINELA" },
      {
        property: "og:description",
        content: "PDF, assunto, pergunta, áudio, transcrição e avaliação por IA.",
      },
    ],
  }),
  component: StudyPage,
});

type Step = "upload" | "topics" | "question" | "review" | "result";

type AttachedFile = {
  name: string;
  sizeFormatted: string;
  pages: number;
  url: string | null;
};

function StudyPage() {
  const { topic: topicParam } = Route.useSearch();
  const navigate = useNavigate();
  const recorder = useRecorder();

  const [step, setStep] = useState<Step>(topicParam ? "question" : "upload");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [topicId, setTopicId] = useState<string | null>(topicParam ?? null);
  const [topicName, setTopicName] = useState<string>("");
  const [pergunta, setPergunta] = useState("");
  const [transcription, setTranscription] = useState("");
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [previousExplanationId, setPreviousExplanationId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runProcessMaterial = useServerFn(processMaterial);
  const runGenerateQuestion = useServerFn(generateQuestion);
  const runTranscribe = useServerFn(transcribeExplanation);
  const runEvaluate = useServerFn(evaluateExplanation);

  // Clean up blob URL on unmount or file reset
  useEffect(() => {
    return () => {
      if (attachedFile?.url) {
        URL.revokeObjectURL(attachedFile.url);
      }
    };
  }, [attachedFile]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setProgress("Lendo o PDF...");
      const { pages, text } = await extractPdfText(file);
      const fileUrl = URL.createObjectURL(file);
      setAttachedFile({
        name: file.name,
        sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        pages,
        url: fileUrl,
      });

      setProgress("Identificando os assuntos do material...");
      const response = await runProcessMaterial({
        data: { nome: file.name.replace(/\.pdf$/i, ""), arquivo: null, paginas: pages, texto: text },
      });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: (data) => {
      setProgress(null);
      setTopics(data.topics);
      setStep("topics");
      toast.success("PDF processado com sucesso! Escolha um assunto para começar.");
    },
    onError: (error) => {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "Falha ao processar o PDF.");
    },
  });

  const question = useMutation({
    mutationFn: async (id: string) => {
      const response = await runGenerateQuestion({ data: { topicId: id } });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: (data) => {
      setPergunta(data.pergunta);
      setTopicName(data.topicName);
      setStep("question");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao gerar a pergunta."),
  });

  const submitAudio = useMutation({
    mutationFn: async (blob: Blob) => {
      setProgress("Enviando o áudio...");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");
      const path = `${userId}/${crypto.randomUUID()}.wav`;
      const { error } = await supabase.storage
        .from("explanation-audio")
        .upload(path, blob, { contentType: "audio/wav" });
      if (error) throw new Error("Não foi possível enviar o áudio. Tente novamente.");
      setAudioPath(path);
      setProgress("Transcrevendo sua explicação (pt-BR)...");
      const response = await runTranscribe({ data: { path } });
      if (!response.ok) throw new Error(response.message);
      return response.data.text;
    },
    onSuccess: (text) => {
      setProgress(null);
      setTranscription(text);
      setStep("review");
      toast.success("Áudio transcrito com sucesso! Confira sua explicação antes de enviar.");
    },
    onError: (error) => {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "Falha ao transcrever o áudio.");
    },
  });

  const evaluate = useMutation({
    mutationFn: async () => {
      if (!topicId) throw new Error("Escolha um assunto.");
      setProgress("A Sentinela está analisando sua explicação com base no PDF anexado...");
      const response = await runEvaluate({
        data: {
          topicId,
          pergunta,
          transcription,
          audioPath,
          previousExplanationId,
        },
      });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: (data) => {
      setProgress(null);
      setResult(data);
      setPreviousExplanationId(data.explanationId);
      setStep("result");
      toast.success("Análise concluída pela Sentinela!");
    },
    onError: (error) => {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "Falha ao avaliar a explicação.");
    },
  });

  // A topic can arrive from the dashboard; generate its question right away.
  useEffect(() => {
    if (topicParam && !pergunta && !question.isPending) question.mutate(topicParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicParam]);

  const busy =
    upload.isPending || question.isPending || submitAudio.isPending || evaluate.isPending;

  function retry() {
    recorder.reset();
    setTranscription("");
    setAudioPath(null);
    setResult(null);
    setStep("question");
  }

  function handleRemoveFile() {
    if (attachedFile?.url) {
      URL.revokeObjectURL(attachedFile.url);
    }
    setAttachedFile(null);
    setTopics([]);
    setTopicId(null);
    setTopicName("");
    setPergunta("");
    setTranscription("");
    setAudioPath(null);
    setResult(null);
    recorder.reset();
    setStep("upload");
    toast.info("Arquivo removido. Selecione um novo PDF.");
  }

  function handleReplaceFile() {
    fileRef.current?.click();
  }

  function handleOpenPdf() {
    if (attachedFile?.url) {
      window.open(attachedFile.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <AppShell>
      <StepHeader step={step} />

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 20 * 1024 * 1024) {
            toast.error("O PDF passa de 20 MB. Envie um arquivo menor.");
            return;
          }
          upload.mutate(file);
        }}
      />

      {/* Attached File Banner (Visible whenever a file is attached) */}
      {attachedFile && (
        <div className="card-surface mt-6 flex flex-wrap items-center justify-between gap-4 border-primary/30 bg-primary/5 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  PDF Anexado
                </span>
                <span className="truncate text-sm font-semibold max-w-[200px] sm:max-w-xs md:max-w-sm">
                  {attachedFile.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {attachedFile.pages} {attachedFile.pages === 1 ? "página" : "páginas"} · {attachedFile.sizeFormatted}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {attachedFile.url && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPdf}
                className="gap-1.5 text-xs"
                title="Abrir e visualizar PDF"
              >
                <ExternalLink className="size-3.5" />
                Visualizar PDF
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReplaceFile}
              disabled={busy}
              className="gap-1.5 text-xs"
              title="Trocar arquivo por outro PDF"
            >
              <RefreshCw className="size-3.5" />
              Trocar PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              disabled={busy}
              className="gap-1.5 text-xs text-error hover:bg-error/10 hover:text-error"
              title="Excluir arquivo anexado"
            >
              <Trash2 className="size-3.5" />
              Excluir
            </Button>
          </div>
        </div>
      )}

      {progress && (
        <div className="card-surface mt-6 flex items-center gap-3 p-5 text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          {progress}
        </div>
      )}

      {step === "upload" && !attachedFile && (
        <div className="card-surface mt-6 p-8 text-center">
          <Upload className="mx-auto size-8 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Envie seu material de estudo</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            PDF com texto selecionável, até 20 MB. O Sentinela lê o conteúdo e identifica os
            assuntos.
          </p>
          <Button className="mt-6" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Escolher PDF
          </Button>
        </div>
      )}

      {step === "topics" && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Assuntos identificados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha o que você quer explicar agora.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setTopicId(topic.id);
                  setTopicName(topic.nome);
                  setPreviousExplanationId(null);
                  question.mutate(topic.id);
                }}
                className="card-surface p-5 text-left transition-colors hover:border-primary disabled:opacity-60"
              >
                <h3 className="text-base font-semibold">{topic.nome}</h3>
                {topic.descricao && (
                  <p className="mt-1 text-sm text-muted-foreground">{topic.descricao}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {topic.conceitos_principais.slice(0, 4).map((conceito) => (
                    <span
                      key={conceito}
                      className="rounded-full bg-elevated px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {conceito}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "question" && (
        <div className="mt-6 space-y-6">
          <div className="card-surface p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {topicName || "Assunto escolhido"}
            </p>
            <h2 className="mt-3 text-xl font-semibold leading-snug">{pergunta || "..."}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Explique em voz alta, com suas palavras, como se ensinasse alguém. Sem ler o material.
            </p>
          </div>

          <div className="card-surface p-6 text-center">
            <div className="mx-auto flex size-24 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
              <div
                className="flex size-16 items-center justify-center rounded-full bg-primary/20 transition-transform"
                style={{
                  transform: `scale(${1 + Math.min(recorder.level * 1.6, 0.6)})`,
                }}
              >
                <Mic className="size-7 text-primary" />
              </div>
            </div>
            <p className="mt-4 font-display text-3xl font-bold tabular-nums">
              {formatTime(recorder.seconds)}
            </p>
            <p className="text-xs text-muted-foreground">
              limite de {Math.floor(MAX_RECORDING_SECONDS / 60)} minutos
            </p>
            {recorder.error && <p className="mt-3 text-sm text-error">{recorder.error}</p>}

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {recorder.state === "idle" && (
                <Button onClick={recorder.start} disabled={busy || !pergunta}>
                  <Mic className="size-4" /> Gravar explicação
                </Button>
              )}
              {recorder.state === "recording" && (
                <>
                  <Button variant="secondary" onClick={recorder.pause}>
                    <Pause className="size-4" /> Pausar
                  </Button>
                  <Button onClick={recorder.stop}>
                    <Square className="size-4" /> Finalizar
                  </Button>
                </>
              )}
              {recorder.state === "paused" && (
                <>
                  <Button variant="secondary" onClick={recorder.resume}>
                    <Play className="size-4" /> Continuar
                  </Button>
                  <Button onClick={recorder.stop}>
                    <Square className="size-4" /> Finalizar
                  </Button>
                </>
              )}
              {recorder.state === "ready" && (
                <>
                  <Button variant="ghost" onClick={recorder.reset} disabled={busy}>
                    <RotateCcw className="size-4" /> Regravar
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => recorder.blob && submitAudio.mutate(recorder.blob)}
                  >
                    Gerar transcrição (pt-BR)
                  </Button>
                </>
              )}
            </div>

            {recorder.audioUrl && (
              <audio controls src={recorder.audioUrl} className="mx-auto mt-5 w-full max-w-sm" />
            )}
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="card-surface mt-6 p-6">
          <h2 className="text-lg font-semibold">Confira sua transcrição</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste possíveis detalhes da fala antes de enviar para a avaliação da Sentinela.
          </p>
          <Textarea
            className="mt-4 min-h-52 text-base leading-relaxed"
            value={transcription}
            onChange={(event) => setTranscription(event.target.value)}
            placeholder="Sua fala transcrita aparecerá aqui..."
          />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={retry} disabled={busy} className="gap-1.5">
              <RotateCcw className="size-4" /> Gravar de novo
            </Button>
            <Button
              disabled={busy || transcription.trim().length < 40}
              onClick={() => evaluate.mutate()}
              className="gap-2 px-6 font-semibold"
            >
              <Send className="size-4" />
              ENVIAR ANÁLISE
            </Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="mt-6 space-y-6">
          <ResultView result={result} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={retry} className="gap-1.5">
              <RotateCcw className="size-4" /> Refazer explicação
            </Button>
            <Button variant="secondary" onClick={() => navigate({ to: "/history" })}>
              Ver histórico
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
              Voltar ao painel
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

const STEP_LABELS: Array<{ key: Step; label: string }> = [
  { key: "upload", label: "Material" },
  { key: "topics", label: "Assunto" },
  { key: "question", label: "Explicação" },
  { key: "review", label: "Transcrição" },
  { key: "result", label: "Resultado" },
];

function StepHeader({ step }: { step: Step }) {
  const current = STEP_LABELS.findIndex((s) => s.key === step);
  return (
    <div>
      <h1 className="text-2xl font-bold">Sessão de explicação</h1>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs">
        {STEP_LABELS.map((item, index) => (
          <li
            key={item.key}
            className={
              index <= current
                ? "rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-primary"
                : "rounded-full border border-border px-3 py-1 text-muted-foreground"
            }
          >
            {index + 1}. {item.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
