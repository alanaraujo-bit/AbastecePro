import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirPapelApi, podeAcessarAdmin } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { CorpoVeiculo, prepararVeiculo } from "../route";
import { Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

const CorpoBloqueio = z.object({
  bloqueado: z.boolean(),
  motivoBloqueio: z.string().trim().max(300).nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await exigirPapelApi(podeAcessarAdmin);
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { id } = await ctx.params;
  const corpo = await req.json().catch(() => null);

  const atual = await prisma.veiculo.findUnique({
    where: { id },
    select: { placa: true },
  });
  if (!atual) {
    return NextResponse.json({ erro: "Veículo não encontrado." }, { status: 404 });
  }

  if (corpo && typeof corpo.bloqueado === "boolean") {
    const d = CorpoBloqueio.parse(corpo);
    if (d.bloqueado && !d.motivoBloqueio?.trim()) {
      return NextResponse.json(
        { erro: "Informe o motivo do bloqueio." },
        { status: 422 },
      );
    }
    await prisma.veiculo.update({
      where: { id },
      data: {
        bloqueado: d.bloqueado,
        motivoBloqueio: d.bloqueado ? d.motivoBloqueio!.trim() : null,
        bloqueadoEm: d.bloqueado ? new Date() : null,
      },
    });
    registrarAuditoria({
      usuarioId: auth.usuario.id,
      acao: d.bloqueado ? "veiculo.bloquear" : "veiculo.desbloquear",
      entidade: "veiculo",
      entidadeId: id,
      dados: { placa: atual.placa, motivo: d.motivoBloqueio ?? null },
    });
    return NextResponse.json({ ok: true });
  }

  let dados: ReturnType<typeof prepararVeiculo>;
  try {
    dados = prepararVeiculo(CorpoVeiculo.parse(corpo));
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
    await prisma.veiculo.update({ where: { id }, data: dados });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { erro: "Esta placa já está cadastrada em outro veículo." },
        { status: 409 },
      );
    }
    throw e;
  }

  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "veiculo.editar",
    entidade: "veiculo",
    entidadeId: id,
    dados: { placa: dados.placa },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await exigirPapelApi(podeAcessarAdmin);
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { id } = await ctx.params;

  const veiculo = await prisma.veiculo.findUnique({
    where: { id },
    select: { placa: true, _count: { select: { abastecimentos: true } } },
  });
  if (!veiculo) {
    return NextResponse.json({ erro: "Veículo não encontrado." }, { status: 404 });
  }

  // Mesma regra das pessoas: com histórico, desativa em vez de apagar.
  if (veiculo._count.abastecimentos > 0) {
    await prisma.veiculo.update({ where: { id }, data: { ativo: false } });
    registrarAuditoria({
      usuarioId: auth.usuario.id,
      acao: "veiculo.desativar",
      entidade: "veiculo",
      entidadeId: id,
      dados: { placa: veiculo.placa },
    });
    return NextResponse.json({
      ok: true,
      desativado: true,
      mensagem: "Veículo desativado. O histórico foi preservado.",
    });
  }

  await prisma.veiculo.delete({ where: { id } });
  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "veiculo.excluir",
    entidade: "veiculo",
    entidadeId: id,
    dados: { placa: veiculo.placa },
  });
  return NextResponse.json({ ok: true, desativado: false });
}
