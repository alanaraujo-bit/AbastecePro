import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  exigirSessaoApi,
  hashSenha,
  verificarSenha,
  revogarSessoesDoUsuario,
  revogarOutrasSessoes,
} from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { Prisma } from "@/generated/prisma";

// Este acesso libera combustivel e autoriza excecoes; nao e um cadastro
// qualquer. Dez caracteres e o piso.
export const SENHA_MINIMA = 10;

/**
 * A conta — uma so.
 *
 * Nao existe rota para CRIAR usuario: o sistema tem um dono, semeado por
 * `prisma/seed.ts`. Esconder o botao de criar no painel nao bastaria; a
 * rota e que precisa nao existir.
 *
 * E este PATCH opera sempre sobre a sessao de quem chama — nunca sobre um
 * id vindo do corpo. Assim nao ha como pedir a alteracao de outra conta,
 * mesmo que um dia passe a existir outra.
 */
const Corpo = z.object({
  nome: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  senhaAtual: z.string().max(200).optional(),
  // A mensagem e explicita porque ela CHEGA A TELA: o texto padrao do zod
  // vem em ingles e falando de "string", que nao diz nada a quem esta
  // tentando trocar a propria senha.
  novaSenha: z
    .string()
    .min(SENHA_MINIMA, `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`)
    .max(200)
    .optional(),
});

export async function PATCH(req: Request) {
  const auth = await exigirSessaoApi();
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const eu = auth.usuario;

  let d: z.infer<typeof Corpo>;
  try {
    d = Corpo.parse(await req.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.issues[0]?.message ?? "Dados inválidos.")
        : "Dados inválidos.";
    return NextResponse.json({ erro: msg }, { status: 422 });
  }

  const atual = await prisma.usuario.findUniqueOrThrow({
    where: { id: eu.id },
    select: { nome: true, email: true, senhaHash: true },
  });

  // Trocar a senha exige a senha vigente. Sem isso, um aparelho deixado
  // aberto no balcao vira uma troca de dono da conta em dois toques.
  if (d.novaSenha) {
    if (!d.senhaAtual) {
      return NextResponse.json(
        { erro: "Informe a senha atual para definir uma nova." },
        { status: 422 },
      );
    }
    const confere = await verificarSenha(atual.senhaHash, d.senhaAtual);
    if (!confere) {
      return NextResponse.json({ erro: "Senha atual incorreta." }, { status: 422 });
    }
  }

  try {
    await prisma.usuario.update({
      where: { id: eu.id },
      data: {
        nome: d.nome,
        email: d.email,
        ...(d.novaSenha ? { senhaHash: await hashSenha(d.novaSenha) } : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { erro: "Já existe uma conta com este e-mail." },
        { status: 409 },
      );
    }
    throw e;
  }

  // Senha nova derruba TODAS as sessoes, inclusive esta: quem troca a senha
  // costuma estar reagindo a uma suspeita, e manter a propria sessao viva
  // manteria viva tambem a de quem estiver com o aparelho.
  if (d.novaSenha) await revogarSessoesDoUsuario(eu.id);

  // A senha nunca entra na auditoria.
  registrarAuditoria({
    usuarioId: eu.id,
    acao: "conta.editar",
    entidade: "usuario",
    entidadeId: eu.id,
    dados: {
      antes: { nome: atual.nome, email: atual.email },
      depois: { nome: d.nome, email: d.email },
      senhaAlterada: Boolean(d.novaSenha),
    },
  });

  return NextResponse.json({ ok: true, senhaAlterada: Boolean(d.novaSenha) });
}

/** Encerra os outros aparelhos, mantendo este. */
export async function DELETE() {
  const auth = await exigirSessaoApi();
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const eu = auth.usuario;

  const encerradas = await revogarOutrasSessoes(eu.id, eu.sessaoId);
  registrarAuditoria({
    usuarioId: eu.id,
    acao: "conta.encerrar-sessoes",
    entidade: "usuario",
    entidadeId: eu.id,
    dados: { encerradas },
  });

  return NextResponse.json({ ok: true, encerradas });
}
