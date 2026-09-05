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

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function sujeitoRegra(r: RegraDescritivel): string {
  if (r.escopo === "GLOBAL") return "o posto";
  if (r.alvoNome) return r.alvoNome;
  return r.escopo === "PESSOA" ? "cada pessoa" : "cada veículo";
}

export function limiteRegra(r: RegraDescritivel): string {
  if (r.metrica === "LITROS") return `${fmt.format(r.limite)} L`;
  if (r.metrica === "VALOR") return fmtBRL.format(r.limite);
  return r.limite === 1
    ? "1 abastecimento"
    : `${fmt.format(r.limite)} abastecimentos`;
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
      const h = r.janelaHoras ?? 24;
      return h === 1 ? "por hora" : `a cada ${h} horas`;
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

export const OPCOES_METRICA = [
  { valor: "ABASTECIMENTOS", rotulo: "Abastecimentos" },
  { valor: "LITROS", rotulo: "Litros" },
  { valor: "VALOR", rotulo: "Valor (R$)" },
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
