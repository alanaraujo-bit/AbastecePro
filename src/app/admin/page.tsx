import Link from "next/link";
import {
  Fuel,
  Droplets,
  Ban,
  ShieldAlert,
  ArrowRight,
  Users,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { inicioDaJanela, FUSO_PADRAO } from "@/lib/regras/janelas";
import { moeda, litros as fmtLitros, numero, tempoRelativo } from "@/lib/utils";
import { formatarPlaca } from "@/lib/placa";
import {
  PageHeader,
  Conteudo,
  Card,
  Indicador,
  Vazio,
  EtiquetaResultado,
} from "@/components/admin/ui";
import { GraficoConsumo, type PontoDia } from "@/components/admin/grafico-consumo";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type LinhaDia = {
  dia: Date;
  qtd: number;
  litros: number;
  valor: number;
};

export default async function DashboardPage() {
  await exigirAdmin();

  const agora = new Date();
  const inicioHoje = inicioDaJanela("DIA", null, agora);
  const inicioMes = inicioDaJanela("MES", null, agora);
  const trintaDias = new Date(agora.getTime() - 30 * 864e5);

  const [hoje, mes, bloqueiosHoje, excecoes, serie, recentes, topPessoas] =
    await Promise.all([
      prisma.abastecimento.aggregate({
        where: {
          criadoEm: { gte: inicioHoje },
          resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
        },
        _count: { _all: true },
        _sum: { litros: true, valor: true },
      }),
      prisma.abastecimento.aggregate({
        where: {
          criadoEm: { gte: inicioMes },
          resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
        },
        _count: { _all: true },
        _sum: { litros: true, valor: true },
      }),
      prisma.abastecimento.count({
        where: { criadoEm: { gte: inicioHoje }, resultado: "BLOQUEADO" },
      }),
      prisma.abastecimento.count({
        where: {
          criadoEm: { gte: new Date(agora.getTime() - 7 * 864e5) },
          resultado: "AUTORIZADO_EXCECAO",
        },
      }),
      // Agregação por dia CIVIL no fuso do negócio. `date_trunc` sobre o
      // timestamp em UTC agruparia errado perto da meia-noite.
      prisma.$queryRaw<LinhaDia[]>`
        SELECT date_trunc('day', "criadoEm" AT TIME ZONE ${FUSO_PADRAO})::date AS dia,
               COUNT(*)::int AS qtd,
               COALESCE(SUM("litros"), 0)::float AS litros,
               COALESCE(SUM("valor"), 0)::float AS valor
        FROM abastecimentos
        WHERE "criadoEm" >= ${trintaDias}
          AND "resultado" IN ('LIBERADO', 'AUTORIZADO_EXCECAO')
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.abastecimento.findMany({
        orderBy: { criadoEm: "desc" },
        take: 8,
        select: {
          id: true,
          placa: true,
          criadoEm: true,
          litros: true,
          valor: true,
          resultado: true,
          pessoa: { select: { nome: true } },
        },
      }),
      prisma.abastecimento.groupBy({
        by: ["pessoaId"],
        where: {
          criadoEm: { gte: trintaDias },
          resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
          pessoaId: { not: null },
        },
        _sum: { litros: true },
        orderBy: { _sum: { litros: "desc" } },
        take: 6,
      }),
    ]);

  const nomes = await prisma.pessoa.findMany({
    where: { id: { in: topPessoas.map((p) => p.pessoaId!).filter(Boolean) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(nomes.map((n) => [n.id, n.nome]));

  // Preenche os dias sem movimento: um gráfico com buracos mente sobre a
  // forma do consumo.
  const porDia = new Map(
    serie.map((l) => [new Date(l.dia).toISOString().slice(0, 10), l]),
  );
  const pontos: PontoDia[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 864e5);
    const chave = d.toISOString().slice(0, 10);
    const l = porDia.get(chave);
    pontos.push({
      dia: chave,
      litros: l?.litros ?? 0,
      valor: l?.valor ?? 0,
      qtd: l?.qtd ?? 0,
    });
  }

  const maiorLitros = Math.max(...topPessoas.map((p) => Number(p._sum.litros ?? 0)), 1);

  return (
    <>
      <PageHeader
        titulo="Dashboard"
        descricao="Visão geral da operação"
      />

      <Conteudo className="flex flex-col gap-5">
        {/* ---------- Indicadores ---------- */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Indicador
            rotulo="Abastecimentos hoje"
            valor={numero(hoje._count._all)}
            detalhe={`${numero(mes._count._all)} no mês`}
            Icone={Fuel}
          />
          <Indicador
            rotulo="Litros hoje"
            valor={fmtLitros(hoje._sum.litros ?? 0)}
            detalhe={`${fmtLitros(mes._sum.litros ?? 0)} no mês`}
            Icone={Droplets}
          />
          <Indicador
            rotulo="Valor hoje"
            valor={moeda(hoje._sum.valor ?? 0)}
            detalhe={`${moeda(mes._sum.valor ?? 0)} no mês`}
            Icone={Fuel}
          />
          <Indicador
            rotulo="Bloqueios hoje"
            valor={numero(bloqueiosHoje)}
            detalhe={
              excecoes > 0
                ? `${numero(excecoes)} exceção(ões) em 7 dias`
                : "Nenhuma exceção em 7 dias"
            }
            tom={bloqueiosHoje > 0 ? "danger" : "neutro"}
            Icone={bloqueiosHoje > 0 ? Ban : ShieldAlert}
          />
        </div>

        {/* ---------- Consumo ---------- */}
        <Card titulo="Consumo dos últimos 30 dias">
          <div className="p-4 sm:p-5">
            <GraficoConsumo pontos={pontos} />
          </div>
        </Card>

        {/* ---------- Duas colunas no desktop ---------- */}
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card
            titulo="Últimos atendimentos"
            acao={
              <Link
                href="/admin/abastecimentos"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand transition-opacity hover:opacity-75"
              >
                Ver todos
                <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {recentes.length === 0 ? (
              <Vazio
                Icone={Fuel}
                titulo="Nenhum atendimento ainda"
                descricao="Os registros aparecem aqui assim que o primeiro abastecimento for feito."
              />
            ) : (
              <ul>
                {recentes.map((r, i) => (
                  <li
                    key={r.id}
                    className={i > 0 ? "border-t border-border" : undefined}
                  >
                    <Link
                      href={`/admin/abastecimentos/${r.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <span className="w-[5.5rem] shrink-0 font-mono text-sm font-semibold tracking-wider">
                        {formatarPlaca(r.placa)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                        {r.pessoa?.nome ?? "—"}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right text-sm tabular-nums text-text-secondary sm:block">
                        {r.litros ? fmtLitros(r.litros) : "—"}
                      </span>
                      <EtiquetaResultado resultado={r.resultado} />
                      <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-text-muted sm:block">
                        {tempoRelativo(r.criadoEm)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card titulo="Maior consumo · 30 dias">
            {topPessoas.length === 0 ? (
              <Vazio
                Icone={Users}
                titulo="Sem dados no período"
                descricao="O ranking aparece quando houver abastecimentos nos últimos 30 dias."
              />
            ) : (
              <ul className="flex flex-col gap-3 p-4 sm:p-5">
                {topPessoas.map((p) => {
                  const litros = Number(p._sum.litros ?? 0);
                  return (
                    <li key={p.pessoaId}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {nomePorId.get(p.pessoaId!) ?? "—"}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-text-secondary">
                          {fmtLitros(litros)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(litros / maiorLitros) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </Conteudo>
    </>
  );
}
