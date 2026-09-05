"use client";

import { forwardRef } from "react";
import { normalizarPlaca } from "@/lib/placa";
import { cn } from "@/lib/utils";

/**
 * Campo de placa.
 *
 * E o controle mais usado do produto, entao ele e grande, monoespacado e
 * espacado como uma placa de verdade — o operador confere o que digitou de
 * relance, sem precisar ler caractere por caractere.
 *
 * `inputMode="text"` com `autoCapitalize="characters"`: teclado alfanumerico
 * completo, ja em maiuscula. Placa mistura letra e digito, entao teclado
 * numerico atrapalharia.
 */
export type PlacaInputProps = {
  valor: string;
  aoMudar: (v: string) => void;
  aoConfirmar?: () => void;
  desabilitado?: boolean;
  autoFoco?: boolean;
  invalido?: boolean;
  className?: string;
};

export const PlacaInput = forwardRef<HTMLInputElement, PlacaInputProps>(
  function PlacaInput(
    { valor, aoMudar, aoConfirmar, desabilitado, autoFoco, invalido, className },
    ref,
  ) {
    const completa = valor.length === 7;

    return (
      <div className={cn("relative", className)}>
        <input
          ref={ref}
          value={valor}
          onChange={(e) => aoMudar(normalizarPlaca(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              aoConfirmar?.();
            }
          }}
          disabled={desabilitado}
          autoFocus={autoFoco}
          enterKeyHint="search"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          aria-label="Placa do veículo"
          placeholder="ABC1D23"
          className={cn(
            "h-20 w-full rounded-card border-2 bg-surface text-center",
            "font-mono text-[2rem] font-semibold uppercase tracking-[0.28em]",
            // O tracking empurra o texto para a direita; o padding compensa
            // para que a placa fique opticamente centrada.
            "pl-[0.28em] text-text placeholder:tracking-[0.2em] placeholder:text-text-muted/45",
            "transition-[border-color,box-shadow] duration-200",
            "[transition-timing-function:var(--ease-out-app)]",
            "focus:outline-none focus:ring-4",
            invalido
              ? "border-danger focus:border-danger focus:ring-danger/15"
              : completa
                ? "border-brand focus:border-brand focus:ring-brand/15"
                : "border-border focus:border-brand focus:ring-brand/15",
            "disabled:opacity-60",
          )}
        />

        {/* Progresso discreto: 7 marcas que acendem conforme preenche.
            Diz "falta pouco" sem ocupar espaco nem exigir leitura. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-3 flex justify-center gap-1.5"
        >
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-200",
                "[transition-timing-function:var(--ease-out-app)]",
                i < valor.length
                  ? invalido
                    ? "w-5 bg-danger"
                    : "w-5 bg-brand"
                  : "w-3 bg-border",
              )}
            />
          ))}
        </div>
      </div>
    );
  },
);
