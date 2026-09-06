"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { travarRolagem } from "@/lib/travar-rolagem";
import { prenderFoco, focoAnterior } from "@/lib/foco";

/**
 * Painel modal.
 *
 * Sobe de baixo no celular (gesto de app) e vira um cartão centrado no
 * desktop. Deliberadamente sem cara de janela de navegador: sem borda de
 * diálogo do sistema, sem barra de título, sem sombra genérica.
 */
export function Sheet({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  larguraMaxima = "max-w-md",
  focoInicial = "campo",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
  rodape?: React.ReactNode;
  larguraMaxima?: string;
  /**
   * Onde o foco cai ao abrir. `"campo"` põe o cursor no primeiro campo —
   * certo para cadastrar. `"painel"` não mexe em campo nenhum: ao editar
   * um registro que já existe, jogar o cursor no primeiro campo sugere
   * que é ali que se deve mexer, e atrapalha quem veio trocar outra coisa.
   */
  focoInicial?: "campo" | "painel";
}) {
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    document.addEventListener("keydown", esc);

    // Congela a rolagem de fundo: no celular, o conteúdo atrás rolando
    // enquanto o painel está aberto é a coisa que mais denuncia "site".
    const destravar = travarRolagem();

    // O foco inicial é decidido aqui, e não por `autoFocus` nos campos.
    // Depender do `autoFocus` deixava o resultado à mercê da ordem em que
    // React monta e desmonta efeitos; e é aqui que dá para escolher bem:
    //
    //   - tem campo de texto? o cursor vai para o primeiro, que é o que o
    //     formulário quer;
    //   - não tem? fica no próprio painel. Nunca no primeiro botão — em
    //     um painel de confirmação isso deixaria uma ação destrutiva a um
    //     Enter de distância.
    const t = setTimeout(() => {
      const p = painel.current;
      if (!p) return;
      const campo =
        focoInicial === "campo"
          ? p.querySelector<HTMLElement>(
              "input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled])",
            )
          : null;
      (campo ?? p).focus();
    }, 40);

    const soltarFoco = painel.current
      ? prenderFoco(painel.current, focoAnterior())
      : () => {};

    return () => {
      document.removeEventListener("keydown", esc);
      destravar();
      soltarFoco();
      clearTimeout(t);
    };
  }, [aberto, aoFechar, focoInicial]);

  if (!aberto || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-[var(--overlay)] anim-fade"
        onClick={aoFechar}
        aria-hidden
      />

      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col bg-bg-elevated shadow-[var(--shadow-lg)] outline-none",
          "rounded-t-sheet sm:rounded-sheet",
          "anim-sheet sm:motion-safe:animate-[menu-in_200ms_var(--ease-out-app)]",
          larguraMaxima,
        )}
      >
        {/* Alça: sinaliza "isto arrasta/fecha" sem precisar de texto. */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-start gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">{titulo}</h2>
            {descricao && (
              <p className="mt-1 text-sm leading-snug text-text-secondary">
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="-mr-1.5 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
          >
            <X className="size-5" />
          </button>
        </div>

        {children && (
          <div className="scroll-area min-h-0 flex-1 px-5 pb-2">{children}</div>
        )}

        {rodape && (
          <div className="safe-bottom flex gap-2.5 border-t border-border px-5 py-4">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
