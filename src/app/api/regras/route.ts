import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { exigirSessaoApi } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { Prisma } from "@/generated/prisma";

/**
 * Corpo de uma regra.
 *
 * `superRefine` cobre as combinações que o tipo sozinho não impede: janela
 * em horas sem o número de horas, e alvo que não corresponde ao escopo.
 */
export const CorpoRegra = z
  .object({
    nome: z.string().trim().min(3).max(120),
    descricao: z.string().trim().max(500).nullable().optional(),
    ativo: z.boolean().default(true),
    prioridade: z.number().int().min(0).max(9999).default(100),
    escopo: z.enum(["GLOBAL", "PESSOA", "VEICULO"]),
    // O sistema so mede contagem de liberacoes; litros e valor sairam do
    // modelo. Aceitar as outras metricas criaria regra que nunca dispara.
    metrica: z.literal("ABASTECIMENTOS").default("ABASTECIMENTOS"),
    janela: z.enum(["DIA", "SEMANA", "MES", "HORAS"]),
    janelaHoras: z.number().int().min(1).max(8760).nullable().optional(),
    limite: z.number().positive().max(9_999_999),
    acao: z.enum(["BLOQUEAR", "AVISAR"]).default("BLOQUEAR"),
    mensagem: z.string().trim().max(300).nullable().optional(),
    alvoPessoaId: z.string().nullable().optional(),
    alvoVeiculoId: z.string().nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.janela === "HORAS" && !d.janelaHoras) {
      ctx.addIssue({
        code: "custom",
        path: ["janelaHoras"],
        message: "Informe o número de horas da janela.",
      });
    }
    if (d.escopo !== "PESSOA" && d.alvoPessoaId) {
      ctx.addIssue({
        code: "custom",
        path: ["alvoPessoaId"],
        message: "Alvo de pessoa só vale com escopo Pessoa.",
      });
    }
    if (d.escopo !== "VEICULO" && d.alvoVeiculoId) {
      ctx.addIssue({
        code: "custom",
        path: ["alvoVeiculoId"],
        message: "Alvo de veículo só vale com escopo Veículo.",
      });
    }
  });

export async function POST(req: Request) {
  // A checagem vive aqui, não só na página: esconder o botão não fecha a rota.
  const auth = await exigirSessaoApi();
  if ("erro" in auth) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }

  let d: z.infer<typeof CorpoRegra>;
  try {
    d = CorpoRegra.parse(await req.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.issues[0]?.message ?? "Dados inválidos.")
        : "Dados inválidos.";
    return NextResponse.json({ erro: msg }, { status: 422 });
  }

  const regra = await prisma.regra.create({
    data: {
      nome: d.nome,
      descricao: d.descricao || null,
      ativo: d.ativo,
      prioridade: d.prioridade,
      escopo: d.escopo,
      metrica: d.metrica,
      janela: d.janela,
      janelaHoras: d.janela === "HORAS" ? (d.janelaHoras ?? 24) : null,
      limite: new Prisma.Decimal(d.limite),
      acao: d.acao,
      mensagem: d.mensagem || null,
      alvoPessoaId: d.escopo === "PESSOA" ? (d.alvoPessoaId ?? null) : null,
      alvoVeiculoId: d.escopo === "VEICULO" ? (d.alvoVeiculoId ?? null) : null,
    },
  });

  registrarAuditoria({
    usuarioId: auth.usuario.id,
    acao: "regra.criar",
    entidade: "regra",
    entidadeId: regra.id,
    dados: d,
  });

  return NextResponse.json({ ok: true, regra: { id: regra.id } });
}
