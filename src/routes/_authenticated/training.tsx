import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BrainCircuit,
  Check,
  Eye,
  FileText,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractPdfText } from "@/lib/pdf";
import { analyzeLanguageProfile } from "@/lib/training.functions";
import {
  PROFILE_FIELDS,
  PROFILE_FIELD_LABELS,
  TRAINING_CATEGORIES,
  TRAINING_CATEGORY_LABELS,
  type LanguageProfile,
  type ProfileField,
  type TrainingCategory,
  type TrainingExample,
} from "@/lib/training-types";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [
      { title: "Treinamento da Sentinela — Ensine sua linguagem à IA" },
      {
        name: "description",
        content:
          "Envie exemplos em PDF ou texto e ensine à Sentinela seu vocabulário, tom, forma de explicar e padrão de materiais.",
      },
      { property: "og:title", content: "Treinamento da Sentinela" },
      {
        property: "og:description",
        content: "Perfil de linguagem e biblioteca de referências para a Sentinela escrever como você.",
      },
    ],
  }),
  component: TrainingPage,
});

const db = () => supabase as any;

function TrainingPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const runAnalysis = useServerFn(analyzeLanguageProfile);

  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<TrainingCategory>("linguagem");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<{ nome: string; paginas: number } | null>(null);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<TrainingExample | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TrainingExample | null>(null);
  const [draftProfile, setDraftProfile] = useState<Record<ProfileField, string> | null>(null);

  const examplesQuery = useQuery({
    queryKey: ["training-examples", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<TrainingExample[]> => {
      const { data, error } = await db()
        .from("training_examples")
        .select("id, titulo, categoria, origem, arquivo, quantidade_paginas, texto, ativo, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingExample[];
    },
  });

  const profileQuery = useQuery({
    queryKey: ["language-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<LanguageProfile | null> => {
      const { data, error } = await db()
        .from("language_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LanguageProfile | null;
    },
  });

  const profile = profileQuery.data ?? null;
  const profileValues = useMemo<Record<ProfileField, string>>(() => {
    if (draftProfile) return draftProfile;
    const base = {} as Record<ProfileField, string>;
    for (const field of PROFILE_FIELDS) base[field] = profile?.[field] ?? "";
    return base;
  }, [draftProfile, profile]);

  const activeCount = (examplesQuery.data ?? []).filter((e) => e.ativo).length;

  const resetForm = () => {
    setTitulo("");
    setTexto("");
    setArquivo(null);
  };

  const addExample = useMutation({
    mutationFn: async () => {
      const conteudo = texto.trim();
      if (conteudo.length < 100) {
        throw new Error("Escreva ou envie um exemplo com pelo menos 100 caracteres.");
      }
      const { error } = await db()
        .from("training_examples")
        .insert({
          user_id: user!.id,
          titulo: (titulo.trim() || arquivo?.nome || "Exemplo sem título").slice(0, 200),
          categoria,
          origem: arquivo ? "pdf" : "texto",
          arquivo: arquivo?.nome ?? null,
          quantidade_paginas: arquivo?.paginas ?? null,
          texto: conteudo.slice(0, 400000),
          ativo: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exemplo adicionado à biblioteca de referências.");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await db().from("training_examples").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-examples"] }),
    onError: () => toast.error("Não foi possível atualizar o exemplo."),
  });

  const removeExample = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("training_examples").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exemplo excluído.");
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
    },
    onError: () => toast.error("Não foi possível excluir o exemplo."),
  });

  const analyze = useMutation({
    mutationFn: async () => {
      const result = await runAnalysis({ data: {} });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      setDraftProfile(null);
      queryClient.setQueryData(["language-profile", user?.id], data);
      toast.success("A Sentinela atualizou o perfil da sua linguagem.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        user_id: user!.id,
        editado_manualmente: true,
      };
      for (const field of PROFILE_FIELDS) {
        payload[field] = profileValues[field].trim() || null;
      }
      const { data, error } = await db()
        .from("language_profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();
      if (error) throw error;
      return data as LanguageProfile;
    },
    onSuccess: (data) => {
      setDraftProfile(null);
      queryClient.setQueryData(["language-profile", user?.id], data);
      toast.success("Perfil de linguagem salvo.");
    },
    onError: () => toast.error("Não foi possível salvar o perfil."),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const { text, pages } = await extractPdfText(file);
      setTexto(text);
      setArquivo({ nome: file.name, paginas: pages });
      if (!titulo.trim()) setTitulo(file.name.replace(/\.pdf$/i, ""));
      toast.success(`PDF processado: ${pages} página(s) e ${text.length} caracteres.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler este PDF.");
    } finally {
      setReading(false);
    }
  }

  if (loading || adminLoading) {
    return (
      <AppShell>
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const examples = examplesQuery.data ?? [];

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <BrainCircuit className="size-3.5 text-primary" aria-hidden />
            Área administrativa
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Treinamento da Sentinela
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Ensine à Sentinela a sua linguagem, a sua forma de explicar e o seu padrão de materiais.
            Ela usa esses exemplos como referência de estilo — o conteúdo factual continua vindo do
            material de estudo.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="size-4 text-primary" aria-hidden />
            <h2 className="font-display text-lg font-semibold">Adicionar material de referência</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título do exemplo</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Aula de atos administrativos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Tipo de exemplo</Label>
              <Select
                value={categoria}
                onValueChange={(value) => setCategoria(value as TrainingCategory)}
              >
                <SelectTrigger id="categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_CATEGORIES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {TRAINING_CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="texto">Texto do exemplo</Label>
            <Textarea
              id="texto"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setArquivo(null);
              }}
              rows={8}
              placeholder="Cole aqui o seu texto, resumo, explicação ou questão comentada — ou envie um PDF."
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  id="pdf-treino"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" disabled={reading} asChild={!reading}>
                  {reading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Lendo PDF…
                    </span>
                  ) : (
                    <label htmlFor="pdf-treino" className="cursor-pointer">
                      <Upload className="mr-2 inline size-4" aria-hidden />
                      Enviar PDF
                    </label>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {arquivo
                    ? `${arquivo.nome} · ${arquivo.paginas} página(s)`
                    : `${texto.trim().length} caracteres`}
                </span>
              </div>
              <Button
                onClick={() => addExample.mutate()}
                disabled={addExample.isPending || reading || texto.trim().length < 100}
              >
                {addExample.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="mr-2 size-4" aria-hidden />
                )}
                Adicionar exemplo
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden />
              <h2 className="font-display text-lg font-semibold">
                O que a Sentinela aprendeu sobre minha linguagem
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => analyze.mutate()}
                disabled={analyze.isPending || activeCount === 0}
              >
                {analyze.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <BrainCircuit className="mr-2 size-4" aria-hidden />
                )}
                Analisar exemplos
              </Button>
              <Button
                size="sm"
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending || !draftProfile}
              >
                {saveProfile.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="mr-2 size-4" aria-hidden />
                )}
                Salvar revisão
              </Button>
            </div>
          </div>

          {profile ? (
            <p className="mb-4 text-xs text-muted-foreground">
              Baseado em {profile.exemplos_analisados} exemplo(s)
              {profile.editado_manualmente ? " · revisado por você" : ""} · atualizado em{" "}
              {new Date(profile.updated_at).toLocaleDateString("pt-BR")}
            </p>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              Ainda não há perfil. Adicione exemplos e clique em “Analisar exemplos”.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {PROFILE_FIELDS.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`profile-${field}`}>{PROFILE_FIELD_LABELS[field]}</Label>
                <Textarea
                  id={`profile-${field}`}
                  rows={4}
                  value={profileValues[field]}
                  onChange={(e) =>
                    setDraftProfile({ ...profileValues, [field]: e.target.value })
                  }
                  placeholder="Ainda sem informações — a Sentinela preenche ao analisar seus exemplos."
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden />
            <h2 className="font-display text-lg font-semibold">Biblioteca de referências</h2>
            <Badge variant="secondary">{activeCount} ativo(s)</Badge>
          </div>

          {examplesQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : examples.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum material de referência ainda. Adicione o primeiro exemplo acima.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {examples.map((example) => (
                <li key={example.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{example.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {TRAINING_CATEGORY_LABELS[example.categoria as TrainingCategory] ??
                        example.categoria}{" "}
                      · {example.origem === "pdf" ? "PDF" : "Texto"} · {example.texto.length}{" "}
                      caracteres ·{" "}
                      {new Date(example.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {example.ativo ? (
                        <Check className="size-3.5 text-primary" aria-hidden />
                      ) : null}
                      <Switch
                        checked={example.ativo}
                        aria-label="Ativar ou desativar exemplo"
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: example.id, ativo: checked })
                        }
                      />
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Visualizar exemplo"
                      onClick={() => setPreview(example)}
                    >
                      <Eye className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir exemplo"
                      onClick={() => setPendingDelete(example)}
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.titulo}</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{preview?.texto}</p>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este exemplo?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.titulo}” deixará de ser usado como referência de estilo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && removeExample.mutate(pendingDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
