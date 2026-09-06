import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirSessaoApi } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { normalizarPlaca, placaValida } from "@/lib/placa";
import { Prisma } from "@/generated/prisma";

export const CorpoVeiculo = z.object({
  placa: z.string().trim().min(7).max(10),
  marca: z.string().trim().max(80).nullable().optional(),
  modelo: z.string().trim().max(80).nullable().optional(),
  cor: z.string().trim().max(40).nullable().optional(),
  ano: z.number().int().min(1900).max(2100).nullable().optional(),
  tipo: z
    .enum(["CARRO", "MOTO", "CAMINHAO", "ONIBUS", "MAQUINA", "OUTRO"])
    .default("CARRO"),
  ativo: z.boolean().optional(),
});

export function prepararVeiculo(d: z.infer<typeof CorpoVeiculo>) {
  const placa = normalizarPlaca(d.placa);
  if (!placaValida(placa)) {
    throw new Error("Placa inválida. Use ABC-1234 ou ABC1D23.");
  }
  return {
    placa,
    marca: d.marca?.trim() || null,
    modelo: d.modelo?.trim() || null,
    cor: d.cor?.trim() || null,
    ano: d.ano ?? null,
    tipo: d.tipo,
    ...(d.ativo === undefined ? {} : { ativo: d.ativo }),
  };
}

export async function POST(req: Request) {
  const auth = await exigirSessaoApi();
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }

  let dados: ReturnType<typeof prepararVeiculo>;
  try {
    dados = prepararVeiculo(CorpoVeiculo.parse(await req.json()));
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.issues[0]?.message ?? "Dados inválidos.")
        : e instanceof Error
          ? e.message
          : "Dados inválidos.";
    return NextResponse.json({ erro: msg }, { status: 422 });
  }

  try {
    const veiculo = await prisma.veiculo.create({ data: dados });
    registrarAuditoria({
      usuarioId: auth.usuario.id,
      acao: "veiculo.criar",
      entidade: "veiculo",
      entidadeId: veiculo.id,
      dados: { placa: veiculo.placa },
    });
    return NextResponse.json({ ok: true, veiculo: { id: veiculo.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { erro: "Esta placa já está cadastrada." },
        { status: 409 },
      );
    }
    throw e;
  }
}
