import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Edit2,
  FilePlus2,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  Layers,
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
  X,
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Seus Materiais Organizados — SENTINELA" },
      {
        name: "description",
        content: "Biblioteca de estudos hierárquica (Grupo → Assunto → Materiais/Tópicos) para concursos com a Sentinela.",
      },
      { property: "og:title", content: "Painel — SENTINELA" },
      { property: "og:description", content: "Gerencie grupos, materiais e tópicos de estudo." },
    ],
  }),
  component: Dashboard,
});

type TopicItem = {
  id: string;
  material_id?: string;
  nome: string;
  descricao?: string | null;
  conceitos_principais?: string[];
};

type MaterialItem = {
  id: string;
  nome: string;
  arquivo?: string | null;
  grupo?: string | null;
  concurso?: string | null;
  disciplina?: string | null;
  quantidade_paginas?: number | null;
  created_at: string;
  topics: TopicItem[];
};

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Expansion state for Groups and Subjects
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Dialog states for creation
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupConcurso, setNewGroupConcurso] = useState("");

  const [createSubjectTargetGroup, setCreateSubjectTargetGroup] = useState<string | null>(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDisciplina, setNewSubjectDisciplina] = useState("");

  // Dialog states for editing
  const [editGroupTarget, setEditGroupTarget] = useState<{ oldName: string; newName: string; concurso: string } | null>(null);
  const [editSubjectTarget, setEditSubjectTarget] = useState<{
    groupName: string;
    oldSubjectName: string;
    newSubjectName: string;
    disciplina: string;
    materialIds: string[];
  } | null>(null);

  // Dialog state for moving material
  const [moveMaterialTarget, setMoveMaterialTarget] = useState<{
    materialId: string;
    filename: string;
    currentGroup: string;
    currentSubject: string;
    destinationGroup: string;
    destinationSubject: string;
  } | null>(null);

  // Dialog states for deleting
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<{ groupName: string; subjectName: string; ids: string[] } | null>(null);
  const [deleteMaterialTarget, setDeleteMaterialTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<{ id: string; name: string } | null>(null);

  // Dialog state for adding a topic
  const [addTopicTarget, setAddTopicTarget] = useState<{ materialId: string; subjectName: string } | null>(null);
  const [newTopicInput, setNewTopicInput] = useState("");

  const materialsQuery = useQuery({
    queryKey: ["materials", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_materials")
        .select("id, nome, arquivo, grupo, concurso, disciplina, quantidade_paginas, created_at, topics(id, nome, descricao, conceitos_principais)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MaterialItem[];
    },
  });

  const stats = useQuery({
    queryKey: ["stats", user?.id],
    enabled: !!user,
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

  // Grouping into GRUPO -> ASSUNTOS -> MATERIAIS + TÓPICOS
  type SubjectBucket = {
    subjectName: string;
    disciplina: string;
    concurso: string;
    materialIds: string[];
    files: Array<{ id: string; filename: string; pages: number; created_at: string }>;
    topics: Array<{ id: string; nome: string; materialId: string }>;
  };

  type GroupBucket = {
    groupName: string;
    concurso: string;
    subjects: Record<string, SubjectBucket>;
  };

  const groupBuckets: Record<string, GroupBucket> = {};

  for (const m of materialsQuery.data ?? []) {
    const groupName = m.grupo?.trim() || "Geral";
    const subjectName = m.nome?.trim() || "Assunto Geral";

    if (!groupBuckets[groupName]) {
      groupBuckets[groupName] = {
        groupName,
        concurso: m.concurso?.trim() || "Geral",
        subjects: {},
      };
    }

    if (!groupBuckets[groupName].subjects[subjectName]) {
      groupBuckets[groupName].subjects[subjectName] = {
        subjectName,
        disciplina: m.disciplina?.trim() || "Geral",
        concurso: m.concurso?.trim() || "Geral",
        materialIds: [],
        files: [],
        topics: [],
      };
    }

    const sub = groupBuckets[groupName].subjects[subjectName];
    sub.materialIds.push(m.id);

    const filename = m.arquivo || `${m.nome}.pdf`;
    sub.files.push({
      id: m.id,
      filename,
      pages: m.quantidade_paginas ?? 1,
      created_at: m.created_at,
    });

    for (const t of m.topics ?? []) {
      if (!sub.topics.some((existing) => existing.nome.toLowerCase() === t.nome.toLowerCase())) {
        sub.topics.push({ id: t.id, nome: t.nome, materialId: m.id });
      }
    }
  }

  const groupKeys = Object.keys(groupBuckets);

  // Initialize expansion state on first load (default all expanded)
  useEffect(() => {
    if (groupKeys.length > 0) {
      setExpandedGroups((prev) => {
        const next = { ...prev };
        groupKeys.forEach((k) => {
          if (next[k] === undefined) next[k] = true;
        });
        return next;
      });

      setExpandedSubjects((prev) => {
        const next = { ...prev };
        groupKeys.forEach((g) => {
          Object.keys(groupBuckets[g].subjects).forEach((s) => {
            const composite = `${g}:::${s}`;
            if (next[composite] === undefined) next[composite] = true;
          });
        });
        return next;
      });
    }
  }, [materialsQuery.data]);

  function toggleGroupExpansion(groupName: string) {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: prev[groupName] !== undefined ? !prev[groupName] : false,
    }));
  }

  function toggleSubjectExpansion(groupName: string, subjectName: string) {
    const key = `${groupName}:::${subjectName}`;
    setExpandedSubjects((prev) => ({
      ...prev,
      [key]: prev[key] !== undefined ? !prev[key] : false,
    }));
  }

  // --- Mutations ---

  // 1. Create Group (by placeholder material or structure)
  const createGroupMutation = useMutation({
    mutationFn: async ({ name, concurso }: { name: string; concurso: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { error } = await supabase.from("study_materials").insert({
        user_id: user.id,
        nome: "Introdução ao Estudo",
        grupo: name.trim(),
        concurso: concurso.trim() || "Geral",
        disciplina: "Geral",
        quantidade_paginas: 0,
        texto_extraido: "Material inicial do grupo.",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setIsCreateGroupOpen(false);
      setNewGroupName("");
      setNewGroupConcurso("");
      toast.success("Grupo criado com sucesso!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar grupo."),
  });

  // 2. Create Subject in Group
  const createSubjectMutation = useMutation({
    mutationFn: async ({ groupName, subjectName, disciplina }: { groupName: string; subjectName: string; disciplina: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { error } = await supabase.from("study_materials").insert({
        user_id: user.id,
        nome: subjectName.trim(),
        grupo: groupName.trim(),
        concurso: groupBuckets[groupName]?.concurso || "Geral",
        disciplina: disciplina.trim() || "Geral",
        quantidade_paginas: 0,
        texto_extraido: `Módulo de estudo para ${subjectName}.`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setCreateSubjectTargetGroup(null);
      setNewSubjectName("");
      setNewSubjectDisciplina("");
      toast.success("Novo assunto criado no grupo!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar assunto."),
  });

  // 3. Rename Group across all its materials
  const renameGroupMutation = useMutation({
    mutationFn: async ({ oldName, newName, concurso }: { oldName: string; newName: string; concurso: string }) => {
      const { error } = await supabase
        .from("study_materials")
        .update({ grupo: newName.trim(), concurso: concurso.trim() || "Geral" })
        .eq("grupo", oldName);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setEditGroupTarget(null);
      toast.success("Grupo renomeado com sucesso!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao renomear grupo."),
  });

  // 4. Rename Subject across its materials
  const renameSubjectMutation = useMutation({
    mutationFn: async ({ materialIds, newSubjectName, disciplina }: { materialIds: string[]; newSubjectName: string; disciplina: string }) => {
      const { error } = await supabase
        .from("study_materials")
        .update({ nome: newSubjectName.trim(), disciplina: disciplina.trim() || "Geral" })
        .in("id", materialIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setEditSubjectTarget(null);
      toast.success("Assunto atualizado com sucesso!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar assunto."),
  });

  // 5. Move Material to another Group or Subject
  const moveMaterialMutation = useMutation({
    mutationFn: async ({ materialId, destinationGroup, destinationSubject }: { materialId: string; destinationGroup: string; destinationSubject: string }) => {
      const { error } = await supabase
        .from("study_materials")
        .update({
          grupo: destinationGroup.trim(),
          nome: destinationSubject.trim(),
        })
        .eq("id", materialId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setMoveMaterialTarget(null);
      toast.success("Material movido com sucesso!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao mover material."),
  });

  // 6. Delete Group
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupName: string) => {
      const matching = (materialsQuery.data ?? []).filter((m) => (m.grupo || "Geral") === groupName);
      const ids = matching.map((m) => m.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("study_materials").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setDeleteGroupTarget(null);
      toast.success("Grupo e todos os assuntos associados foram removidos.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir grupo."),
  });

  // 7. Delete Subject
  const deleteSubjectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("study_materials").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setDeleteSubjectTarget(null);
      toast.success("Assunto e materiais associados foram excluídos.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir assunto."),
  });

  // 8. Delete Material
  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const { error } = await supabase.from("study_materials").delete().eq("id", materialId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setDeleteMaterialTarget(null);
      toast.success("Material excluído.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir material."),
  });

  // 9. Delete Topic
  const deleteTopicMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const { error } = await supabase.from("topics").delete().eq("id", topicId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setDeleteTopicTarget(null);
      toast.success("Tópico excluído.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir tópico."),
  });

  // 10. Add Topic to Material
  const addTopicMutation = useMutation({
    mutationFn: async ({ materialId, nome }: { materialId: string; nome: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { error } = await supabase.from("topics").insert({
        material_id: materialId,
        user_id: user.id,
        nome: nome.trim(),
        descricao: "Tópico adicionado manualmente pelo aluno.",
        conceitos_principais: [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setAddTopicTarget(null);
      setNewTopicInput("");
      toast.success("Novo tópico adicionado ao assunto!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao adicionar tópico."),
  });

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Painel de Estudos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua biblioteca personalizada organizada por Grupos, Concursos e Assuntos com a Sentinela.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCreateGroupOpen(true)} className="gap-1.5">
            <FolderPlus className="size-4" /> Criar grupo
          </Button>
          <Link to="/study">
            <Button className="gap-2">
              <Plus className="size-4" /> Nova sessão de estudo
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Explicações realizadas", value: stats.data?.total ?? 0 },
          { label: "Média geral", value: stats.data?.media !== null && stats.data?.media !== undefined ? `${stats.data.media} / 100` : "—" },
          { label: "Última pontuação", value: stats.data?.ultima ?? "—" },
        ].map((card) => (
          <div key={card.label} className="card-surface p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Seus Materiais Organizados Header */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <FolderOpen className="size-5 text-primary" />
            Seus Materiais Organizados
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hierarquia: <strong>📁 GRUPO → 📚 ASSUNTO → 📄 MATERIAIS → 🔎 TÓPICOS IDENTIFICADOS PELA SENTINELA</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/study">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FilePlus2 className="size-3.5" />
              Anexar Novo PDF
            </Button>
          </Link>
        </div>
      </div>

      {/* Grouped Library Tree with Expand & Collapse */}
      <div className="mt-6 space-y-6">
        {materialsQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {groupKeys.length === 0 && !materialsQuery.isLoading && (
          <div className="card-surface p-10 text-center">
            <FileText className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 text-base font-semibold">Sua biblioteca está vazia</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Envie um PDF para que a Sentinela identifique e organize automaticamente seus grupos, matérias e tópicos.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button onClick={() => setIsCreateGroupOpen(true)} variant="outline" className="gap-2">
                <FolderPlus className="size-4" /> Criar Primeiro Grupo
              </Button>
              <Link to="/study">
                <Button className="gap-2">
                  <Plus className="size-4" /> Anexar Primeiro PDF
                </Button>
              </Link>
            </div>
          </div>
        )}

        {groupKeys.map((groupName) => {
          const groupBucket = groupBuckets[groupName];
          const subjectList = Object.values(groupBucket.subjects);
          const isGroupExpanded = expandedGroups[groupName] !== false;

          return (
            <div key={groupName} className="card-surface overflow-hidden border border-border/80 p-0 shadow-sm transition-all">
              {/* 1. Group Header (📁 GRUPO) with Expansão/Contração */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-5 py-3.5">
                <div
                  className="flex items-center gap-3 cursor-pointer select-none"
                  onClick={() => toggleGroupExpansion(groupName)}
                >
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    title={isGroupExpanded ? "Recolher grupo" : "Expandir grupo"}
                  >
                    {isGroupExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>

                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <Folder className="size-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold tracking-tight text-foreground uppercase">
                        📁 {groupName}
                      </h3>
                      {groupBucket.concurso && groupBucket.concurso !== "Geral" && (
                        <span className="rounded bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {groupBucket.concurso}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {subjectList.length} {subjectList.length === 1 ? "assunto" : "assuntos"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Botão + ADICIONAR MATERIAL no grupo */}
                  <Link to="/study">
                    <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold">
                      <Plus className="size-3.5" />
                      ADICIONAR MATERIAL
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setCreateSubjectTargetGroup(groupName)}
                    title="Criar novo assunto neste grupo"
                  >
                    <BookOpen className="size-3.5" />
                    Novo Assunto
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setEditGroupTarget({
                            oldName: groupName,
                            newName: groupName,
                            concurso: groupBucket.concurso,
                          })
                        }
                      >
                        <Edit2 className="mr-2 size-3.5" /> Renomear grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-error focus:text-error"
                        onClick={() => setDeleteGroupTarget(groupName)}
                      >
                        <Trash2 className="mr-2 size-3.5" /> Excluir grupo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* 2. Subjects List inside this Group (Expandable) */}
              {isGroupExpanded && (
                <div className="divide-y divide-border/50 p-5 space-y-6">
                  {subjectList.length === 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      Nenhum assunto cadastrado neste grupo. Clique em "Adicionar Material" para começar.
                    </div>
                  )}

                  {subjectList.map((subject) => {
                    const subjectKey = `${groupName}:::${subject.subjectName}`;
                    const isSubjectExpanded = expandedSubjects[subjectKey] !== false;

                    return (
                      <div key={subject.subjectName} className="pt-4 first:pt-0 space-y-4">
                        {/* Subject Bar with Expansão/Contração */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-2 cursor-pointer select-none"
                            onClick={() => toggleSubjectExpansion(groupName, subject.subjectName)}
                          >
                            <button
                              type="button"
                              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            >
                              {isSubjectExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            </button>

                            <span className="text-base font-bold text-foreground hover:text-primary transition-colors">
                              🌐 {subject.subjectName}
                            </span>
                            {subject.disciplina && subject.disciplina !== "Geral" && (
                              <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted-foreground border border-border">
                                {subject.disciplina}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary"
                              onClick={() =>
                                setAddTopicTarget({
                                  materialId: subject.materialIds[0],
                                  subjectName: subject.subjectName,
                                })
                              }
                            >
                              <Plus className="size-3" />
                              Tópico
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-7">
                                  <MoreVertical className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    setEditSubjectTarget({
                                      groupName,
                                      oldSubjectName: subject.subjectName,
                                      newSubjectName: subject.subjectName,
                                      disciplina: subject.disciplina,
                                      materialIds: subject.materialIds,
                                    })
                                  }
                                >
                                  <Edit2 className="mr-2 size-3.5" /> Renomear assunto
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-error focus:text-error"
                                  onClick={() =>
                                    setDeleteSubjectTarget({
                                      groupName,
                                      subjectName: subject.subjectName,
                                      ids: subject.materialIds,
                                    })
                                  }
                                >
                                  <Trash2 className="mr-2 size-3.5" /> Excluir assunto
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Subject Content (Files & Topics) - Expandable */}
                        {isSubjectExpanded && (
                          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                            {/* Attached Files (📄 MATERIAIS) */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Materiais Anexados ({subject.files.length}):
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {subject.files.map((file) => (
                                  <div
                                    key={file.id}
                                    className="flex items-center justify-between rounded-md border border-border/80 bg-background/60 px-3 py-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2 truncate min-w-0">
                                      <FileText className="size-3.5 text-primary shrink-0" />
                                      <span className="truncate font-medium text-foreground">{file.filename}</span>
                                      <span className="text-[11px] text-muted-foreground shrink-0">
                                        ({file.pages} pág.)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 text-muted-foreground hover:text-primary"
                                        onClick={() =>
                                          setMoveMaterialTarget({
                                            materialId: file.id,
                                            filename: file.filename,
                                            currentGroup: groupName,
                                            currentSubject: subject.subjectName,
                                            destinationGroup: groupName,
                                            destinationSubject: subject.subjectName,
                                          })
                                        }
                                        title="Mover material para outro grupo ou assunto"
                                      >
                                        <FolderInput className="size-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 text-muted-foreground hover:text-error hover:bg-error/10"
                                        onClick={() => setDeleteMaterialTarget({ id: file.id, name: file.filename })}
                                        title="Excluir este arquivo"
                                      >
                                        <Trash2 className="size-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Topics (🔎 TÓPICOS IDENTIFICADOS PELA SENTINELA) */}
                            <div className="space-y-2 pt-1">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Sparkles className="size-3 text-primary" />
                                Tópicos identificados pela Sentinela:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {subject.topics.length === 0 && (
                                  <span className="text-xs italic text-muted-foreground">
                                    Nenhum tópico cadastrado neste assunto.
                                  </span>
                                )}
                                {subject.topics.map((t) => (
                                  <div
                                    key={t.id}
                                    className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary"
                                  >
                                    <Link
                                      to="/study"
                                      search={{ topic: t.id }}
                                      className="font-medium text-foreground hover:text-primary flex items-center gap-1.5"
                                      title="Clique para explicar este tópico por áudio com a Sentinela"
                                    >
                                      <span className="size-1.5 rounded-full bg-primary" />
                                      {t.nome}
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDeleteTopicTarget({ id: t.id, name: t.nome });
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-error transition-opacity pl-1"
                                      title="Remover tópico"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog: Create Group */}
      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Grupo de Estudos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-group-name">Nome do Grupo</Label>
              <Input
                id="create-group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: GRUPO PMBA, GRUPO PCBA, GRUPO PF..."
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-group-concurso">Concurso / Órgão</Label>
              <Input
                id="create-group-concurso"
                value={newGroupConcurso}
                onChange={(e) => setNewGroupConcurso(e.target.value)}
                placeholder="Ex: PMBA, PCBA, PF, PRF, OAB..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateGroupOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={createGroupMutation.isPending || !newGroupName.trim()}
              onClick={() => createGroupMutation.mutate({ name: newGroupName, concurso: newGroupConcurso })}
            >
              {createGroupMutation.isPending ? "Criando..." : "Criar Grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Create Subject in Group */}
      <Dialog open={!!createSubjectTargetGroup} onOpenChange={(open) => !open && setCreateSubjectTargetGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Assunto no Grupo "{createSubjectTargetGroup}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-subj-name">Nome do Assunto</Label>
              <Input
                id="create-subj-name"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Ex: Redes de Computadores, Direito Penal..."
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-subj-disc">Disciplina (Opcional)</Label>
              <Input
                id="create-subj-disc"
                value={newSubjectDisciplina}
                onChange={(e) => setNewSubjectDisciplina(e.target.value)}
                placeholder="Ex: Informática, Legislação..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSubjectTargetGroup(null)}>
              Cancelar
            </Button>
            <Button
              disabled={createSubjectMutation.isPending || !newSubjectName.trim()}
              onClick={() =>
                createSubjectTargetGroup &&
                createSubjectMutation.mutate({
                  groupName: createSubjectTargetGroup,
                  subjectName: newSubjectName,
                  disciplina: newSubjectDisciplina,
                })
              }
            >
              {createSubjectMutation.isPending ? "Criando..." : "Criar Assunto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rename Group */}
      <Dialog open={!!editGroupTarget} onOpenChange={(open) => !open && setEditGroupTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Grupo</DialogTitle>
          </DialogHeader>
          {editGroupTarget && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-grp-name">Nome do Grupo</Label>
                <Input
                  id="edit-grp-name"
                  value={editGroupTarget.newName}
                  onChange={(e) => setEditGroupTarget({ ...editGroupTarget, newName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-grp-concurso">Concurso / Órgão</Label>
                <Input
                  id="edit-grp-concurso"
                  value={editGroupTarget.concurso}
                  onChange={(e) => setEditGroupTarget({ ...editGroupTarget, concurso: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={renameGroupMutation.isPending || !editGroupTarget?.newName.trim()}
              onClick={() => editGroupTarget && renameGroupMutation.mutate(editGroupTarget)}
            >
              {renameGroupMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rename Subject */}
      <Dialog open={!!editSubjectTarget} onOpenChange={(open) => !open && setEditSubjectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Assunto</DialogTitle>
          </DialogHeader>
          {editSubjectTarget && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-sbj-name">Nome do Assunto</Label>
                <Input
                  id="edit-sbj-name"
                  value={editSubjectTarget.newSubjectName}
                  onChange={(e) => setEditSubjectTarget({ ...editSubjectTarget, newSubjectName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-sbj-disc">Disciplina</Label>
                <Input
                  id="edit-sbj-disc"
                  value={editSubjectTarget.disciplina}
                  onChange={(e) => setEditSubjectTarget({ ...editSubjectTarget, disciplina: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSubjectTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={renameSubjectMutation.isPending || !editSubjectTarget?.newSubjectName.trim()}
              onClick={() => editSubjectTarget && renameSubjectMutation.mutate(editSubjectTarget)}
            >
              {renameSubjectMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Move Material to another Group or Subject */}
      <Dialog open={!!moveMaterialTarget} onOpenChange={(open) => !open && setMoveMaterialTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover Material</DialogTitle>
          </DialogHeader>
          {moveMaterialTarget && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Mover o arquivo <strong>"{moveMaterialTarget.filename}"</strong> para outro grupo ou assunto.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="move-dest-group">Grupo de Destino</Label>
                <Input
                  id="move-dest-group"
                  value={moveMaterialTarget.destinationGroup}
                  onChange={(e) => setMoveMaterialTarget({ ...moveMaterialTarget, destinationGroup: e.target.value })}
                  placeholder="Ex: GRUPO PMBA"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="move-dest-subject">Assunto de Destino</Label>
                <Input
                  id="move-dest-subject"
                  value={moveMaterialTarget.destinationSubject}
                  onChange={(e) => setMoveMaterialTarget({ ...moveMaterialTarget, destinationSubject: e.target.value })}
                  placeholder="Ex: Redes de Computadores"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveMaterialTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={moveMaterialMutation.isPending || !moveMaterialTarget?.destinationSubject.trim()}
              onClick={() => moveMaterialTarget && moveMaterialMutation.mutate(moveMaterialTarget)}
            >
              {moveMaterialMutation.isPending ? "Movendo..." : "Mover Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Delete Group */}
      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(open) => !open && setDeleteGroupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os assuntos, tópicos e arquivos associados a este grupo serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGroupMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupTarget && deleteGroupMutation.mutate(deleteGroupTarget)}
              disabled={deleteGroupMutation.isPending}
              className="bg-error text-error-foreground hover:bg-error/90"
            >
              {deleteGroupMutation.isPending ? "Excluindo..." : "Excluir grupo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete Subject */}
      <AlertDialog open={!!deleteSubjectTarget} onOpenChange={(open) => !open && setDeleteSubjectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este assunto?</AlertDialogTitle>
            <AlertDialogDescription>
              O assunto <strong>"{deleteSubjectTarget?.subjectName}"</strong> e todos os seus materiais e tópicos associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubjectMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSubjectTarget && deleteSubjectMutation.mutate(deleteSubjectTarget.ids)}
              disabled={deleteSubjectMutation.isPending}
              className="bg-error text-error-foreground hover:bg-error/90"
            >
              {deleteSubjectMutation.isPending ? "Excluindo..." : "Excluir assunto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete Material */}
      <AlertDialog open={!!deleteMaterialTarget} onOpenChange={(open) => !open && setDeleteMaterialTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este material?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o arquivo <strong>"{deleteMaterialTarget?.name}"</strong> da sua biblioteca?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMaterialMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMaterialTarget && deleteMaterialMutation.mutate(deleteMaterialTarget.id)}
              disabled={deleteMaterialMutation.isPending}
              className="bg-error text-error-foreground hover:bg-error/90"
            >
              {deleteMaterialMutation.isPending ? "Excluindo..." : "Excluir material"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete Topic */}
      <AlertDialog open={!!deleteTopicTarget} onOpenChange={(open) => !open && setDeleteTopicTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este tópico?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o tópico <strong>"{deleteTopicTarget?.name}"</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTopicMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTopicTarget && deleteTopicMutation.mutate(deleteTopicTarget.id)}
              disabled={deleteTopicMutation.isPending}
              className="bg-error text-error-foreground hover:bg-error/90"
            >
              {deleteTopicMutation.isPending ? "Excluindo..." : "Excluir tópico"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Add Topic */}
      <Dialog open={!!addTopicTarget} onOpenChange={(open) => !open && setAddTopicTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Tópico ao Assunto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Adicione um novo tópico de estudo ao assunto <strong>"{addTopicTarget?.subjectName}"</strong>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-topic-name">Nome do Tópico</Label>
              <Input
                id="new-topic-name"
                value={newTopicInput}
                onChange={(e) => setNewTopicInput(e.target.value)}
                placeholder="Ex: Protocolo TCP/IP, Princípio da Legalidade..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTopicInput.trim() && addTopicTarget) {
                    e.preventDefault();
                    addTopicMutation.mutate({ materialId: addTopicTarget.materialId, nome: newTopicInput });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTopicTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={addTopicMutation.isPending || !newTopicInput.trim()}
              onClick={() =>
                addTopicTarget &&
                addTopicMutation.mutate({ materialId: addTopicTarget.materialId, nome: newTopicInput })
              }
            >
              {addTopicMutation.isPending ? "Adicionando..." : "Adicionar Tópico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
