import { createFileRoute, Link } from "@tanstack/react-router";
import { AudioLines, BrainCircuit, FileText, Gauge } from "lucide-react";

import { Brand } from "@/components/sentinela/Shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SENTINELA — explique em voz alta e descubra o que domina" },
      {
        name: "description",
        content:
          "Envie seu PDF de estudo, grave uma explicação por áudio e receba nota de 0 a 100, acertos, erros, lacunas e diagnóstico da sua compreensão.",
      },
      { property: "og:title", content: "SENTINELA — Explique. Entenda. Domine." },
      {
        property: "og:description",
        content:
          "Aprendizagem ativa por áudio: transcrição automática, avaliação semântica por IA e evolução entre tentativas.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: FileText, title: "Envie o PDF", text: "O Sentinela identifica os assuntos do material." },
  { icon: AudioLines, title: "Explique falando", text: "Uma pergunta aberta, sua voz, sem cola." },
  { icon: BrainCircuit, title: "Análise semântica", text: "A IA compara sua explicação com o material." },
  { icon: Gauge, title: "Nota e diagnóstico", text: "Acertos, erros, lacunas e o que estudar agora." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Brand />
        <Link to="/auth">
          <Button size="sm">Entrar</Button>
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-16 pt-10 text-center sm:pt-16">
        <div className="mb-6 flex justify-center">
          <img
            src="/logo.png"
            alt="Sentinela"
            className="size-24 sm:size-32 object-contain drop-shadow-2xl"
          />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
          Aprendizagem ativa
        </p>
        <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-6xl">
          Se você não consegue <span className="text-signal">explicar</span>, você ainda não
          entendeu.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          O SENTINELA ouve sua explicação, confronta com o seu próprio material de estudo e mostra
          exatamente onde está o buraco no seu entendimento.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg">Começar agora</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="card-surface p-5">
              <step.icon className="size-6 text-primary" aria-hidden />
              <p className="mt-4 text-xs text-muted-foreground">Etapa {index + 1}</p>
              <h2 className="mt-1 text-base font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
