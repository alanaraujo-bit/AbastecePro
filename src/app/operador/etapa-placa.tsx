"use client";

import { useRef } from "react";
import { Camera, Loader2, Search, X, WifiOff } from "lucide-react";
import { PlacaInput } from "@/components/placa-input";
import { Button } from "@/components/ui/button";
import { formatarPlaca, placaValida } from "@/lib/placa";
import { litros as fmtLitros, tempoRelativo } from "@/lib/utils";
import type { Recente } from "./atendimento";

export function EtapaPlaca({
  placa,
  aoMudarPlaca,
  aoConsultar,
  consultando,
  erro,
  foto,
  aoFotografar,
  recentes,
}: {
  placa: string;
  aoMudarPlaca: (v: string) => void;
  aoConsultar: () => void;
  consultando: boolean;
  erro: string | null;
  foto: { arquivo: File; url: string } | null;
  aoFotografar: (f: File | null) => void;
  recentes: Recente[];
}) {
  const inputFoto = useRef<HTMLInputElement>(null);
  const completa = placa.length === 7;
  const invalida = completa && !placaValida(placa);

  return (
    <div className="scroll-area flex h-full flex-col">
      <div className="px-4 pb-6 pt-7">
        <h1 className="text-center text-[1.375rem] font-semibold tracking-[-0.01em]">
          Identificar veículo
        </h1>
        <p className="mt-1 text-center text-sm text-text-muted">
          Fotografe ou digite a placa
        </p>

        <div className="mt-7">
          <PlacaInput
            valor={placa}
            aoMudar={aoMudarPlaca}
            aoConfirmar={aoConsultar}
            autoFoco
            invalido={invalida}
            desabilitado={consultando}
          />
        </div>

        {invalida && (
          <p className="mt-6 text-center text-sm text-danger anim-fade">
            Placa inválida. Use ABC-1234 ou ABC1D23.
          </p>
        )}

        {erro && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-app border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger anim-fade"
          >
            <WifiOff className="mt-0.5 size-4 shrink-0" />
            <span className="leading-snug">{erro}</span>
          </div>
        )}

        {/* Estado de consulta: ocupa o mesmo lugar do erro para o layout
            não pular entre um e outro. */}
        {consultando && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-brand anim-fade">
            <Loader2 className="size-4 animate-spin" />
            Consultando {formatarPlaca(placa)}…
          </div>
        )}

        <div className="mt-7 flex flex-col gap-2.5">
          {/* capture="environment" abre a câmera traseira nativa direto —
              mais rápido e mais familiar do que uma câmera dentro da página. */}
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => aoFotografar(e.target.files?.[0] ?? null)}
          />

          {foto ? (
            <div className="flex items-center gap-3 rounded-app border border-border bg-surface p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.url}
                alt="Foto da placa"
                className="size-14 rounded-[0.625rem] object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Foto anexada</p>
                <p className="truncate text-xs text-text-muted">
                  Será salva com o atendimento
                </p>
              </div>
              <button
                type="button"
                onClick={() => aoFotografar(null)}
                aria-label="Remover foto"
                className="flex size-9 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
              >
                <X className="size-4.5" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variante="secundario"
              tamanho="lg"
              larguraTotal
              onClick={() => inputFoto.current?.click()}
            >
              <Camera className="size-5" />
              Fotografar placa
            </Button>
          )}

          <Button
            type="button"
            tamanho="lg"
            larguraTotal
            onClick={aoConsultar}
            disabled={!completa || invalida}
            carregando={consultando}
          >
            {!consultando && <Search className="size-5" />}
            Consultar
          </Button>
        </div>
      </div>

      {recentes.length > 0 && (
        <div className="mt-2 border-t border-border px-4 pb-8 pt-5">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Últimos atendimentos
          </h2>
          <ul className="flex flex-col">
            {recentes.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => aoMudarPlaca(r.placa)}
                  className="flex w-full items-center gap-3 rounded-app px-2 py-2.5 text-left transition-colors hover:bg-surface-2 active:bg-surface-2"
                >
                  <span className="font-mono text-[0.9375rem] font-semibold tracking-wider">
                    {formatarPlaca(r.placa)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                    {r.nome ?? "—"}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    {r.litros ? fmtLitros(r.litros) : ""} ·{" "}
                    {tempoRelativo(r.criadoEm)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
