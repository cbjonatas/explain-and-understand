import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Brand } from "@/components/sentinela/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Criar nova senha — SENTINELA" },
      {
        name: "description",
        content: "Defina uma nova senha para voltar a estudar com a SENTINELA.",
      },
      { property: "og:title", content: "Criar nova senha — SENTINELA" },
      { property: "og:description", content: "Defina uma nova senha de acesso à SENTINELA." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (senha.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirma) {
      toast.error("As senhas não são iguais.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha alterada com sucesso.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Brand />
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" aria-hidden />
          <h1 className="font-display text-xl font-bold">Criar nova senha</h1>
        </div>
        <div className="space-y-2">
          <Label htmlFor="nova-senha">Nova senha</Label>
          <Input
            id="nova-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirma-senha">Repita a nova senha</Label>
          <Input
            id="confirma-senha"
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          Salvar nova senha
        </Button>
      </form>
    </main>
  );
}
