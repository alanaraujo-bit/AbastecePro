import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirSessaoApi } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

const Corpo = z.object({
  pessoaId: z.string().min(1),
  veiculoId: z.string().min(1),
  principal: z.boolean().optional(),
});

/** Cria (ou reativa) o vínculo entre uma pessoa e um veículo. */
export async function POST(req: Request) {
  const auth = await exigirSessaoApi();
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }

  let d: z.infer<typeof Corpo>;
  try {
    d = Corpo.parse(await req.json());
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 422 });
  }

  await prisma.$transaction(async (tx) => {
    // Só um condutor principal por veículo: promover um rebaixa o anterior,
    // senão o operador veria dois "principais" e teria de escolher à toa.
    if (d.principal) {
      await tx.vinculo.updateMany({
        where: { veiculoId: d.veiculoId },
        data: { principal: false },
      });
    }
    await tx.vinculo.upsert({
      where: {
        pessoaId_veiculoId: { pessoaId: d.pessoaId, veiculoId: d.veiculoId },
      },
      update: { ativo: true, principal: d.principal ?? false },
      create: {
        pessoaId: d.pessoaId,
        veiculoId: d.veiculoId,
        principal: d.principal ?? false,
      },
    });
  });

  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "vinculo.criar",
    entidade: "vinculo",
    dados: d,
  });
  return NextResponse.json({ ok: true });
}

/** Remove o vínculo. O histórico de abastecimentos não é afetado. */
export async function DELETE(req: Request) {
  const auth = await exigirSessaoApi();
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }

  const sp = new URL(req.url).searchParams;
  const pessoaId = sp.get("pessoaId");
  const veiculoId = sp.get("veiculoId");
  if (!pessoaId || !veiculoId) {
    return NextResponse.json({ erro: "Informe pessoa e veículo." }, { status: 400 });
  }

  await prisma.vinculo
    .delete({ where: { pessoaId_veiculoId: { pessoaId, veiculoId } } })
    .catch(() => null);

  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "vinculo.remover",
    entidade: "vinculo",
    dados: { pessoaId, veiculoId },
  });
  return NextResponse.json({ ok: true });
}
