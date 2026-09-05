"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { TEMA_STORAGE_KEY, type Tema } from "@/components/theme-script";
import { cn } from "@/lib/utils";

const OPCOES: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", Icone: Sun },
  { valor: "escuro", rotulo: "Escuro", Icone: Moon },
  { valor: "sistema", rotulo: "Sistema", Icone: Monitor },
];

function aplicar(tema: Tema) {
  const escuro =
    tema === "escuro" ||
    (tema === "sistema" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", escuro);
  document.documentElement.style.colorScheme = escuro ? "dark" : "light";
}

/** Alterna claro/escuro/sistema. Segmentado: os três estados ficam visíveis. */
export function ThemeToggle({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>("sistema");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const salvo = (localStorage.getItem(TEMA_STORAGE_KEY) as Tema) || "sistema";
    setTema(salvo);
    setMontado(true);
  }, []);

  // Em "sistema", seguir a troca feita no SO sem exigir recarga.
  useEffect(() => {
    if (tema !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const ouvir = () => aplicar("sistema");
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, [tema]);

  function escolher(t: Tema) {
    setTema(t);
    localStorage.setItem(TEMA_STORAGE_KEY, t);
    aplicar(t);
  }

  if (compacto) {
    // No topo do app: um botão só, que cicla. Menos ruído na barra.
    const atual = OPCOES.find((o) => o.valor === tema) ?? OPCOES[2];
    const Icone = atual.Icone;
    return (
      <button
        type="button"
        onClick={() => {
          const i = OPCOES.findIndex((o) => o.valor === tema);
          escolher(OPCOES[(i + 1) % OPCOES.length].valor);
        }}
        aria-label={`Tema: ${atual.rotulo}. Tocar para alternar.`}
        className="flex size-10 items-center justify-center rounded-app text-text-secondary transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
      >
        {montado ? <Icone className="size-5" /> : <span className="size-5" />}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex rounded-app bg-surface-sunken p-1"
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={montado && tema === valor}
          onClick={() => escolher(valor)}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-[0.625rem] px-3 text-sm font-medium transition-all",
            "[transition-timing-function:var(--ease-out-app)]",
            montado && tema === valor
              ? "bg-surface text-text shadow-[var(--shadow-sm)]"
              : "text-text-muted hover:text-text",
          )}
        >
          <Icone className="size-4" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}
