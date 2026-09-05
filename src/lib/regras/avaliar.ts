import "server-only";

import { prisma } from "@/lib/db";
import { inicioDaJanela, rotuloJanela } from "@/lib/regras/janelas";
import type { Regra } from "@/generated/prisma";

/**
 * Interpretador de regras.
 *
 * Toda a politica de liberacao vive na tabela `regras`. Este arquivo nao
 * conhece nenhum limite especifico: ele le as linhas ativas, mede o consumo
 * na janela de cada uma e devolve um veredito ESTRUTURADO — a tela de
 * bloqueio precisa dizer qual regra pegou, qual o teto e quanto ja foi usado.
 */

export type MotivoRegra = {
  regraId: string;
  nome: string;
  escopo: string;
  metrica: string;
  janela: string;
  limite: number;
  /** Consumo ja registrado na janela, antes deste atendimento. */
  atual: number;
  /** Quanto este atendimento acrescenta (0 quando ainda nao informado). */
  proposto: number;
  restante: number;
  acao: "BLOQUEAR" | "AVISAR";
  mensagem: string;
};

export type BloqueioCadastral = {
  tipo: "PESSOA" | "VEICULO";
  nome: string;
  motivo: string | null;
  desde: Date | null;
};

export type Veredito = {
  liberado: boolean;
  /** Bloqueios manuais em pessoa/veiculo — precedem qualquer regra de limite. */
  cadastrais: BloqueioCadastral[];
  bloqueios: MotivoRegra[];
  avisos: MotivoRegra[];
  /** Regras ativas no instante da decisao, para auditoria posterior. */
  snapshot: unknown;
};

export type AlvoAvaliacao = {
  pessoaId?: string | null;
  veiculoId?: string | null;
  /** Consumo previsto deste atendimento, quando ja conhecido. */
  litros?: number | null;
  valor?: number | null;
};

type ChaveConsumo = string;
type Consumo = { abastecimentos: number; litros: number; valor: number };

function chave(escopo: string, alvoId: string | null, desde: Date): ChaveConsumo {
  return `${escopo}:${alvoId ?? "*"}:${desde.toISOString()}`;
}

/**
 * Uma regra so entra na conta se o alvo dela bate com o atendimento.
 * Sem alvo, a regra vale para todos daquele escopo (ex.: "todo veiculo,
 * 2 abastecimentos por dia"). Com alvo, so para aquele registro.
 */
function regraSeAplica(regra: Regra, alvo: AlvoAvaliacao): boolean {
  if (regra.escopo === "GLOBAL") return true;
  if (regra.escopo === "PESSOA") {
    if (!alvo.pessoaId) return false;
    return !regra.alvoPessoaId || regra.alvoPessoaId === alvo.pessoaId;
  }
  if (regra.escopo === "VEICULO") {
    if (!alvo.veiculoId) return false;
    return !regra.alvoVeiculoId || regra.alvoVeiculoId === alvo.veiculoId;
  }
  return false;
}

function filtroDoEscopo(regra: Regra, alvo: AlvoAvaliacao) {
  if (regra.escopo === "PESSOA") return { pessoaId: alvo.pessoaId! };
  if (regra.escopo === "VEICULO") return { veiculoId: alvo.veiculoId! };
  return {};
}

function idDoEscopo(regra: Regra, alvo: AlvoAvaliacao): string | null {
  if (regra.escopo === "PESSOA") return alvo.pessoaId ?? null;
  if (regra.escopo === "VEICULO") return alvo.veiculoId ?? null;
  return null;
}

// Numeros que chegam ao operador sempre em pt-BR: "150,28", nunca "150.28".
const fmtBR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function interpolar(
  modelo: string,
  d: {
    limite: number;
    atual: number;
    restante: number;
    janela: string;
    nome: string;
  },
): string {
  return modelo
    .replace(/\{limite\}/g, fmtBR.format(d.limite))
    .replace(/\{atual\}/g, fmtBR.format(d.atual))
    .replace(/\{restante\}/g, fmtBR.format(d.restante))
    .replace(/\{janela\}/g, d.janela)
    .replace(/\{nome\}/g, d.nome);
}

