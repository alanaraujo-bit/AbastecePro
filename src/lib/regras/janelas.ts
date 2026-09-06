import type { JanelaRegra } from "@/generated/prisma";

/**
 * O servidor roda em UTC, mas "limite por dia" significa o dia civil de quem
 * opera o posto. Todas as fronteiras de janela sao calculadas no fuso do
 * negocio, nao no do container.
 */
// Configurável por ambiente, não por banco: é infraestrutura, muda quase
// nunca, e lê-lo do banco custaria uma consulta dentro do caminho crítico
// de avaliação das regras.
export const FUSO_PADRAO = process.env.TZ_NEGOCIO || "America/Sao_Paulo";

/** Diferenca entre o relogio de parede em `tz` e UTC, no instante `d`. */
function deslocamentoMs(d: Date, tz: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);

  const p: Record<string, number> = {};
  for (const { type, value } of partes) {
    if (type !== "literal") p[type] = Number(value);
  }
  // `hour` pode vir como 24 em alguns runtimes na virada do dia.
  const hora = p.hour === 24 ? 0 : p.hour;
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, hora, p.minute, p.second);
  return comoUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Relogio de parede local expresso como se fosse UTC — facilita a aritmetica. */
function paredeLocal(d: Date, tz: string): Date {
  return new Date(d.getTime() + deslocamentoMs(d, tz));
}

/** Converte um relogio de parede local de volta para o instante real. */
function deParedeParaInstante(parede: Date, tz: string): Date {
  const palpite = new Date(parede.getTime() - deslocamentoMs(parede, tz));
  // Reavalia no proprio palpite: cobre corretamente bordas de horario de verao.
  return new Date(parede.getTime() - deslocamentoMs(palpite, tz));
}

export function inicioDaJanela(
  janela: JanelaRegra,
  janelaHoras: number | null | undefined,
  agora: Date = new Date(),
  tz: string = FUSO_PADRAO,
): Date {
  if (janela === "HORAS") {
    const h = janelaHoras && janelaHoras > 0 ? janelaHoras : 24;
    return new Date(agora.getTime() - h * 3600_000);
  }

  const parede = paredeLocal(agora, tz);

  if (janela === "DIA") {
    parede.setUTCHours(0, 0, 0, 0);
  } else if (janela === "SEMANA") {
    // Semana civil brasileira: segunda a domingo.
    const dow = parede.getUTCDay(); // 0 = domingo
    const desde = dow === 0 ? 6 : dow - 1;
    parede.setUTCDate(parede.getUTCDate() - desde);
    parede.setUTCHours(0, 0, 0, 0);
  } else {
    parede.setUTCDate(1);
    parede.setUTCHours(0, 0, 0, 0);
  }

  return deParedeParaInstante(parede, tz);
}

export function rotuloJanela(
  janela: JanelaRegra,
  janelaHoras?: number | null,
): string {
  switch (janela) {
    case "DIA":
      return "no dia";
    case "SEMANA":
      return "na semana";
    case "MES":
      return "no mês";
    case "HORAS":
      return `em ${duracaoLegivel(janelaHoras ?? 24)}`;
  }
}

/**
 * Horas viram dias quando fecham em dias exatos.
 *
 * A janela é armazenada em horas porque é a unidade que o interpretador
 * usa, mas "a cada 720 horas" não se lê como "a cada 30 dias" — e a frase
 * da regra é o que a pessoa confere antes de confiar na política. Abaixo
 * de um dia, a hora continua sendo a unidade natural ("a cada 6 horas").
 */
export function duracaoLegivel(horas: number): string {
  if (horas >= 24 && horas % 24 === 0) {
    const dias = horas / 24;
    return dias === 1 ? "1 dia" : `${dias} dias`;
  }
  return horas === 1 ? "1 hora" : `${horas} horas`;
}
