import { exigirUsuario, podeAutorizarExcecao } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Atendimento } from "./atendimento";

export const metadata = { title: "Atendimento" };
// O operador precisa sempre do estado atual do posto, nunca de cache.
export const dynamic = "force-dynamic";

export default async function OperadorPage() {
  const u = await exigirUsuario();

  const [recentes, combustiveis] = await Promise.all([
    prisma.abastecimento.findMany({
      where: { resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] } },
      orderBy: { criadoEm: "desc" },
      take: 8,
      select: {
        id: true,
        placa: true,
        criadoEm: true,
        litros: true,
        resultado: true,
        pessoa: { select: { nome: true } },
      },
    }),
    // Sugestoes vindas do proprio historico: o posto costuma trabalhar com
    // dois ou tres combustiveis, e digitar isso toda vez seria desperdicio.
    prisma.abastecimento.groupBy({
      by: ["combustivel"],
      where: { combustivel: { not: null } },
      _count: { combustivel: true },
      orderBy: { _count: { combustivel: "desc" } },
      take: 4,
    }),
  ]);

  return (
    <Atendimento
      podeAutorizar={podeAutorizarExcecao(u.papel)}
      recentes={recentes.map((r) => ({
        id: r.id,
        placa: r.placa,
        criadoEm: r.criadoEm.toISOString(),
        litros: r.litros ? Number(r.litros) : null,
        resultado: r.resultado,
        nome: r.pessoa?.nome ?? null,
      }))}
      combustiveis={combustiveis
        .map((c) => c.combustivel)
        .filter((c): c is string => Boolean(c))}
    />
  );
}
