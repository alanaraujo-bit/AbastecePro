"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Ban } from "lucide-react";
import { formatarPlaca } from "@/lib/placa";
import { cn } from "@/lib/utils";

/**
 * Vitrine do veredito — o painel de marca da tela de entrada.
 *
 * Mostra, sozinha, o momento que define o produto: a placa e digitada, as
 * regras sao consultadas e a resposta chega inteira (cor, palavra e motivo).
 *
 * Motivo de existir: quem abre esta tela pela primeira vez entende o que a
 * ferramenta faz em quatro segundos, sem ler um paragrafo de venda.
 *
 * Nao ha rotulo dizendo "demonstracao" nem indicador de cena: e uma tela de
 * login, anterior a qualquer autenticacao — ninguem confunde estes dados com
 * a propria frota, e legenda que explica a interface e ruido.
 */

type Cena = {
  placa: string;
  liberado: boolean;
  veiculo: string;
  motivos: string[];
};

// Casos escolhidos para cobrir as tres familias de regra do sistema:
// vinculo, janela de horario e cota. Um bloqueio no meio — a ferramenta
// existe justamente para dizer "nao".
const CENAS: Cena[] = [
  {
    placa: "RIO2A18",
    liberado: true,
    veiculo: "Fiat Strada · Branca",
    motivos: ["Frota interna · condutor vinculado", "Seg a sex, 6h às 20h", "Limite de 80 L por atendimento"],
  },
  {
    placa: "QXB7J09",
    liberado: false,
    veiculo: "VW Saveiro · Prata",
    motivos: ["Condutor sem vínculo ativo com o veículo", "Cota mensal esgotada — 600 de 600 L"],
  },
  {
    placa: "KLM4C55",
    liberado: true,
    veiculo: "Toyota Hilux SW4 · Cinza",
    motivos: ["Frota interna · condutor vinculado", "Cota mensal: 214 de 600 L usados"],
  },
];

type Fase = "digitando" | "consultando" | "veredito";

const MS_POR_LETRA = 105;
const MS_CONSULTA = 620;
const MS_LEITURA = 2900;

const CONSULTA_MOVIMENTO = "(prefers-reduced-motion: reduce)";

/**
 * Le a preferencia de movimento como fonte externa, e nao como estado
 * sincronizado por efeito: assim a primeira pintura ja sai certa e a
 * preferencia trocada no sistema chega sem recarregar.
 */
function useMovimentoReduzido() {
  return useSyncExternalStore(
    (aoMudar) => {
      const mq = window.matchMedia(CONSULTA_MOVIMENTO);
      mq.addEventListener("change", aoMudar);
      return () => mq.removeEventListener("change", aoMudar);
    },
    () => window.matchMedia(CONSULTA_MOVIMENTO).matches,
    () => false,
  );
}

export function VitrineVeredito({ className }: { className?: string }) {
  const [indiceVivo, setIndice] = useState(0);
  const [faseViva, setFase] = useState<Fase>("digitando");
  const [letrasVivas, setLetras] = useState(0);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quem pediu menos movimento ve uma cena parada, nao um carrossel: o
  // ciclo nao roda e a vitrine mostra o veredito da primeira cena, inteiro.
  const parado = useMovimentoReduzido();
  const indice = parado ? 0 : indiceVivo;
  const fase: Fase = parado ? "veredito" : faseViva;
  const letras = parado ? CENAS[0].placa.length : letrasVivas;

  const cena = CENAS[indice];

  useEffect(() => {
    if (parado) return;

    function agendar(ms: number, fn: () => void) {
      relogio.current = setTimeout(fn, ms);
    }

    if (fase === "digitando") {
      if (letras < cena.placa.length) {
        agendar(MS_POR_LETRA, () => setLetras((n) => n + 1));
      } else {
        agendar(MS_POR_LETRA * 2, () => setFase("consultando"));
      }
    } else if (fase === "consultando") {
      agendar(MS_CONSULTA, () => setFase("veredito"));
    } else {
      agendar(MS_LEITURA, () => {
        setIndice((i) => (i + 1) % CENAS.length);
        setLetras(0);
        setFase("digitando");
      });
    }

    return () => {
      if (relogio.current) clearTimeout(relogio.current);
    };
  }, [fase, letras, indice, cena.placa.length, parado]);

  const digitado = cena.placa.slice(0, letras);
  const liberado = cena.liberado;

  return (
    <figure className={cn("m-0 w-full max-w-[26rem]", className)}>
      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-lg)]">
        {/* ---- Entrada da placa: a unica coisa que o operador digita ---- */}
        <div className="flex items-baseline gap-3 border-b border-border px-5 py-4">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Placa
          </span>
          <p className="font-mono text-[1.375rem] font-semibold leading-none tracking-[0.16em] text-text">
            {formatarPlaca(digitado) || " "}
            {fase === "digitando" && !parado && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1.05em] w-[0.09em] translate-y-[0.12em] bg-brand cursor-placa"
              />
            )}
          </p>
        </div>

        {/* ---- Resposta. Altura fixa: a troca de cena nao pode empurrar
             o layout da pagina inteira para cima e para baixo. ---- */}
        <div className="relative flex min-h-[11.25rem] flex-col">
          {fase === "digitando" && (
            <p className="m-auto px-6 text-center text-sm text-text-muted">
              Digite a placa. A consulta dispara sozinha.
            </p>
          )}

          {fase === "consultando" && (
            <div className="m-auto flex flex-col items-center gap-3">
              <span className="flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-2 rounded-full bg-brand pulso-consulta"
                    style={{ animationDelay: `${i * 130}ms` }}
                  />
                ))}
              </span>
              <p className="text-sm text-text-secondary">Consultando as regras…</p>
            </div>
          )}

          {fase === "veredito" && (
            <div className={cn("flex flex-1 flex-col", !parado && "anim-veredito")}>
              <div
                className={cn(
                  "flex items-center gap-3.5 px-5 py-4",
                  liberado ? "bg-ok-soft" : "bg-danger-soft",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    liberado ? "bg-ok" : "bg-danger",
                  )}
                >
                  {liberado ? (
                    <Check className="size-6 text-white" strokeWidth={3} />
                  ) : (
                    <Ban className="size-[1.375rem] text-white" strokeWidth={2.5} />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xl font-bold uppercase leading-none tracking-[-0.01em]",
                      liberado ? "text-ok" : "text-danger",
                    )}
                  >
                    {liberado ? "Liberado" : "Bloqueado"}
                  </p>
                  <p className="mt-1 truncate text-sm text-text-secondary">
                    {cena.veiculo}
                  </p>
                </div>
              </div>

              <ul className="flex flex-1 flex-col justify-center gap-2 px-5 py-4">
                {cena.motivos.map((m) => (
                  <li key={m} className="flex gap-2.5 text-sm leading-snug text-text-secondary">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-[0.4375rem] size-1.5 shrink-0 rounded-full",
                        liberado ? "bg-ok" : "bg-danger",
                      )}
                    />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

    </figure>
  );
}
