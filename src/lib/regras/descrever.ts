/**
 * Traduz uma regra para uma frase em português.
 *
 * É o que decide se o cliente consegue mesmo configurar a política: um
 * formulário de sete campos (escopo × métrica × janela × limite × ação ×
 * alvo × prioridade) é ilegível como formulário e claro como frase. A mesma
 * função alimenta a lista e a pré-visualização do editor, então o que a
 * pessoa lê enquanto edita é exatamente o que vai aparecer depois.
 *
 * Sem `server-only`: roda nos dois lados de propósito.
 */

export type RegraDescritivel = {
  escopo: string;
  metrica: string;
  janela: string;
  janelaHoras?: number | null;
  limite: number;
  acao: string;
  alvoNome?: string | null;
};

import { duracaoLegivel } from "@/lib/regras/janelas";

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function sujeitoRegra(r: RegraDescritivel): string {
  if (r.escopo === "GLOBAL") return "o posto";
  if (r.alvoNome) return r.alvoNome;
  return r.escopo === "PESSOA" ? "cada pessoa" : "cada veículo";
}

/**
 * O limite e sempre uma CONTAGEM de liberacoes.
 *
 * Litros e valor sairam do modelo junto com o modo operador: quem libera
 * entrega um papel e nunca ve a bomba. Regras antigas com essas metricas
 * continuam no banco, marcadas como sem efeito na lista, ate serem
 * apagadas — por isso a funcao ainda recebe `metrica` sem usa-la.
 */
export function limiteRegra(r: RegraDescritivel): string {
  if (metricaObsoleta(r.metrica)) {
    return r.metrica === "LITROS"
      ? `${fmt.format(r.limite)} L`
      : `R$ ${fmt.format(r.limite)}`;
  }
  return r.limite === 1
    ? "1 liberação"
    : `${fmt.format(r.limite)} liberações`;
}

/** Metricas que o sistema nao mede mais. */
export function metricaObsoleta(metrica: string): boolean {
  return metrica === "LITROS" || metrica === "VALOR";
}

export function janelaRegra(r: RegraDescritivel): string {
  switch (r.janela) {
    case "DIA":
      return "por dia";
    case "SEMANA":
      return "por semana";
    case "MES":
      return "por mês";
    case "HORAS": {
      // "a cada 720 horas" não se lê como "a cada 30 dias", e é esta frase
      // que a pessoa confere antes de confiar na política.
      return `a cada ${duracaoLegivel(r.janelaHoras ?? 24)}`;
    }
    default:
      return "";
  }
}

/** Ex.: "Bloqueia cada veículo acima de 1 abastecimento por dia." */
export function descreverRegra(r: RegraDescritivel): string {
  const verbo = r.acao === "AVISAR" ? "Avisa quando" : "Bloqueia";
  const sujeito = sujeitoRegra(r);
  const limite = limiteRegra(r);
  const janela = janelaRegra(r);

  if (r.acao === "AVISAR") {
    return `${verbo} ${sujeito} passar de ${limite} ${janela}.`;
  }
  return `${verbo} ${sujeito} acima de ${limite} ${janela}.`;
}

export const OPCOES_ESCOPO = [
  { valor: "PESSOA", rotulo: "Pessoa" },
  { valor: "VEICULO", rotulo: "Veículo" },
  { valor: "GLOBAL", rotulo: "Posto inteiro" },
] as const;

export const OPCOES_JANELA = [
  { valor: "DIA", rotulo: "Por dia" },
  { valor: "SEMANA", rotulo: "Por semana" },
  { valor: "MES", rotulo: "Por mês" },
  { valor: "HORAS", rotulo: "Janela em horas" },
] as const;

export const OPCOES_ACAO = [
  { valor: "BLOQUEAR", rotulo: "Bloquear" },
  { valor: "AVISAR", rotulo: "Apenas avisar" },
] as const;
