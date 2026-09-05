"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Variante = "sucesso" | "erro" | "aviso" | "info";

type Toast = {
  id: number;
  titulo: string;
  descricao?: string;
  variante: Variante;
};

type ToastInput = Omit<Toast, "id" | "variante"> & { variante?: Variante };

const Ctx = createContext<{
  mostrar: (t: ToastInput) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}

const ICONES: Record<Variante, typeof Info> = {
  sucesso: CheckCircle2,
  erro: XCircle,
  aviso: AlertTriangle,
  info: Info,
};

const CORES: Record<Variante, string> = {
  sucesso: "text-ok",
  erro: "text-danger",
  aviso: "text-warn",
  info: "text-brand",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<Toast[]>([]);
  const seq = useRef(0);

  const mostrar = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItens((xs) => [...xs, { id, variante: "info", ...t }]);
    // Some sozinho: o operador nao deve precisar fechar nada para seguir.
    setTimeout(() => {
      setItens((xs) => xs.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-0 sm:items-end sm:pt-3 sm:pr-3"
        role="status"
        aria-live="polite"
      >
        {itens.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [entrou, setEntrou] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntrou(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const Icone = ICONES[toast.variante];

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-app border border-border bg-bg-elevated p-3 shadow-[var(--shadow-lg)]",
        "transition-all duration-300 [transition-timing-function:var(--ease-out-app)]",
        entrou
          ? "translate-y-0 opacity-100"
          : "translate-y-3 opacity-0 sm:-translate-y-3",
      )}
    >
      <Icone className={cn("mt-0.5 size-5 shrink-0", CORES[toast.variante])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{toast.titulo}</p>
        {toast.descricao && (
          <p className="mt-0.5 text-sm leading-snug text-text-secondary">
            {toast.descricao}
          </p>
        )}
      </div>
    </div>
  );
}
