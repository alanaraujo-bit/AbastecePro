import Link from "next/link";
import { cn } from "@/lib/utils";

/** Cabeçalho de página. Gruda no topo ao rolar para manter o contexto. */
export function PageHeader({
  titulo,
  descricao,
  acoes,
  voltar,
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
  voltar?: { href: string; rotulo: string };
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          {voltar && (
            <Link
              href={voltar.href}
              className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-text-muted transition-colors hover:text-text"
            >
              <svg
                viewBox="0 0 20 20"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15 7 10l5-5" />
              </svg>
              {voltar.rotulo}
            </Link>
          )}
          <h1 className="truncate text-xl font-semibold tracking-[-0.015em] sm:text-2xl">
            {titulo}
          </h1>
          {descricao && (
            <p className="mt-0.5 text-sm text-text-muted">{descricao}</p>
          )}
        </div>
        {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
      </div>
    </div>
  );
}

export function Conteudo({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
  titulo,
  acao,
}: {
  children: React.ReactNode;
  className?: string;
  titulo?: string;
  acao?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-card border border-border bg-surface",
        className,
      )}
    >
      {(titulo || acao) && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          {titulo && (
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
              {titulo}
            </h2>
          )}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Indicador numérico.
 *
 * O número é a única coisa grande: o rótulo explica, a variação contextualiza,
 * mas quem lê de longe só precisa do valor.
 */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
  Icone,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "ok" | "danger" | "warn" | "brand";
  Icone?: React.ComponentType<{ className?: string }>;
}) {
  const cores = {
    neutro: "text-text",
    ok: "text-ok",
    danger: "text-danger",
    warn: "text-warn",
    brand: "text-brand",
  } as const;

  return (
    <div className="rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2">
        {Icone && <Icone className="size-4 shrink-0 text-text-muted" />}
        <p className="truncate text-sm font-medium text-text-secondary">
          {rotulo}
        </p>
      </div>
      <p
        className={cn(
          "mt-2 text-[1.75rem] font-semibold tabular-nums leading-none tracking-[-0.02em]",
          cores[tom],
        )}
      >
        {valor}
      </p>
      {detalhe && (
        <p className="mt-1.5 text-xs text-text-muted">{detalhe}</p>
      )}
    </div>
  );
}

const TONS_ETIQUETA = {
  neutro: "bg-surface-2 text-text-secondary",
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  brand: "bg-brand-soft text-brand-on-soft",
} as const;

export function Etiqueta({
  children,
  tom = "neutro",
  className,
}: {
  children: React.ReactNode;
  tom?: keyof typeof TONS_ETIQUETA;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
        TONS_ETIQUETA[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Estado vazio. Diz o que é e o que fazer, não só "nada aqui". */
export function Vazio({
  titulo,
  descricao,
  acao,
  Icone,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  Icone?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icone && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-surface-2">
          <Icone className="size-6 text-text-muted" />
        </div>
      )}
      <p className="text-[0.9375rem] font-semibold">{titulo}</p>
      {descricao && (
        <p className="mt-1 max-w-sm text-sm leading-snug text-text-muted">
          {descricao}
        </p>
      )}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

/** Etiqueta de resultado de abastecimento, com a mesma cor em todo o app. */
export function EtiquetaResultado({ resultado }: { resultado: string }) {
  if (resultado === "LIBERADO")
    return <Etiqueta tom="ok">Liberado</Etiqueta>;
  if (resultado === "BLOQUEADO")
    return <Etiqueta tom="danger">Bloqueado</Etiqueta>;
  return <Etiqueta tom="warn">Exceção</Etiqueta>;
}
