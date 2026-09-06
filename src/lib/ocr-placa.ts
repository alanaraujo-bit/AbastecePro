/**
 * Leitura da placa a partir da foto — no proprio aparelho.
 *
 * Roda Tesseract em WebAssembly, servido pelo proprio dominio (ver
 * `scripts/preparar-ocr.mjs`). Nao ha chamada a servico externo e nao ha
 * custo por foto.
 *
 * DUAS DECISOES QUE SUSTENTAM O RESTO:
 *
 * 1. O resultado NUNCA vira consulta sozinho. OCR de camera de celular
 *    erra — foto torta, contraluz, placa suja — e um erro silencioso aqui
 *    viraria liberacao no nome do carro errado. A leitura preenche o campo
 *    e devolve o quanto confia; quem opera confirma.
 *
 * 2. Falhar e aceitavel. Se o worker nao carregar, se a imagem nao decodar,
 *    se nada parecido com placa aparecer, devolvemos `falha` e a tela
 *    continua funcionando pela digitacao. Nada aqui pode lancar para fora.
 */
import { corrigirPlaca, normalizarPlaca, placaValida } from "@/lib/placa";

export type EstadoLeitura = "certeza" | "duvida" | "falha";

export type LeituraPlaca = {
  /** Placa canonica (maiuscula, sem separador). Vazia quando falhou. */
  placa: string;
  /** 0-100. Quanto o reconhecimento confia nos caracteres devolvidos. */
  confianca: number;
  estado: EstadoLeitura;
  /** Indices dos caracteres em que a leitura ficou fraca. */
  fracos: number[];
};

export type Recorte = { x: number; y: number; largura: number; altura: number };

const CAMINHOS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract/",
  langPath: "/tesseract/",
};

const LETRAS_E_DIGITOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Acima disto a leitura se apresenta como confiavel; abaixo do piso ela
// nao chega a ser oferecida. A faixa do meio e onde a tela pede conferencia.
const LIMIAR_CERTEZA = 86;
const LIMIAR_MINIMO = 45;

/** Largura alvo do recorte antes do reconhecimento. */
const LARGURA_ALVO = 1200;

type WorkerTesseract = {
  setParameters: (p: Record<string, string | number>) => Promise<unknown>;
  recognize: (imagem: unknown) => Promise<{ data: DadosOcr }>;
  terminate: () => Promise<unknown>;
};

type SimboloOcr = { text?: string; confidence?: number };
type DadosOcr = {
  text?: string;
  confidence?: number;
  symbols?: SimboloOcr[];
  words?: { text?: string; confidence?: number; symbols?: SimboloOcr[] }[];
};

/**
 * O worker custa alguns segundos e alguns MB para subir. Guardamos um so
 * por aba: quem esta liberando costuma ler varias placas seguidas, e pagar
 * essa inicializacao a cada foto seria o dobro do tempo de espera.
 */
let workerPromise: Promise<WorkerTesseract> | null = null;

async function obterWorker(): Promise<WorkerTesseract> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = (await createWorker("eng", 1, CAMINHOS)) as WorkerTesseract;
      await worker.setParameters({
        tessedit_char_whitelist: LETRAS_E_DIGITOS,
      });
      return worker;
    })().catch((e) => {
      // Nao guardamos a promessa falha: a proxima tentativa recomeca.
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Sobe o worker em segundo plano, para a primeira foto nao esperar tudo. */
export function aquecerOcr(): void {
  obterWorker().catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Preparo da imagem                                                    */
/* ------------------------------------------------------------------ */

/**
 * Recorta, amplia e aumenta o contraste.
 *
 * O recorte e o passo que mais muda o resultado: na foto inteira a placa
 * ocupa uma faixa pequena, cercada de bordas que tambem parecem texto, e o
 * reconhecimento se perde. Depois de isolada, a mesma foto le bem.
 */
function prepararCanvas(
  origem: HTMLImageElement,
  recorte: Recorte,
  inverter: boolean,
): HTMLCanvasElement | null {
  const escala = Math.min(3, Math.max(1, LARGURA_ALVO / recorte.largura));
  const largura = Math.round(recorte.largura * escala);
  const altura = Math.round(recorte.altura * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    origem,
    recorte.x,
    recorte.y,
    recorte.largura,
    recorte.altura,
    0,
    0,
    largura,
    altura,
  );

  const img = ctx.getImageData(0, 0, largura, altura);
  const d = img.data;

  // 1ª passada: luminancia + extremos reais da imagem.
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = y;
    if (y < min) min = y;
    if (y > max) max = y;
  }

  // 2ª passada: estica o histograma para o intervalo cheio. Foto de placa
  // costuma vir "lavada" — sombra do carro, sol de lado — e sem esticar o
  // contraste os caracteres somam pouco contra o fundo.
  const faixa = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    let y = ((d[i] - min) / faixa) * 255;
    if (inverter) y = 255 - y;
    d[i] = d[i + 1] = d[i + 2] = y;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imagem ilegível"));
    img.src = url;
  });
}

/* ------------------------------------------------------------------ */
/* Extracao do candidato                                                */
/* ------------------------------------------------------------------ */

const SEQUENCIA = /[A-Z0-9]{7}/g;

/**
 * Acha a placa dentro do texto reconhecido.
 *
 * Testa cada sequencia de 7 caracteres passando pela correcao posicional
 * de `corrigirPlaca` — que resolve justamente O/0, I/1 e S/5, os erros que
 * o OCR comete. Preferimos a primeira que vira placa valida; se nenhuma
 * virar, devolvemos a primeira sequencia como palpite para conferencia.
 */
