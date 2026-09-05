import { cn } from "@/lib/utils";

/**
 * Marca do AbastecePro.
 *
 * Uma gota de combustivel cortada por um traco de nivel — a leitura e
 * "quanto pode" — dentro de um quadrado arredondado no raio do app.
 * Geometrica de proposito: escala bem de 20px (barra) a 512px (icone PWA).
 */
export function Marca({
  className,
  tamanho = 32,
}: {
  className?: string;
  tamanho?: number;
}) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect width="48" height="48" rx="13" fill="currentColor" />
      <path
        d="M24 11c0 0-8.5 8.9-8.5 15.1A8.5 8.5 0 0 0 24 34.6a8.5 8.5 0 0 0 8.5-8.5C32.5 19.9 24 11 24 11Z"
        className="fill-white/95"
      />
      <path
        d="M18.4 27.4h11.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold tracking-[-0.02em] text-text",
        className,
      )}
    >
      Abastece<span className="text-brand">Pro</span>
    </span>
  );
}
