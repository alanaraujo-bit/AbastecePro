"use client";

import { useEffect, useState } from "react";
import { Check, ShieldAlert, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarPlaca } from "@/lib/placa";
import { horaCurta, litros as fmtLitros, moeda, cn } from "@/lib/utils";
import type { ResumoFinal } from "./atendimento";

/** Segundos até o app voltar sozinho para a tela de placa. */
const SEGUNDOS_ATE_VOLTAR = 8;

export function EtapaConcluido({
  resumo,
  aoNovo,
}: {
  resumo: ResumoFinal;
  aoNovo: () => void;
}) {
  const [restante, setRestante] = useState(SEGUNDOS_ATE_VOLTAR);
  const excecao = resumo.resultado === "AUTORIZADO_EXCECAO";

  /**
   * Volta sozinho ao início.
   *
   * O operador termina o atendimento e vai atender o próximo carro — deixar
   * a tela de sucesso esperando um toque só adiciona trabalho. O contador
   * fica visível para que a volta não pareça um bug.
   */
  useEffect(() => {
    const t = setInterval(() => {
      setRestante((s) => {
        if (s <= 1) {
          clearInterval(t);
          aoNovo();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [aoNovo]);

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-area flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className={cn(
            "flex size-20 items-center justify-center rounded-full anim-veredito",
            excecao ? "bg-warn" : "bg-ok",
          )}
        >
          {excecao ? (
            <ShieldAlert className="size-10 text-white" strokeWidth={2.5} />
          ) : (
            <Check className="size-11 text-white" strokeWidth={3} />
          )}
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em]">
          {excecao ? "Autorizado" : "Registrado"}
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          {excecao
            ? "Liberação excepcional gravada na auditoria."
            : "Abastecimento gravado com sucesso."}
        </p>

        <div className="mt-7 w-full max-w-xs rounded-card border border-border bg-surface p-4 text-left">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-lg font-semibold tracking-[0.1em] selectable">
              {formatarPlaca(resumo.placa)}
            </span>
            <span className="text-sm tabular-nums text-text-muted">
              {horaCurta(resumo.criadoEm)}
            </span>
          </div>
          {resumo.condutor && (
            <p className="mt-1 truncate text-sm text-text-secondary">
              {resumo.condutor}
            </p>
          )}
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <span className="text-xl font-semibold tabular-nums">
              {fmtLitros(resumo.litros)}
            </span>
            {resumo.valor != null && (
              <span className="text-[0.9375rem] tabular-nums text-text-secondary">
                {moeda(resumo.valor)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="safe-bottom shrink-0 px-4 pb-3 pt-3">
        <Button tamanho="xl" larguraTotal onClick={aoNovo}>
          <Plus className="size-5" strokeWidth={2.5} />
          Novo atendimento
        </Button>
        <p
          className="mt-2 text-center text-xs text-text-muted"
          aria-live="polite"
        >
          Voltando em {restante}s
        </p>
      </div>
    </div>
  );
}
