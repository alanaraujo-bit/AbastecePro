/**
 * Placas brasileiras.
 *
 * Convivem dois formatos e ambos continuam validos:
 *   - Antigo:   ABC1234   (3 letras + 4 digitos)
 *   - Mercosul: ABC1D23   (3 letras + digito + letra + 2 digitos)
 *
 * Guardamos sempre a forma canonica (maiuscula, sem separador) para que o
 * mesmo carro nunca gere dois cadastros. A formatacao e so apresentacao.
 */

export const PLACA_ANTIGA = /^[A-Z]{3}[0-9]{4}$/;
export const PLACA_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

/** Remove tudo que nao for letra/digito e coloca em maiuscula. */
export function normalizarPlaca(entrada: string): string {
  return (entrada ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

export function placaValida(entrada: string): boolean {
  const p = normalizarPlaca(entrada);
  return PLACA_ANTIGA.test(p) || PLACA_MERCOSUL.test(p);
}

export function tipoPlaca(entrada: string): "antiga" | "mercosul" | null {
  const p = normalizarPlaca(entrada);
  if (PLACA_ANTIGA.test(p)) return "antiga";
  if (PLACA_MERCOSUL.test(p)) return "mercosul";
  return null;
}

/** ABC1234 -> "ABC-1234"; ABC1D23 -> "ABC1D23" (Mercosul nao usa hifen). */
export function formatarPlaca(entrada: string): string {
  const p = normalizarPlaca(entrada);
  if (PLACA_ANTIGA.test(p)) return `${p.slice(0, 3)}-${p.slice(3)}`;
  return p;
}

/**
 * Corrige confusoes de caractere usando a posicao.
 *
 * Vale tanto para OCR quanto para digitacao apressada: nas duas fontes o
 * erro classico e trocar O/0, I/1 e S/5. Como cada posicao da placa so
 * aceita letra OU digito, da para desambiguar sem adivinhar.
 *
 * Posicoes 0-2 sao sempre letras. Posicao 3 e sempre digito. Posicao 4
 * decide o formato (digito = antiga, letra = Mercosul) e por isso e a unica
 * que deixamos intacta. Posicoes 5-6 sao sempre digitos.
 */
const PARA_LETRA: Record<string, string> = {
  "0": "O",
  "1": "I",
  "5": "S",
  "8": "B",
  "2": "Z",
  "6": "G",
  "4": "A",
};
const PARA_DIGITO: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  S: "5",
  B: "8",
  Z: "2",
  G: "6",
  A: "4",
};

export function corrigirPlaca(entrada: string): string {
  const p = normalizarPlaca(entrada);
  if (p.length !== 7) return p;

  const c = p.split("");
  for (let i = 0; i < 3; i++) c[i] = PARA_LETRA[c[i]] ?? c[i];
  c[3] = PARA_DIGITO[c[3]] ?? c[3];
  // c[4] fica como veio: e ele que distingue placa antiga de Mercosul.
  for (let i = 5; i < 7; i++) c[i] = PARA_DIGITO[c[i]] ?? c[i];

  const corrigida = c.join("");
  // So aceitamos a correcao se ela de fato produzir uma placa valida;
  // caso contrario devolvemos o que o operador digitou, sem "consertar"
  // por cima de um dado que ele pode ter escrito certo.
  return placaValida(corrigida) ? corrigida : p;
}

/** Mascara progressiva para o campo de digitacao. */
export function mascararPlaca(entrada: string): string {
  const p = normalizarPlaca(entrada);
  if (p.length <= 3) return p;
  // Enquanto nao sabemos o formato, mostramos sem separador.
  if (p.length <= 4) return p;
  if (PLACA_MERCOSUL.test(p) || /^[A-Z]{3}[0-9][A-Z]/.test(p)) return p;
  return `${p.slice(0, 3)}-${p.slice(3)}`;
}