function extrairCandidato(texto: string): { placa: string; valida: boolean } | null {
  const limpo = normalizarTexto(texto);
  const achados = limpo.match(SEQUENCIA);
  if (!achados?.length) return null;

  for (const bruto of achados) {
    const corrigida = corrigirPlaca(bruto);
    if (placaValida(corrigida)) return { placa: corrigida, valida: true };
  }
  return { placa: normalizarPlaca(achados[0]), valida: false };
}

function normalizarTexto(t: string): string {
  return (t ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Confianca de cada caractere, na ordem em que aparecem no texto. */
function confiancasPorCaractere(dados: DadosOcr): number[] {
  const simbolos =
    dados.symbols ?? dados.words?.flatMap((w) => w.symbols ?? []) ?? [];
  const conf: number[] = [];
  for (const s of simbolos) {
    const txt = normalizarTexto(s.text ?? "");
    for (let i = 0; i < txt.length; i++) {
      conf.push(typeof s.confidence === "number" ? s.confidence : 0);
    }
  }
  return conf;
}

/* ------------------------------------------------------------------ */
/* Leitura                                                              */
/* ------------------------------------------------------------------ */

type Tentativa = { placa: string; valida: boolean; confianca: number; fracos: number[] };

async function tentar(
  worker: WorkerTesseract,
  canvas: HTMLCanvasElement,
  psm: string,
): Promise<Tentativa | null> {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(canvas);

  const candidato = extrairCandidato(data.text ?? "");
  if (!candidato) return null;

  // Alinha as confiancas por caractere com a posicao do candidato dentro
  // do texto reconhecido. Quando nao ha simbolos, cai na confianca geral.
  const limpo = normalizarTexto(data.text ?? "");
  const conf = confiancasPorCaractere(data);
  const inicio = limpo.indexOf(normalizarTexto(candidato.placa));
  const geral = typeof data.confidence === "number" ? data.confidence : 0;

  const porChar: number[] = [];
  for (let i = 0; i < 7; i++) {
    const c = inicio >= 0 ? conf[inicio + i] : undefined;
    porChar.push(typeof c === "number" && c > 0 ? c : geral);
  }

  const media = porChar.reduce((a, b) => a + b, 0) / 7;
  const fracos = porChar
    .map((c, i) => (c < 70 ? i : -1))
    .filter((i) => i >= 0);

  return { ...candidato, confianca: media, fracos };
}

/**
 * Le a placa de uma foto.
 *
 * @param urlImagem  URL da foto (`URL.createObjectURL` do arquivo da camera).
 * @param recorte    Regiao escolhida na tela, em pixels da imagem original.
 * @param placaConhecida  Devolve `true` quando a placa lida ja existe no
 *   cadastro. Bater com um veiculo conhecido e a evidencia mais forte de
 *   que a leitura esta certa — mais do que qualquer nota do reconhecedor.
 */
export async function lerPlacaDaFoto(
  urlImagem: string,
  recorte: Recorte,
  placaConhecida?: (placa: string) => Promise<boolean>,
): Promise<LeituraPlaca> {
  const falha: LeituraPlaca = {
    placa: "",
    confianca: 0,
    estado: "falha",
    fracos: [],
  };

  try {
    const [worker, img] = await Promise.all([
      obterWorker(),
      carregarImagem(urlImagem),
    ]);

    const normal = prepararCanvas(img, recorte, false);
    if (!normal) return falha;

    const tentativas: Tentativa[] = [];
    const t1 = await tentar(worker, normal, "7"); // linha unica
    if (t1) tentativas.push(t1);

    // Placa Mercosul e escura sobre claro; a antiga costuma ser o oposto.
    // Uma passada invertida cobre o caso em que o primeiro preparo apagou
    // justamente o contraste que importava.
    if (!t1?.valida || t1.confianca < LIMIAR_CERTEZA) {
      const invertido = prepararCanvas(img, recorte, true);
      if (invertido) {
        const t2 = await tentar(worker, invertido, "7");
        if (t2) tentativas.push(t2);
      }
      // Ultimo recurso: texto esparso, para quando a placa nao foi lida
      // como uma linha unica (moldura folgada, sombra cortando ao meio).
      const t3 = await tentar(worker, normal, "11");
      if (t3) tentativas.push(t3);
    }

    if (!tentativas.length) return falha;

    // Placa valida ganha de placa com nota alta: o formato brasileiro e uma
    // restricao forte, e um palpite bem pontuado fora do formato e ruido.
    tentativas.sort((a, b) => {
      if (a.valida !== b.valida) return a.valida ? -1 : 1;
      return b.confianca - a.confianca;
    });
    const melhor = tentativas[0];
    if (melhor.confianca < LIMIAR_MINIMO && !melhor.valida) return falha;

    let confianca = melhor.confianca;
    if (melhor.valida) confianca = Math.min(100, confianca + 6);

    if (melhor.valida && placaConhecida) {
      try {
        if (await placaConhecida(melhor.placa)) confianca = 100;
      } catch {
        // Cadastro indisponivel nao invalida a leitura: segue sem o bonus.
      }
    }

    const estado: EstadoLeitura =
      melhor.valida && confianca >= LIMIAR_CERTEZA && melhor.fracos.length === 0
        ? "certeza"
        : "duvida";

    return { placa: melhor.placa, confianca, estado, fracos: melhor.fracos };
  } catch {
    return falha;
  }
}
