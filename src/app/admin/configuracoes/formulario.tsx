"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Configuracoes } from "@/lib/config";

/** Interruptor com rótulo e explicação da consequência. */
function Opcao({
  titulo,
  descricao,
  valor,
  aoMudar,
}: {
  titulo: string;
  descricao: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3.5 border-t border-border px-4 py-4 sm:px-5">
      <button
        type="button"
        role="switch"
        aria-checked={valor}
        aria-label={titulo}
        onClick={() => aoMudar(!valor)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          valor ? "bg-brand" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-[left] duration-200",
            "[transition-timing-function:var(--ease-out-app)]",
            valor ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-medium">{titulo}</p>
        <p className="mt-0.5 text-sm leading-snug text-text-muted">
          {descricao}
        </p>
      </div>
    </div>
  );
}

export function FormularioConfig({ config }: { config: Configuracoes }) {
  const router = useRouter();
  const { mostrar } = useToast();

  const [organizacao, setOrganizacao] = useState(config.organizacao);
  const [litrosObrigatorios, setLitros] = useState(config.litrosObrigatorios);
  const [fotoObrigatoria, setFoto] = useState(config.fotoObrigatoria);
  const [salvando, setSalvando] = useState(false);

  const mudou =
    organizacao !== config.organizacao ||
    litrosObrigatorios !== config.litrosObrigatorios ||
    fotoObrigatoria !== config.fotoObrigatoria;

  async function salvar() {
    if (salvando || !mudou) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizacao, litrosObrigatorios, fotoObrigatoria }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        mostrar({ titulo: d.erro ?? "Não foi possível salvar", variante: "erro" });
        setSalvando(false);
        return;
      }
      mostrar({
        titulo: "Configurações salvas",
        descricao: "Valem para o próximo atendimento.",
        variante: "sucesso",
      });
      setSalvando(false);
      router.refresh();
    } catch {
      mostrar({ titulo: "Sem conexão", variante: "erro" });
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card titulo="Identificação">
        <div className="p-4 sm:p-5">
          <Input
            rotulo="Nome da organização"
            value={organizacao}
            onChange={(e) => setOrganizacao(e.target.value)}
            maxLength={80}
            dica="Aparece no painel e no cabeçalho dos relatórios exportados."
          />
        </div>
      </Card>

      <Card titulo="Atendimento">
        <Opcao
          titulo="Exigir litros no registro"
          descricao="Sem litros, as regras de volume não têm como ser aplicadas — o consumo por pessoa e por veículo deixa de ser controlável."
          valor={litrosObrigatorios}
          aoMudar={setLitros}
        />
        <Opcao
          titulo="Exigir foto no atendimento"
          descricao="O operador não conclui sem anexar a imagem. Aumenta o tempo de cada atendimento; use quando a comprovação visual for necessária."
          valor={fotoObrigatoria}
          aoMudar={setFoto}
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={!mudou} carregando={salvando}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
