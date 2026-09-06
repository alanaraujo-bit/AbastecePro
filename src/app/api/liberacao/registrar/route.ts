import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { sessaoAtual } from "@/lib/auth";
import { avaliarRegras } from "@/lib/regras/avaliar";
import { registrarAuditoria } from "@/lib/auditoria";
import { normalizarPlaca, placaValida } from "@/lib/placa";
import { soDigitos, cpfValido } from "@/lib/utils";
import { Prisma } from "@/generated/prisma";

/**
 * O LANÇAMENTO — uma chamada só.
 *
 * Antes eram duas: cadastrar o veículo e a pessoa, depois liberar. Isso
 * obrigava a "cadastrar antes de usar", que é trabalho de escritório imposto
 * a quem tem alguém esperando na frente da mesa. Agora placa, nome e
 * telefone chegam juntos com o pedido e o cadastro nasce do próprio
 * lançamento.
 *
 * Tudo numa transação: um registro de liberação apontando para uma pessoa
 * que não chegou a ser criada seria um furo na auditoria.
 */
const Corpo = z.object({
  // Gerada no cliente quando o lançamento começa. É a defesa contra o
  // toque duplo em rede ruim.
  chaveIdempotencia: z.string().min(8).max(64),
  placa: z.string().min(1),

  /** Pessoa já conhecida (a placa foi reconhecida e o vínculo existe). */
  pessoaId: z.string().nullable().optional(),
  /** Ou os dados digitados agora. `nome` basta; o resto é opcional. */
  nome: z.string().trim().max(120).nullable().optional(),
  telefone: z.string().max(20).nullable().optional(),
  documento: z.string().max(20).nullable().optional(),

  /** Detalhes do veículo — todos opcionais, ficam atrás de "mais detalhes". */
  marca: z.string().trim().max(80).nullable().optional(),
  modelo: z.string().trim().max(80).nullable().optional(),
  cor: z.string().trim().max(40).nullable().optional(),
  tipo: z
    .enum(["CARRO", "MOTO", "CAMINHAO", "ONIBUS", "MAQUINA", "OUTRO"])
    .nullable()
    .optional(),

  observacao: z.string().max(500).nullable().optional(),
  fotoChave: z.string().max(255).nullable().optional(),

  /** Registrar mesmo com as regras bloqueando. Exige justificativa. */
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
        ? (e.issues[0]?.message ?? "Dados inválidos.")
        : "Dados inválidos.";
    return NextResponse.json({ erro: msg }, { status: 400 });
  }

  /* --- Idempotência: antes de qualquer escrita. Um segundo toque não pode
         criar pessoa, veículo nem liberação de novo. ------------------- */
  const existente = await prisma.abastecimento.findUnique({
    where: { chaveIdempotencia: d.chaveIdempotencia },
    select: { id: true, resultado: true, criadoEm: true },
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
    return NextResponse.json(
      { erro: "Placa inválida. Use ABC-1234 ou ABC1D23." },
      { status: 422 },
    );
  }

  const nome = d.nome?.trim() || null;
  if (!d.pessoaId && (!nome || nome.length < 3)) {
    return NextResponse.json(
      { erro: "Informe o nome da pessoa." },
      { status: 422 },
    );
  }

  const documento = d.documento ? soDigitos(d.documento) : null;
  if (documento && !cpfValido(documento)) {
    return NextResponse.json({ erro: "CPF inválido." }, { status: 422 });
  }
  const telefone = d.telefone ? soDigitos(d.telefone) || null : null;

  // Antes de qualquer escrita: pedir para registrar mesmo assim sem dizer
  // por quê é sempre erro, e falhar depois da transação deixaria um veículo
  // e uma pessoa cadastrados sem liberação nenhuma.
  const querAutorizar = d.autorizar === true;
  if (querAutorizar && !d.justificativa?.trim()) {
    return NextResponse.json(
      { erro: "Descreva o motivo para registrar mesmo assim." },
      { status: 422 },
    );
  }

  /* --- 1. Cadastro implícito: veículo, pessoa e vínculo -------------- */
  let veiculoId: string;
  let pessoaId: string;
  try {
    const ids = await prisma.$transaction(async (tx) => {
      // `upsert` e não `create`: a placa pode já existir (foi reconhecida na
      // consulta, ou entrou por outro aparelho no mesmo instante).
      // Detalhes só preenchem o que ainda está vazio — o lançamento não
      // pode apagar um cadastro melhor feito antes, no painel.
      const veiculo = await tx.veiculo.findUnique({ where: { placa } });
      const v = veiculo
        ? await tx.veiculo.update({
            where: { placa },
            data: {
              marca: veiculo.marca ?? d.marca?.trim() ?? null,
              modelo: veiculo.modelo ?? d.modelo?.trim() ?? null,
              cor: veiculo.cor ?? d.cor?.trim() ?? null,
            },
          })
        : await tx.veiculo.create({
            data: {
              placa,
              marca: d.marca?.trim() || null,
              modelo: d.modelo?.trim() || null,
              cor: d.cor?.trim() || null,
              tipo: d.tipo ?? "CARRO",
            },
          });

      let pid = d.pessoaId ?? null;
      if (pid) {
        // Confere que a pessoa existe: um id velho vindo de uma tela
        // aberta há muito tempo não pode derrubar o lançamento.
        const ok = await tx.pessoa.findUnique({
          where: { id: pid },
          select: { id: true },
        });
        if (!ok) pid = null;
      }

      if (!pid) {
        // Evita duplicar a mesma pessoa a cada lançamento. O CPF é a
        // identidade forte; o telefone é o que se digita de verdade no
        // balcão e serve bem como segunda chave.
        const achada =
          (documento
            ? await tx.pessoa.findUnique({ where: { documento } })
            : null) ??
          (telefone
            ? await tx.pessoa.findFirst({ where: { telefone, ativo: true } })
            : null);

        pid = achada
          ? (
              await tx.pessoa.update({
                where: { id: achada.id },
                data: {
                  // Completa o que faltava, sem sobrescrever o que existe.
                  telefone: achada.telefone ?? telefone,
                  documento: achada.documento ?? documento,
                },
              })
            ).id
          : (
              await tx.pessoa.create({
                data: { nome: nome!, telefone, documento },
              })
            ).id;
      }

      await tx.vinculo.upsert({
        where: { pessoaId_veiculoId: { pessoaId: pid, veiculoId: v.id } },
        update: { ativo: true },
        create: { pessoaId: pid, veiculoId: v.id, principal: true },
      });

      return { veiculoId: v.id, pessoaId: pid };
    });
    veiculoId = ids.veiculoId;
    pessoaId = ids.pessoaId;
  } catch (e) {
    console.error("[registrar] falha no cadastro", e);
    return NextResponse.json(
      { erro: "Não foi possível salvar o cadastro. Tente novamente." },
      { status: 500 },
    );
  }

  /* --- 2. Veredito no servidor. A tela pode estar aberta há minutos; o
         que vale é a política no instante do lançamento. --------------- */
  const veredito = await avaliarRegras({ pessoaId, veiculoId });

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

  /* --- 3. A liberação ------------------------------------------------ */
  try {
    const criado = await prisma.abastecimento.create({
      data: {
        chaveIdempotencia: d.chaveIdempotencia,
        placa,
        veiculoId,
        pessoaId,
        operadorId: u.id,
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
        pessoaId,
        bloqueios: veredito.bloqueios.map((b) => b.nome),
        justificativa: d.justificativa ?? null,
      },
    });

    const pessoa = await prisma.pessoa.findUnique({
      where: { id: pessoaId },
      select: { nome: true },
    });

    return NextResponse.json({
      ok: true,
      repetido: false,
      abastecimento: criado,
      pessoa,
      veredito,
    });
  } catch (e) {
    // Corrida entre dois toques quase simultâneos: a chave única pegou o
    // segundo. Devolvemos o registro que venceu, não um erro.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
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
