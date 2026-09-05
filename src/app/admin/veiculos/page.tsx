import Link from "next/link";
import { Car, Ban, Users } from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { formatarPlaca, normalizarPlaca } from "@/lib/placa";
import { numero } from "@/lib/utils";
import { PageHeader, Conteudo, Card, Vazio, Etiqueta } from "@/components/admin/ui";
import { BuscaFiltro, AbasFiltro, Paginacao } from "@/components/admin/filtros";
import { FormularioVeiculo } from "./formulario";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Veículos" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

const ROTULO_TIPO: Record<string, string> = {
  CARRO: "Carro",
  MOTO: "Moto",
  CAMINHAO: "Caminhão",
  ONIBUS: "Ônibus",
  MAQUINA: "Máquina",
  OUTRO: "Outro",
};

export default async function VeiculosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirAdmin();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const situacao = sp.situacao ?? "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const where: Prisma.VeiculoWhereInput = {};
  if (q) {
    where.OR = [
      { placa: { contains: normalizarPlaca(q) } },
      { modelo: { contains: q, mode: "insensitive" } },
      { marca: { contains: q, mode: "insensitive" } },
    ];
  }
  if (situacao === "bloqueados") where.bloqueado = true;
  if (situacao === "inativos") where.ativo = false;
  if (situacao === "ativos") where.ativo = true;

  const [total, veiculos] = await Promise.all([
    prisma.veiculo.count({ where }),
    prisma.veiculo.findMany({
      where,
      orderBy: { placa: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        placa: true,
        marca: true,
        modelo: true,
        cor: true,
        ano: true,
        tipo: true,
        bloqueado: true,
        ativo: true,
        _count: { select: { vinculos: true, abastecimentos: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        titulo="Veículos"
        descricao={total > 0 ? `${numero(total)} cadastrado(s)` : undefined}
        acoes={<FormularioVeiculo />}
      />

      <Conteudo className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <BuscaFiltro placeholder="Placa, marca ou modelo" />
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <AbasFiltro
            chave="situacao"
            opcoes={[
              { valor: "", rotulo: "Todos" },
              { valor: "ativos", rotulo: "Ativos" },
              { valor: "bloqueados", rotulo: "Bloqueados" },
              { valor: "inativos", rotulo: "Inativos" },
            ]}
          />
        </div>

        <Card>
          {veiculos.length === 0 ? (
            <Vazio
              Icone={Car}
              titulo="Nenhum veículo encontrado"
              descricao={
                q || situacao
                  ? "Nenhum veículo corresponde aos filtros aplicados."
                  : "Cadastre os veículos autorizados a abastecer."
              }
            />
          ) : (
            <>
              <ul>
                {veiculos.map((v, i) => (
                  <li
                    key={v.id}
                    className={i > 0 ? "border-t border-border" : undefined}
                  >
                    <Link
                      href={`/admin/veiculos/${v.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <span className="w-[5.5rem] shrink-0 font-mono text-sm font-semibold tracking-wider">
                        {formatarPlaca(v.placa)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[0.9375rem] font-medium">
                            {[v.marca, v.modelo].filter(Boolean).join(" ") ||
                              "Sem modelo"}
                          </span>
                          {v.bloqueado && (
                            <Etiqueta tom="danger">
                              <Ban className="size-3" />
                              Bloqueado
                            </Etiqueta>
                          )}
                          {!v.ativo && <Etiqueta>Inativo</Etiqueta>}
                        </div>
                        <p className="truncate text-sm text-text-muted">
                          {[ROTULO_TIPO[v.tipo], v.cor, v.ano]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>

                      <div className="hidden shrink-0 items-center gap-4 text-sm tabular-nums text-text-muted sm:flex">
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" />
                          {v._count.vinculos}
                        </span>
                        <span className="w-24 text-right">
                          {numero(v._count.abastecimentos)} abast.
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} />
            </>
          )}
        </Card>
      </Conteudo>
    </>
  );
}
