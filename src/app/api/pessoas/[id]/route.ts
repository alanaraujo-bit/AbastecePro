import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirSessaoApi } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { CorpoPessoa, prepararPessoa } from "../route";
import { Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

const CorpoBloqueio = z.object({
  bloqueado: z.boolean(),
  motivoBloqueio: z.string().trim().max(300).nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await exigirSessaoApi();
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { id } = await ctx.params;
  const corpo = await req.json().catch(() => null);

  const atual = await prisma.pessoa.findUnique({
    where: { id },
    select: { nome: true, bloqueado: true },
  });
  if (!atual) {
    return NextResponse.json({ erro: "Pessoa não encontrada." }, { status: 404 });
  }

  /* --- Bloqueio/desbloqueio ---
     Tratado à parte do cadastro: é a mudança que muda o resultado do
     atendimento na hora, e por isso exige motivo e vira auditoria própria. */
  if (corpo && typeof corpo.bloqueado === "boolean") {
    const d = CorpoBloqueio.parse(corpo);
    if (d.bloqueado && !d.motivoBloqueio?.trim()) {
      return NextResponse.json(
        { erro: "Informe o motivo do bloqueio." },
        { status: 422 },
      );
    }

    await prisma.pessoa.update({
      where: { id },
      data: {
        bloqueado: d.bloqueado,
        motivoBloqueio: d.bloqueado ? d.motivoBloqueio!.trim() : null,
        bloqueadoEm: d.bloqueado ? new Date() : null,
      },
    });

    registrarAuditoria({
      usuarioId: auth.usuario.id,
      acao: d.bloqueado ? "pessoa.bloquear" : "pessoa.desbloquear",
      entidade: "pessoa",
      entidadeId: id,
      dados: { nome: atual.nome, motivo: d.motivoBloqueio ?? null },
    });
    return NextResponse.json({ ok: true });
  }

  /* --- Edição de cadastro --- */
  let dados: ReturnType<typeof prepararPessoa>;
  try {
    dados = prepararPessoa(CorpoPessoa.parse(corpo));
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
    await prisma.pessoa.update({ where: { id }, data: dados });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { erro: "Já existe uma pessoa com este CPF." },
        { status: 409 },
      );
    }
    throw e;
  }

  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "pessoa.editar",
    entidade: "pessoa",
    entidadeId: id,
    dados: { nome: dados.nome },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await exigirSessaoApi();
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { id } = await ctx.params;

  const pessoa = await prisma.pessoa.findUnique({
    where: { id },
    select: { nome: true, _count: { select: { abastecimentos: true } } },
  });
  if (!pessoa) {
    return NextResponse.json({ erro: "Pessoa não encontrada." }, { status: 404 });
  }

  // Quem já abasteceu não é excluído: apagar o cadastro deixaria buracos no
  // histórico e na auditoria. Desativar preserva o passado e impede o uso
  // futuro — que é o que "excluir" realmente significa aqui.
  if (pessoa._count.abastecimentos > 0) {
    await prisma.pessoa.update({ where: { id }, data: { ativo: false } });
    registrarAuditoria({
      usuarioId: auth.usuario.id,
      acao: "pessoa.desativar",
      entidade: "pessoa",
      entidadeId: id,
      dados: { nome: pessoa.nome, abastecimentos: pessoa._count.abastecimentos },
    });
    return NextResponse.json({
      ok: true,
      desativada: true,
      mensagem:
        "Pessoa desativada. O histórico de abastecimentos foi preservado.",
    });
  }

  await prisma.pessoa.delete({ where: { id } });
  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "pessoa.excluir",
    entidade: "pessoa",
    entidadeId: id,
    dados: { nome: pessoa.nome },
  });
  return NextResponse.json({ ok: true, desativada: false });
}
