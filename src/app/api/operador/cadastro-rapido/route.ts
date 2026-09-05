import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { sessaoAtual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { normalizarPlaca, placaValida } from "@/lib/placa";
import { soDigitos, cpfValido } from "@/lib/utils";

const Corpo = z.object({
  placa: z.string(),
  modelo: z.string().max(80).optional().nullable(),
  marca: z.string().max(80).optional().nullable(),
  cor: z.string().max(40).optional().nullable(),
  tipo: z
    .enum(["CARRO", "MOTO", "CAMINHAO", "ONIBUS", "MAQUINA", "OUTRO"])
    .default("CARRO"),
  /** Vincular a alguem que ja existe... */
  pessoaId: z.string().optional().nullable(),
  /** ...ou cadastrar na hora. */
  pessoaNova: z
    .object({
      nome: z.string().trim().min(3).max(120),
      telefone: z.string().max(20).optional().nullable(),
      documento: z.string().max(20).optional().nullable(),
    })
    .optional()
    .nullable(),
});

/**
 * Cadastro rapido de veiculo (e, se preciso, do condutor) direto da pista.
 *
 * Existe para que uma placa desconhecida nao interrompa o atendimento: o
 * operador registra o minimo aqui e o cadastro completo fica para o painel.
 */
export async function POST(req: Request) {
  const u = await sessaoAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  let d: z.infer<typeof Corpo>;
  try {
    d = Corpo.parse(await req.json());
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const placa = normalizarPlaca(d.placa);
  if (!placaValida(placa)) {
    return NextResponse.json({ erro: "Placa inválida." }, { status: 422 });
  }
  if (!d.pessoaId && !d.pessoaNova) {
    return NextResponse.json(
      { erro: "Informe o condutor." },
      { status: 422 },
    );
  }

  const documento = d.pessoaNova?.documento
    ? soDigitos(d.pessoaNova.documento)
    : null;
  if (documento && !cpfValido(documento)) {
    return NextResponse.json({ erro: "CPF inválido." }, { status: 422 });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // Se outro operador cadastrou a mesma placa neste instante,
      // reaproveitamos o registro dele em vez de falhar.
      const veiculo = await tx.veiculo.upsert({
        where: { placa },
        update: {},
        create: {
          placa,
          modelo: d.modelo?.trim() || null,
          marca: d.marca?.trim() || null,
          cor: d.cor?.trim() || null,
          tipo: d.tipo,
        },
      });

      let pessoaId = d.pessoaId ?? null;
      if (!pessoaId && d.pessoaNova) {
        // CPF informado e ja cadastrado: vincula a pessoa existente em vez
        // de criar uma duplicata.
        const existente = documento
          ? await tx.pessoa.findUnique({ where: { documento } })
          : null;
        pessoaId =
          existente?.id ??
          (
            await tx.pessoa.create({
              data: {
                nome: d.pessoaNova.nome.trim(),
                telefone: soDigitos(d.pessoaNova.telefone ?? "") || null,
                documento,
              },
            })
          ).id;
      }

      await tx.vinculo.upsert({
        where: {
          pessoaId_veiculoId: { pessoaId: pessoaId!, veiculoId: veiculo.id },
        },
        update: { ativo: true },
        create: { pessoaId: pessoaId!, veiculoId: veiculo.id, principal: true },
      });

      return { veiculoId: veiculo.id, pessoaId: pessoaId! };
    });

    registrarAuditoria({
      usuarioId: u.id,
      acao: "cadastro.rapido",
      entidade: "veiculo",
      entidadeId: resultado.veiculoId,
      dados: { placa, pessoaId: resultado.pessoaId },
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    console.error("[cadastro-rapido] falha", e);
    return NextResponse.json(
      { erro: "Não foi possível cadastrar. Tente novamente." },
      { status: 500 },
    );
  }
}
