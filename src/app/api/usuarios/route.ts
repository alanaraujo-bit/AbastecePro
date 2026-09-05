import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirPapelApi, podeConfigurar, hashSenha } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { Prisma } from "@/generated/prisma";

// Mínimo de 10 caracteres: este é o acesso que libera combustível e
// autoriza exceções, não um cadastro qualquer.
export const SENHA_MINIMA = 10;

export const CorpoUsuario = z.object({
  nome: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  papel: z.enum(["ADMIN", "SUPERVISOR", "OPERADOR"]),
  senha: z.string().min(SENHA_MINIMA).max(200).optional(),
  ativo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await exigirPapelApi(podeConfigurar);
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
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

  if (!d.senha) {
    return NextResponse.json(
      { erro: `Defina uma senha com pelo menos ${SENHA_MINIMA} caracteres.` },
      { status: 422 },
    );
  }

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nome: d.nome,
        email: d.email,
        papel: d.papel,
        senhaHash: await hashSenha(d.senha),
        ativo: d.ativo ?? true,
      },
      select: { id: true },
    });

    // A senha nunca entra na auditoria.
    registrarAuditoria({
      usuarioId: auth.usuario.id,
      acao: "usuario.criar",
      entidade: "usuario",
      entidadeId: usuario.id,
      dados: { nome: d.nome, email: d.email, papel: d.papel },
    });

    return NextResponse.json({ ok: true, usuario });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { erro: "Já existe um usuário com este e-mail." },
        { status: 409 },
      );
    }
    throw e;
  }
}
