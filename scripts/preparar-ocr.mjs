/**
 * Copia os arquivos do Tesseract para `public/tesseract/`.
 *
 * A leitura da placa roda NO APARELHO — sem chave de API e sem custo por
 * foto. Para isso o navegador precisa buscar o worker, o núcleo WebAssembly
 * e o modelo de idioma em algum lugar.
 *
 * Servimos do próprio domínio, e não da CDN padrão da biblioteca, por dois
 * motivos: o app é um PWA usado em rede ruim, onde um terceiro fora do ar
 * quebraria a leitura sem qualquer aviso; e a folha de estilo/scripts do
 * produto já vivem sob uma origem só, o que mantém a política de conteúdo
 * simples.
 *
 * Os arquivos NÃO são versionados (~20 MB): este script roda antes do `dev`
 * e do `build`, copiando do `node_modules`. Nada é baixado da rede aqui.
 *
 *   node scripts/preparar-ocr.mjs
 */
import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DESTINO = path.join(process.cwd(), "public", "tesseract");

/** Resolve a pasta de um pacote a partir de um arquivo conhecido dele. */
function pastaDo(pacoteArquivo, subir = 1) {
  let p = require.resolve(pacoteArquivo);
  for (let i = 0; i < subir; i++) p = path.dirname(p);
  return p;
}

async function existe(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(DESTINO, { recursive: true });

  // 1. Worker: o laço de OCR fora da thread da interface.
  const worker = path.join(
    pastaDo("tesseract.js/package.json"),
    "dist",
    "worker.min.js",
  );
  await cp(worker, path.join(DESTINO, "worker.min.js"));

  // 2. Núcleo WebAssembly. Copiamos só as variantes LSTM — são as que a
  //    biblioteca usa quando não se pede o motor legado, e as legadas
  //    dobrariam o peso sem serem carregadas nunca.
  const core = pastaDo("tesseract.js-core/package.json");
  for (const arquivo of [
    "tesseract-core-lstm.wasm",
    "tesseract-core-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm",
    "tesseract-core-simd-lstm.wasm.js",
  ]) {
    const origem = path.join(core, arquivo);
    if (await existe(origem)) await cp(origem, path.join(DESTINO, arquivo));
  }

  // 3. Modelo de idioma. `eng` basta: placa é A-Z e 0-9, e a lista branca
  //    no reconhecimento já impede qualquer outro caractere de aparecer.
  //
  //    Variante `_best_int`: 2,8 MB contra 10,4 MB da completa. Num celular
  //    em rede ruim, 7 MB a mais é a diferença entre a leitura começar em
  //    segundos e a pessoa desistir — e a precisão extra do modelo grande
  //    se ganha em texto corrido, não em sete caracteres grandes e de alto
  //    contraste.
  const dados = pastaDo("@tesseract.js-data/eng/package.json");
  await cp(
    path.join(dados, "4.0.0_best_int", "eng.traineddata.gz"),
    path.join(DESTINO, "eng.traineddata.gz"),
  );

  console.log(`✓ Tesseract preparado em ${path.relative(process.cwd(), DESTINO)}`);
}

main().catch((e) => {
  // Falhar aqui não pode derrubar o build: sem estes arquivos a tela de
  // liberação continua funcionando pela digitação da placa.
  console.warn("⚠ Não foi possível preparar o OCR:", e.message);
});
