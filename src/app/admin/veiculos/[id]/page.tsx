import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Fuel } from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
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
  Indicador,
  Vazio,
  EtiquetaResultado,
} from "@/components/admin/ui";
import { BotaoBloqueio } from "@/components/admin/bloqueio";
import { BotaoExcluir } from "@/components/admin/excluir";
import { FormularioVeiculo } from "../formulario";
import { GestorVinculos } from "./vinculos";
import { inicioDaJanela } from "@/lib/regras/janelas";

export const dynamic = "force-dynamic";

const ROTULO_TIPO: Record<string, string> = {
  CARRO: "Carro",
  MOTO: "Moto",
  CAMINHAO: "Caminhão",
  ONIBUS: "Ônibus",
  MAQUINA: "Máquina",
  OUTRO: "Outro",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = await prisma.veiculo.findUnique({
    where: { id },
    select: { placa: true },
  });
  return { title: v ? formatarPlaca(v.placa) : "Veículo" };
}

export default async function VeiculoDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuario();
  const { id } = await params;

  const veiculo = await prisma.veiculo.findUnique({
    where: { id },
    include: {
      vinculos: {
        include: {
          pessoa: {
            select: { id: true, nome: true, telefone: true, bloqueado: true },
          },
        },
        orderBy: [{ principal: "desc" }, { criadoEm: "asc" }],
      },
    },
  });
  if (!veiculo) notFound();

  const inicioMes = inicioDaJanela("MES", null);

  const [mes, historico, totalHistorico] = await Promise.all([
    prisma.abastecimento.aggregate({
      where: {
        veiculoId: id,
        criadoEm: { gte: inicioMes },
        resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
      },
      _count: { _all: true },
      _sum: { litros: true, valor: true },
    }),
    prisma.abastecimento.findMany({
      where: { veiculoId: id },
      orderBy: { criadoEm: "desc" },
      take: 15,
      select: {
        id: true,
        criadoEm: true,
        litros: true,
        valor: true,
        hodometro: true,
        resultado: true,
        pessoa: { select: { nome: true } },
      },
    }),
    prisma.abastecimento.count({ where: { veiculoId: id } }),
  ]);

  const descricao = [
    ROTULO_TIPO[veiculo.tipo],
    veiculo.marca,
    veiculo.modelo,
    veiculo.cor,
    veiculo.ano,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        titulo={formatarPlaca(veiculo.placa)}
        descricao={descricao || undefined}
        voltar={{ href: "/admin/veiculos", rotulo: "Veículos" }}
        acoes={
          <>
            <FormularioVeiculo
              veiculo={{
                id: veiculo.id,
                placa: veiculo.placa,
                marca: veiculo.marca,
                modelo: veiculo.modelo,
                cor: veiculo.cor,
                ano: veiculo.ano,
                tipo: veiculo.tipo,
              }}
            />
            <BotaoBloqueio
              tipo="veiculo"
              id={veiculo.id}
              nome={formatarPlaca(veiculo.placa)}
              bloqueado={veiculo.bloqueado}
            />
            <BotaoExcluir
              tipo="veiculo"
              id={veiculo.id}
              nome={formatarPlaca(veiculo.placa)}
              temHistorico={totalHistorico > 0}
            />
          </>
        }
      />

      <Conteudo className="flex flex-col gap-5">
        {veiculo.bloqueado && (
          <div className="flex items-start gap-3 rounded-card border border-danger/25 bg-danger-soft p-4">
            <Ban className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="font-semibold text-danger">Veículo bloqueado</p>
              <p className="mt-0.5 text-[0.9375rem] leading-snug">
                {veiculo.motivoBloqueio}
              </p>
              {veiculo.bloqueadoEm && (
                <p className="mt-1 text-xs text-text-secondary">
                  Desde {dataHora(veiculo.bloqueadoEm)}
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
          <Indicador rotulo="Valor no mês" valor={moeda(mes._sum.valor ?? 0)} />
          <Indicador
            rotulo="Total histórico"
            valor={`${numero(totalHistorico)}`}
            detalhe="atendimentos registrados"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr] xl:items-start">
          <Card titulo="Condutores">
            <GestorVinculos
              veiculoId={veiculo.id}
              vinculos={veiculo.vinculos.map((v) => ({
                pessoaId: v.pessoa.id,
                nome: v.pessoa.nome,
                telefone: v.pessoa.telefone,
                principal: v.principal,
                bloqueado: v.pessoa.bloqueado,
              }))}
            />
          </Card>

          <Card
            titulo="Histórico"
            acao={
              totalHistorico > historico.length ? (
                <Link
                  href={`/admin/abastecimentos?q=${veiculo.placa}`}
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
                descricao="Este veículo ainda não foi atendido."
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
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {h.pessoa?.nome ?? "—"}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-text-secondary">
                        {h.litros ? fmtLitros(h.litros) : "—"}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right text-sm tabular-nums text-text-secondary sm:block">
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
      </Conteudo>
    </>
  );
}
