"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ImageOff, Maximize2 } from "lucide-react";
import { formatarPlaca } from "@/lib/placa";
import { travarRolagem } from "@/lib/travar-rolagem";

/**
 * Foto do atendimento.
 *
 * Servida por `/api/fotos/...`, que exige sessão — a tag `img` manda o
 * cookie por ser mesma origem. Não passa pelo otimizador de imagem do
 * Next porque a rota é autenticada e o conteúdo é privado; otimizar
 * significaria copiar dado pessoal para um cache intermediário.
 */
export function FotoAtendimento({
  chave,
  placa,
}: {
  chave: string;
  placa: string;
}) {
  const [ampliada, setAmpliada] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const url = `/api/fotos/${chave}`;

  useEffect(() => {
    if (!ampliada) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAmpliada(false);
    document.addEventListener("keydown", esc);
    const destravar = travarRolagem();
    return () => {
      document.removeEventListener("keydown", esc);
      destravar();
    };
  }, [ampliada]);

  if (falhou) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-app bg-surface-2 px-4 py-10 text-center">
        <ImageOff className="size-6 text-text-muted" />
        <p className="text-sm font-medium">Foto indisponível</p>
        <p className="max-w-[16rem] text-xs leading-snug text-text-muted">
          O arquivo não foi encontrado no armazenamento. O registro do
          atendimento permanece íntegro.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        className="group relative block w-full overflow-hidden rounded-app border border-border"
        aria-label="Ampliar foto do atendimento"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Foto do atendimento da placa ${formatarPlaca(placa)}`}
          onError={() => setFalhou(true)}
          className="block w-full bg-surface-2 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-app bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Maximize2 className="size-4" />
        </span>
      </button>

      {ampliada &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 anim-fade"
            onClick={() => setAmpliada(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Foto ampliada"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Foto do atendimento da placa ${formatarPlaca(placa)}`}
              className="max-h-full max-w-full rounded-app object-contain"
            />
            <button
              type="button"
              onClick={() => setAmpliada(false)}
              aria-label="Fechar"
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
