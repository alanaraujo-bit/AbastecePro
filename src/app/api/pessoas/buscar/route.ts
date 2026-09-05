import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAtual } from "@/lib/auth";
import { soDigitos } from "@/lib/utils";

/** Busca de pessoa por nome, telefone ou CPF — usada no cadastro rápido. */
export async function GET(req: Request) {
  const u = await sessaoAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ pessoas: [] });

  const digitos = soDigitos(q);

  const pessoas = await prisma.pessoa.findMany({
    where: {
      ativo: true,
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        ...(digitos.length >= 3
          ? [
              { telefone: { contains: digitos } },
              { documento: { contains: digitos } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      nome: true,
      telefone: true,
      documento: true,
      bloqueado: true,
    },
    orderBy: { nome: "asc" },
    take: 8,
  });

  return NextResponse.json({ pessoas });
}
