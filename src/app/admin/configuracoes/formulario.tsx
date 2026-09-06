"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Configuracoes } from "@/lib/config";

/**
 * Só entra aqui o que MUDA COMPORTAMENTO de verdade.
 *
 * As duas opções que existiam — exigir litros e exigir foto — morreram com
 * o modelo antigo: a liberação é um papel emitido no balcão, e quem emite
 * não tem litros para informar nem obrigação de fotografar. Um interruptor
 * que não faz nada é pior do que nenhum: aparenta um controle inexistente.
 */
export function FormularioConfig({ config }: { config: Configuracoes }) {
  const router = useRouter();
  const { mostrar } = useToast();

  const [organizacao, setOrganizacao] = useState(config.organizacao);
  const [salvando, setSalvando] = useState(false);

  const mudou = organizacao !== config.organizacao;

  async function salvar() {
    if (salvando || !mudou) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizacao }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        mostrar({ titulo: d.erro ?? "Não foi possível salvar", variante: "erro" });
        setSalvando(false);
        return;
      }
      mostrar({
        titulo: "Configurações salvas",
        descricao: "Valem para a próxima liberação.",
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
            dica="Aparece no painel, no comprovante impresso e no cabeçalho dos relatórios exportados."
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={!mudou} carregando={salvando}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
