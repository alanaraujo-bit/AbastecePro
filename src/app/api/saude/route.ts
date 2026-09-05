import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { descricaoArmazenamento, usandoBucket } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Verificação de saúde.
 *
 * Serve ao health check da plataforma e responde a uma dúvida operacional
 * concreta: **as fotos estão indo para o bucket ou para o disco do
 * contêiner?** Sem bucket, o disco é apagado a cada deploy e as imagens
 * somem silenciosamente — o tipo de falha que só aparece semanas depois.
 *
 * Não expõe credencial nem nome de bucket: só o modo em uso.
 */
export async function GET() {
  const inicio = Date.now();
  let banco: "ok" | "falha" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    banco = "falha";
  }

  const armazenamento = usandoBucket() ? "bucket" : "disco-local";
  const saudavel = banco === "ok" && armazenamento === "bucket";

  return NextResponse.json(
    {
      ok: saudavel,
      banco,
      armazenamento,
      // Em produção o disco local é efêmero: some a cada deploy.
      aviso:
        armazenamento === "disco-local" && process.env.NODE_ENV === "production"
          ? "Fotos no disco do contêiner serão perdidas no próximo deploy. Configure as variáveis S3_*."
          : undefined,
      detalhe: descricaoArmazenamento(),
      latenciaBancoMs: Date.now() - inicio,
    },
    { status: saudavel ? 200 : 503 },
  );
}
