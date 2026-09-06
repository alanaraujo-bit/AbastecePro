"use client";

import { useState } from "react";
import { cn, numero } from "@/lib/utils";

export type PontoDia = {
  dia: string; // YYYY-MM-DD
  qtd: number;
};

/**
 * Liberações por dia.
 *
 * Conta papéis emitidos, não volume: quem libera nunca vê a bomba, então
 * litro e valor não existem mais como grandeza do sistema. O que dá para
 * medir — e o que interessa a quem controla — é quantas autorizações
 * saíram por dia.
 *
 * Barras em flex, não SVG: acompanha a largura do contêiner sem nenhuma
 * conta de viewBox e sem distorcer em tela larga.
 */
export function GraficoLiberacoes({ pontos }: { pontos: PontoDia[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  const maximo = Math.max(...pontos.map((p) => p.qtd), 1);
  const total = pontos.reduce((s, p) => s + p.qtd, 0);
  const media = total / (pontos.length || 1);
  const destaque = ativo != null ? pontos[ativo] : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <p className="text-xs font-medium text-text-muted">Total no período</p>
          <p className="text-lg font-semibold tabular-nums">{numero(total)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">Média por dia</p>
          <p className="text-lg font-semibold tabular-nums">
            {media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          </p>
        </div>

        {/* O valor em foco substitui os agregados no mesmo lugar, para o
            bloco não mudar de altura e empurrar o gráfico. */}
        <div
          className={cn(
            "ml-auto text-right transition-opacity",
            destaque ? "opacity-100" : "opacity-0",
          )}
          aria-live="polite"
        >
          <p className="text-xs font-medium text-text-muted">
            {destaque ? rotuloData(destaque.dia) : "—"}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {destaque ? numero(destaque.qtd) : "—"}
          </p>
        </div>
      </div>

      <div
        className="relative flex h-44 items-end gap-[2px]"
        onMouseLeave={() => setAtivo(null)}
      >
        {/* Linha da média: dá referência sem precisar de eixo Y numerado. */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-strong"
          style={{ bottom: `${(media / maximo) * 100}%` }}
          aria-hidden
        />

        {pontos.map((p, i) => (
          <button
            key={p.dia}
            type="button"
            onMouseEnter={() => setAtivo(i)}
            onFocus={() => setAtivo(i)}
            onBlur={() => setAtivo(null)}
            aria-label={`${rotuloData(p.dia)}: ${p.qtd} liberação(ões)`}
            className="group relative flex h-full flex-1 items-end"
          >
            <span
              className={cn(
                "w-full rounded-t-[3px] transition-colors",
                p.qtd === 0
                  ? "bg-surface-sunken"
                  : ativo === i
                    ? "bg-brand"
                    : "bg-brand/45 group-hover:bg-brand",
              )}
              style={{
                // Dias sem movimento ganham um traço mínimo: sumir por
                // completo faria parecer que falta dado, não que foi zero.
                height: p.qtd === 0 ? "3px" : `${(p.qtd / maximo) * 100}%`,
              }}
            />
          </button>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-xs text-text-muted">
        <span>{rotuloData(pontos[0]?.dia)}</span>
        <span>{rotuloData(pontos[pontos.length - 1]?.dia)}</span>
      </div>
    </div>
  );
}

function rotuloData(iso?: string): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}
