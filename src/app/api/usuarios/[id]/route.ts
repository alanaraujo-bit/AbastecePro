import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  exigirPapelApi,
  podeConfigurar,
  hashSenha,
  revogarSessoesDoUsuario,
} from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { CorpoUsuario } from "../route";
import { Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await exigirPapelApi(podeConfigurar);
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { id } = await ctx.params;

  const alvo = await prisma.usuario.findUnique({
    where: { id },
    select: { nome: true, email: true, papel: true, ativo: true },
  });
  if (!alvo) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }

  let d: z.infer<typeof CorpoUsuario>;
  try {
    d = CorpoUsuario.parse(await req.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.issues[0]?.message ?? "Dados inválidos.")
        : "Dados inválidos.";
    return NextResponse.json({ erro: msg }, { status: 422 });
  }

  // Um admin não pode se rebaixar nem se desativar: o sistema ficaria sem
  // ninguém capaz de configurar regras, e não há como reverter pela interface.
  const ehEuMesmo = id === auth.usuario.id;
  if (ehEuMesmo && (d.papel !== "ADMIN" || d.ativo === false)) {
    return NextResponse.json(
      { erro: "Você não pode remover o próprio acesso de administrador." },
      { status: 422 },
    );
  }

  // Rebaixar ou desativar o último admin ativo deixaria o sistema órfão.
  if (alvo.papel === "ADMIN" && (d.papel !== "ADMIN" || d.ativo === false)) {
    const outrosAdmins = await prisma.usuario.count({
      where: { papel: "ADMIN", ativo: true, id: { not: id } },
    });
    if (outrosAdmins === 0) {
      return NextResponse.json(
        { erro: "Este é o último administrador ativo. Promova outro antes." },
        { status: 422 },
      );
    }
  }

  try {
    await prisma.usuario.update({
      where: { id },
      data: {
        nome: d.nome,
        email: d.email,
        papel: d.papel,
        ativo: d.ativo ?? true,
        ...(d.senha ? { senhaHash: await hashSenha(d.senha) } : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { erro: "Já existe um usuário com este e-mail." },
        { status: 409 },
      );
    }
    throw e;
  }

  // Desativar, trocar senha ou mudar papel tem de valer AGORA. Como a sessão
  // é uma linha no banco (e não um JWT), basta revogá-la — é justamente o
  // que essa escolha de arquitetura comprava.
  const precisaDerrubar =
    d.ativo === false || Boolean(d.senha) || d.papel !== alvo.papel;
  if (precisaDerrubar) await revogarSessoesDoUsuario(id);

  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "usuario.editar",
    entidade: "usuario",
    entidadeId: id,
    dados: {
      antes: { nome: alvo.nome, papel: alvo.papel, ativo: alvo.ativo },
      depois: { nome: d.nome, papel: d.papel, ativo: d.ativo ?? true },
      senhaAlterada: Boolean(d.senha),
      sessoesRevogadas: precisaDerrubar,
    },
  });

  return NextResponse.json({ ok: true, sessoesRevogadas: precisaDerrubar });
}
