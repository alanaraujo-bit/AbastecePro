"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Filtros que vivem na URL.
 *
 * Guardar o estado na query string, e não em `useState`, é o que permite
 * recarregar, voltar e **compartilhar** uma visão filtrada — coisas que um
 * painel administrativo precisa fazer o tempo todo.
 */
function useFiltroUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const aplicar = useCallback(
    (mudancas: Record<string, string | null>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(mudancas)) {
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      // Qualquer mudança de filtro volta para a primeira página: manter a
      // página 7 num resultado que agora tem 2 mostraria uma tela vazia.
      if (!("pagina" in mudancas)) p.delete("pagina");
      iniciar(() => router.replace(`${pathname}?${p.toString()}`));
    },
    [params, pathname, router],
  );

  return { params, aplicar, pendente };
}

export function BuscaFiltro({
  placeholder = "Buscar…",
  chave = "q",
}: {
  placeholder?: string;
  chave?: string;
}) {
  const { params, aplicar, pendente } = useFiltroUrl();
  const [valor, setValor] = useState(params.get(chave) ?? "");
  const primeiro = useRef(true);

  // Debounce: buscar a cada tecla faria uma consulta por caractere.
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    const t = setTimeout(() => aplicar({ [chave]: valor || null }), 320);
    return () => clearTimeout(t);
  }, [valor, chave, aplicar]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-text-muted" />
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-app border border-border bg-surface pl-10 pr-9 text-[0.9375rem] placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/12"
      />
      {pendente ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-text-muted" />
      ) : (
        valor && (
          <button
            type="button"
            onClick={() => setValor("")}
            aria-label="Limpar busca"
            className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="size-3.5" />
          </button>
        )
      )}
    </div>
  );
}

/** Grupo de opções mutuamente exclusivas, em pílulas. */
export function AbasFiltro({
  chave,
  opcoes,
  padrao = "",
}: {
  chave: string;
  opcoes: { valor: string; rotulo: string }[];
  /**
   * Valor em vigor quando o parâmetro não está na URL. Sem isto, uma tela
   * que já filtra por 30 dias por padrão mostraria nenhuma pílula acesa —
   * o cabeçalho diria uma coisa e os controles, outra.
   */
  padrao?: string;
}) {
  const { params, aplicar } = useFiltroUrl();
  const atual = params.get(chave) ?? padrao;

  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = atual === o.valor;
        return (
          <button
            key={o.valor || "todos"}
            type="button"
            onClick={() => aplicar({ [chave]: o.valor || null })}
            className={cn(
              "h-10 rounded-app border px-3.5 text-sm font-medium transition-all active:scale-95",
              ativo
                ? "border-brand bg-brand-soft text-brand-on-soft"
                : "border-border bg-surface text-text-secondary hover:bg-surface-2",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function SelectFiltro({
  chave,
  rotulo,
  opcoes,
}: {
  chave: string;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
}) {
  const { params, aplicar } = useFiltroUrl();
  return (
    <select
      aria-label={rotulo}
      value={params.get(chave) ?? ""}
      onChange={(e) => aplicar({ [chave]: e.target.value || null })}
      className="h-10 cursor-pointer rounded-app border border-border bg-surface px-3 text-sm font-medium text-text-secondary focus:border-brand focus:outline-none"
    >
      {opcoes.map((o) => (
        <option key={o.valor || "todos"} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}

export function Paginacao({
  pagina,
  total,
  porPagina,
}: {
  pagina: number;
  total: number;
  porPagina: number;
}) {
  const { aplicar, pendente } = useFiltroUrl();
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;

  const primeiroItem = (pagina - 1) * porPagina + 1;
  const ultimoItem = Math.min(pagina * porPagina, total);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
      <p className="text-sm tabular-nums text-text-muted">
        {primeiroItem}–{ultimoItem} de {total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagina <= 1 || pendente}
          onClick={() => aplicar({ pagina: String(pagina - 1) })}
          className="h-9 rounded-app border border-border bg-surface px-3.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={pagina >= ultima || pendente}
          onClick={() => aplicar({ pagina: String(pagina + 1) })}
          className="h-9 rounded-app border border-border bg-surface px-3.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
