import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Edit2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
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
      { title: "Painel e Seus Materiais — SENTINELA" },
      {
        name: "description",
        content: "Biblioteca de materiais organizados por concurso e grupo para estudo com a Sentinela.",
      },
      { property: "og:title", content: "Painel — SENTINELA" },
      { property: "og:description", content: "Gerencie grupos, materiais e tópicos de estudo." },
    ],
  }),
  component: Dashboard,
});

type TopicItem = {
  id: string;
  nome: string;
  descricao?: string | null;
  conceitos_principais?: string[];
};

type MaterialItem = {
  id: string;
  nome: string;
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

  // Dialog states for deleting
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(null);
  const [deleteMaterialTarget, setDeleteMaterialTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<{ id: string; name: string } | null>(null);

  // Dialog states for editing material/group
  const [editMaterialData, setEditMaterialData] = useState<{
    id: string;
    nome: string;
    grupo: string;
    concurso: string;
    disciplina: string;
  } | null>(null);

  // Dialog state for adding a topic to an existing material
  const [addTopicTarget, setAddTopicTarget] = useState<{ materialId: string; materialName: string } | null>(null);
  const [newTopicInput, setNewTopicInput] = useState("");

  const materialsQuery = useQuery({
    queryKey: ["materials", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_materials")
        .select("id, nome, grupo, concurso, disciplina, quantidade_paginas, created_at, topics(id, nome, descricao, conceitos_principais)")
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

  // Delete whole group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupName: string) => {
      // Find all material IDs in this group
      const matchingMaterials = (materialsQuery.data ?? []).filter(
        (m) => (m.grupo || "Geral") === groupName,
      );
      const ids = matchingMaterials.map((m) => m.id);
      if (ids.length === 0) return;

      const { error } = await supabase.from("study_materials").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setDeleteGroupTarget(null);
      toast.success("Grupo e todos os materiais associados foram excluídos com sucesso.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir grupo.");
    },
  });

  // Delete single material/assunto mutation
  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const { error } = await supabase.from("study_materials").delete().eq("id", materialId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setDeleteMaterialTarget(null);
      toast.success("Assunto/material excluído com sucesso.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir material.");
    },
  });

  // Delete single topic mutation
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
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir tópico.");
    },
  });

  // Edit material metadata mutation
  const updateMaterialMutation = useMutation({
    mutationFn: async (data: { id: string; nome: string; grupo: string; concurso: string; disciplina: string }) => {
      const { error } = await supabase
        .from("study_materials")
        .update({
          nome: data.nome.trim(),
          grupo: data.grupo.trim() || "Geral",
          concurso: data.concurso.trim() || "Geral",
          disciplina: data.disciplina.trim() || "Geral",
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", user?.id] });
      setEditMaterialData(null);
      toast.success("Material atualizado com sucesso!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar material.");
    },
  });

  // Add new topic mutation
  const addTopicMutation = useMutation({
    mutationFn: async ({ materialId, nome }: { materialId: string; nome: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { error } = await supabase.from("topics").insert({
        material_id: materialId,
        user_id: user.id,
        nome: nome.trim(),
        descricao: "Tópico adicionado manualmente na biblioteca.",
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
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar tópico.");
    },
  });

  // Organize materials into groups
  const groupedMaterials: Record<string, MaterialItem[]> = {};
  for (const m of materialsQuery.data ?? []) {
    const g = m.grupo?.trim() || "Geral / Sem Grupo";
    if (!groupedMaterials[g]) {
      groupedMaterials[g] = [];
    }
    groupedMaterials[g].push(m);
  }

  const groupKeys = Object.keys(groupedMaterials);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Painel de Estudos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua biblioteca de materiais organizados por concurso e grupo para estudo com a Sentinela.
          </p>
        </div>
        <Link to="/study">
          <Button className="gap-2">
            <Plus className="size-4" /> Nova sessão de estudo
          </Button>
        </Link>
      </div>

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

      {/* Seus Materiais Header */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FolderOpen className="size-5 text-primary" />
            Seus Materiais Organizados
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grupos, concursos, disciplinas e tópicos de estudo. Clique em qualquer tópico para iniciar a explicação com a Sentinela.
          </p>
        </div>
        <Link to="/study">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <FilePlus2 className="size-3.5" />
            Adicionar novo PDF
          </Button>
        </Link>
      </div>

      {/* Materials Library */}
      <div className="mt-6 space-y-6">
        {materialsQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {groupKeys.length === 0 && !materialsQuery.isLoading && (
          <div className="card-surface p-10 text-center">
            <FileText className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 text-base font-semibold">Sua biblioteca está vazia</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Envie um PDF para que a Sentinela identifique e organize automaticamente seus grupos, matérias e tópicos.
            </p>
            <Link to="/study" className="mt-6 inline-block">
              <Button className="gap-2">
                <Plus className="size-4" /> Enviar primeiro PDF
              </Button>
            </Link>
          </div>
        )}

        {groupKeys.map((groupName) => {
          const itemsInGroup = groupedMaterials[groupName];
          const firstItem = itemsInGroup[0];
          const contestTag = firstItem?.concurso && firstItem.concurso !== "Geral" ? firstItem.concurso : null;

          return (
            <div key={groupName} className="card-surface overflow-hidden border border-border/80 p-0">
              {/* Group Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Folder className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold tracking-tight text-foreground">{groupName}</h3>
                      {contestTag && (
                        <span className="rounded bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {contestTag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {itemsInGroup.length} {itemsInGroup.length === 1 ? "assunto cadastrado" : "assuntos cadastrados"}
                    </p>
                  </div>
                </div>

                {/* Group Actions */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground hover:text-error hover:bg-error/10"
                    onClick={() => setDeleteGroupTarget(groupName)}
                    title="Excluir este grupo e todos os seus materiais"
                  >
                    <Trash2 className="size-3.5" />
                    Excluir grupo
                  </Button>
                </div>
              </div>

              {/* Subjects / Materials in this Group */}
              <div className="divide-y divide-border/40 p-5 space-y-5">
                {itemsInGroup.map((material) => (
                  <div key={material.id} className="pt-2 first:pt-0 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          📘 {material.nome}
                        </span>
                        {material.disciplina && material.disciplina !== "Geral" && (
                          <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] text-muted-foreground border border-border">
                            {material.disciplina}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          ({material.quantidade_paginas ?? 0} pág.)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setEditMaterialData({
                              id: material.id,
                              nome: material.nome,
                              grupo: material.grupo || groupName,
                              concurso: material.concurso || "Geral",
                              disciplina: material.disciplina || "Geral",
                            })
                          }
                          title="Editar assunto e grupo"
                        >
                          <Edit2 className="size-3" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary"
                          onClick={() => setAddTopicTarget({ materialId: material.id, materialName: material.nome })}
                          title="Adicionar novo tópico a este assunto"
                        >
                          <Plus className="size-3" />
                          Adicionar Tópico
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-error hover:bg-error/10"
                          onClick={() => setDeleteMaterialTarget({ id: material.id, name: material.nome })}
                          title="Excluir assunto"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Topics under this Subject */}
                    <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-primary/20">
                      {material.topics?.length === 0 && (
                        <span className="text-xs italic text-muted-foreground">
                          Nenhum tópico cadastrado neste assunto.
                        </span>
                      )}
                      {(material.topics ?? []).map((topic) => (
                        <div
                          key={topic.id}
                          className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary"
                        >
                          <Link
                            to="/study"
                            search={{ topic: topic.id }}
                            className="font-medium text-foreground hover:text-primary flex items-center gap-1.5"
                            title="Clique para iniciar uma explicação sobre este tópico com a Sentinela"
                          >
                            <Sparkles className="size-3 text-primary" />
                            {topic.nome}
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteTopicTarget({ id: topic.id, name: topic.nome });
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
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog: Delete Group */}
      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(open) => !open && setDeleteGroupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os assuntos, tópicos e arquivos associados ao grupo <strong>"{deleteGroupTarget}"</strong> serão removidos permanentemente. Você poderá reenviar os materiais no futuro quando quiser.
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

      {/* Confirmation Dialog: Delete Subject/Material */}
      <AlertDialog open={!!deleteMaterialTarget} onOpenChange={(open) => !open && setDeleteMaterialTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este assunto?</AlertDialogTitle>
            <AlertDialogDescription>
              O assunto <strong>"{deleteMaterialTarget?.name}"</strong> e todos os seus tópicos associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMaterialMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMaterialTarget && deleteMaterialMutation.mutate(deleteMaterialTarget.id)}
              disabled={deleteMaterialMutation.isPending}
              className="bg-error text-error-foreground hover:bg-error/90"
            >
              {deleteMaterialMutation.isPending ? "Excluindo..." : "Excluir assunto"}
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

      {/* Dialog: Edit Material / Group */}
      <Dialog open={!!editMaterialData} onOpenChange={(open) => !open && setEditMaterialData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Assunto e Grupo</DialogTitle>
          </DialogHeader>
          {editMaterialData && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-nome">Nome do Assunto</Label>
                <Input
                  id="edit-nome"
                  value={editMaterialData.nome}
                  onChange={(e) => setEditMaterialData({ ...editMaterialData, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-grupo">Grupo / Pasta</Label>
                <Input
                  id="edit-grupo"
                  value={editMaterialData.grupo}
                  onChange={(e) => setEditMaterialData({ ...editMaterialData, grupo: e.target.value })}
                  placeholder="Ex: Concurso PMBA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-concurso">Concurso / Exame</Label>
                <Input
                  id="edit-concurso"
                  value={editMaterialData.concurso}
                  onChange={(e) => setEditMaterialData({ ...editMaterialData, concurso: e.target.value })}
                  placeholder="Ex: PMBA, PF, OAB..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-disciplina">Disciplina</Label>
                <Input
                  id="edit-disciplina"
                  value={editMaterialData.disciplina}
                  onChange={(e) => setEditMaterialData({ ...editMaterialData, disciplina: e.target.value })}
                  placeholder="Ex: Informática, Direito Constitucional..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMaterialData(null)}>
              Cancelar
            </Button>
            <Button
              disabled={updateMaterialMutation.isPending || !editMaterialData?.nome.trim()}
              onClick={() => editMaterialData && updateMaterialMutation.mutate(editMaterialData)}
            >
              {updateMaterialMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Topic to Material */}
      <Dialog open={!!addTopicTarget} onOpenChange={(open) => !open && setAddTopicTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Tópico ao Assunto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Adicione um novo tópico de estudo ao assunto <strong>"{addTopicTarget?.materialName}"</strong>.
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
