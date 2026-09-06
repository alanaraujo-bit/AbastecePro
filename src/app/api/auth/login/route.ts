import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { criarSessao, verificarSenha, ipDaRequisicao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { checarTentativas, registrarFalha, limparTentativas } from "@/lib/rate-limit";

const Corpo = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1),
});

// Hash descartavel usado quando o e-mail nao existe. Sem ele, a resposta
// volta muito mais rapido para e-mail inexistente do que para senha errada,
// e isso permite enumerar usuarios pelo tempo de resposta.
const HASH_ISCA =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZS1zYWx0LXZhbHVl$0000000000000000000000000000000000000000000";

export async function POST(req: Request) {
  const h = await headers();
  const ip = ipDaRequisicao(h) ?? "desconhecido";

  let dados: z.infer<typeof Corpo>;
  try {
    dados = Corpo.parse(await req.json());
  } catch {
    return NextResponse.json(
      { erro: "Informe e-mail e senha válidos." },
      { status: 400 },
    );
  }

  const chave = `login:${ip}:${dados.email}`;
  const limite = checarTentativas(chave);
  if (!limite.permitido) {
    return NextResponse.json(
      {
        erro: `Muitas tentativas. Aguarde ${limite.segundos}s e tente de novo.`,
      },
      { status: 429 },
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: dados.email },
    select: { id: true, senhaHash: true, ativo: true, nome: true },
  });

  const ok = usuario
    ? await verificarSenha(usuario.senhaHash, dados.senha)
    : await verificarSenha(HASH_ISCA, dados.senha);

  // Mesma mensagem para "nao existe", "senha errada" e "desativado":
  // qualquer diferenca aqui vira ferramenta de enumeracao.
  if (!usuario || !ok || !usuario.ativo) {
    registrarFalha(chave);
    await registrarAuditoria({
      acao: "sessao.falha",
      entidade: "usuario",
      entidadeId: usuario?.id ?? null,
      dados: { email: dados.email, motivo: !usuario ? "inexistente" : !ok ? "senha" : "inativo" },
    });
    return NextResponse.json(
      { erro: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  }

  limparTentativas(chave);
  await criarSessao(usuario.id);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "sessao.entrar",
    entidade: "usuario",
    entidadeId: usuario.id,
  });

  return NextResponse.json({
    ok: true,
    destino: "/admin",
    usuario: { nome: usuario.nome },
  });
}
