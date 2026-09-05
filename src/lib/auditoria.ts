import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { ipDaRequisicao } from "@/lib/auth";

export type EntradaAuditoria = {
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  dados?: unknown;
};

/**
 * Grava a trilha de auditoria.
 *
 * Nunca lanca: uma falha ao registrar o log nao pode derrubar a operacao que
 * o originou — o operador nao pode ficar sem abastecer porque a auditoria
 * teve um soluco. Perdas ficam visiveis no log do servidor.
 */
export async function registrarAuditoria(e: EntradaAuditoria): Promise<void> {
  try {
    const h = await headers();
    await prisma.auditoria.create({
      data: {
        usuarioId: e.usuarioId ?? null,
        acao: e.acao,
        entidade: e.entidade,
        entidadeId: e.entidadeId ?? null,
        dados: (e.dados ?? undefined) as never,
        ip: ipDaRequisicao(h),
        userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      },
    });
  } catch (err) {
    console.error("[auditoria] falha ao registrar", e.acao, err);
  }
}
