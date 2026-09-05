/**
 * Gera os ícones do PWA a partir da marca vetorial.
 *
 * Roda uma vez e os PNGs são versionados — não é passo de build. Assim o
 * deploy não depende do `sharp` nem de rasterizar nada em produção.
 *
 *   node scripts/gerar-icones.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BRAND = "#1B51DB";
const DIR = path.join(process.cwd(), "public", "icons");

/**
 * @param raio  Raio do quadrado. 0 = borda reta (o SO recorta por cima).
 * @param escala Tamanho da gota dentro do quadrado. Ícone "maskable" precisa
 *   caber na zona segura central (~80%), senão o Android corta a arte.
 */
function svg(raio, escala) {
  const d = 48;
  const c = d / 2;
  const s = escala;
  // Redesenha a gota em torno do centro, aplicando a escala pedida.
  const p = (x, y) => `${c + (x - c) * s} ${c + (y - c) * s}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 ${d} ${d}">
  <rect width="${d}" height="${d}" rx="${raio}" fill="${BRAND}"/>
  <path d="M${p(24, 11)} C${p(24, 11)} ${p(15.5, 19.9)} ${p(15.5, 26.1)} a${8.5 * s} ${8.5 * s} 0 0 0 ${17 * s} 0 C${p(32.5, 19.9)} ${p(24, 11)} ${p(24, 11)} Z" fill="#ffffff" fill-opacity="0.96"/>
  <path d="M${p(18.4, 27.4)} h${11.2 * s}" stroke="${BRAND}" stroke-width="${2.6 * s}" stroke-linecap="round"/>
</svg>`;
}

const ALVOS = [
  { arquivo: "icon-192.png", tamanho: 192, raio: 13, escala: 1 },
  { arquivo: "icon-512.png", tamanho: 512, raio: 13, escala: 1 },
  // Apple não aplica máscara: o ícone precisa já vir com o canto certo.
  { arquivo: "apple-touch-icon.png", tamanho: 180, raio: 0, escala: 1 },
  // Maskable: borda reta e arte encolhida para sobreviver ao recorte.
  { arquivo: "icon-maskable-512.png", tamanho: 512, raio: 0, escala: 0.62 },
];

await mkdir(DIR, { recursive: true });

for (const { arquivo, tamanho, raio, escala } of ALVOS) {
  const png = await sharp(Buffer.from(svg(raio, escala)))
    .resize(tamanho, tamanho)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(DIR, arquivo), png);
  console.log(`✓ ${arquivo} (${tamanho}px, ${(png.length / 1024).toFixed(1)} kB)`);
}

// Favicon vetorial: nítido em qualquer densidade e mais leve que .ico.
await writeFile(path.join(process.cwd(), "public", "icon.svg"), svg(13, 1));
console.log("✓ icon.svg");
