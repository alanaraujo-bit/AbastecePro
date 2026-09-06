"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, ChevronDown, ChevronUp, UserCog } from "lucide-react";
import { cn, iniciais } from "@/lib/utils";

export function MenuUsuario({
  nome,
  email,
  acima = false,
}: {
  nome: string;
  email: string;
  /**
   * Abre o painel para cima. Obrigatorio quando o gatilho fica no rodape de
   * um container ancorado na base: a moldura do app usa `overflow-hidden`,
   * entao um menu que desce a partir dali e recortado e some — o clique
   * parece nao fazer nada.
   */
  acima?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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
    setErro(null);
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      // Sem esta checagem a falha some: o redirect acontece, o middleware ve
      // o cookie ainda vivo e devolve o usuario pra ca, preso no spinner.
      if (!r.ok) throw new Error(String(r.status));
      router.replace("/login");
      router.refresh();
    } catch {
      setErro("Nao foi possivel sair. Tente de novo.");
      setSaindo(false);
    }
  }

  const Seta = acima ? ChevronUp : ChevronDown;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Conta de ${nome}`}
        className="ml-0.5 flex items-center gap-0.5 rounded-full pr-1 transition-transform active:scale-95"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-[0.8125rem] font-semibold text-brand-on-soft">
          {iniciais(nome)}
        </span>
        {/* A seta e o que diz que isto abre um menu: so as iniciais nao
            anunciam nada, e quem procura "sair" nao pensa em clicar nelas. */}
        <Seta
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-text-muted transition-transform duration-150",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-50 w-60 overflow-hidden rounded-card border border-border bg-bg-elevated shadow-[var(--shadow-lg)]",
            acima
              ? "bottom-[calc(100%+0.5rem)] origin-bottom-right motion-safe:animate-[menu-in-cima_160ms_var(--ease-out-app)]"
              : "top-[calc(100%+0.5rem)] origin-top-right motion-safe:animate-[menu-in_160ms_var(--ease-out-app)]",
          )}
        >
          <div className="border-b border-border px-3.5 py-3">
            <p className="truncate text-sm font-semibold">{nome}</p>
            <p className="mt-0.5 truncate text-xs text-text-muted">{email}</p>
          </div>
          <Link
            href="/admin/conta"
            role="menuitem"
            onClick={() => setAberto(false)}
            className="flex w-full items-center gap-2.5 border-b border-border px-3.5 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text"
          >
            <UserCog className="size-4" />
            Minha conta
          </Link>
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
          {erro && (
            <p
              role="alert"
              className="border-t border-border px-3.5 py-2 text-xs text-danger"
            >
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
