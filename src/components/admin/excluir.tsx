"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Exclusão de pessoa ou veículo.
 *
 * Com histórico, o servidor DESATIVA em vez de apagar — remover o cadastro
 * deixaria buracos nos relatórios e na auditoria. A tela diz isso antes de
 * confirmar, para que ninguém descubra a diferença depois do clique.
 */
export function BotaoExcluir({
  tipo,
  id,
  nome,
  temHistorico,
}: {
  tipo: "pessoa" | "veiculo";
  id: string;
  nome: string;
  temHistorico: boolean;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const rota = tipo === "pessoa" ? "pessoas" : "veiculos";
  const artigo = tipo === "pessoa" ? "a pessoa" : "o veículo";

  async function confirmar() {
    if (enviando) return;
    setEnviando(true);
    try {
      const resp = await fetch(`/api/${rota}/${id}`, { method: "DELETE" });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        mostrar({ titulo: d.erro ?? "Não foi possível excluir", variante: "erro" });
        setEnviando(false);
        return;
      }
      mostrar({
        titulo: d.desativada || d.desativado ? "Cadastro desativado" : "Cadastro excluído",
        descricao: d.mensagem ?? nome,
        variante: "sucesso",
      });
      router.replace(`/admin/${rota}`);
      router.refresh();
    } catch {
      mostrar({ titulo: "Sem conexão", variante: "erro" });
      setEnviando(false);
    }
  }

  return (
    <>
      <Button
        variante="fantasma"
        onClick={() => setAberto(true)}
        aria-label={`Excluir ${nome}`}
        className="text-text-muted hover:text-danger"
      >
        <Trash2 className="size-4" />
      </Button>

      <Sheet
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={temHistorico ? "Desativar cadastro" : "Excluir cadastro"}
        descricao={
          temHistorico
            ? `${nome} já tem abastecimentos registrados. O cadastro será DESATIVADO, não apagado: o histórico e a auditoria permanecem íntegros, e ${artigo} deixa de aparecer para o operador.`
            : `${nome} não tem nenhum abastecimento registrado e será removido definitivamente. Esta ação não pode ser desfeita.`
        }
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
              onClick={confirmar}
              carregando={enviando}
            >
              {temHistorico ? "Desativar" : "Excluir"}
            </Button>
          </>
        }
      />
    </>
  );
}
