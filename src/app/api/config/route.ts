import { NextResponse } from "next/server";
import { z } from "zod";

import { exigirPapelApi, podeConfigurar } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { lerConfig, salvarConfig } from "@/lib/config";

const Corpo = z.object({
  organizacao: z.string().trim().min(2).max(80),
  litrosObrigatorios: z.boolean(),
  fotoObrigatoria: z.boolean(),
});

export async function PUT(req: Request) {
  const auth = await exigirPapelApi(podeConfigurar);
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }

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

  const antes = await lerConfig();
  await salvarConfig(d);

  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "config.editar",
    entidade: "config",
    entidadeId: "geral",
    dados: { antes, depois: d },
  });

  return NextResponse.json({ ok: true });
}
