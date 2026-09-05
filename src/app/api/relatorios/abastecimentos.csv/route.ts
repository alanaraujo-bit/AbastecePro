import { prisma } from "@/lib/db";
import { sessaoAtual, podeAcessarAdmin } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { normalizarPlaca, formatarPlaca } from "@/lib/placa";
import type { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

/** Escapa um campo para CSV. Aspas dentro do campo dobram. */
function campo(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Número no padrão pt-BR (vírgula decimal), para o Excel não tratar como texto. */
function num(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(".", ",");
}

const ROTULO_RESULTADO: Record<string, string> = {
  LIBERADO: "Liberado",
  BLOQUEADO: "Bloqueado",
  AUTORIZADO_EXCECAO: "Autorizado por exceção",
};

export async function GET(req: Request) {
  const u = await sessaoAtual();
  if (!u || !podeAcessarAdmin(u.papel)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const resultado = sp.get("resultado") ?? "";
  const periodo = sp.get("periodo") ?? "";

  const where: Prisma.AbastecimentoWhereInput = {};
  if (q) {
    where.OR = [
      { placa: { contains: normalizarPlaca(q) } },
      { pessoa: { nome: { contains: q, mode: "insensitive" } } },
      { veiculo: { modelo: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (resultado) where.resultado = resultado as never;
  if (periodo) {
    const dias = Number(periodo);
    if (Number.isFinite(dias) && dias > 0) {
      where.criadoEm = { gte: new Date(Date.now() - dias * 864e5) };
    }
  }

  const itens = await prisma.abastecimento.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    // Teto de segurança: uma exportação sem limite pode derrubar a memória
    // do contêiner quando a base crescer.
    take: 10_000,
    select: {
      criadoEm: true,
      placa: true,
      litros: true,
      valor: true,
      combustivel: true,
      hodometro: true,
      resultado: true,
      justificativa: true,
      observacao: true,
      pessoa: { select: { nome: true, documento: true } },
      veiculo: { select: { marca: true, modelo: true } },
      operador: { select: { nome: true } },
      autorizadoPor: { select: { nome: true } },
    },
  });

  const cabecalho = [
    "Data",
    "Hora",
    "Placa",
    "Condutor",
    "Documento",
    "Veículo",
    "Litros",
    "Valor (R$)",
    "Combustível",
    "Hodômetro",
    "Resultado",
    "Operador",
    "Autorizado por",
    "Justificativa",
    "Observação",
  ];

  const linhas = itens.map((a) =>
    [
      a.criadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      a.criadoEm.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }),
      formatarPlaca(a.placa),
      a.pessoa?.nome ?? "",
      a.pessoa?.documento ?? "",
      [a.veiculo?.marca, a.veiculo?.modelo].filter(Boolean).join(" "),
      num(a.litros),
      num(a.valor),
      a.combustivel ?? "",
      a.hodometro ?? "",
      ROTULO_RESULTADO[a.resultado] ?? a.resultado,
      a.operador.nome,
      a.autorizadoPor?.nome ?? "",
      a.justificativa ?? "",
      a.observacao ?? "",
    ].map(campo).join(";"),
  );

  // Separador ";" e BOM UTF-8: é o que faz o Excel em pt-BR abrir o arquivo
  // com as colunas separadas e os acentos corretos, sem passo de importação.
  const csv = "﻿" + [cabecalho.join(";"), ...linhas].join("\r\n");

  registrarAuditoria({
    usuarioId: u.id,
    acao: "relatorio.exportar",
    entidade: "abastecimento",
    dados: { formato: "csv", filtros: { q, resultado, periodo }, linhas: itens.length },
  });

  const data = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="abastecimentos-${data}.csv"`,
      "cache-control": "no-store",
    },
  });
}
