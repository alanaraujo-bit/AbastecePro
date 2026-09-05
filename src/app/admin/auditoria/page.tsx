import {
  ScrollText,
  LogIn,
  LogOut,
  ShieldAlert,
  Fuel,
  Ban,
  SlidersHorizontal,
  UserCog,
  Users,
  Car,
  Link2,
  Download,
  AlertTriangle,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { dataHora, numero, tempoRelativo } from "@/lib/utils";
import { PageHeader, Conteudo, Card, Vazio, Etiqueta } from "@/components/admin/ui";
import { BuscaFiltro, AbasFiltro, Paginacao } from "@/components/admin/filtros";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 40;

/**
 * Tradução das ações para linguagem de quem lê.
 *
 * A auditoria só serve se for legível: `regra.editar` não conta uma
 * história, "Editou uma regra" conta.
 */
const ACOES: Record<
  string,
  { rotulo: string; Icone: typeof ScrollText; tom?: "danger" | "warn" | "ok" }
> = {
  "sessao.entrar": { rotulo: "Entrou no sistema", Icone: LogIn },
  "sessao.sair": { rotulo: "Saiu do sistema", Icone: LogOut },
  "sessao.falha": {
    rotulo: "Tentativa de acesso recusada",
    Icone: AlertTriangle,
    tom: "warn",
  },
  "abastecimento.liberado": { rotulo: "Registrou abastecimento", Icone: Fuel, tom: "ok" },
  "abastecimento.bloqueado": { rotulo: "Atendimento bloqueado", Icone: Ban, tom: "danger" },
  "abastecimento.autorizar": {
    rotulo: "Autorizou exceção",
    Icone: ShieldAlert,
    tom: "warn",
  },
  "regra.criar": { rotulo: "Criou uma regra", Icone: SlidersHorizontal },
  "regra.editar": { rotulo: "Editou uma regra", Icone: SlidersHorizontal, tom: "warn" },
  "regra.excluir": { rotulo: "Excluiu uma regra", Icone: SlidersHorizontal, tom: "danger" },
  "regra.ativar": { rotulo: "Ativou uma regra", Icone: SlidersHorizontal },
  "regra.desativar": { rotulo: "Desativou uma regra", Icone: SlidersHorizontal, tom: "warn" },
  "pessoa.criar": { rotulo: "Cadastrou pessoa", Icone: Users },
  "pessoa.editar": { rotulo: "Editou pessoa", Icone: Users },
  "pessoa.bloquear": { rotulo: "Bloqueou pessoa", Icone: Ban, tom: "danger" },
  "pessoa.desbloquear": { rotulo: "Desbloqueou pessoa", Icone: Users, tom: "ok" },
  "pessoa.desativar": { rotulo: "Desativou pessoa", Icone: Users, tom: "warn" },
  "pessoa.excluir": { rotulo: "Excluiu pessoa", Icone: Users, tom: "danger" },
  "veiculo.criar": { rotulo: "Cadastrou veículo", Icone: Car },
  "veiculo.editar": { rotulo: "Editou veículo", Icone: Car },
  "veiculo.bloquear": { rotulo: "Bloqueou veículo", Icone: Ban, tom: "danger" },
  "veiculo.desbloquear": { rotulo: "Desbloqueou veículo", Icone: Car, tom: "ok" },
  "veiculo.desativar": { rotulo: "Desativou veículo", Icone: Car, tom: "warn" },
  "veiculo.excluir": { rotulo: "Excluiu veículo", Icone: Car, tom: "danger" },
  "vinculo.criar": { rotulo: "Vinculou condutor", Icone: Link2 },
  "vinculo.remover": { rotulo: "Removeu vínculo", Icone: Link2, tom: "warn" },
  "usuario.criar": { rotulo: "Criou usuário", Icone: UserCog, tom: "warn" },
  "usuario.editar": { rotulo: "Editou usuário", Icone: UserCog, tom: "warn" },
  "cadastro.rapido": { rotulo: "Cadastro rápido na pista", Icone: Car },
  "relatorio.exportar": { rotulo: "Exportou relatório", Icone: Download },
};

/** Frase curta com o alvo da ação, extraída do JSON gravado. */
function detalhe(dados: unknown): string | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as Record<string, unknown>;
  const partes: string[] = [];

  if (typeof d.nome === "string") partes.push(d.nome);
  if (typeof d.placa === "string") partes.push(d.placa);
  if (typeof d.email === "string" && !partes.length) partes.push(d.email);
  if (typeof d.motivo === "string" && d.motivo) partes.push(`“${d.motivo}”`);
  if (typeof d.justificativa === "string" && d.justificativa)
    partes.push(`“${d.justificativa}”`);
  if (typeof d.linhas === "number") partes.push(`${d.linhas} linha(s)`);

  const antes = d.antes as Record<string, unknown> | undefined;
  const depois = d.depois as Record<string, unknown> | undefined;
  if (antes?.nome && depois?.nome) {
    partes.push(String(depois.nome));
    if (antes.limite !== undefined && antes.limite !== depois?.limite) {
      partes.push(`limite ${antes.limite} → ${depois?.limite}`);
    }
    if (antes.papel && antes.papel !== depois?.papel) {
      partes.push(`${antes.papel} → ${depois?.papel}`);
    }
  }

  return partes.length ? partes.join(" · ") : null;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirAdmin();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const entidade = sp.entidade ?? "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const where: Prisma.AuditoriaWhereInput = {};
  if (entidade) where.entidade = entidade;
  if (q) {
    where.OR = [
      { acao: { contains: q, mode: "insensitive" } },
      { usuario: { nome: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, registros] = await Promise.all([
    prisma.auditoria.count({ where }),
    prisma.auditoria.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        acao: true,
        entidade: true,
        entidadeId: true,
        dados: true,
        ip: true,
        criadoEm: true,
        usuario: { select: { nome: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        titulo="Auditoria"
        descricao={
          total > 0 ? `${numero(total)} evento(s) registrado(s)` : undefined
        }
      />

      <Conteudo className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <BuscaFiltro placeholder="Ação ou usuário" />
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <AbasFiltro
            chave="entidade"
            opcoes={[
              { valor: "", rotulo: "Tudo" },
              { valor: "abastecimento", rotulo: "Abastecimentos" },
              { valor: "regra", rotulo: "Regras" },
              { valor: "pessoa", rotulo: "Pessoas" },
              { valor: "veiculo", rotulo: "Veículos" },
              { valor: "usuario", rotulo: "Acessos" },
            ]}
          />
        </div>

        <Card>
          {registros.length === 0 ? (
            <Vazio
              Icone={ScrollText}
              titulo="Nenhum evento encontrado"
              descricao="Toda ação relevante do sistema é registrada aqui automaticamente."
            />
          ) : (
            <>
              <ul>
                {registros.map((r, i) => {
                  const meta = ACOES[r.acao] ?? {
                    rotulo: r.acao,
                    Icone: ScrollText,
                  };
                  const Icone = meta.Icone;
                  const info = detalhe(r.dados);
                  return (
                    <li
                      key={r.id}
                      className={
                        i > 0
                          ? "flex items-start gap-3 border-t border-border px-4 py-3 sm:px-5"
                          : "flex items-start gap-3 px-4 py-3 sm:px-5"
                      }
                    >
                      <span
                        className={
                          meta.tom === "danger"
                            ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
                            : meta.tom === "warn"
                              ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn"
                              : meta.tom === "ok"
                                ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok"
                                : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted"
                        }
                        aria-hidden
                      >
                        <Icone className="size-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="text-[0.9375rem] font-medium">
                            {meta.rotulo}
                          </span>
                          {r.usuario && (
                            <span className="text-sm text-text-secondary">
                              por {r.usuario.nome}
                            </span>
                          )}
                          {!r.usuario && (
                            <Etiqueta>sem usuário</Etiqueta>
                          )}
                        </div>
                        {info && (
                          <p className="mt-0.5 break-words text-sm leading-snug text-text-muted">
                            {info}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs tabular-nums text-text-muted">
                          {tempoRelativo(r.criadoEm)}
                        </p>
                        <p className="hidden text-[0.6875rem] tabular-nums text-text-muted sm:block">
                          {dataHora(r.criadoEm)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} />
            </>
          )}
        </Card>
      </Conteudo>
    </>
  );
}
