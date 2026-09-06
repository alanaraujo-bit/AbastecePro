import Link from "next/link";
import { Fuel, Camera, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { normalizarPlaca } from "@/lib/placa";
import { formatarPlaca } from "@/lib/placa";
import {
  dataHora,
  litros as fmtLitros,
  moeda,
  numero,
  tempoRelativo,
} from "@/lib/utils";
import {
  PageHeader,
  Conteudo,
  Card,
  Vazio,
  EtiquetaResultado,
} from "@/components/admin/ui";
import { BuscaFiltro, AbasFiltro, Paginacao } from "@/components/admin/filtros";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Abastecimentos" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

export default async function AbastecimentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirUsuario();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const resultado = sp.resultado ?? "";
  const periodo = sp.periodo ?? "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const where: Prisma.AbastecimentoWhereInput = {};

  if (q) {
    // A busca cobre placa e nome de uma vez: quem opera não quer escolher
    // em qual campo procurar, quer digitar o que lembra.
    where.OR = [
      { placa: { contains: normalizarPlaca(q) } },
      { pessoa: { nome: { contains: q, mode: "insensitive" } } },
      { veiculo: { modelo: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (resultado) where.resultado = resultado as never;

  if (periodo) {
    const dias = Number(periodo);
    if (Number.isFinite(dias) && dias > 0) {
      where.criadoEm = { gte: new Date(Date.now() - dias * 864e5) };
    }
  }

  const [total, itens] = await Promise.all([
    prisma.abastecimento.count({ where }),
    prisma.abastecimento.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        placa: true,
        criadoEm: true,
        litros: true,
        valor: true,
        combustivel: true,
        resultado: true,
        fotoChave: true,
        pessoa: { select: { nome: true } },
        operador: { select: { nome: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        titulo="Liberações"
        descricao={
          total > 0
            ? `${numero(total)} registro(s) no filtro atual`
            : undefined
        }
        acoes={
          <Link
            href={`/api/relatorios/abastecimentos.csv?${new URLSearchParams(
              Object.entries(sp).filter(([, v]) => v) as [string, string][],
            ).toString()}`}
            className="inline-flex h-10 items-center gap-2 rounded-app border border-border bg-surface px-3.5 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Exportar CSV
          </Link>
        }
      />

      <Conteudo className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <BuscaFiltro placeholder="Placa, condutor ou modelo" />
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <AbasFiltro
            chave="resultado"
            opcoes={[
              { valor: "", rotulo: "Todos" },
              { valor: "LIBERADO", rotulo: "Liberados" },
              { valor: "BLOQUEADO", rotulo: "Bloqueados" },
              { valor: "AUTORIZADO_EXCECAO", rotulo: "Exceções" },
            ]}
          />
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <AbasFiltro
            chave="periodo"
            opcoes={[
              { valor: "", rotulo: "Sempre" },
              { valor: "1", rotulo: "24 h" },
              { valor: "7", rotulo: "7 dias" },
              { valor: "30", rotulo: "30 dias" },
            ]}
          />
        </div>

        <Card>
          {itens.length === 0 ? (
            <Vazio
              Icone={Fuel}
              titulo="Nenhuma liberação encontrada"
              descricao={
                q || resultado || periodo
                  ? "Nenhum registro corresponde aos filtros aplicados. Tente ampliar o período ou limpar a busca."
                  : "As liberações emitidas aparecem aqui."
              }
            />
          ) : (
            <>
              {/* Tabela no desktop: densidade e comparação entre linhas. */}
              <div className="hidden lg:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {[
                        "Placa",
                        "Condutor",
                        "Litros",
                        "Valor",
                        "Combustível",
                        "Liberado por",
                        "Data",
                        "Resultado",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted"
                        >
                          {h}
                        </th>
                      ))}
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((a) => (
                      <tr
                        key={a.id}
                        className="relative border-b border-border last:border-0 transition-colors hover:bg-surface-2"
                      >
                        <td className="px-4 py-3">
                          {/* after:inset-0 estica o link sobre a linha
                              inteira, sem aninhar <a> dentro de cada <td>. */}
                          <Link
                            href={`/admin/abastecimentos/${a.id}`}
                            className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wider after:absolute after:inset-0 after:content-['']"
                          >
                            {formatarPlaca(a.placa)}
                            {a.fotoChave && (
                              <Camera
                                className="size-3.5 text-text-muted"
                                aria-label="Tem foto"
                              />
                            )}
                          </Link>
                        </td>
                        <td className="max-w-[14rem] truncate px-4 py-3 text-sm">
                          {a.pessoa?.nome ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums">
                          {a.litros ? fmtLitros(a.litros) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums">
                          {a.valor ? moeda(a.valor) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {a.combustivel ?? "—"}
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3 text-sm text-text-secondary">
                          {a.operador.nome}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-text-secondary">
                          {dataHora(a.criadoEm)}
                        </td>
                        <td className="px-4 py-3">
                          <EtiquetaResultado resultado={a.resultado} />
                        </td>
                        <td className="px-2">
                          <Link
                            href={`/admin/abastecimentos/${a.id}`}
                            aria-label="Ver detalhes"
                            className="flex size-8 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cartões no mobile: tabela em tela estreita vira rolagem
                  horizontal, que é justamente o gesto que queremos evitar. */}
              <ul className="lg:hidden">
                {itens.map((a, i) => (
                  <li
                    key={a.id}
                    className={i > 0 ? "border-t border-border" : undefined}
                  >
                    <Link
                      href={`/admin/abastecimentos/${a.id}`}
                      className="flex flex-col gap-1.5 px-4 py-3.5 transition-colors active:bg-surface-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold tracking-wider">
                          {formatarPlaca(a.placa)}
                        </span>
                        {a.fotoChave && (
                          <Camera className="size-3.5 text-text-muted" />
                        )}
                        <span className="ml-auto">
                          <EtiquetaResultado resultado={a.resultado} />
                        </span>
                      </div>
                      <p className="truncate text-sm text-text-secondary">
                        {a.pessoa?.nome ?? "—"}
                      </p>
                      <div className="flex items-baseline gap-3 text-sm tabular-nums text-text-muted">
                        <span>{a.litros ? fmtLitros(a.litros) : "—"}</span>
                        <span>{a.valor ? moeda(a.valor) : ""}</span>
                        <span className="ml-auto text-xs">
                          {tempoRelativo(a.criadoEm)}
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
