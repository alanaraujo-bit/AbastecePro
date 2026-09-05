import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { sessaoAtual } from "@/lib/auth";
import { avaliarRegras } from "@/lib/regras/avaliar";
import { normalizarPlaca, placaValida } from "@/lib/placa";

const Corpo = z.object({
  placa: z.string().min(1),
  /** Quando o veiculo tem mais de um condutor, qual deles esta abastecendo. */
  pessoaId: z.string().optional().nullable(),
});

/**
 * Consulta de placa — o coracao do fluxo do operador.
 *
 * Uma unica chamada devolve tudo que a tela precisa: veiculo, condutores,
 * veredito das regras, ultimo atendimento e historico curto. O objetivo e
 * que entre digitar a placa e ver LIBERADO/BLOQUEADO exista uma requisicao
 * so — cada ida e volta extra e tempo com o carro parado na pista.
 */
export async function POST(req: Request) {
  const u = await sessaoAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  let dados: z.infer<typeof Corpo>;
  try {
    dados = Corpo.parse(await req.json());
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const placa = normalizarPlaca(dados.placa);
  if (!placaValida(placa)) {
    return NextResponse.json(
      { erro: "Placa inválida. Use ABC1D23 ou ABC-1234." },
      { status: 422 },
    );
  }

  const veiculo = await prisma.veiculo.findUnique({
    where: { placa },
    include: {
      vinculos: {
        where: { ativo: true },
        include: {
          pessoa: {
            select: {
              id: true,
              nome: true,
              documento: true,
              telefone: true,
              bloqueado: true,
              motivoBloqueio: true,
              ativo: true,
            },
          },
        },
        orderBy: [{ principal: "desc" }, { criadoEm: "asc" }],
      },
    },
  });

  // Veiculo desconhecido: nao e erro, e o comeco de um cadastro rapido.
  if (!veiculo) {
    return NextResponse.json({
      placa,
      veiculo: null,
      condutores: [],
      veredito: null,
      ultimo: null,
      historico: [],
    });
  }

  const condutores = veiculo.vinculos
    .filter((v) => v.pessoa.ativo)
    .map((v) => ({
      id: v.pessoa.id,
      nome: v.pessoa.nome,
      documento: v.pessoa.documento,
      telefone: v.pessoa.telefone,
      bloqueado: v.pessoa.bloqueado,
      motivoBloqueio: v.pessoa.motivoBloqueio,
      principal: v.principal,
    }));

  // Se o operador ja escolheu um condutor, respeitamos; senao usamos o
  // principal (ou o unico) — o caso comum nao deve exigir escolha nenhuma.
  const escolhido =
    (dados.pessoaId && condutores.find((c) => c.id === dados.pessoaId)) ||
    condutores[0] ||
    null;

  const [veredito, ultimo, historico] = await Promise.all([
    avaliarRegras({ pessoaId: escolhido?.id ?? null, veiculoId: veiculo.id }),
    // "Último abastecimento" tem de ser o último que de fato aconteceu.
    // Uma tentativa bloqueada não abasteceu nada e apareceria aqui como
    // um registro vazio — ela continua visível no histórico abaixo.
    prisma.abastecimento.findFirst({
      where: {
        veiculoId: veiculo.id,
        resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
      },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        criadoEm: true,
        litros: true,
        valor: true,
        resultado: true,
        combustivel: true,
        pessoa: { select: { nome: true } },
        operador: { select: { nome: true } },
      },
    }),
    prisma.abastecimento.findMany({
      where: { veiculoId: veiculo.id },
      orderBy: { criadoEm: "desc" },
      take: 6,
      select: {
        id: true,
        criadoEm: true,
        litros: true,
        valor: true,
        resultado: true,
        pessoa: { select: { nome: true } },
      },
    }),
  ]);

  return NextResponse.json({
    placa,
    veiculo: {
      id: veiculo.id,
      placa: veiculo.placa,
      modelo: veiculo.modelo,
      marca: veiculo.marca,
      cor: veiculo.cor,
      ano: veiculo.ano,
      tipo: veiculo.tipo,
      bloqueado: veiculo.bloqueado,
      motivoBloqueio: veiculo.motivoBloqueio,
    },
    condutores,
    pessoaSelecionada: escolhido?.id ?? null,
    veredito,
    ultimo: ultimo && {
      ...ultimo,
      litros: ultimo.litros ? Number(ultimo.litros) : null,
      valor: ultimo.valor ? Number(ultimo.valor) : null,
    },
    historico: historico.map((h) => ({
      ...h,
      litros: h.litros ? Number(h.litros) : null,
      valor: h.valor ? Number(h.valor) : null,
    })),
  });
}
