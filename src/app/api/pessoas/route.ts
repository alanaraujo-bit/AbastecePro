import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirPapelApi, podeAcessarAdmin } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { soDigitos, cpfValido } from "@/lib/utils";
import { Prisma } from "@/generated/prisma";

export const CorpoPessoa = z.object({
  nome: z.string().trim().min(3).max(120),
  documento: z.string().trim().max(20).nullable().optional(),
  telefone: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().max(120).nullable().optional().or(z.literal("")),
  observacao: z.string().trim().max(500).nullable().optional(),
  ativo: z.boolean().optional(),
});

/** Normaliza e valida documento/telefone. Documento vazio vira `null`. */
export function prepararPessoa(d: z.infer<typeof CorpoPessoa>) {
  const documento = d.documento ? soDigitos(d.documento) : null;
  if (documento && !cpfValido(documento)) {
    throw new Error("CPF inválido.");
  }
  return {
    nome: d.nome,
    // `null` e não string vazia: a coluna é única, e várias strings vazias
    // colidiriam entre si.
    documento: documento || null,
    telefone: d.telefone ? soDigitos(d.telefone) || null : null,
    email: d.email?.trim() || null,
    observacao: d.observacao?.trim() || null,
    ...(d.ativo === undefined ? {} : { ativo: d.ativo }),
  };
}

export async function POST(req: Request) {
  const auth = await exigirPapelApi(podeAcessarAdmin);
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }

  let dados: ReturnType<typeof prepararPessoa>;
  try {
    dados = prepararPessoa(CorpoPessoa.parse(await req.json()));
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
    const pessoa = await prisma.pessoa.create({ data: dados });
    registrarAuditoria({
      usuarioId: auth.usuario.id,
      acao: "pessoa.criar",
      entidade: "pessoa",
      entidadeId: pessoa.id,
      dados: { nome: pessoa.nome },
    });
    return NextResponse.json({ ok: true, pessoa: { id: pessoa.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { erro: "Já existe uma pessoa com este CPF." },
        { status: 409 },
      );
    }
    throw e;
  }
}
