import Link from "next/link";
import { Download, Fuel, Droplets, Ban, ShieldAlert, Users } from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { formatarPlaca } from "@/lib/placa";
import { litros as fmtLitros, moeda, numero } from "@/lib/utils";
import {
  PageHeader,
  Conteudo,
  Card,
  Indicador,
  Vazio,
} from "@/components/admin/ui";
import { AbasFiltro } from "@/components/admin/filtros";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Relatórios" };
export const dynamic = "force-dynamic";

const PERIODOS: Record<string, { dias: number; rotulo: string }> = {
  "7": { dias: 7, rotulo: "últimos 7 dias" },
  "30": { dias: 30, rotulo: "últimos 30 dias" },
  "90": { dias: 90, rotulo: "últimos 90 dias" },
  "365": { dias: 365, rotulo: "últimos 12 meses" },
};

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirUsuario();
  const sp = await searchParams;

  const chave = sp.periodo && PERIODOS[sp.periodo] ? sp.periodo : "30";
  const { dias, rotulo } = PERIODOS[chave];
  const desde = new Date(Date.now() - dias * 864e5);

  // "Efetivado" = o combustível saiu da bomba. Tentativas bloqueadas não
  // entram em nenhum total: elas não consumiram nada.
  const efetivados: Prisma.AbastecimentoWhereInput = {
    criadoEm: { gte: desde },
    resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
  };

  const [totais, bloqueios, excecoes, porCombustivel, porPessoa, porVeiculo] =
    await Promise.all([
      prisma.abastecimento.aggregate({
        where: efetivados,
        _count: { _all: true },
        _sum: { litros: true, valor: true },
      }),
      prisma.abastecimento.count({
        where: { criadoEm: { gte: desde }, resultado: "BLOQUEADO" },
      }),
      prisma.abastecimento.count({
        where: { criadoEm: { gte: desde }, resultado: "AUTORIZADO_EXCECAO" },
      }),
      prisma.abastecimento.groupBy({
        by: ["combustivel"],
        where: { ...efetivados, combustivel: { not: null } },
        _sum: { litros: true, valor: true },
        _count: { combustivel: true },
        orderBy: { _count: { combustivel: "desc" } },
      }),
      // Ordenado por CONTAGEM. Ordenar por litros deixaria o ranking a
      // cargo de registros antigos, quando o sistema ainda anotava a bomba
      // — e um "maior consumo" cuja ordem ninguem consegue explicar.
      prisma.abastecimento.groupBy({
        by: ["pessoaId"],
        where: { ...efetivados, pessoaId: { not: null } },
        _sum: { litros: true, valor: true },
        _count: { pessoaId: true },
        orderBy: { _count: { pessoaId: "desc" } },
        take: 10,
      }),
      prisma.abastecimento.groupBy({
        by: ["veiculoId"],
        where: { ...efetivados, veiculoId: { not: null } },
        _sum: { litros: true, valor: true },
        _count: { veiculoId: true },
        orderBy: { _count: { veiculoId: "desc" } },
        take: 10,
      }),
    ]);

  const [pessoas, veiculos] = await Promise.all([
    prisma.pessoa.findMany({
      where: { id: { in: porPessoa.map((p) => p.pessoaId!).filter(Boolean) } },
      select: { id: true, nome: true },
    }),
    prisma.veiculo.findMany({
      where: { id: { in: porVeiculo.map((v) => v.veiculoId!).filter(Boolean) } },
      select: { id: true, placa: true, marca: true, modelo: true },
    }),
  ]);
  const nomePessoa = new Map(pessoas.map((p) => [p.id, p.nome]));
  const dadosVeiculo = new Map(veiculos.map((v) => [v.id, v]));

  const totalLitros = Number(totais._sum.litros ?? 0);

  return (
    <>
      <PageHeader
        titulo="Relatórios"
        descricao={`Consolidado dos ${rotulo}`}
        acoes={
          <Link
            href={`/api/relatorios/abastecimentos.csv?periodo=${dias}`}
            className="inline-flex h-10 items-center gap-2 rounded-app border border-border bg-surface px-3.5 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            <Download className="size-4" />
            Exportar CSV
          </Link>
        }
      />

      <Conteudo className="flex flex-col gap-5">
        <AbasFiltro
          chave="periodo"
          padrao="30"
          opcoes={[
            { valor: "7", rotulo: "7 dias" },
            { valor: "30", rotulo: "30 dias" },
            { valor: "90", rotulo: "90 dias" },
            { valor: "365", rotulo: "12 meses" },
          ]}
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Indicador
            rotulo="Liberações"
            valor={numero(totais._count._all)}
            Icone={Fuel}
          />
          <Indicador
            rotulo="Pessoas atendidas"
            valor={numero(porPessoa.length)}
            detalhe={`${numero(porVeiculo.length)} veículo(s) distinto(s)`}
            Icone={Users}
          />
          {/* Volume só existe no histórico anterior à mudança de modelo (ver
              DECISIONS.md, D14). O bloco desaparece quando o período não
              tem nenhum registro daquela época — um "0 L" fixo faria o
              relatório parecer quebrado. */}
          {totalLitros > 0 && (
            <Indicador
              rotulo="Volume (registros antigos)"
              valor={fmtLitros(totalLitros)}
              detalhe={moeda(totais._sum.valor ?? 0)}
              Icone={Droplets}
            />
          )}
          <Indicador
            rotulo="Bloqueios"
            valor={numero(bloqueios)}
            detalhe={`${numero(excecoes)} liberação(ões) por exceção`}
            tom={bloqueios > 0 ? "danger" : "neutro"}
            Icone={bloqueios > 0 ? Ban : ShieldAlert}
          />
        </div>

        <Card titulo="Por combustível · registros antigos">
          {porCombustivel.length === 0 ? (
            <Vazio
              Icone={Droplets}
              titulo="Sem dados no período"
              descricao="O combustível só era anotado no modelo antigo, quando o registro descrevia a bomba."
            />
          ) : (
            <ul className="flex flex-col gap-3 p-4 sm:p-5">
              {porCombustivel.map((c) => {
                const l = Number(c._sum?.litros ?? 0);
                const pct = totalLitros > 0 ? (l / totalLitros) * 100 : 0;
                return (
                  <li key={c.combustivel}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{c.combustivel}</span>
                      <span className="shrink-0 text-sm tabular-nums text-text-secondary">
                        {fmtLitros(l)} · {moeda(c._sum?.valor ?? 0)} ·{" "}
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card titulo="Quem mais recebeu">
            {porPessoa.length === 0 ? (
              <Vazio Icone={Fuel} titulo="Sem dados no período" />
            ) : (
              <TabelaRanking
                linhas={porPessoa.map((p) => ({
                  chave: p.pessoaId!,
                  titulo: nomePessoa.get(p.pessoaId!) ?? "—",
                  subtitulo: null,
                  qtd: p._count.pessoaId,
                  litros: Number(p._sum.litros ?? 0),
                  valor: Number(p._sum.valor ?? 0),
                  href: `/admin/pessoas/${p.pessoaId}`,
                }))}
              />
            )}
          </Card>

          <Card titulo="Veículos mais liberados">
            {porVeiculo.length === 0 ? (
              <Vazio Icone={Fuel} titulo="Sem dados no período" />
            ) : (
              <TabelaRanking
                linhas={porVeiculo.map((v) => {
                  const d = dadosVeiculo.get(v.veiculoId!);
                  return {
                    chave: v.veiculoId!,
                    titulo: d ? formatarPlaca(d.placa) : "—",
                    subtitulo:
                      [d?.marca, d?.modelo].filter(Boolean).join(" ") || null,
                    qtd: v._count.veiculoId,
                    litros: Number(v._sum.litros ?? 0),
                    valor: Number(v._sum.valor ?? 0),
                    href: `/admin/veiculos/${v.veiculoId}`,
                  };
                })}
                mono
              />
            )}
          </Card>
        </div>
      </Conteudo>
    </>
  );
}

function TabelaRanking({
  linhas,
  mono,
}: {
  linhas: {
    chave: string;
    titulo: string;
    subtitulo: string | null;
    qtd: number;
    litros: number;
    valor: number;
    href: string;
  }[];
  mono?: boolean;
}) {
  return (
    <ul>
      {linhas.map((l, i) => (
        <li key={l.chave} className={i > 0 ? "border-t border-border" : undefined}>
          <Link
            href={l.href}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
          >
            <span className="w-5 shrink-0 text-sm tabular-nums text-text-muted">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <span
                className={
                  mono
                    ? "block truncate font-mono text-sm font-semibold tracking-wider"
                    : "block truncate text-[0.9375rem] font-medium"
                }
              >
                {l.titulo}
              </span>
              {l.subtitulo && (
                <span className="block truncate text-sm text-text-muted">
                  {l.subtitulo}
                </span>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium tabular-nums">
                {l.qtd === 1 ? "1 liberação" : `${numero(l.qtd)} liberações`}
              </p>
              {/* Litros só aparecem se houver: são herança dos registros
                  anteriores à mudança de modelo, não um campo do produto. */}
              {l.litros > 0 && (
                <p className="text-xs tabular-nums text-text-muted">
                  {fmtLitros(l.litros)} · {moeda(l.valor)}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
