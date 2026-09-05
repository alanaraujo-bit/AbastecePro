"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

/**
 * Bloqueio manual de pessoa ou veículo.
 *
 * O motivo é obrigatório ao bloquear, e não por formalidade: ele aparece
 * na tela do operador, que precisa explicar a recusa ao motorista ali na
 * pista sem ter a quem perguntar.
 */
export function BotaoBloqueio({
  tipo,
  id,
  nome,
  bloqueado,
}: {
  tipo: "pessoa" | "veiculo";
  id: string;
  nome: string;
  bloqueado: boolean;
}) {
  const router = useRouter();
  const { mostrar } = useToast();

  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const rota = tipo === "pessoa" ? "pessoas" : "veiculos";
  const substantivo = tipo === "pessoa" ? "Pessoa" : "Veículo";

  async function aplicar(novoBloqueado: boolean) {
    if (enviando) return;
    if (novoBloqueado && motivo.trim().length < 5) {
      setErro("Descreva o motivo — ele aparece para o operador.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const resp = await fetch(`/api/${rota}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bloqueado: novoBloqueado,
          motivoBloqueio: novoBloqueado ? motivo.trim() : null,
        }),
      });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(d.erro ?? "Não foi possível aplicar.");
        setEnviando(false);
        return;
      }
      mostrar({
        titulo: novoBloqueado
          ? `${substantivo} bloqueado(a)`
          : `${substantivo} desbloqueado(a)`,
        descricao: nome,
        variante: novoBloqueado ? "aviso" : "sucesso",
      });
      setAberto(false);
      setMotivo("");
      setEnviando(false);
      router.refresh();
    } catch {
      setErro("Sem conexão. Tente novamente.");
      setEnviando(false);
    }
  }

  if (bloqueado) {
    return (
      <Button
        variante="secundario"
        onClick={() => aplicar(false)}
        carregando={enviando}
        className="border-ok/40 text-ok"
      >
        <ShieldCheck className="size-4" />
        Desbloquear
      </Button>
    );
  }

  return (
    <>
      <Button
        variante="secundario"
        onClick={() => setAberto(true)}
        className="border-danger/40 text-danger"
      >
        <Ban className="size-4" />
        Bloquear
      </Button>

      <Sheet
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`Bloquear ${tipo === "pessoa" ? "pessoa" : "veículo"}`}
        descricao={`Todo atendimento de ${nome} passa a ser recusado até o desbloqueio. O motivo aparece na tela do operador.`}
        rodape={
          <>
            <Button
              variante="secundario"
              larguraTotal
              onClick={() => setAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              variante="perigo"
              larguraTotal
              onClick={() => aplicar(true)}
              carregando={enviando}
            >
              Bloquear
            </Button>
          </>
        }
      >
        <div className="pb-2 pt-1">
          <Textarea
            rotulo="Motivo do bloqueio"
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setErro(null);
            }}
            erro={erro ?? undefined}
            maxLength={300}
            autoFocus
            placeholder="Ex.: pendência financeira em aberto."
          />
        </div>
      </Sheet>
    </>
  );
}
