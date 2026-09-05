import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirPapelApi, podeConfigurar } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { CorpoRegra } from "../route";
import { Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await exigirPapelApi(podeConfigurar);
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { id } = await ctx.params;

  const corpo = await req.json().catch(() => null);

  // Ligar/desligar é o gesto mais frequente nesta tela e não deve exigir
  // reenviar a regra inteira.
  if (corpo && typeof corpo.ativo === "boolean" && Object.keys(corpo).length === 1) {
    const antes = await prisma.regra.findUnique({
      where: { id },
      select: { nome: true, ativo: true },
    });
    if (!antes) {
      return NextResponse.json({ erro: "Regra não encontrada." }, { status: 404 });
    }
    await prisma.regra.update({ where: { id }, data: { ativo: corpo.ativo } });
    registrarAuditoria({
      usuarioId: auth.usuario.id,
      acao: corpo.ativo ? "regra.ativar" : "regra.desativar",
      entidade: "regra",
      entidadeId: id,
      dados: { nome: antes.nome, de: antes.ativo, para: corpo.ativo },
    });
    return NextResponse.json({ ok: true });
  }

  let d: z.infer<typeof CorpoRegra>;
  try {
    d = CorpoRegra.parse(corpo);
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.issues[0]?.message ?? "Dados inválidos.")
        : "Dados inválidos.";
    return NextResponse.json({ erro: msg }, { status: 422 });
  }

  const antes = await prisma.regra.findUnique({ where: { id } });
  if (!antes) {
    return NextResponse.json({ erro: "Regra não encontrada." }, { status: 404 });
  }

  await prisma.regra.update({
    where: { id },
    data: {
      nome: d.nome,
      descricao: d.descricao || null,
      ativo: d.ativo,
      prioridade: d.prioridade,
      escopo: d.escopo,
      metrica: d.metrica,
      janela: d.janela,
      janelaHoras: d.janela === "HORAS" ? (d.janelaHoras ?? 24) : null,
      limite: new Prisma.Decimal(d.limite),
      acao: d.acao,
      mensagem: d.mensagem || null,
      alvoPessoaId: d.escopo === "PESSOA" ? (d.alvoPessoaId ?? null) : null,
      alvoVeiculoId: d.escopo === "VEICULO" ? (d.alvoVeiculoId ?? null) : null,
    },
  });

  // Guardamos o antes e o depois: uma regra editada muda quem passa e quem
  // não passa, e depois é preciso saber o que valia em cada momento.
  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "regra.editar",
    entidade: "regra",
    entidadeId: id,
    dados: {
      antes: {
        nome: antes.nome,
        escopo: antes.escopo,
        metrica: antes.metrica,
        janela: antes.janela,
        limite: Number(antes.limite),
        acao: antes.acao,
        ativo: antes.ativo,
      },
      depois: d,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await exigirPapelApi(podeConfigurar);
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { id } = await ctx.params;

  const regra = await prisma.regra.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!regra) {
    return NextResponse.json({ erro: "Regra não encontrada." }, { status: 404 });
  }

  await prisma.regra.delete({ where: { id } });

  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "regra.excluir",
    entidade: "regra",
    entidadeId: id,
    dados: { nome: regra.nome },
  });

  return NextResponse.json({ ok: true });
}
