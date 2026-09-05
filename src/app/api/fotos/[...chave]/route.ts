import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/auth";
import { lerFoto } from "@/lib/storage";

/**
 * Serve a foto do atendimento.
 *
 * Exige sessao: foto de veiculo e condutor e dado pessoal, e uma URL
 * publica (mesmo com nome aleatorio) vaza para qualquer um com o link.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ chave: string[] }> },
) {
  const u = await sessaoAtual();
  if (!u) return new NextResponse("Não autenticado.", { status: 401 });

  const { chave } = await ctx.params;
  const foto = await lerFoto(chave.join("/"));
  if (!foto) return new NextResponse("Não encontrada.", { status: 404 });

  return new NextResponse(new Uint8Array(foto.dados), {
    headers: {
      "content-type": foto.contentType,
      "content-length": String(foto.dados.length),
      // Privado: pode ficar no cache do dispositivo, nunca em CDN.
      "cache-control": "private, max-age=86400, immutable",
    },
  });
}
