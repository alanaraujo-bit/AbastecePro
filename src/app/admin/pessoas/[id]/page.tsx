import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Car, Fuel, Star } from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { formatarPlaca } from "@/lib/placa";
import {
  dataHora,
  litros as fmtLitros,
  mascararCpf,
  mascararTelefone,
  moeda,
  numero,
  tempoRelativo,
} from "@/lib/utils";
import {
  PageHeader,
  Conteudo,
  Card,
  Indicador,
  Vazio,
  Etiqueta,
  EtiquetaResultado,
} from "@/components/admin/ui";
import { BotaoBloqueio } from "@/components/admin/bloqueio";
import { BotaoExcluir } from "@/components/admin/excluir";
import { FormularioPessoa } from "../formulario";
import { inicioDaJanela } from "@/lib/regras/janelas";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await prisma.pessoa.findUnique({
    where: { id },
    select: { nome: true },
  });
  return { title: p?.nome ?? "Pessoa" };
}

export default async function PessoaDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdmin();
  const { id } = await params;

  const pessoa = await prisma.pessoa.findUnique({
    where: { id },
    include: {
      vinculos: {
        include: {
          veiculo: {
            select: {
              id: true,
              placa: true,
              marca: true,
              modelo: true,
              bloqueado: true,
            },
          },
        },
        orderBy: [{ principal: "desc" }, { criadoEm: "asc" }],
      },
    },
  });
  if (!pessoa) notFound();

  const inicioMes = inicioDaJanela("MES", null);
  const inicioSemana = inicioDaJanela("SEMANA", null);

  const [mes, semana, historico, totalHistorico] = await Promise.all([
    prisma.abastecimento.aggregate({
      where: {
        pessoaId: id,
        criadoEm: { gte: inicioMes },
        resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
      },
      _count: { _all: true },
      _sum: { litros: true, valor: true },
    }),
    prisma.abastecimento.aggregate({
      where: {
        pessoaId: id,
        criadoEm: { gte: inicioSemana },
        resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
      },
      _sum: { litros: true },
    }),
    prisma.abastecimento.findMany({
      where: { pessoaId: id },
      orderBy: { criadoEm: "desc" },
      take: 15,
      select: {
        id: true,
        placa: true,
        criadoEm: true,
        litros: true,
        valor: true,
        resultado: true,
      },
    }),
    prisma.abastecimento.count({ where: { pessoaId: id } }),
  ]);

  return (
    <>
      <PageHeader
        titulo={pessoa.nome}
        descricao={
          [
            pessoa.documento ? mascararCpf(pessoa.documento) : null,
            pessoa.telefone ? mascararTelefone(pessoa.telefone) : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        voltar={{ href: "/admin/pessoas", rotulo: "Pessoas" }}
        acoes={
          <>
            <FormularioPessoa
              pessoa={{
                id: pessoa.id,
                nome: pessoa.nome,
                documento: pessoa.documento,
                telefone: pessoa.telefone,
                email: pessoa.email,
                observacao: pessoa.observacao,
              }}
            />
            <BotaoBloqueio
              tipo="pessoa"
              id={pessoa.id}
              nome={pessoa.nome}
              bloqueado={pessoa.bloqueado}
            />
            <BotaoExcluir
              tipo="pessoa"
              id={pessoa.id}
              nome={pessoa.nome}
              temHistorico={totalHistorico > 0}
            />
          </>
        }
      />

      <Conteudo className="flex flex-col gap-5">
        {pessoa.bloqueado && (
          <div className="flex items-start gap-3 rounded-card border border-danger/25 bg-danger-soft p-4">
            <Ban className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="font-semibold text-danger">Pessoa bloqueada</p>
              <p className="mt-0.5 text-[0.9375rem] leading-snug">
                {pessoa.motivoBloqueio}
              </p>
              {pessoa.bloqueadoEm && (
                <p className="mt-1 text-xs text-text-secondary">
                  Desde {dataHora(pessoa.bloqueadoEm)}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Indicador
            rotulo="Abastecimentos no mês"
            valor={numero(mes._count._all)}
            Icone={Fuel}
          />
          <Indicador
            rotulo="Litros no mês"
            valor={fmtLitros(mes._sum.litros ?? 0)}
          />
          <Indicador
            rotulo="Litros na semana"
            valor={fmtLitros(semana._sum.litros ?? 0)}
          />
          <Indicador
            rotulo="Valor no mês"
            valor={moeda(mes._sum.valor ?? 0)}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr] xl:items-start">
          <Card titulo="Veículos vinculados">
            {pessoa.vinculos.length === 0 ? (
              <Vazio
                Icone={Car}
                titulo="Nenhum veículo vinculado"
                descricao="Vincule um veículo para que esta pessoa possa abastecer."
              />
            ) : (
              <ul>
                {pessoa.vinculos.map((v, i) => (
                  <li
                    key={v.id}
                    className={i > 0 ? "border-t border-border" : undefined}
                  >
                    <Link
                      href={`/admin/veiculos/${v.veiculo.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <Car className="size-4 shrink-0 text-text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold tracking-wider">
                            {formatarPlaca(v.veiculo.placa)}
                          </span>
                          {v.principal && (
                            <Etiqueta tom="brand">
                              <Star className="size-3" />
                              Principal
                            </Etiqueta>
                          )}
                          {v.veiculo.bloqueado && (
                            <Etiqueta tom="danger">Bloqueado</Etiqueta>
                          )}
                        </div>
                        <p className="truncate text-sm text-text-muted">
                          {[v.veiculo.marca, v.veiculo.modelo]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            titulo="Histórico"
            acao={
              totalHistorico > historico.length ? (
                <Link
                  href={`/admin/abastecimentos?q=${encodeURIComponent(pessoa.nome)}`}
                  className="text-sm font-medium text-brand hover:opacity-75"
                >
                  Ver todos ({numero(totalHistorico)})
                </Link>
              ) : undefined
            }
          >
            {historico.length === 0 ? (
              <Vazio
                Icone={Fuel}
                titulo="Sem abastecimentos"
                descricao="Esta pessoa ainda não foi atendida."
              />
            ) : (
              <ul>
                {historico.map((h, i) => (
                  <li
                    key={h.id}
                    className={i > 0 ? "border-t border-border" : undefined}
                  >
                    <Link
                      href={`/admin/abastecimentos/${h.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <span className="w-[5.5rem] shrink-0 font-mono text-sm font-semibold tracking-wider">
                        {formatarPlaca(h.placa)}
                      </span>
                      <span className="flex-1 text-sm tabular-nums text-text-secondary">
                        {h.litros ? fmtLitros(h.litros) : "—"}
                      </span>
                      <span className="hidden w-24 text-right text-sm tabular-nums text-text-secondary sm:block">
                        {h.valor ? moeda(h.valor) : ""}
                      </span>
                      <EtiquetaResultado resultado={h.resultado} />
                      <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-text-muted sm:block">
                        {tempoRelativo(h.criadoEm)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {pessoa.observacao && (
          <Card titulo="Observação">
            <p className="p-4 text-[0.9375rem] leading-snug selectable sm:p-5">
              {pessoa.observacao}
            </p>
          </Card>
        )}
      </Conteudo>
    </>
  );
}
