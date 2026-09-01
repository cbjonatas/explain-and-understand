import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  Layers,
  Library,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ResultView } from "@/components/sentinela/ResultView";
import { AppShell } from "@/components/sentinela/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, MAX_RECORDING_SECONDS, useRecorder } from "@/hooks/useRecorder";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractPdfText } from "@/lib/pdf";
import {
  analyzeMaterialStructure,
  evaluateExplanation,
  generateQuestion,
  saveCustomMaterialStructure,
  transcribeExplanation,
} from "@/lib/sentinela.functions";
import type { EvaluationResult, IdentifiedTopic, MaterialStructure, TopicSummary } from "@/lib/sentinela-types";

export const Route = createFileRoute("/_authenticated/study")({
  validateSearch: z.object({ topic: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Nova sessão de explicação — SENTINELA" },
      {
        name: "description",
        content:
          "Envie um PDF ou escolha da sua biblioteca, grave sua explicação e receba avaliação com nota e diagnóstico da Sentinela.",
      },
      { property: "og:title", content: "Nova sessão — SENTINELA" },
      {
        property: "og:description",
        content: "PDF, estrutura de estudo, pergunta, áudio, transcrição e avaliação por IA.",
      },
    ],
  }),
  component: StudyPage,
});

type Step = "upload" | "structure" | "topics" | "question" | "review" | "result";

type AttachedFile = {
  name: string;
  sizeFormatted: string;
  pages: number;
  url: string | null;
  text: string;
};

