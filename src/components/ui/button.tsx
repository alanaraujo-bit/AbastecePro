"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variante = "primario" | "secundario" | "fantasma" | "perigo" | "sucesso";
type Tamanho = "sm" | "md" | "lg" | "xl";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-brand text-brand-fg shadow-[var(--shadow-sm)] hover:bg-brand-hover active:bg-brand-hover",
  secundario:
    "bg-surface text-text border border-border shadow-[var(--shadow-sm)] hover:bg-surface-2 active:bg-surface-2",
  fantasma: "text-text-secondary hover:bg-surface-2 hover:text-text active:bg-surface-2",
  perigo: "bg-danger text-danger-fg shadow-[var(--shadow-sm)] hover:brightness-110 active:brightness-95",
  sucesso: "bg-ok text-ok-fg shadow-[var(--shadow-sm)] hover:brightness-110 active:brightness-95",
};

// Alvos de toque nunca abaixo de 44px: o operador usa isso em pe, na chuva,
// as vezes de luva.
const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm rounded-[0.625rem]",
  md: "h-11 gap-2 px-4 text-[0.9375rem] rounded-app",
  lg: "h-13 gap-2.5 px-5 text-base rounded-app",
  xl: "h-16 gap-3 px-6 text-lg rounded-card",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  larguraTotal?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variante = "primario",
      tamanho = "md",
      carregando = false,
      larguraTotal = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || carregando}
        className={cn(
          "relative inline-flex select-none items-center justify-center font-semibold",
          "transition-[transform,background-color,opacity,filter] duration-150",
          "[transition-timing-function:var(--ease-out-app)]",
          // O recuo ao toque e o que faz o botao responder como app,
          // e nao como link de pagina.
          "active:scale-[0.97]",
          "disabled:pointer-events-none disabled:opacity-45",
          VARIANTES[variante],
          TAMANHOS[tamanho],
          larguraTotal && "w-full",
          className,
        )}
        {...props}
      >
        {carregando && <Loader2 className="size-[1.15em] animate-spin" />}
        {children}
      </button>
    );
  },
);
