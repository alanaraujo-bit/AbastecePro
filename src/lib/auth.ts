import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

import { prisma } from "@/lib/db";
import { Papel } from "@/generated/prisma";

export const COOKIE_SESSAO = "ap_sess";
const DIAS_SESSAO = 30;

/* ---------- Senhas ---------- */

// Parametros OWASP para argon2id (19 MiB, 2 iteracoes, paralelismo 1).
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashSenha(senha: string): Promise<string> {
  return argonHash(senha, ARGON);
}

export async function verificarSenha(
  hash: string,
  senha: string,
): Promise<boolean> {
  try {
    return await argonVerify(hash, senha);
  } catch {
    return false;
  }
}

/* ---------- Tokens de sessao ---------- */

/**
 * O cookie carrega um token aleatorio; o banco guarda apenas o HMAC dele.
 * Assim um dump do banco nao permite forjar sessao, e a rotacao do
 * SESSION_SECRET invalida tudo de uma vez.
 */
function hashToken(token: string): string {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) throw new Error("SESSION_SECRET nao configurado");
  return crypto.createHmac("sha256", segredo).update(token).digest("hex");
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DIAS_SESSAO * 864e5);

  const h = await headers();
  await prisma.sessao.create({
    data: {
      tokenHash: hashToken(token),
      usuarioId,
      expiraEm,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ip: ipDaRequisicao(h),
    },
  });

  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_SESSAO * 86400,
  });
}

export function ipDaRequisicao(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 45);
  return h.get("x-real-ip")?.slice(0, 45) ?? null;
}

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  sessaoId: string;
};

/**
 * Le a sessao do cookie. Memoizado por requisicao (`cache`) para que varios
 * componentes possam chamar sem multiplicar consultas ao banco.
 *
 * A verificacao inclui `usuario.ativo`: desativar alguem no painel derruba
 * o acesso na proxima requisicao, sem esperar o token expirar.
 */
export const sessaoAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiraEm: true,
      revogadaEm: true,
      usuario: {
        select: { id: true, nome: true, email: true, papel: true, ativo: true },
      },
    },
  });

  if (!sessao) return null;
  if (sessao.revogadaEm) return null;
  if (sessao.expiraEm < new Date()) return null;
  if (!sessao.usuario.ativo) return null;

  return {
    id: sessao.usuario.id,
    nome: sessao.usuario.nome,
    email: sessao.usuario.email,
    papel: sessao.usuario.papel,
    sessaoId: sessao.id,
  };
});

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) {
    await prisma.sessao
      .updateMany({
        where: { tokenHash: hashToken(token), revogadaEm: null },
        data: { revogadaEm: new Date() },
      })
      .catch(() => {});
  }
  jar.delete(COOKIE_SESSAO);
}

/** Revoga todas as sessoes de um usuario (bloqueio/troca de senha). */
export async function revogarSessoesDoUsuario(usuarioId: string) {
  await prisma.sessao.updateMany({
    where: { usuarioId, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}

/* ---------- Guardas ---------- */

export async function exigirUsuario(): Promise<UsuarioSessao> {
  const u = await sessaoAtual();
  if (!u) redirect("/login");
  return u;
}

export async function exigirAdmin(): Promise<UsuarioSessao> {
  const u = await exigirUsuario();
  if (!podeAcessarAdmin(u.papel)) redirect("/operador");
  return u;
}

/**
 * Guarda das telas que definem a POLITICA (regras, usuarios, configuracao).
 *
 * Supervisor opera e autoriza excecoes, mas nao pode reescrever as regras
 * que limitam as proprias autorizacoes dele — isso anularia o controle.
 * Precisa ser aplicada tanto na pagina quanto em cada rota de mutacao:
 * proteger so a pagina esconde o botao, nao fecha o endpoint.
 */
export async function exigirConfigurador(): Promise<UsuarioSessao> {
  const u = await exigirUsuario();
  if (!podeConfigurar(u.papel)) redirect("/admin");
  return u;
}

/** Versao para rotas de API: devolve erro em vez de redirecionar. */
export async function exigirPapelApi(
  checagem: (p: Papel) => boolean,
): Promise<{ usuario: UsuarioSessao } | { erro: string; status: number }> {
  const u = await sessaoAtual();
  if (!u) return { erro: "Não autenticado.", status: 401 };
  if (!checagem(u.papel)) return { erro: "Sem permissão.", status: 403 };
  return { usuario: u };
}

/* ---------- Permissoes ---------- */

export function podeAcessarAdmin(papel: Papel): boolean {
  return papel === "ADMIN" || papel === "SUPERVISOR";
}

/** Liberar um atendimento que as regras bloquearam. */
export function podeAutorizarExcecao(papel: Papel): boolean {
  return papel === "ADMIN" || papel === "SUPERVISOR";
}

/** Configurar regras, usuarios e parametros do sistema. */
export function podeConfigurar(papel: Papel): boolean {
  return papel === "ADMIN";
}

export function rotaInicial(papel: Papel): string {
  return papel === "OPERADOR" ? "/operador" : "/admin";
}
