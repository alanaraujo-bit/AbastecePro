import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAtual } from "@/lib/auth";
import { normalizarPlaca } from "@/lib/placa";

/** Busca de veículo por placa ou modelo. */
export async function GET(req: Request) {
  const u = await sessaoAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ veiculos: [] });

  const veiculos = await prisma.veiculo.findMany({
    where: {
      ativo: true,
      OR: [
        { placa: { contains: normalizarPlaca(q) } },
        { modelo: { contains: q, mode: "insensitive" } },
        { marca: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      placa: true,
      marca: true,
      modelo: true,
      bloqueado: true,
    },
    orderBy: { placa: "asc" },
    take: 8,
  });

  return NextResponse.json({ veiculos });
}