function StudyPage() {
  const { user } = useAuth();
  const { topic: topicParam } = Route.useSearch();
  const navigate = useNavigate();
  const recorder = useRecorder();

  const [step, setStep] = useState<Step>(topicParam ? "question" : "upload");
  const [uploadMode, setUploadMode] = useState<"new_pdf" | "library">("new_pdf");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  // Grouping choice: "new_group" | "existing_group"
  const [groupChoice, setGroupChoice] = useState<"new_group" | "existing_group">("new_group");
  const [selectedExistingGroup, setSelectedExistingGroup] = useState<string>("");
  const [subjectChoice, setSubjectChoice] = useState<"auto" | "existing_subject" | "new_subject">("auto");
  const [selectedExistingSubject, setSelectedExistingSubject] = useState<string>("");

  // Grouping & Structure state
  const [structure, setStructure] = useState<MaterialStructure>({
    grupo: "",
    concurso: "",
    disciplina: "",
    assunto: "",
    topics: [],
  });

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

  // New custom topic draft
  const [newTopicName, setNewTopicName] = useState("");

  const runAnalyzeStructure = useServerFn(analyzeMaterialStructure);
  const runSaveStructure = useServerFn(saveCustomMaterialStructure);
  const runGenerateQuestion = useServerFn(generateQuestion);
  const runTranscribe = useServerFn(transcribeExplanation);
  const runEvaluate = useServerFn(evaluateExplanation);

  // Fetch library materials for existing groups & subjects
  const libraryQuery = useQuery({
    queryKey: ["library-materials-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_materials")
        .select("id, nome, grupo, concurso, disciplina, topics(id, nome, descricao, conceitos_principais)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Extract unique groups and subjects per group
  const existingGroupsMap: Record<string, { concurso: string; subjects: string[] }> = {};
  for (const m of libraryQuery.data ?? []) {
    const g = (m as any).grupo?.trim() || "Geral";
    if (!existingGroupsMap[g]) {
      existingGroupsMap[g] = {
        concurso: (m as any).concurso?.trim() || "Geral",
        subjects: [],
      };
    }
    const subj = m.nome?.trim();
    if (subj && !existingGroupsMap[g].subjects.includes(subj)) {
      existingGroupsMap[g].subjects.push(subj);
    }
  }

  const existingGroupNames = Object.keys(existingGroupsMap);

  // Clean up blob URL on unmount or file reset
  useEffect(() => {
    return () => {
      if (attachedFile?.url) {
        URL.revokeObjectURL(attachedFile.url);
      }
    };
  }, [attachedFile]);

  const uploadAndAnalyze = useMutation({
    mutationFn: async (file: File) => {
      setProgress("Lendo o PDF...");
      const { pages, text } = await extractPdfText(file);
      const fileUrl = URL.createObjectURL(file);
      const fileData: AttachedFile = {
        name: file.name,
        sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        pages,
        url: fileUrl,
        text,
      };
      setAttachedFile(fileData);

      setProgress("A Sentinela está identificando a estrutura do material (Concurso, Disciplina, Assunto e Tópicos)...");
      const response = await runAnalyzeStructure({
        data: { nome: file.name.replace(/\.pdf$/i, ""), paginas: pages, texto: text },
      });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: (data) => {
      setProgress(null);
      setStructure(data);

      // If user has existing groups and suggested group matches or we have groups, set options
      if (existingGroupNames.length > 0) {
        const match = existingGroupNames.find(
          (g) => g.toLowerCase() === data.grupo.toLowerCase() || g.toLowerCase().includes(data.concurso.toLowerCase()),
        );
        if (match) {
          setGroupChoice("existing_group");
          setSelectedExistingGroup(match);
        } else {
          setGroupChoice("new_group");
        }
      }

      setStep("structure");
      toast.success("Estrutura identificada pela Sentinela! Confira onde deseja organizar.");
    },
    onError: (error) => {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "Falha ao analisar o PDF.");
    },
  });

  const confirmStructure = useMutation({
    mutationFn: async () => {
      if (!attachedFile) throw new Error("Nenhum arquivo anexado.");
      const selectedTopics = structure.topics.filter((t) => t.selected);
      if (selectedTopics.length === 0) {
        throw new Error("Selecione pelo menos um tópico para estudar.");
      }

      const finalGroup =
        groupChoice === "existing_group" && selectedExistingGroup
          ? selectedExistingGroup
          : structure.grupo.trim() || "Geral";

      const finalSubject =
        subjectChoice === "existing_subject" && selectedExistingSubject
          ? selectedExistingSubject
          : structure.assunto.trim() || attachedFile.name.replace(/\.pdf$/i, "");

      setProgress("Salvando a organização do material...");
      const response = await runSaveStructure({
        data: {
          nome: finalSubject,
          arquivo: attachedFile.name,
          paginas: attachedFile.pages,
          texto: attachedFile.text,
          grupo: finalGroup,
          concurso: structure.concurso,
          disciplina: structure.disciplina,
          assunto: finalSubject,
          topics: selectedTopics.map((t) => ({
            nome: t.nome.trim(),
            descricao: t.descricao,
            conceitos_principais: t.conceitos_principais,
          })),
        },
      });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    onSuccess: (data) => {
      setProgress(null);
      setTopics(data.topics);
      setStep("topics");
      toast.success("Material organizado com sucesso! Escolha o tópico para iniciar sua explicação.");
    },
    onError: (error) => {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "Erro ao salvar estrutura.");
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
      setProgress("A Sentinela está analisando sua explicação com base no conteúdo selecionado...");
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
    uploadAndAnalyze.isPending ||
    confirmStructure.isPending ||
    question.isPending ||
    submitAudio.isPending ||
    evaluate.isPending;

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
    setStructure({ grupo: "", concurso: "", disciplina: "", assunto: "", topics: [] });
    setTopics([]);
    setTopicId(null);
    setTopicName("");
    setPergunta("");
    setTranscription("");
    setAudioPath(null);
    setResult(null);
    recorder.reset();
    setStep("upload");
    toast.info("Arquivo removido.");
  }

  function handleReplaceFile() {
    fileRef.current?.click();
  }

  function handleOpenPdf() {
    if (attachedFile?.url) {
      window.open(attachedFile.url, "_blank", "noopener,noreferrer");
    }
  }

  // Topic editing helpers
  function toggleTopicSelection(tempId: string) {
    setStructure((prev) => ({
      ...prev,
      topics: prev.topics.map((t) => (t.tempId === tempId ? { ...t, selected: !t.selected } : t)),
    }));
  }

  function updateTopicName(tempId: string, name: string) {
    setStructure((prev) => ({
      ...prev,
      topics: prev.topics.map((t) => (t.tempId === tempId ? { ...t, nome: name } : t)),
    }));
  }

  function deleteTopic(tempId: string) {
    setStructure((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t.tempId !== tempId),
    }));
    toast.info("Tópico removido da lista.");
  }

  function addNewTopic() {
    if (!newTopicName.trim()) return;
    const newTopic: IdentifiedTopic = {
      tempId: `custom-topic-${Date.now()}`,
      nome: newTopicName.trim(),
      descricao: "Tópico adicionado manualmente pelo aluno.",
      conceitos_principais: [],
      selected: true,
    };
    setStructure((prev) => ({
      ...prev,
      topics: [...prev.topics, newTopic],
    }));
    setNewTopicName("");
    toast.success("Novo tópico adicionado!");
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
          uploadAndAnalyze.mutate(file);
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

      {/* Step 1: Upload PDF OR Select from Library */}
      {step === "upload" && !attachedFile && (
        <div className="mt-6 space-y-6">
          <div className="flex rounded-lg bg-muted/40 p-1 border border-border">
            <button
              type="button"
              onClick={() => setUploadMode("new_pdf")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-colors ${
                uploadMode === "new_pdf" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="size-4" />
              Anexar Novo PDF
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("library")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-colors ${
                uploadMode === "library" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Library className="size-4" />
              Escolher da Minha Biblioteca
            </button>
          </div>

          {uploadMode === "new_pdf" && (
            <div className="card-surface p-8 text-center">
              <Upload className="mx-auto size-8 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Envie seu material de estudo</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                PDF com texto selecionável, até 20 MB. A Sentinela identifica a estrutura, concurso, disciplina e tópicos.
              </p>
              <Button className="mt-6 gap-2" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" />
                Escolher PDF
              </Button>
            </div>
          )}

          {uploadMode === "library" && (
            <div className="space-y-4">
              <div className="card-surface p-5">
                <h3 className="text-base font-semibold">Selecione o conteúdo para a Sentinela</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escolha um assunto inteiro ou clique no tópico específico que deseja explicar agora.
                </p>
              </div>

              {existingGroupNames.length === 0 && (
                <div className="card-surface p-8 text-center">
                  <Library className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Você ainda não possui materiais cadastrados na biblioteca.
                  </p>
                  <Button className="mt-4" onClick={() => setUploadMode("new_pdf")}>
                    Enviar primeiro PDF
                  </Button>
                </div>
              )}

              {existingGroupNames.map((gName) => {
                const groupInfo = existingGroupsMap[gName];
                const matsInGroup = (libraryQuery.data ?? []).filter((m: any) => (m.grupo?.trim() || "Geral") === gName);

                return (
                  <div key={gName} className="card-surface p-0 overflow-hidden border border-border/80">
                    <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-3">
                      <Folder className="size-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground uppercase">{gName}</h4>
                    </div>
                    <div className="divide-y divide-border/40 p-4 space-y-4">
                      {matsInGroup.map((mat: any) => (
                        <div key={mat.id} className="pt-2 first:pt-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">
                              🌐 {mat.nome}
                            </span>
                            {mat.disciplina && mat.disciplina !== "Geral" && (
                              <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {mat.disciplina}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-3 border-l-2 border-primary/20">
                            {(mat.topics ?? []).map((topic: any) => (
                              <button
                                key={topic.id}
                                type="button"
                                onClick={() => {
                                  setTopicId(topic.id);
                                  setTopicName(topic.nome);
                                  setPreviousExplanationId(null);
                                  question.mutate(topic.id);
                                }}
                                className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
                              >
                                <Sparkles className="size-3 text-primary" />
                                {topic.nome}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Structure and Grouping Configuration */}
      {step === "structure" && (
        <div className="mt-6 space-y-6">
          {/* Smart Sentinela Suggestion Alert */}
          <div className="card-surface border-primary/40 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Sparkles className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">
                  Identificação Automática da Sentinela
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Identificamos este conteúdo como <strong>{structure.assunto || "Assunto identificado"}</strong> para o grupo <strong>{structure.grupo || "Grupo sugerido"}</strong> ({structure.concurso || "Geral"}).
                </p>
                <p className="text-xs text-foreground font-medium pt-1">
                  Deseja organizar este material com essa estrutura ou personalizar?
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: "Onde deseja organizar este material?" */}
          <div className="card-surface p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-foreground">
                📁 Onde deseja organizar este material?
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escolha se deseja criar um novo grupo ou vincular a um grupo existente da sua biblioteca.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div
                onClick={() => setGroupChoice("new_group")}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  groupChoice === "new_group"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="groupChoice"
                    checked={groupChoice === "new_group"}
                    onChange={() => setGroupChoice("new_group")}
                    className="text-primary"
                  />
                  <span className="text-sm font-semibold">Criar novo grupo</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 pl-6">
                  Defina um novo grupo exclusivo (ex: GRUPO PMBA, GRUPO PCBA, GRUPO PF).
                </p>
              </div>

              <div
                onClick={() => {
                  setGroupChoice("existing_group");
                  if (!selectedExistingGroup && existingGroupNames.length > 0) {
                    setSelectedExistingGroup(existingGroupNames[0] ?? "");
                  }
                }}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  groupChoice === "existing_group"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="groupChoice"
                    checked={groupChoice === "existing_group"}
                    onChange={() => {
                      setGroupChoice("existing_group");
                      if (!selectedExistingGroup && existingGroupNames.length > 0) {
                        setSelectedExistingGroup(existingGroupNames[0] ?? "");
                      }
                    }}
                    className="text-primary"
                  />
                  <span className="text-sm font-semibold">Adicionar a um grupo existente</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 pl-6">
                  Vincular aos grupos já criados na sua biblioteca de estudos.
                </p>
              </div>
            </div>

            {/* Inputs based on choice */}
            {groupChoice === "new_group" ? (
              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/50">
                <div className="space-y-1.5">
                  <Label htmlFor="grupo" className="flex items-center gap-1.5 text-xs font-semibold">
                    <Folder className="size-3.5 text-primary" />
                    Nome do Novo Grupo
                  </Label>
                  <Input
                    id="grupo"
                    value={structure.grupo}
                    onChange={(e) => setStructure((prev) => ({ ...prev, grupo: e.target.value }))}
                    placeholder="Ex: GRUPO PMBA, GRUPO PCBA, GRUPO PF..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="concurso" className="flex items-center gap-1.5 text-xs font-semibold">
                    <GraduationCap className="size-3.5 text-primary" />
                    Concurso / Exame
                  </Label>
                  <Input
                    id="concurso"
                    value={structure.concurso}
                    onChange={(e) => setStructure((prev) => ({ ...prev, concurso: e.target.value }))}
                    placeholder="Ex: PMBA, PCBA, PF, PRF, ENEM..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <FolderOpen className="size-3.5 text-primary" />
                  Selecione o Grupo Existente:
                </Label>
                {existingGroupNames.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum grupo pré-existente. Crie seu primeiro grupo acima.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {existingGroupNames.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedExistingGroup(g)}
                        className={`flex items-center gap-2 rounded-md border p-3 text-left text-xs font-medium transition-all ${
                          selectedExistingGroup === g
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <Folder className="size-4 text-primary shrink-0" />
                        <span className="truncate">{g}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subject and Discipline Inputs */}
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label htmlFor="assunto" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Layers className="size-3.5 text-primary" />
                  Assunto Identificado / Nome do Módulo
                </Label>
                <Input
                  id="assunto"
                  value={structure.assunto}
                  onChange={(e) => setStructure((prev) => ({ ...prev, assunto: e.target.value }))}
                  placeholder="Ex: Redes de Computadores, Atos Administrativos..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="disciplina" className="flex items-center gap-1.5 text-xs font-semibold">
                  <BookOpen className="size-3.5 text-primary" />
                  Disciplina
                </Label>
                <Input
                  id="disciplina"
                  value={structure.disciplina}
                  onChange={(e) => setStructure((prev) => ({ ...prev, disciplina: e.target.value }))}
                  placeholder="Ex: Informática, Direito Constitucional..."
                />
              </div>
            </div>
          </div>

          {/* Topics Identified by Sentinela */}
          <div className="card-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">Tópicos e Subtópicos Identificados</h3>
                <p className="text-xs text-muted-foreground">
                  Marque os tópicos que deseja utilizar agora. Você pode renomear, excluir ou adicionar novos.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {structure.topics.filter((t) => t.selected).length} de {structure.topics.length} selecionados
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {structure.topics.map((t) => (
                <div
                  key={t.tempId}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                    t.selected ? "border-primary/40 bg-card" : "border-border/60 bg-muted/20 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={t.selected}
                    onChange={() => toggleTopicSelection(t.tempId)}
                    className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      value={t.nome}
                      onChange={(e) => updateTopicName(t.tempId, e.target.value)}
                      className="h-8 text-sm font-medium"
                    />
                    {t.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{t.descricao}</p>
                    )}
                    {t.conceitos_principais && t.conceitos_principais.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {t.conceitos_principais.map((c, i) => (
                          <span
                            key={i}
                            className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTopic(t.tempId)}
                    className="size-8 text-muted-foreground hover:text-error hover:bg-error/10 shrink-0"
                    title="Remover este tópico"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new custom topic */}
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Digitar novo tópico personalizado..."
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNewTopic();
                  }
                }}
                className="h-9 text-sm"
              />
              <Button variant="secondary" size="sm" onClick={addNewTopic} className="gap-1 shrink-0">
                <Plus className="size-4" />
                Adicionar Tópico
              </Button>
            </div>
          </div>

          {/* Hierarchy preview */}
          <div className="card-surface border-dashed p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estrutura Final na Biblioteca:
            </h4>
            <div className="mt-3 font-mono text-xs space-y-1 text-foreground">
              <p className="font-semibold text-primary">
                📁 {groupChoice === "existing_group" && selectedExistingGroup ? selectedExistingGroup : structure.grupo || "Sem grupo"}
              </p>
              <p className="pl-4 text-muted-foreground">
                └── 🌐 {structure.assunto || "Assunto"} ({structure.disciplina || "Geral"})
              </p>
              <p className="pl-8 text-xs text-muted-foreground">
                ├── 📄 {attachedFile?.name} ({attachedFile?.pages} pág.)
              </p>
              {structure.topics.filter((t) => t.selected).map((t, idx) => (
                <p key={idx} className="pl-8 text-xs text-foreground">
                  ├── 🏷️ Tópico: {t.nome}
                </p>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" onClick={handleRemoveFile} disabled={busy}>
              Cancelar e Escolher Outro PDF
            </Button>
            <Button
              disabled={busy || structure.topics.filter((t) => t.selected).length === 0}
              onClick={() => confirmStructure.mutate()}
              className="gap-2 px-6"
            >
              <Check className="size-4" />
              Confirmar e Iniciar Estudo
            </Button>
          </div>
        </div>
      )}

      {step === "topics" && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Escolha o assunto para explicar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A Sentinela irá formular uma pergunta aberta e desafiadora sobre o assunto selecionado.
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
  { key: "structure", label: "Estrutura & Grupo" },
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
