"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { iniciais } from "@/lib/utils";

const ROTULO_PAPEL: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  OPERADOR: "Operador",
};

export function MenuUsuario({
  nome,
  papel,
  email,
}: {
  nome: string;
  papel: string;
  email: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  async function sair() {
    setSaindo(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Conta de ${nome}`}
        className="ml-0.5 flex size-9 items-center justify-center rounded-full bg-brand-soft text-[0.8125rem] font-semibold text-brand-on-soft transition-transform active:scale-95"
      >
        {iniciais(nome)}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 origin-top-right overflow-hidden rounded-card border border-border bg-bg-elevated shadow-[var(--shadow-lg)] motion-safe:animate-[menu-in_160ms_var(--ease-out-app)]"
        >
          <div className="border-b border-border px-3.5 py-3">
            <p className="truncate text-sm font-semibold">{nome}</p>
            <p className="mt-0.5 truncate text-xs text-text-muted">{email}</p>
            <span className="mt-2 inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-text-secondary">
              {ROTULO_PAPEL[papel] ?? papel}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={sair}
            disabled={saindo}
            className="flex w-full items-center gap-2.5 px-3.5 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
          >
            {saindo ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
