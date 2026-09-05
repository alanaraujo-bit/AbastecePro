import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Armazenamento das fotos de atendimento.
 *
 * Dois provedores atras da mesma interface: bucket S3-compatível (Railway,
 * em producao) e disco local (dev, sem exigir credencial nenhuma). Escolhe
 * sozinho pela presenca das variaveis.
 *
 * As fotos NUNCA sao servidas por URL publica. A chave e opaca e o acesso
 * passa por `/api/fotos/[chave]`, que exige sessao — imagem de pessoa e
 * veiculo e dado pessoal, nao asset estatico.
 */

const BUCKET = process.env.S3_BUCKET;
const usaS3 = Boolean(
  BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
);

const DIR_LOCAL = path.join(process.cwd(), ".storage");

let clienteS3: S3Client | null = null;
function s3(): S3Client {
  if (!clienteS3) {
    clienteS3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      // Buckets da Railway usam URL virtual-hosted (nome como subdomínio),
      // que é o padrão do SDK. Buckets antigos e alguns provedores exigem
      // path-style — por isso a variável de escape.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return clienteS3;
}

export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
export const TAMANHO_MAX = 8 * 1024 * 1024; // 8 MB

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Chave opaca, particionada por dia para o bucket nao virar um diretorio único. */
function novaChave(contentType: string): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const id = crypto.randomBytes(16).toString("hex");
  return `${hoje}/${id}.${EXT[contentType] ?? "bin"}`;
}

export async function salvarFoto(
  dados: Buffer,
  contentType: string,
): Promise<string> {
  const chave = novaChave(contentType);

  if (usaS3) {
    await s3().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: chave,
        Body: dados,
        ContentType: contentType,
        // Sem ACL publica: o objeto so sai daqui pela rota autenticada.
      }),
    );
    return chave;
  }

  const destino = path.join(DIR_LOCAL, chave);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, dados);
  return chave;
}

export async function lerFoto(
  chave: string,
): Promise<{ dados: Buffer; contentType: string } | null> {
  // A chave vem da URL: barrar travessia de diretorio antes de tocar no disco.
  if (!/^\d{4}-\d{2}-\d{2}\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(chave)) {
    return null;
  }
  const contentType =
    chave.endsWith(".png")
      ? "image/png"
      : chave.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

  try {
    if (usaS3) {
      const r = await s3().send(
        new GetObjectCommand({ Bucket: BUCKET, Key: chave }),
      );
      const bytes = await r.Body!.transformToByteArray();
      return { dados: Buffer.from(bytes), contentType };
    }
    const dados = await fs.readFile(path.join(DIR_LOCAL, chave));
    return { dados, contentType };
  } catch {
    return null;
  }
}

export async function apagarFoto(chave: string): Promise<void> {
  try {
    if (usaS3) {
      await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chave }));
    } else {
      await fs.unlink(path.join(DIR_LOCAL, chave));
    }
  } catch {
    /* apagar foto inexistente nao e erro */
  }
}

export function usandoBucket(): boolean {
  return usaS3;
}

export function descricaoArmazenamento(): string {
  // Sem o nome do bucket: a rota de saude e consultada sem autenticacao.
  return usaS3 ? "bucket S3 compativel" : "disco local (.storage/)";
}
