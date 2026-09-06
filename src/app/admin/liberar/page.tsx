import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lerConfig } from "@/lib/config";
import { Atendimento } from "./atendimento";

export const metadata = { title: "Liberar" };
// Quem libera precisa sempre do estado atual, nunca de cache.
export const dynamic = "force-dynamic";

export default async function LiberarPage() {
  await exigirUsuario();

  const [config, recentes] = await Promise.all([
    lerConfig(),
    prisma.abastecimento.findMany({
      where: { resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] } },
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
  ]);

  return (
    <Atendimento
      organizacao={config.organizacao}
      recentes={recentes.map((r) => ({
        id: r.id,
        placa: r.placa,
        criadoEm: r.criadoEm.toISOString(),
        resultado: r.resultado,
        nome: r.pessoa?.nome ?? null,
      }))}
    />
  );
}
