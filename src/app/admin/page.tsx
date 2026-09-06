import Link from "next/link";
import {
  Fuel,
  TicketCheck,
  Ban,
  ShieldAlert,
  ArrowRight,
  Users,
  CalendarDays,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { inicioDaJanela, FUSO_PADRAO } from "@/lib/regras/janelas";
import { numero, tempoRelativo } from "@/lib/utils";
import { formatarPlaca } from "@/lib/placa";
import {
  PageHeader,
  Conteudo,
  Card,
  Indicador,
  Vazio,
  EtiquetaResultado,
} from "@/components/admin/ui";
import {
  GraficoLiberacoes,
  type PontoDia,
} from "@/components/admin/grafico-liberacoes";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type LinhaDia = { dia: Date; qtd: number };

/**
 * Painel de controle.
 *
 * TUDO AQUI CONTA LIBERAÇÕES, não volume. O sistema registra a autorização
 * entregue no balcão, e quem autoriza nunca vê a bomba — indicadores de
 * litros e reais mostrariam zero para sempre, o que é pior do que não
 * existir: parece sistema quebrado, não escopo deliberado.
 */
export default async function DashboardPage() {
  await exigirUsuario();

  const agora = new Date();
  const inicioHoje = inicioDaJanela("DIA", null, agora);
  const inicioMes = inicioDaJanela("MES", null, agora);
  const trintaDias = new Date(agora.getTime() - 30 * 864e5);
  const EMITIDAS: ("LIBERADO" | "AUTORIZADO_EXCECAO")[] = [
    "LIBERADO",
    "AUTORIZADO_EXCECAO",
  ];

  const [hoje, mes, bloqueiosHoje, excecoes, serie, recentes, topPessoas] =
    await Promise.all([
      prisma.abastecimento.count({
        where: { criadoEm: { gte: inicioHoje }, resultado: { in: EMITIDAS } },
      }),
      prisma.abastecimento.count({
        where: { criadoEm: { gte: inicioMes }, resultado: { in: EMITIDAS } },
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
               COUNT(*)::int AS qtd
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
          resultado: true,
          pessoa: { select: { nome: true } },
        },
      }),
      prisma.abastecimento.groupBy({
        by: ["pessoaId"],
        where: {
          criadoEm: { gte: trintaDias },
          resultado: { in: EMITIDAS },
          pessoaId: { not: null },
        },
        _count: { pessoaId: true },
        orderBy: { _count: { pessoaId: "desc" } },
        take: 6,
      }),
    ]);

  const nomes = await prisma.pessoa.findMany({
    where: { id: { in: topPessoas.map((p) => p.pessoaId!).filter(Boolean) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(nomes.map((n) => [n.id, n.nome]));

  // Preenche os dias sem movimento: um gráfico com buracos mente sobre a
  // forma da operação.
  const porDia = new Map(
    serie.map((l) => [new Date(l.dia).toISOString().slice(0, 10), l]),
  );
  const pontos: PontoDia[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 864e5);
    const chave = d.toISOString().slice(0, 10);
    pontos.push({ dia: chave, qtd: porDia.get(chave)?.qtd ?? 0 });
  }

  const maiorTotal = Math.max(...topPessoas.map((p) => p._count.pessoaId), 1);

  return (
    <>
      <PageHeader titulo="Dashboard" descricao="Visão geral da operação" />

      <Conteudo className="flex flex-col gap-5">
        {/* ---------- Indicadores ---------- */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Indicador
            rotulo="Liberações hoje"
            valor={numero(hoje)}
            detalhe={`${numero(mes)} no mês`}
            Icone={TicketCheck}
          />
          <Indicador
            rotulo="Liberações no mês"
            valor={numero(mes)}
            detalhe="Mês civil corrente"
            Icone={CalendarDays}
          />
          <Indicador
            rotulo="Bloqueios hoje"
            valor={numero(bloqueiosHoje)}
            detalhe={
              bloqueiosHoje > 0
                ? "Pedidos recusados pelas regras"
                : "Nenhum pedido recusado"
            }
            tom={bloqueiosHoje > 0 ? "danger" : "neutro"}
            Icone={Ban}
          />
          <Indicador
            rotulo="Exceções em 7 dias"
            valor={numero(excecoes)}
            detalhe={
              excecoes > 0
                ? "Liberadas mesmo com bloqueio"
                : "Nenhuma liberação excepcional"
            }
            tom={excecoes > 0 ? "warn" : "neutro"}
            Icone={ShieldAlert}
          />
        </div>

        {/* ---------- Liberações por dia ---------- */}
        <Card titulo="Liberações dos últimos 30 dias">
          <div className="p-4 sm:p-5">
            <GraficoLiberacoes pontos={pontos} />
          </div>
        </Card>

        {/* ---------- Duas colunas no desktop ---------- */}
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card
            titulo="Últimas liberações"
            acao={
              <Link
                href="/admin/abastecimentos"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand transition-opacity hover:opacity-75"
              >
                Ver todas
                <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {recentes.length === 0 ? (
              <Vazio
                Icone={Fuel}
                titulo="Nenhuma liberação ainda"
                descricao="Os registros aparecem aqui assim que o primeiro papel for emitido."
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

          <Card titulo="Quem mais recebeu · 30 dias">
            {topPessoas.length === 0 ? (
              <Vazio
                Icone={Users}
                titulo="Sem dados no período"
                descricao="O ranking aparece quando houver liberações nos últimos 30 dias."
              />
            ) : (
              <ul className="flex flex-col gap-3 p-4 sm:p-5">
                {topPessoas.map((p) => {
                  const qtd = p._count.pessoaId;
                  return (
                    <li key={p.pessoaId}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {nomePorId.get(p.pessoaId!) ?? "—"}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-text-secondary">
                          {qtd === 1 ? "1 liberação" : `${qtd} liberações`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(qtd / maiorTotal) * 100}%` }}
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
