"use client";

import { useState } from "react";
import {
  Check,
  Ban,
  ShieldAlert,
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Fuel,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import { formatarPlaca } from "@/lib/placa";
import {
  dataHora,
  litros as fmtLitros,
  mascararTelefone,
  moeda,
  tempoRelativo,
} from "@/lib/utils";
import type { Condutor, ConsultaResposta, MotivoRegraCliente } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export function EtapaVeredito({
  consulta,
  condutor,
  aoTrocarCondutor,
  atualizando,
  podeAutorizar,
  aoRegistrar,
  aoAutorizar,
  aoCancelar,
}: {
  consulta: ConsultaResposta;
  condutor: Condutor | null;
  aoTrocarCondutor: (id: string) => void;
  atualizando: boolean;
  podeAutorizar: boolean;
  aoRegistrar: () => void;
  aoAutorizar: (justificativa: string) => void;
  aoCancelar: () => void;
}) {
  const [sheetAberto, setSheetAberto] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [erroJust, setErroJust] = useState<string | null>(null);

  const v = consulta.veredito;
  const liberado = v?.liberado ?? false;
  const veiculo = consulta.veiculo!;

  const descricaoVeiculo = [veiculo.marca, veiculo.modelo, veiculo.cor]
    .filter(Boolean)
    .join(" · ");

  function confirmarAutorizacao() {
    const j = justificativa.trim();
    if (j.length < 5) {
      setErroJust("Descreva o motivo — isso fica registrado na auditoria.");
      return;
    }
    setSheetAberto(false);
    aoAutorizar(j);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-area flex-1">
        {/* ------- Veredito. A tela inteira responde de uma vez: cor, ícone
            e palavra. O operador tem de saber a resposta de relance, sem ler. */}
        <div
          className={cn(
            "px-4 pb-6 pt-8 text-center anim-veredito",
            liberado ? "bg-ok-soft" : "bg-danger-soft",
          )}
        >
          <div
            className={cn(
              "mx-auto flex size-[4.5rem] items-center justify-center rounded-full",
              liberado ? "bg-ok" : "bg-danger",
            )}
          >
            {liberado ? (
              <Check className="size-10 text-white" strokeWidth={3} />
            ) : (
              <Ban className="size-9 text-white" strokeWidth={2.5} />
            )}
          </div>

          <p
            className={cn(
              "mt-4 text-[2rem] font-bold uppercase leading-none tracking-[-0.02em]",
              liberado ? "text-ok" : "text-danger",
            )}
          >
            {liberado ? "Liberado" : "Bloqueado"}
          </p>

          <p className="mt-3 font-mono text-xl font-semibold tracking-[0.12em] text-text selectable">
            {formatarPlaca(veiculo.placa)}
          </p>
          {descricaoVeiculo && (
            <p className="mt-1 text-sm text-text-secondary">{descricaoVeiculo}</p>
          )}
        </div>

        <div className="flex flex-col gap-4 px-4 py-5">
          {/* ------- Motivos do bloqueio ------- */}
          {!liberado && v && (
            <section className="flex flex-col gap-2.5">
              {v.cadastrais.map((c) => (
                <div
                  key={`${c.tipo}-${c.nome}`}
                  className="rounded-card border border-danger/25 bg-surface p-4"
                >
                  <div className="flex items-center gap-2 text-danger">
                    <ShieldAlert className="size-4.5 shrink-0" />
                    <h2 className="text-sm font-semibold">
                      {c.tipo === "PESSOA"
                        ? "Pessoa bloqueada"
                        : "Veículo bloqueado"}
                    </h2>
                  </div>
                  <p className="mt-2 text-[0.9375rem] font-medium">
                    {c.tipo === "VEICULO" ? formatarPlaca(c.nome) : c.nome}
                  </p>
                  {c.motivo && (
                    <p className="mt-1 text-sm leading-snug text-text-secondary">
                      {c.motivo}
                    </p>
                  )}
                  {c.desde && (
                    <p className="mt-2 text-xs text-text-muted">
                      Bloqueado em {dataHora(c.desde)}
                    </p>
                  )}
                </div>
              ))}

              {v.bloqueios.map((b) => (
                <CartaoRegra key={b.regraId} motivo={b} tom="bloqueio" />
              ))}
            </section>
          )}

          {/* ------- Avisos: liberam, mas o operador precisa ver ------- */}
          {v?.avisos.map((a) => (
            <CartaoRegra key={a.regraId} motivo={a} tom="aviso" />
          ))}

          {/* ------- Condutor ------- */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Condutor
              {atualizando && (
                <Loader2 className="ml-2 inline size-3 animate-spin" />
              )}
            </h2>

            {consulta.condutores.length === 0 ? (
              <div className="rounded-card border border-border bg-surface p-4 text-sm text-text-muted">
                Nenhuma pessoa vinculada a este veículo.
              </div>
            ) : consulta.condutores.length === 1 ? (
              <CartaoCondutor c={consulta.condutores[0]} />
            ) : (
              // Mais de um condutor: escolha explícita, porque o veredito
              // muda conforme quem está abastecendo.
              <div className="flex flex-col gap-2">
                {consulta.condutores.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => aoTrocarCondutor(c.id)}
                    disabled={atualizando}
                    className={cn(
                      "rounded-card border p-3.5 text-left transition-all active:scale-[0.99]",
                      c.id === condutor?.id
                        ? "border-brand bg-brand-soft"
                        : "border-border bg-surface hover:bg-surface-2",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <User
                        className={cn(
                          "size-4 shrink-0",
                          c.id === condutor?.id
                            ? "text-brand-on-soft"
                            : "text-text-muted",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">
                        {c.nome}
                      </span>
                      {c.principal && (
                        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-text-secondary">
                          Principal
                        </span>
                      )}
                      {c.bloqueado && (
                        <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
                          Bloqueado
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ------- Último atendimento ------- */}
          {consulta.ultimo && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Último abastecimento
              </h2>
              <div className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.9375rem] font-semibold tabular-nums">
                    {fmtLitros(consulta.ultimo.litros)}
                  </span>
                  <span className="text-sm tabular-nums text-text-secondary">
                    {moeda(consulta.ultimo.valor)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-text-secondary">
                  {consulta.ultimo.pessoa?.nome ?? "—"}
                  {consulta.ultimo.combustivel
                    ? ` · ${consulta.ultimo.combustivel}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {dataHora(consulta.ultimo.criadoEm)} ·{" "}
                  {tempoRelativo(consulta.ultimo.criadoEm)}
                </p>
              </div>
            </section>
          )}

          {/* ------- Histórico curto ------- */}
          {consulta.historico.length > 1 && (
            <section className="pb-2">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Histórico do veículo
              </h2>
              <ul className="overflow-hidden rounded-card border border-border bg-surface">
                {consulta.historico.map((h, i) => (
                  <li
                    key={h.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        h.resultado === "BLOQUEADO"
                          ? "bg-danger"
                          : h.resultado === "AUTORIZADO_EXCECAO"
                            ? "bg-warn"
                            : "bg-ok",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                      {h.pessoa?.nome ?? "—"}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-text-secondary">
                      {h.litros ? fmtLitros(h.litros) : "—"}
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-text-muted">
                      {tempoRelativo(h.criadoEm)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* ------- Barra de ação fixa. Fica sempre ao alcance do polegar,
          sem depender de rolar até o fim da tela. ------- */}
      <div className="safe-bottom shrink-0 border-t border-border bg-bg-elevated px-4 pb-3 pt-3">
        <div className="flex flex-col gap-2.5">
          {liberado ? (
            <Button tamanho="xl" larguraTotal onClick={aoRegistrar}>
              <Fuel className="size-5" />
              Registrar abastecimento
            </Button>
          ) : podeAutorizar ? (
            <Button
              tamanho="xl"
              larguraTotal
              variante="secundario"
              onClick={() => setSheetAberto(true)}
              className="border-warn/40 text-warn"
            >
              <ShieldAlert className="size-5" />
              Autorizar excepcionalmente
            </Button>
          ) : (
            <p className="pb-1 text-center text-sm text-text-muted">
              Chame um supervisor para autorizar.
            </p>
          )}

          <Button
            tamanho="lg"
            larguraTotal
            variante="fantasma"
            onClick={aoCancelar}
          >
            <ChevronLeft className="size-5" />
            Nova consulta
          </Button>
        </div>
      </div>

      <Sheet
        aberto={sheetAberto}
        aoFechar={() => setSheetAberto(false)}
        titulo="Autorizar excepcionalmente"
        descricao="Este atendimento está bloqueado pelas regras. A autorização fica registrada com seu nome na auditoria."
        rodape={
          <>
            <Button
              variante="secundario"
              larguraTotal
              onClick={() => setSheetAberto(false)}
            >
              Cancelar
            </Button>
            <Button larguraTotal onClick={confirmarAutorizacao}>
              Autorizar
            </Button>
          </>
        }
      >
        <div className="pb-2 pt-1">
          <Textarea
            rotulo="Motivo da autorização"
            placeholder="Ex.: veículo em atendimento emergencial, autorizado pela gerência."
            value={justificativa}
            onChange={(e) => {
              setJustificativa(e.target.value);
              setErroJust(null);
            }}
            erro={erroJust ?? undefined}
            maxLength={500}
            autoFocus
          />
        </div>
      </Sheet>
    </div>
  );
}

function CartaoCondutor({ c }: { c: Condutor }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <User className="size-4 shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">
          {c.nome}
        </span>
        {c.bloqueado && (
          <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
            Bloqueado
          </span>
        )}
      </div>
      {c.telefone && (
        <p className="mt-1.5 pl-6.5 text-sm text-text-muted selectable">
          {mascararTelefone(c.telefone)}
        </p>
      )}
    </div>
  );
}

/**
 * Motivo de regra em forma de cartão.
 *
 * Mostra a barra de consumo porque "excedeu o limite" não é acionável: o
 * operador precisa ver *quanto* foi usado de *quanto* para explicar ao
 * motorista sem chamar ninguém.
 */
function CartaoRegra({
  motivo,
  tom,
}: {
  motivo: MotivoRegraCliente;
  tom: "bloqueio" | "aviso";
}) {
  const perigo = tom === "bloqueio";
  const pct = motivo.limite > 0
    ? Math.min(100, (motivo.atual / motivo.limite) * 100)
    : 100;

  return (
    <div
      className={cn(
        "rounded-card border bg-surface p-4",
        perigo ? "border-danger/25" : "border-warn/30",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          perigo ? "text-danger" : "text-warn",
        )}
      >
        {perigo ? (
          <Ban className="size-4.5 shrink-0" />
        ) : (
          <AlertTriangle className="size-4.5 shrink-0" />
        )}
        <h3 className="text-sm font-semibold">{motivo.nome}</h3>
      </div>

      <p className="mt-2 text-[0.9375rem] leading-snug">{motivo.mensagem}</p>

      <div className="mt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              "[transition-timing-function:var(--ease-out-app)]",
              perigo ? "bg-danger" : "bg-warn",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs tabular-nums text-text-muted">
          <span>
            {formatarMetrica(motivo.atual, motivo.metrica)} usados
          </span>
          <span>
            limite {formatarMetrica(motivo.limite, motivo.metrica)} {motivo.janela}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatarMetrica(v: number, metrica: string): string {
  if (metrica === "LITROS") return `${v.toLocaleString("pt-BR")} L`;
  if (metrica === "VALOR") return moeda(v);
  return String(v);
}
