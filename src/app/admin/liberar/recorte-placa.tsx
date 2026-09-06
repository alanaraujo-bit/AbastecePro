"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recorte } from "@/lib/ocr-placa";

/**
 * Enquadramento da placa antes da leitura.
 *
 * Existe porque a camera devolve a cena inteira — carro, asfalto, portao,
 * adesivo — e nela a placa e uma faixa pequena cercada de bordas que
 * tambem parecem texto. Reconhecer a foto toda erra quase sempre; isolar a
 * faixa e o que faz a leitura funcionar.
 *
 * A moldura ja nasce onde a placa costuma estar (centro, formato deitado),
 * de modo que o caminho comum e so confirmar. Arrastar move, e a alca no
 * canto redimensiona.
 */
export function RecortePlaca({
  url,
  lendo,
  aoConfirmar,
  aoCancelar,
}: {
  url: string;
  lendo: boolean;
  aoConfirmar: (recorte: Recorte) => void;
  aoCancelar: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [pronta, setPronta] = useState(false);

  // Caixa em fracao (0-1) da imagem exibida: sobrevive a rotacao de tela e
  // a diferenca entre o tamanho exibido e o tamanho real da foto.
  const [caixa, setCaixa] = useState({ x: 0.1, y: 0.38, l: 0.8, a: 0.24 });

  const arrasto = useRef<{
    modo: "mover" | "redimensionar";
    px: number;
    py: number;
    inicio: typeof caixa;
    largura: number;
    altura: number;
  } | null>(null);

  const aoMover = useCallback((e: PointerEvent) => {
    const a = arrasto.current;
    if (!a) return;
    const dx = (e.clientX - a.px) / a.largura;
    const dy = (e.clientY - a.py) / a.altura;

    setCaixa(() => {
      if (a.modo === "mover") {
        return {
          ...a.inicio,
          x: limitar(a.inicio.x + dx, 0, 1 - a.inicio.l),
          y: limitar(a.inicio.y + dy, 0, 1 - a.inicio.a),
        };
      }
      return {
        ...a.inicio,
        l: limitar(a.inicio.l + dx, 0.12, 1 - a.inicio.x),
        a: limitar(a.inicio.a + dy, 0.06, 1 - a.inicio.y),
      };
    });
  }, []);

  const aoSoltar = useCallback(() => {
    arrasto.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", aoMover);
    window.addEventListener("pointerup", aoSoltar);
    window.addEventListener("pointercancel", aoSoltar);
    return () => {
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener("pointerup", aoSoltar);
      window.removeEventListener("pointercancel", aoSoltar);
    };
  }, [aoMover, aoSoltar]);

  function iniciar(modo: "mover" | "redimensionar", e: React.PointerEvent) {
    const el = imgRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const r = el.getBoundingClientRect();
    arrasto.current = {
      modo,
      px: e.clientX,
      py: e.clientY,
      inicio: caixa,
      largura: r.width,
      altura: r.height,
    };
  }

  function confirmar() {
    const el = imgRef.current;
    if (!el) return;
    // Converte para pixels da imagem ORIGINAL: e nela que o recorte e feito,
    // e usar o tamanho exibido jogaria fora a resolucao que o OCR precisa.
    aoConfirmar({
      x: Math.round(caixa.x * el.naturalWidth),
      y: Math.round(caixa.y * el.naturalHeight),
      largura: Math.round(caixa.l * el.naturalWidth),
      altura: Math.round(caixa.a * el.naturalHeight),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-6 text-center">
        <h1 className="text-[1.375rem] font-semibold tracking-[-0.01em]">
          Enquadre a placa
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Arraste a moldura até ela conter só a placa
        </p>
      </div>

      <div className="scroll-area flex-1 px-4">
        <div className="relative mx-auto w-fit select-none overflow-hidden rounded-card border border-border bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={url}
            alt="Foto da placa"
            onLoad={() => setPronta(true)}
            className="block max-h-[52vh] w-auto max-w-full touch-none"
            draggable={false}
          />

          {pronta && (
            <>
              {/* Escurece o que está fora da moldura: sem esse contraste a
                  moldura vira só um retângulo desenhado sobre a foto. */}
              <div
                className="pointer-events-none absolute inset-0 bg-black/55"
                style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                    ${pct(caixa.x)} ${pct(caixa.y)},
                    ${pct(caixa.x)} ${pct(caixa.y + caixa.a)},
                    ${pct(caixa.x + caixa.l)} ${pct(caixa.y + caixa.a)},
                    ${pct(caixa.x + caixa.l)} ${pct(caixa.y)},
                    ${pct(caixa.x)} ${pct(caixa.y)})`,
                }}
                aria-hidden
              />
              <div
                onPointerDown={(e) => iniciar("mover", e)}
                className="absolute cursor-move touch-none rounded-[0.25rem] border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                style={{
                  left: pct(caixa.x),
                  top: pct(caixa.y),
                  width: pct(caixa.l),
                  height: pct(caixa.a),
                }}
              >
                <button
                  type="button"
                  onPointerDown={(e) => iniciar("redimensionar", e)}
                  aria-label="Redimensionar moldura"
                  className="absolute -bottom-3 -right-3 size-7 touch-none rounded-full border-2 border-white bg-brand shadow-[var(--shadow-md)]"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="safe-bottom shrink-0 px-4 pb-3 pt-4">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-2.5">
          <Button
            tamanho="xl"
            larguraTotal
            onClick={confirmar}
            carregando={lendo}
            disabled={!pronta}
          >
            {!lendo && <Check className="size-5" />}
            {lendo ? "Lendo a placa…" : "Ler placa"}
          </Button>
          <Button
            tamanho="lg"
            larguraTotal
            variante="fantasma"
            onClick={aoCancelar}
            disabled={lendo}
          >
            <X className="size-5" />
            Cancelar
          </Button>
          {lendo && (
            <p className="flex items-center justify-center gap-2 text-xs text-text-muted">
              <Loader2 className="size-3 animate-spin" />
              A primeira leitura demora mais: o reconhecedor está carregando.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function pct(v: number): string {
  return `${(v * 100).toFixed(3)}%`;
}
