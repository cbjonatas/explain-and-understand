import { supabase } from "@/integrations/supabase/client";

export interface LibraryTopic {
  id: string;
  nome: string;
  descricao?: string | null;
  conceitos_principais?: string[];
  material_id?: string;
}

export interface LibraryMaterial {
  id: string;
  nome: string;
  arquivo: string;
  quantidade_paginas: number;
  created_at: string;
}

export interface LibrarySubject {
  id?: string;
  nome: string;
  disciplina: string;
  materials: LibraryMaterial[];
  topics: LibraryTopic[];
}

export interface LibraryGroup {
  id?: string;
  nome: string;
  concurso: string;
  subjects: LibrarySubject[];
}

/**
 * Loads the complete hierarchical study library for the authenticated user:
 * Group -> Subjects -> Materials/Files + Topics
 */
export async function fetchFullLibraryStructure(userId: string): Promise<LibraryGroup[]> {
  if (!userId) return [];

  // 1. Query study_materials & topics (the base tables that always exist)
  let materialsData: any[] = [];
  try {
    const { data, error } = await supabase
      .from("study_materials")
      .select("id, nome, arquivo, grupo, concurso, disciplina, quantidade_paginas, created_at, topics(id, nome, descricao, conceitos_principais)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // If error might be missing columns, fallback to basic select
      const fallback = await supabase
        .from("study_materials")
        .select("id, nome, arquivo, quantidade_paginas, created_at, topics(id, nome, descricao, conceitos_principais)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      materialsData = fallback.data ?? [];
    } else {
      materialsData = data ?? [];
    }
  } catch (err) {
    console.warn("Aviso ao carregar materiais:", err);
  }

  // 2. Try querying explicit study_groups table if available
  let groupsData: any[] = [];
  try {
    const { data } = await supabase
      .from("study_groups")
      .select("id, nome, concurso, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) groupsData = data;
  } catch {
    // study_groups table might not exist yet
  }

  // 3. Try querying explicit study_subjects table if available
  let subjectsData: any[] = [];
  try {
    const { data } = await supabase
      .from("study_subjects")
      .select("id, group_id, nome, disciplina, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) subjectsData = data;
  } catch {
    // study_subjects table might not exist yet
  }

  // 4. Build Group Map
  const groupMap: Record<string, LibraryGroup> = {};

  // Seed with explicit groups
  for (const g of groupsData) {
    const gName = g.nome.trim();
    if (!groupMap[gName]) {
      groupMap[gName] = {
        id: g.id,
        nome: gName,
        concurso: g.concurso || "Geral",
        subjects: [],
      };
    }
  }

  // Subject helper map inside groups
  const subjectMap: Record<string, Record<string, LibrarySubject>> = {};

  // Seed with explicit subjects
  for (const s of subjectsData) {
    const parentGroup = groupsData.find((g) => g.id === s.group_id);
    const gName = parentGroup ? parentGroup.nome.trim() : "Geral";
    if (!groupMap[gName]) {
      groupMap[gName] = {
        id: parentGroup?.id,
        nome: gName,
        concurso: parentGroup?.concurso || "Geral",
        subjects: [],
      };
    }
    if (!subjectMap[gName]) subjectMap[gName] = {};

    const sName = s.nome.trim();
    if (!subjectMap[gName][sName]) {
      subjectMap[gName][sName] = {
        id: s.id,
        nome: sName,
        disciplina: s.disciplina || "Geral",
        materials: [],
        topics: [],
      };
    }
  }

  // Map all materials and their topics into the hierarchy
  for (const m of materialsData) {
    const gName = (m.grupo?.trim() || "Geral");
    const sName = (m.nome?.trim() || "Assunto Geral");
    const concurso = m.concurso?.trim() || "Geral";
    const disciplina = m.disciplina?.trim() || "Geral";

    if (!groupMap[gName]) {
      groupMap[gName] = {
        nome: gName,
        concurso,
        subjects: [],
      };
    }

    if (!subjectMap[gName]) subjectMap[gName] = {};

    if (!subjectMap[gName][sName]) {
      subjectMap[gName][sName] = {
        nome: sName,
        disciplina,
        materials: [],
        topics: [],
      };
    }

    const targetSubject = subjectMap[gName][sName];

    // Only add material file if it's a real document (has pages or text or arquivo)
    if (m.arquivo || m.quantidade_paginas > 0 || m.texto_extraido?.length > 0) {
      const filename = m.arquivo || `${sName}.pdf`;
      if (!targetSubject.materials.some((existing) => existing.id === m.id)) {
        targetSubject.materials.push({
          id: m.id,
          nome: sName,
          arquivo: filename,
          quantidade_paginas: m.quantidade_paginas ?? 1,
          created_at: m.created_at,
        });
      }
    }

    // Add topics
    for (const t of m.topics ?? []) {
      if (!targetSubject.topics.some((existing) => existing.nome.toLowerCase() === t.nome.toLowerCase())) {
        targetSubject.topics.push({
          id: t.id,
          nome: t.nome,
          descricao: t.descricao,
          conceitos_principais: t.conceitos_principais,
          material_id: m.id,
        });
      }
    }
  }

  // Assemble subject arrays into groups
  for (const gName of Object.keys(groupMap)) {
    if (subjectMap[gName]) {
      groupMap[gName].subjects = Object.values(subjectMap[gName]);
    }
  }

  return Object.values(groupMap);
}

/**
 * Creates a new Study Group for the user
 */
export async function createStudyGroup(userId: string, nome: string, concurso?: string): Promise<void> {
  const cleanName = nome.trim();
  const cleanConcurso = concurso?.trim() || "Geral";
  if (!cleanName) throw new Error("Nome do grupo é obrigatório.");

  // Try inserting into study_groups table
  try {
    const { error: groupError } = await supabase.from("study_groups").insert({
      user_id: userId,
      nome: cleanName,
      concurso: cleanConcurso,
    });

    if (!groupError) return;
  } catch {
    // fallback below
  }

  // Fallback: create placeholder in study_materials with grupo set
  const { error: matError } = await supabase.from("study_materials").insert({
    user_id: userId,
    nome: "Primeiro Assunto",
    grupo: cleanName,
    concurso: cleanConcurso,
    disciplina: "Geral",
    quantidade_paginas: 0,
    texto_extraido: "",
  });

  if (matError) {
    throw new Error(matError.message || "Não foi possível criar o grupo.");
  }
}

/**
 * Creates a new Subject in a group
 */
export async function createStudySubject(
  userId: string,
  groupId: string | undefined,
  groupName: string,
  subjectName: string,
  disciplina?: string,
): Promise<void> {
  const cleanSubject = subjectName.trim();
  const cleanDisciplina = disciplina?.trim() || "Geral";
  if (!cleanSubject) throw new Error("Nome do assunto é obrigatório.");

  if (groupId) {
    try {
      const { error } = await supabase.from("study_subjects").insert({
        user_id: userId,
        group_id: groupId,
        nome: cleanSubject,
        disciplina: cleanDisciplina,
      });
      if (!error) return;
    } catch {
      // fallback
    }
  }

  // Fallback via study_materials
  const { error } = await supabase.from("study_materials").insert({
    user_id: userId,
    nome: cleanSubject,
    grupo: groupName.trim(),
    concurso: "Geral",
    disciplina: cleanDisciplina,
    quantidade_paginas: 0,
    texto_extraido: "",
  });

  if (error) throw new Error(error.message || "Não foi possível criar o assunto.");
}

/**
 * Renames a group across all relevant tables
 */
export async function renameStudyGroup(
  userId: string,
  groupId: string | undefined,
  oldName: string,
  newName: string,
  concurso?: string,
): Promise<void> {
  const cleanNewName = newName.trim();
  const cleanConcurso = concurso?.trim() || "Geral";

  if (groupId) {
    await supabase
      .from("study_groups")
      .update({ nome: cleanNewName, concurso: cleanConcurso })
      .eq("id", groupId);
  }

  await supabase
    .from("study_materials")
    .update({ grupo: cleanNewName, concurso: cleanConcurso })
    .eq("user_id", userId)
    .eq("grupo", oldName);
}

/**
 * Renames a subject
 */
export async function renameStudySubject(
  userId: string,
  subjectId: string | undefined,
  groupName: string,
  oldSubjectName: string,
  newSubjectName: string,
  disciplina?: string,
): Promise<void> {
  const cleanNewName = newSubjectName.trim();
  const cleanDisciplina = disciplina?.trim() || "Geral";

  if (subjectId) {
    await supabase
      .from("study_subjects")
      .update({ nome: cleanNewName, disciplina: cleanDisciplina })
      .eq("id", subjectId);
  }

  await supabase
    .from("study_materials")
    .update({ nome: cleanNewName, disciplina: cleanDisciplina })
    .eq("user_id", userId)
    .eq("grupo", groupName)
    .eq("nome", oldSubjectName);
}

/**
 * Deletes a group and everything inside
 */
export async function deleteStudyGroup(
  userId: string,
  groupName: string,
  groupId?: string,
): Promise<void> {
  if (groupId) {
    await supabase.from("study_groups").delete().eq("id", groupId);
  }

  await supabase
    .from("study_materials")
    .delete()
    .eq("user_id", userId)
    .eq("grupo", groupName);
}

/**
 * Deletes a subject and associated materials
 */
export async function deleteStudySubject(
  userId: string,
  groupName: string,
  subjectName: string,
  subjectId?: string,
): Promise<void> {
  if (subjectId) {
    await supabase.from("study_subjects").delete().eq("id", subjectId);
  }

  await supabase
    .from("study_materials")
    .delete()
    .eq("user_id", userId)
    .eq("grupo", groupName)
    .eq("nome", subjectName);
}

/**
 * Deletes a single material file
 */
export async function deleteStudyMaterial(materialId: string): Promise<void> {
  const { error } = await supabase.from("study_materials").delete().eq("id", materialId);
  if (error) throw error;
}

/**
 * Deletes a single topic
 */
export async function deleteStudyTopic(topicId: string): Promise<void> {
  const { error } = await supabase.from("topics").delete().eq("id", topicId);
  if (error) throw error;
}

/**
 * Moves a material to another group and subject
 */
export async function moveStudyMaterial(
  materialId: string,
  destinationGroup: string,
  destinationSubject: string,
): Promise<void> {
  const { error } = await supabase
    .from("study_materials")
    .update({
      grupo: destinationGroup.trim(),
      nome: destinationSubject.trim(),
    })
    .eq("id", materialId);
  if (error) throw error;
}
