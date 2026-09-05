import "server-only";

/**
 * Freio de forca bruta em memoria.
 *
 * Deliberadamente simples: o produto roda hoje como uma instancia unica, e
 * um contador local ja encarece o ataque sem introduzir Redis no caminho
 * critico. Se um dia houver mais de uma replica, este e o unico ponto a
 * trocar por um contador compartilhado.
 */

type Registro = { falhas: number; bloqueadoAte: number };

const registros = new Map<string, Registro>();

const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60_000;

// Sem limpeza, cada IP/e-mail tentado vira lixo permanente na memoria.
const LIMPEZA_MS = 10 * 60_000;
let ultimaLimpeza = Date.now();

function limpar(agora: number) {
  if (agora - ultimaLimpeza < LIMPEZA_MS) return;
  ultimaLimpeza = agora;
  for (const [k, r] of registros) {
    if (r.bloqueadoAte < agora - JANELA_MS) registros.delete(k);
  }
}

export function checarTentativas(chave: string): {
  permitido: boolean;
  segundos: number;
} {
  const agora = Date.now();
  limpar(agora);
  const r = registros.get(chave);
  if (r && r.bloqueadoAte > agora) {
    return { permitido: false, segundos: Math.ceil((r.bloqueadoAte - agora) / 1000) };
  }
  return { permitido: true, segundos: 0 };
}

export function registrarFalha(chave: string): void {
  const agora = Date.now();
  const r = registros.get(chave) ?? { falhas: 0, bloqueadoAte: 0 };
  r.falhas += 1;
  if (r.falhas >= MAX_FALHAS) {
    // Recuo progressivo: 1, 2, 4... minutos, teto de 15.
    const minutos = Math.min(15, 2 ** (r.falhas - MAX_FALHAS));
    r.bloqueadoAte = agora + minutos * 60_000;
  }
  registros.set(chave, r);
}

export function limparTentativas(chave: string): void {
  registros.delete(chave);
}
