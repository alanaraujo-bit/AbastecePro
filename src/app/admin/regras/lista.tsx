"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, SlidersHorizontal, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, Etiqueta, Vazio } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import { Sheet } from "@/components/ui/sheet";
import { descreverRegra } from "@/lib/regras/descrever";
import { cn } from "@/lib/utils";
import { EditorRegra } from "./editor";

export type RegraCliente = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  prioridade: number;
  escopo: string;
  metrica: string;
  janela: string;
  janelaHoras: number | null;
  limite: number;
  acao: string;
  mensagem: string | null;
  alvoPessoaId: string | null;
  alvoVeiculoId: string | null;
  alvoNome: string | null;
};

export function ListaRegras({ regras }: { regras: RegraCliente[] }) {
  const router = useRouter();
  const { mostrar } = useToast();

  const [editando, setEditando] = useState<RegraCliente | null>(null);
  const [criando, setCriando] = useState(false);
  const [excluindo, setExcluindo] = useState<RegraCliente | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function alternar(r: RegraCliente) {
    setOcupado(r.id);
    try {
      const resp = await fetch(`/api/regras/${r.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativo: !r.ativo }),
      });
      if (!resp.ok) throw new Error();
      mostrar({
        titulo: r.ativo ? "Regra desativada" : "Regra ativada",
        descricao: r.nome,
        variante: r.ativo ? "info" : "sucesso",
      });
      router.refresh();
    } catch {
      mostrar({ titulo: "Não foi possível alterar a regra", variante: "erro" });
    } finally {
      setOcupado(null);
    }
  }

  async function excluir() {
    if (!excluindo) return;
    setOcupado(excluindo.id);
    try {
      const resp = await fetch(`/api/regras/${excluindo.id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error();
      mostrar({ titulo: "Regra excluída", descricao: excluindo.nome, variante: "sucesso" });
      setExcluindo(null);
      router.refresh();
    } catch {
      mostrar({ titulo: "Não foi possível excluir", variante: "erro" });
    } finally {
      setOcupado(null);
    }
  }

  const ativas = regras.filter((r) => r.ativo);
  const inativas = regras.filter((r) => !r.ativo);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-text-secondary">
          {ativas.length} ativa(s)
          {inativas.length > 0 && ` · ${inativas.length} desativada(s)`}
        </p>
        <Button className="ml-auto" onClick={() => setCriando(true)}>
          <Plus className="size-4.5" strokeWidth={2.5} />
          Nova regra
        </Button>
      </div>

      {regras.length === 0 ? (
        <Card>
          <Vazio
            Icone={SlidersHorizontal}
            titulo="Nenhuma regra cadastrada"
            descricao="Sem regras, todo abastecimento é liberado. Crie a primeira para começar a controlar limites."
            acao={
              <Button onClick={() => setCriando(true)}>
                <Plus className="size-4.5" />
                Criar regra
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {[...ativas, ...inativas].map((r) => (
            <li key={r.id}>
              <div
                className={cn(
                  "flex flex-wrap items-start gap-x-4 gap-y-3 rounded-card border bg-surface p-4",
                  r.ativo ? "border-border" : "border-border opacity-60",
                )}
              >
                {/* Interruptor: ligar/desligar é o gesto mais comum aqui e
                    não deve exigir abrir o editor. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.ativo}
                  aria-label={`${r.ativo ? "Desativar" : "Ativar"} regra ${r.nome}`}
                  disabled={ocupado === r.id}
                  onClick={() => alternar(r)}
                  className={cn(
                    "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
                    r.ativo ? "bg-brand" : "bg-border-strong",
                    ocupado === r.id && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-[left] duration-200",
                      "[transition-timing-function:var(--ease-out-app)]",
                      r.ativo ? "left-[1.375rem]" : "left-0.5",
                    )}
                  />
                </button>

                <div className="min-w-[16rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[0.9375rem] font-semibold">{r.nome}</h3>
                    {r.acao === "AVISAR" && <Etiqueta tom="warn">Aviso</Etiqueta>}
                    {r.alvoNome && <Etiqueta tom="brand">{r.alvoNome}</Etiqueta>}
                  </div>

                  {/* A frase é a leitura principal: quem configura precisa
                      entender o efeito sem decifrar os campos. */}
                  <p className="mt-1 text-sm text-text-secondary">
                    {descreverRegra(r)}
                  </p>

                  {r.descricao && (
                    <p className="mt-1 text-sm leading-snug text-text-muted">
                      {r.descricao}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-1 hidden text-xs tabular-nums text-text-muted sm:block">
                    prioridade {r.prioridade}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditando(r)}
                    aria-label={`Editar ${r.nome}`}
                    className="flex size-9 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcluindo(r)}
                    aria-label={`Excluir ${r.nome}`}
                    className="flex size-9 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(criando || editando) && (
        <EditorRegra
          regra={editando}
          aoFechar={() => {
            setCriando(false);
            setEditando(null);
          }}
          aoSalvar={() => {
            setCriando(false);
            setEditando(null);
            router.refresh();
          }}
        />
      )}

      <Sheet
        aberto={Boolean(excluindo)}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir regra"
        descricao={
          excluindo
            ? `“${excluindo.nome}” deixará de valer imediatamente. Os abastecimentos já registrados mantêm a cópia da regra usada na decisão.`
            : undefined
        }
        rodape={
          <>
            <Button
              variante="secundario"
              larguraTotal
              onClick={() => setExcluindo(null)}
            >
              Cancelar
            </Button>
            <Button
              variante="perigo"
              larguraTotal
              onClick={excluir}
              carregando={ocupado === excluindo?.id}
            >
              {ocupado === excluindo?.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Excluir
            </Button>
          </>
        }
      />
    </div>
  );
}
