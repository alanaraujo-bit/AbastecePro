"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Star, Trash2, Loader2, User } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Etiqueta, Vazio } from "@/components/admin/ui";
import { cn, mascararTelefone } from "@/lib/utils";

export type VinculoItem = {
  pessoaId: string;
  nome: string;
  telefone: string | null;
  principal: boolean;
  bloqueado: boolean;
};

/**
 * Condutores de um veículo.
 *
 * O vínculo é o que faz a placa virar uma pessoa na tela do operador —
 * um veículo sem condutor é consultável mas não rende atendimento.
 */
export function GestorVinculos({
  veiculoId,
  vinculos,
}: {
  veiculoId: string;
  vinculos: VinculoItem[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();

  const [adicionando, setAdicionando] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<
    { id: string; nome: string; telefone: string | null }[]
  >([]);
  const [buscando, setBuscando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    if (!adicionando || busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(
          `/api/pessoas/buscar?q=${encodeURIComponent(busca.trim())}`,
        );
        const d = await r.json();
        const jaVinculadas = new Set(vinculos.map((v) => v.pessoaId));
        setResultados(
          (d.pessoas ?? []).filter(
            (p: { id: string }) => !jaVinculadas.has(p.id),
          ),
        );
      } catch {
        /* offline: a tela segue utilizável */
      } finally {
        setBuscando(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [busca, adicionando, vinculos]);

  async function vincular(pessoaId: string, principal: boolean) {
    setOcupado(pessoaId);
    try {
      const r = await fetch("/api/vinculos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pessoaId, veiculoId, principal }),
      });
      if (!r.ok) throw new Error();
      mostrar({ titulo: "Vínculo atualizado", variante: "sucesso" });
      setAdicionando(false);
      setBusca("");
      router.refresh();
    } catch {
      mostrar({ titulo: "Não foi possível vincular", variante: "erro" });
    } finally {
      setOcupado(null);
    }
  }

  async function remover(pessoaId: string) {
    setOcupado(pessoaId);
    try {
      const r = await fetch(
        `/api/vinculos?pessoaId=${pessoaId}&veiculoId=${veiculoId}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error();
      mostrar({ titulo: "Vínculo removido", variante: "info" });
      router.refresh();
    } catch {
      mostrar({ titulo: "Não foi possível remover", variante: "erro" });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      {vinculos.length === 0 ? (
        <Vazio
          Icone={User}
          titulo="Nenhum condutor vinculado"
          descricao="Sem vínculo, o operador vê a placa mas não sabe quem está abastecendo."
          acao={
            <Button onClick={() => setAdicionando(true)}>
              <Plus className="size-4.5" />
              Vincular condutor
            </Button>
          }
        />
      ) : (
        <>
          <ul>
            {vinculos.map((v, i) => (
              <li
                key={v.pessoaId}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 sm:px-5",
                  i > 0 && "border-t border-border",
                )}
              >
                <User className="size-4 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/pessoas/${v.pessoaId}`}
                      className="truncate text-[0.9375rem] font-medium hover:text-brand"
                    >
                      {v.nome}
                    </Link>
                    {v.principal && (
                      <Etiqueta tom="brand">
                        <Star className="size-3" />
                        Principal
                      </Etiqueta>
                    )}
                    {v.bloqueado && <Etiqueta tom="danger">Bloqueada</Etiqueta>}
                  </div>
                  {v.telefone && (
                    <p className="truncate text-sm text-text-muted">
                      {mascararTelefone(v.telefone)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!v.principal && (
                    <button
                      type="button"
                      onClick={() => vincular(v.pessoaId, true)}
                      disabled={ocupado === v.pessoaId}
                      title="Tornar condutor principal"
                      aria-label={`Tornar ${v.nome} condutor principal`}
                      className="flex size-9 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-surface-2 hover:text-brand disabled:opacity-50"
                    >
                      {ocupado === v.pessoaId ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Star className="size-4" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remover(v.pessoaId)}
                    disabled={ocupado === v.pessoaId}
                    aria-label={`Remover vínculo com ${v.nome}`}
                    className="flex size-9 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-border p-3 sm:px-5">
            <Button variante="secundario" onClick={() => setAdicionando(true)}>
              <Plus className="size-4.5" />
              Vincular condutor
            </Button>
          </div>
        </>
      )}

      <Sheet
        aberto={adicionando}
        aoFechar={() => {
          setAdicionando(false);
          setBusca("");
        }}
        titulo="Vincular condutor"
        descricao="Busque uma pessoa já cadastrada para vincular a este veículo."
      >
        <div className="flex flex-col gap-3 pb-4 pt-1">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, telefone ou CPF"
            prefixo={<Search className="size-4.5" />}
            sufixo={
              buscando ? <Loader2 className="size-4 animate-spin" /> : undefined
            }
            autoFocus
          />

          {resultados.length > 0 && (
            <ul className="overflow-hidden rounded-app border border-border">
              {resultados.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => vincular(p.id, vinculos.length === 0)}
                    disabled={ocupado === p.id}
                    className={cn(
                      "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-60",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-medium">
                        {p.nome}
                      </span>
                      {p.telefone && (
                        <span className="block truncate text-xs text-text-muted">
                          {mascararTelefone(p.telefone)}
                        </span>
                      )}
                    </span>
                    {ocupado === p.id && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {busca.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <p className="px-1 text-sm text-text-muted">
              Ninguém encontrado — ou já está vinculado a este veículo.
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
