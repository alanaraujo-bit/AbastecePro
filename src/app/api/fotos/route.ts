import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/auth";
import { salvarFoto, TIPOS_PERMITIDOS, TAMANHO_MAX } from "@/lib/storage";

/** Recebe a foto do atendimento e devolve a chave opaca para vincular depois. */
export async function POST(req: Request) {
  const u = await sessaoAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("foto");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Envie uma imagem." }, { status: 400 });
  }

  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    return NextResponse.json(
      { erro: "Formato não suportado. Use JPG, PNG ou WebP." },
      { status: 415 },
    );
  }
  if (arquivo.size > TAMANHO_MAX) {
    return NextResponse.json(
      { erro: "Imagem muito grande (máx. 8 MB)." },
      { status: 413 },
    );
  }

  const chave = await salvarFoto(
    Buffer.from(await arquivo.arrayBuffer()),
    arquivo.type,
  );
  return NextResponse.json({ ok: true, chave });
}