export async function avaliarRegras(
  alvo: AlvoAvaliacao,
  agora: Date = new Date(),
): Promise<Veredito> {
  /* --- 1. Bloqueio cadastral tem precedencia absoluta ------------------ */
  const [pessoa, veiculo] = await Promise.all([
    alvo.pessoaId
      ? prisma.pessoa.findUnique({
          where: { id: alvo.pessoaId },
          select: {
            nome: true,
            bloqueado: true,
            motivoBloqueio: true,
            bloqueadoEm: true,
          },
        })
      : null,
    alvo.veiculoId
      ? prisma.veiculo.findUnique({
          where: { id: alvo.veiculoId },
          select: {
            placa: true,
            bloqueado: true,
            motivoBloqueio: true,
            bloqueadoEm: true,
          },
        })
      : null,
  ]);

  // Os dois podem estar bloqueados ao mesmo tempo; o operador precisa
  // saber de ambos para explicar a situacao de uma vez so.
  const cadastrais: BloqueioCadastral[] = [];
  if (pessoa?.bloqueado) {
    cadastrais.push({
      tipo: "PESSOA",
      nome: pessoa.nome,
      motivo: pessoa.motivoBloqueio,
      desde: pessoa.bloqueadoEm,
    });
  }
  if (veiculo?.bloqueado) {
    cadastrais.push({
      tipo: "VEICULO",
      nome: veiculo.placa,
      motivo: veiculo.motivoBloqueio,
      desde: veiculo.bloqueadoEm,
    });
  }

  /* --- 2. Regras ativas aplicaveis ------------------------------------- */
  const todas = await prisma.regra.findMany({
    where: { ativo: true },
    orderBy: [{ prioridade: "asc" }, { criadoEm: "asc" }],
  });
  const aplicaveis = todas.filter((r) => regraSeAplica(r, alvo));

  /* --- 3. Consumo por janela.
         Varias regras costumam compartilhar o mesmo recorte (ex.: tres
         regras "por pessoa, por dia"). Agrupamos para medir uma vez so. --- */
  const grupos = new Map<
    ChaveConsumo,
    { regra: Regra; desde: Date }
  >();
  const desdePorRegra = new Map<string, Date>();

  for (const r of aplicaveis) {
    const desde = inicioDaJanela(r.janela, r.janelaHoras, agora);
    desdePorRegra.set(r.id, desde);
    const k = chave(r.escopo, idDoEscopo(r, alvo), desde);
    if (!grupos.has(k)) grupos.set(k, { regra: r, desde });
  }

  const medidos = await Promise.all(
    [...grupos.entries()].map(async ([k, { regra, desde }]) => {
      const agg = await prisma.abastecimento.aggregate({
        where: {
          ...filtroDoEscopo(regra, alvo),
          criadoEm: { gte: desde },
          // Tentativas bloqueadas nao consomem cota: so contam os
          // atendimentos que de fato aconteceram.
          resultado: { in: ["LIBERADO", "AUTORIZADO_EXCECAO"] },
        },
        _count: { _all: true },
        _sum: { litros: true, valor: true },
      });
      const c: Consumo = {
        abastecimentos: agg._count._all,
        litros: Number(agg._sum.litros ?? 0),
        valor: Number(agg._sum.valor ?? 0),
      };
      return [k, c] as const;
    }),
  );
  const consumoPorChave = new Map<ChaveConsumo, Consumo>(medidos);

  /* --- 4. Veredito ----------------------------------------------------- */
  const bloqueios: MotivoRegra[] = [];
  const avisos: MotivoRegra[] = [];

  for (const r of aplicaveis) {
    const desde = desdePorRegra.get(r.id)!;
    const consumo = consumoPorChave.get(chave(r.escopo, idDoEscopo(r, alvo), desde));
    if (!consumo) continue;

    const limite = Number(r.limite);
    let atual: number;
    let proposto: number;

    if (r.metrica === "ABASTECIMENTOS") {
      atual = consumo.abastecimentos;
      proposto = 1; // este atendimento conta como um
    } else if (r.metrica === "LITROS") {
      atual = consumo.litros;
      proposto = alvo.litros ?? 0;
    } else {
      atual = consumo.valor;
      proposto = alvo.valor ?? 0;
    }

    if (atual + proposto <= limite) continue;

    const janelaTxt = rotuloJanela(r.janela, r.janelaHoras);
    const motivo: MotivoRegra = {
      regraId: r.id,
      nome: r.nome,
      escopo: r.escopo,
      metrica: r.metrica,
      janela: janelaTxt,
      limite,
      atual,
      proposto,
      restante: Math.max(0, limite - atual),
      acao: r.acao,
      mensagem: r.mensagem
        ? interpolar(r.mensagem, {
            limite,
            atual,
            restante: Math.max(0, limite - atual),
            janela: janelaTxt,
            nome: r.nome,
          })
        : mensagemPadrao(r, atual, limite, janelaTxt),
    };

    if (r.acao === "BLOQUEAR") bloqueios.push(motivo);
    else avisos.push(motivo);
  }

  return {
    liberado: cadastrais.length === 0 && bloqueios.length === 0,
    cadastrais,
    bloqueios,
    avisos,
    snapshot: {
      avaliadoEm: agora.toISOString(),
      regras: aplicaveis.map((r) => ({
        id: r.id,
        nome: r.nome,
        escopo: r.escopo,
        metrica: r.metrica,
        janela: r.janela,
        janelaHoras: r.janelaHoras,
        limite: Number(r.limite),
        acao: r.acao,
      })),
    },
  };
}

function mensagemPadrao(
  r: Regra,
  atual: number,
  limite: number,
  janela: string,
): string {
  const sujeito =
    r.escopo === "PESSOA"
      ? "Esta pessoa"
      : r.escopo === "VEICULO"
        ? "Este veículo"
        : "O posto";

  if (r.metrica === "ABASTECIMENTOS") {
    const n = limite === 1 ? "1 abastecimento" : `${limite} abastecimentos`;
    return `${sujeito} já usou ${fmtBR.format(atual)} de ${n} permitidos ${janela}.`;
  }

  // O saldo e o unico numero acionavel aqui: e ele que permite ao operador
  // dizer ao motorista quanto ainda da para abastecer, sem chamar ninguem.
  const restante = Math.max(0, limite - atual);

  if (r.metrica === "LITROS") {
    return (
      `${sujeito} já consumiu ${fmtBR.format(atual)} L do limite de ` +
      `${fmtBR.format(limite)} L ${janela}. Restam ${fmtBR.format(restante)} L.`
    );
  }
  return (
    `${sujeito} já consumiu ${fmtBRL.format(atual)} do limite de ` +
    `${fmtBRL.format(limite)} ${janela}. Restam ${fmtBRL.format(restante)}.`
  );
}
