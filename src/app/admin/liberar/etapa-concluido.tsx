"use client";

import { Check, ShieldAlert, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarPlaca } from "@/lib/placa";
import { dataHora, cn } from "@/lib/utils";
import type { ResumoFinal } from "./atendimento";

/**
 * O comprovante — o "papelzinho".
 *
 * Nao ha contagem regressiva para voltar sozinho: quem esta aqui ainda vai
 * anotar ou imprimir o papel que a pessoa leva ao posto, e uma tela que se
 * troca sozinha no meio disso faz perder o protocolo.
 */
export function EtapaConcluido({
  resumo,
  organizacao,
  aoNovo,
}: {
  resumo: ResumoFinal;
  organizacao: string;
  aoNovo: () => void;
}) {
  const excecao = resumo.resultado === "AUTORIZADO_EXCECAO";
  // Protocolo curto: o id inteiro e ilegivel para copiar a mao no papel.
  // Os ultimos 6 caracteres bastam para achar o registro na busca.
  const protocolo = resumo.id.slice(-6).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-area flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
        <div
          className={cn(
            "flex size-20 items-center justify-center rounded-full anim-veredito print:hidden",
            excecao ? "bg-warn" : "bg-ok",
          )}
        >
          {excecao ? (
            <ShieldAlert className="size-10 text-white" strokeWidth={2.5} />
          ) : (
            <Check className="size-11 text-white" strokeWidth={3} />
          )}
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em] print:hidden">
          Liberado
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary print:hidden">
          {excecao
            ? "Liberação excepcional gravada na auditoria."
            : "Liberação registrada. Entregue o papel à pessoa."}
        </p>

        {/* O bloco abaixo é o que sai na impressão — ver `@media print`
            em globals.css. */}
        <div
          id="comprovante"
          className="mt-7 w-full max-w-xs rounded-card border border-border bg-surface p-5 text-left"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {organizacao} · Autorização de abastecimento
          </p>

          <p className="mt-3 font-mono text-2xl font-bold tracking-[0.12em] selectable">
            {formatarPlaca(resumo.placa)}
          </p>
          {resumo.condutor && (
            <p className="mt-1 truncate text-[0.9375rem] font-medium">
              {resumo.condutor}
            </p>
          )}

          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border pt-3 text-sm">
            <span className="text-text-muted">Protocolo</span>
            <span className="font-mono font-semibold tabular-nums selectable">
              {protocolo}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-text-muted">Emitido em</span>
            <span className="tabular-nums">{dataHora(resumo.criadoEm)}</span>
          </div>
          {excecao && (
            <p className="mt-3 rounded-app bg-warn-soft px-2.5 py-1.5 text-xs font-medium text-warn">
              Liberação excepcional
            </p>
          )}
        </div>
      </div>

      <div className="safe-bottom shrink-0 px-4 pb-3 pt-3 print:hidden">
        <div className="mx-auto flex w-full max-w-xs flex-col gap-2.5">
          <Button tamanho="xl" larguraTotal onClick={aoNovo}>
            <Plus className="size-5" strokeWidth={2.5} />
            Nova consulta
          </Button>
          <Button
            tamanho="lg"
            larguraTotal
            variante="secundario"
            onClick={() => window.print()}
          >
            <Printer className="size-5" />
            Imprimir comprovante
          </Button>
        </div>
      </div>
    </div>
  );
}
