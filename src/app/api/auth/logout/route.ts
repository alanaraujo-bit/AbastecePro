import { NextResponse } from "next/server";
import { sessaoAtual, encerrarSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST() {
  const u = await sessaoAtual();
  if (u) {
    await registrarAuditoria({
      usuarioId: u.id,
      acao: "sessao.sair",
      entidade: "usuario",
      entidadeId: u.id,
    });
  }
  await encerrarSessao();
  return NextResponse.json({ ok: true });
}
