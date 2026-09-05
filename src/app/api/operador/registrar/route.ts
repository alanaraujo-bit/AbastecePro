import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { sessaoAtual, podeAutorizarExcecao } from "@/lib/auth";
import { avaliarRegras } from "@/lib/regras/avaliar";
import { registrarAuditoria } from "@/lib/auditoria";
import { normalizarPlaca, placaValida } from "@/lib/placa";
import { Prisma } from "@/generated/prisma";

const Corpo = z.object({
  // Gerada no cliente quando o atendimento comeca. E a defesa contra o
  // toque duplo em sinal ruim.
  chaveIdempotencia: z.string().min(8).max(64),
  placa: z.string().min(1),
  veiculoId: z.string().nullable().optional(),
  pessoaId: z.string().nullable().optional(),
  litros: z.number().positive().max(9999).nullable().optional(),
  valor: z.number().positive().max(999999).nullable().optional(),
  combustivel: z.string().max(60).nullable().optional(),
  hodometro: z.number().int().min(0).max(9_999_999).nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
  fotoChave: z.string().max(255).nullable().optional(),
  /** Liberacao excepcional de um atendimento que as regras bloquearam. */
  autorizar: z.boolean().optional(),
  justificativa: z.string().max(500).nullable().optional(),
});

export async function POST(req: Request) {
  const u = await sessaoAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  let d: z.infer<typeof Corpo>;
  try {
    d = Corpo.parse(await req.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? e.issues[0]?.message ?? "Dados inválidos."
        : "Dados inválidos.";
    return NextResponse.json({ erro: msg }, { status: 400 });
  }

  /* --- Idempotencia: se ja registramos esta chave, devolvemos o mesmo
         resultado em vez de criar um segundo abastecimento. --------------- */
  const existente = await prisma.abastecimento.findUnique({
    where: { chaveIdempotencia: d.chaveIdempotencia },
    select: { id: true, resultado: true, criadoEm: true, motivo: true },
  });
  if (existente) {
    return NextResponse.json({
      ok: true,
      repetido: true,
      abastecimento: existente,
    });
  }

  const placa = normalizarPlaca(d.placa);
  if (!placaValida(placa)) {
    return NextResponse.json({ erro: "Placa inválida." }, { status: 422 });
  }

  /* --- Reavaliacao. A consulta anterior nao sabia quantos litros seriam
         abastecidos; uma regra de volume so pode ser decidida agora. ------ */
  const veredito = await avaliarRegras({
    pessoaId: d.pessoaId ?? null,
    veiculoId: d.veiculoId ?? null,
    litros: d.litros ?? null,
    valor: d.valor ?? null,
  });

  const querAutorizar = d.autorizar === true;
  if (querAutorizar && !podeAutorizarExcecao(u.papel)) {
    return NextResponse.json(
      { erro: "Seu perfil não pode autorizar exceções." },
      { status: 403 },
    );
  }
  if (querAutorizar && !d.justificativa?.trim()) {
    return NextResponse.json(
      { erro: "Descreva o motivo da autorização excepcional." },
      { status: 422 },
    );
  }

  let resultado: "LIBERADO" | "BLOQUEADO" | "AUTORIZADO_EXCECAO";
  if (veredito.liberado) resultado = "LIBERADO";
  else if (querAutorizar) resultado = "AUTORIZADO_EXCECAO";
  else resultado = "BLOQUEADO";

  const motivo =
    veredito.liberado && veredito.avisos.length === 0
      ? undefined
      : {
          cadastrais: veredito.cadastrais,
          bloqueios: veredito.bloqueios,
          avisos: veredito.avisos,
        };

  try {
    const criado = await prisma.abastecimento.create({
      data: {
        chaveIdempotencia: d.chaveIdempotencia,
        placa,
        veiculoId: d.veiculoId ?? null,
        pessoaId: d.pessoaId ?? null,
        operadorId: u.id,
        // Um atendimento bloqueado nao consumiu combustivel: guardar
        // litros/valor nele falsearia os relatorios.
        litros:
          resultado === "BLOQUEADO" || d.litros == null
            ? null
            : new Prisma.Decimal(d.litros),
        valor:
          resultado === "BLOQUEADO" || d.valor == null
            ? null
            : new Prisma.Decimal(d.valor),
        combustivel: d.combustivel?.trim() || null,
        hodometro: d.hodometro ?? null,
        observacao: d.observacao?.trim() || null,
        fotoChave: d.fotoChave || null,
        resultado,
        motivo: (motivo ?? Prisma.JsonNull) as never,
        regrasSnapshot: veredito.snapshot as never,
        autorizadoPorId: resultado === "AUTORIZADO_EXCECAO" ? u.id : null,
        justificativa:
          resultado === "AUTORIZADO_EXCECAO" ? d.justificativa!.trim() : null,
      },
      select: { id: true, resultado: true, criadoEm: true },
    });

    registrarAuditoria({
      usuarioId: u.id,
      acao:
        resultado === "AUTORIZADO_EXCECAO"
          ? "abastecimento.autorizar"
          : `abastecimento.${resultado.toLowerCase()}`,
      entidade: "abastecimento",
      entidadeId: criado.id,
      dados: {
        placa,
        pessoaId: d.pessoaId,
        litros: d.litros,
        valor: d.valor,
        bloqueios: veredito.bloqueios.map((b) => b.nome),
        justificativa: d.justificativa ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      repetido: false,
      abastecimento: criado,
      veredito,
    });
  } catch (e) {
    // Corrida entre dois toques quase simultaneos: a chave unica pegou o
    // segundo. Devolvemos o registro que venceu, nao um erro.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const jaCriado = await prisma.abastecimento.findUnique({
        where: { chaveIdempotencia: d.chaveIdempotencia },
        select: { id: true, resultado: true, criadoEm: true },
      });
      return NextResponse.json({ ok: true, repetido: true, abastecimento: jaCriado });
    }
    console.error("[registrar] falha", e);
    return NextResponse.json(
      { erro: "Não foi possível registrar. Tente novamente." },
      { status: 500 },
    );
  }
}
