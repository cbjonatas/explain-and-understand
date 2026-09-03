import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/sentinela/Shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — SENTINELA" },
      {
        name: "description",
        content: "Gerencie sua foto de perfil, nome e senha de acesso à Sentinela.",
      },
      { property: "og:title", content: "Meu Perfil — SENTINELA" },
      { property: "og:description", content: "Informações da sua conta e preferências." },
    ],
  }),
  component: ProfilePage,
});

interface UserProfile {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url?: string | null;
  created_at: string;
  acesso_liberado?: boolean;
  acesso_expira_em?: string | null;
}

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Query profile from database
  const profileQuery = useQuery({
    queryKey: ["user-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<UserProfile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url, created_at, acesso_liberado, acesso_expira_em")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) {
        // Fallback if avatar_url column is not yet present
        const fallback = await supabase
          .from("profiles")
          .select("id, nome, email, created_at")
          .eq("id", user!.id)
          .maybeSingle();
        return (fallback.data as UserProfile) || {
          id: user!.id,
          nome: (user?.user_metadata?.nome as string) || (user?.user_metadata?.full_name as string) || null,
          email: user?.email || null,
          avatar_url: (user?.user_metadata?.avatar_url as string) || null,
          created_at: user?.created_at || new Date().toISOString(),
        };
      }

      return (
        (data as unknown as UserProfile) || {
          id: user!.id,
          nome: (user?.user_metadata?.nome as string) || (user?.user_metadata?.full_name as string) || null,
          email: user?.email || null,
          avatar_url: (user?.user_metadata?.avatar_url as string) || null,
          created_at: user?.created_at || new Date().toISOString(),
        }
      );
    },
  });

  // Sync form state when profile loads
  useEffect(() => {
    if (profileQuery.data?.nome) {
      setNome(profileQuery.data.nome);
    } else if (user?.user_metadata?.nome || user?.user_metadata?.full_name) {
      setNome((user.user_metadata.nome as string) || (user.user_metadata.full_name as string) || "");
    }
  }, [profileQuery.data, user]);

  const profile = profileQuery.data;
  const avatarUrl = profile?.avatar_url || (user?.user_metadata?.avatar_url as string) || null;

  // Mutation 1: Update Name
  const updateNameMutation = useMutation({
    mutationFn: async (novoNome: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const cleanName = novoNome.trim();
      if (!cleanName) throw new Error("O nome não pode ficar vazio.");

      // 1. Update in profiles table
      try {
        await supabase
          .from("profiles")
          .update({ nome: cleanName })
          .eq("id", user.id);
      } catch (err) {
        console.warn("Aviso ao atualizar profiles:", err);
      }

      // 2. Update user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          nome: cleanName,
          full_name: cleanName,
        },
      });

      if (authError) throw authError;
    },
    onSuccess: () => {
      toast.success("Nome atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar nome.");
    },
  });

  // Mutation 2: Upload / Change Profile Photo
  async function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      let finalAvatarUrl = "";

      // Try uploading to Supabase Storage bucket 'avatars'
      try {
        const fileExt = file.name.split(".").pop() || "jpg";
        const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);
          finalAvatarUrl = urlData.publicUrl;
        }
      } catch (storageErr) {
        console.warn("Storage upload fallback:", storageErr);
      }

      // Fallback: Convert to base64 if storage is not yet available
      if (!finalAvatarUrl) {
        finalAvatarUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // Save to profiles table
      try {
        await supabase
          .from("profiles")
          .update({ avatar_url: finalAvatarUrl })
          .eq("id", user.id);
      } catch {
        // Safe ignore
      }

      // Save to user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: finalAvatarUrl },
      });

      if (authError) throw authError;

      toast.success("Foto de perfil atualizada!");
      queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a foto.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  // Mutation 3: Remove Profile Photo
  const removePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      try {
        await supabase
          .from("profiles")
          .update({ avatar_url: null })
          .eq("id", user.id);
      } catch {
        // Safe ignore
      }

      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: null },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto de perfil removida.");
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao remover foto.");
    },
  });

  // Mutation 4: Update Password
  const updatePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("A nova senha deve ter no mínimo 6 caracteres.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("A confirmação da senha não coincide com a nova senha digitada.");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sua senha foi alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar a senha.");
    },
  });

  const initials = nome
    ? nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "A";

  return (
    <AppShell>
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              <User className="size-3 text-primary" /> Conta do Aluno
            </Badge>
            {isAdmin && (
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-semibold">
                <Shield className="size-3 mr-1" /> Administrador
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie suas informações pessoais, foto de perfil e credenciais de acesso.
          </p>
        </div>

        {profileQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Card 1: Foto e Identificação */}
            <div className="card-surface p-6 sm:p-8 border border-border/80 shadow-sm">
              <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-3">
                <Camera className="size-4 text-primary" />
                Foto de Perfil & Dados Básicos
              </h2>

              <div className="mt-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar Preview */}
                <div className="relative group">
                  <Avatar className="size-24 sm:size-28 border-2 border-primary/30 shadow-md">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={nome || "Foto de perfil"} className="object-cover" />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  {isUploadingPhoto && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-xs">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                {/* Photo Actions & Info */}
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{nome || "Aluno Sentinela"}</h3>
                    <p className="text-xs text-muted-foreground">{profile?.email || user?.email}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Upload className="size-3.5" />
                      {avatarUrl ? "Alterar foto" : "Adicionar foto"}
                    </Button>

                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePhotoMutation.mutate()}
                        disabled={removePhotoMutation.isPending || isUploadingPhoto}
                        className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-error hover:bg-error/10"
                      >
                        <Trash2 className="size-3.5" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Formatos aceitos: JPG, PNG, WEBP. Tamanho máximo: 5 MB.
                  </p>
                </div>
              </div>

              {/* Edit Name & Display Email Form */}
              <div className="mt-8 grid gap-4 sm:grid-cols-2 pt-6 border-t border-border/50">
                <div className="space-y-1.5">
                  <Label htmlFor="perfil-nome" className="text-xs font-semibold flex items-center gap-1.5">
                    <User className="size-3.5 text-primary" />
                    Nome Completo
                  </Label>
                  <Input
                    id="perfil-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="perfil-email" className="text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5 text-muted-foreground" />
                      E-mail Cadastrado
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Identificador único</span>
                  </Label>
                  <Input
                    id="perfil-email"
                    type="email"
                    value={profile?.email || user?.email || ""}
                    disabled
                    className="bg-muted/40 text-muted-foreground cursor-not-allowed"
                    title="O e-mail cadastrado não pode ser alterado diretamente por segurança."
                  />
                </div>
              </div>

              {/* Save Name Action */}
              <div className="mt-5 flex justify-end">
                <Button
                  onClick={() => updateNameMutation.mutate(nome)}
                  disabled={updateNameMutation.isPending || !nome.trim() || nome.trim() === profile?.nome}
                  className="gap-2 text-xs font-semibold"
                >
                  {updateNameMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Salvar Nome
                </Button>
              </div>
            </div>

            {/* Card 2: Alterar Senha */}
            <div className="card-surface p-6 sm:p-8 border border-border/80 shadow-sm">
              <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-3">
                <KeyRound className="size-4 text-amber-500" />
                Segurança & Alteração de Senha
              </h2>
              <p className="text-xs text-muted-foreground mt-2">
                Defina uma nova senha para acessar a plataforma. A senha é criptografada e salva com segurança.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* Nova Senha */}
                <div className="space-y-1.5">
                  <Label htmlFor="nova-senha" className="text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="size-3.5 text-primary" />
                    Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="nova-senha"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={showNewPassword ? "Ocultar senha" : "Ver senha"}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Senha */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmar-senha" className="text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    Confirmar Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmar-senha"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Digite a mesma senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={showConfirmPassword ? "Ocultar senha" : "Ver senha"}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Requirements info */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  A senha deve conter no mínimo 6 caracteres e coincidir em ambos os campos.
                </p>

                <Button
                  onClick={() => updatePasswordMutation.mutate()}
                  disabled={
                    updatePasswordMutation.isPending ||
                    !newPassword ||
                    newPassword.length < 6 ||
                    newPassword !== confirmPassword
                  }
                  className="gap-2 text-xs font-semibold"
                >
                  {updatePasswordMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="size-3.5" />
                  )}
                  Atualizar Senha
                </Button>
              </div>
            </div>

            {/* Card 3: Status da Conta e Acesso */}
            <div className="card-surface p-6 border border-border/70 bg-muted/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="size-4 text-primary" />
                Informações da Conta
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Membro desde:</span>{" "}
                  <strong className="text-foreground">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Status do Acesso:</span>{" "}
                  <Badge variant="outline" className="ml-1 text-emerald-500 border-emerald-500/30">
                    Ativo & Liberado
                  </Badge>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
