import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Ban,
  ShieldAlert,
  AlertTriangle,
  User,
  Car,
  Clock,
  Gauge,
  MessageSquare,
  ScrollText,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { formatarPlaca } from "@/lib/placa";
import {
  dataHora,
  litros as fmtLitros,
  mascararTelefone,
  moeda,
  numero,
} from "@/lib/utils";
import { PageHeader, Conteudo, Card, Etiqueta, EtiquetaResultado } from "@/components/admin/ui";
import { FotoAtendimento } from "./foto";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await prisma.abastecimento.findUnique({
    where: { id },
    select: { placa: true },
  });
  return { title: a ? formatarPlaca(a.placa) : "Abastecimento" };
}

/** Formato do JSON gravado em `motivo` no momento da decisão. */
type MotivoGravado = {
  cadastrais?: {
    tipo: "PESSOA" | "VEICULO";
    nome: string;
    motivo: string | null;
    desde: string | null;
  }[];
  bloqueios?: LinhaRegra[];
  avisos?: LinhaRegra[];
};

type LinhaRegra = {
  regraId: string;
  nome: string;
  metrica: string;
  janela: string;
  limite: number;
  atual: number;
  restante: number;
  mensagem: string;
};

type SnapshotGravado = {
  avaliadoEm?: string;
  regras?: {
    id: string;
    nome: string;
    escopo: string;
    metrica: string;
    janela: string;
    janelaHoras: number | null;
    limite: number;
    acao: string;
  }[];
};

export default async function AbastecimentoDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdmin();
  const { id } = await params;

  const a = await prisma.abastecimento.findUnique({
    where: { id },
    include: {
      pessoa: { select: { id: true, nome: true, documento: true, telefone: true } },
      veiculo: { select: { id: true, placa: true, marca: true, modelo: true, cor: true } },
      operador: { select: { nome: true, email: true } },
      autorizadoPor: { select: { nome: true, email: true } },
    },
  });

  if (!a) notFound();

  const motivo = (a.motivo ?? null) as MotivoGravado | null;
  const snapshot = (a.regrasSnapshot ?? null) as SnapshotGravado | null;

  const bloqueios = motivo?.bloqueios ?? [];
  const avisos = motivo?.avisos ?? [];
  const cadastrais = motivo?.cadastrais ?? [];

  return (
    <>
      <PageHeader
        titulo={formatarPlaca(a.placa)}
        descricao={dataHora(a.criadoEm)}
        voltar={{ href: "/admin/abastecimentos", rotulo: "Abastecimentos" }}
        acoes={<EtiquetaResultado resultado={a.resultado} />}
      />

      <Conteudo className="grid gap-5 xl:grid-cols-[1.3fr_1fr] xl:items-start">
        <div className="flex flex-col gap-5">
          {/* ---------- Números do atendimento ---------- */}
          <Card titulo="Registro">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-3 sm:p-5">
              <Dado rotulo="Litros" valor={a.litros ? fmtLitros(a.litros) : "—"} destaque />
              <Dado rotulo="Valor" valor={a.valor ? moeda(a.valor) : "—"} destaque />
              <Dado
                rotulo="Preço por litro"
                valor={
                  a.litros && a.valor
                    ? moeda(Number(a.valor) / Number(a.litros))
                    : "—"
                }
              />
              <Dado rotulo="Combustível" valor={a.combustivel ?? "—"} />
              <Dado
                rotulo="Hodômetro"
                valor={a.hodometro ? `${numero(a.hodometro)} km` : "—"}
                Icone={Gauge}
              />
              <Dado rotulo="Operador" valor={a.operador.nome} />
            </dl>

            {a.observacao && (
              <div className="border-t border-border px-4 py-4 sm:px-5">
                <div className="flex items-center gap-2 text-text-muted">
                  <MessageSquare className="size-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Observação
                  </span>
                </div>
                <p className="mt-1.5 text-[0.9375rem] leading-snug selectable">
                  {a.observacao}
                </p>
              </div>
            )}
          </Card>

          {/* ---------- Por que foi bloqueado / autorizado ----------
              É aqui que o `motivo` estruturado deixa de ser dado guardado e
              vira resposta: qual regra pegou, qual era o teto, quanto já
              tinha sido consumido no instante da decisão. */}
          {(cadastrais.length > 0 || bloqueios.length > 0 || avisos.length > 0) && (
            <Card
              titulo={
                a.resultado === "AUTORIZADO_EXCECAO"
                  ? "Motivo do bloqueio (liberado por exceção)"
                  : a.resultado === "BLOQUEADO"
                    ? "Motivo do bloqueio"
                    : "Avisos no atendimento"
              }
            >
              <div className="flex flex-col gap-3 p-4 sm:p-5">
                {cadastrais.map((c, i) => (
                  <div
                    key={`${c.tipo}-${i}`}
                    className="rounded-app border border-danger/25 bg-danger-soft p-3.5"
                  >
                    <div className="flex items-center gap-2 text-danger">
                      <ShieldAlert className="size-4 shrink-0" />
                      <span className="text-sm font-semibold">
                        {c.tipo === "PESSOA"
                          ? "Pessoa bloqueada"
                          : "Veículo bloqueado"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[0.9375rem] font-medium">{c.nome}</p>
                    {c.motivo && (
                      <p className="mt-0.5 text-sm leading-snug text-text-secondary">
                        {c.motivo}
                      </p>
                    )}
                  </div>
                ))}

                {bloqueios.map((b) => (
                  <LinhaMotivo key={b.regraId} r={b} tom="bloqueio" />
                ))}
                {avisos.map((b) => (
                  <LinhaMotivo key={b.regraId} r={b} tom="aviso" />
                ))}
              </div>
            </Card>
          )}

          {/* ---------- Autorização excepcional ---------- */}
          {a.resultado === "AUTORIZADO_EXCECAO" && (
            <Card titulo="Autorização excepcional">
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-warn" />
                  <span className="text-[0.9375rem] font-medium">
                    {a.autorizadoPor?.nome ?? "—"}
                  </span>
                  <Etiqueta tom="warn">Exceção</Etiqueta>
                </div>
                {a.autorizadoPor?.email && (
                  <p className="mt-0.5 text-xs text-text-muted selectable">
                    {a.autorizadoPor.email}
                  </p>
                )}
                {a.justificativa && (
                  <p className="mt-3 rounded-app bg-warn-soft px-3.5 py-3 text-[0.9375rem] leading-snug selectable">
                    {a.justificativa}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* ---------- Snapshot das regras ----------
              O que estava valendo naquele instante. Sem isto, auditar uma
              decisão antiga falha se a regra tiver sido editada depois. */}
          {snapshot?.regras && snapshot.regras.length > 0 && (
            <Card titulo="Regras vigentes no momento da decisão">
              <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs text-text-muted">
                  <ScrollText className="size-3.5" />
                  Cópia registrada na decisão — não reflete edições posteriores.
                </p>
                <ul className="flex flex-col gap-1.5">
                  {snapshot.regras.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-app bg-surface-2 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{r.nome}</span>
                      <span className="text-text-muted">
                        {descreverRegra(r)}
                      </span>
                      {r.acao === "AVISAR" && (
                        <Etiqueta tom="warn">Aviso</Etiqueta>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}
        </div>

        {/* ---------- Coluna lateral ---------- */}
        <div className="flex flex-col gap-5">
          {a.fotoChave && (
            <Card titulo="Foto do atendimento">
              <div className="p-4 sm:p-5">
                <FotoAtendimento chave={a.fotoChave} placa={a.placa} />
              </div>
            </Card>
          )}

          <Card titulo="Condutor">
            {a.pessoa ? (
              <Link
                href={`/admin/pessoas/${a.pessoa.id}`}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-2 sm:p-5"
              >
                <User className="size-4 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-medium">
                    {a.pessoa.nome}
                  </p>
                  {a.pessoa.telefone && (
                    <p className="truncate text-sm text-text-muted">
                      {mascararTelefone(a.pessoa.telefone)}
                    </p>
                  )}
                </div>
              </Link>
            ) : (
              <p className="p-4 text-sm text-text-muted sm:p-5">
                Nenhuma pessoa vinculada a este registro.
              </p>
            )}
          </Card>

          <Card titulo="Veículo">
            {a.veiculo ? (
              <Link
                href={`/admin/veiculos/${a.veiculo.id}`}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-2 sm:p-5"
              >
                <Car className="size-4 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[0.9375rem] font-semibold tracking-wider">
                    {formatarPlaca(a.veiculo.placa)}
                  </p>
                  <p className="truncate text-sm text-text-muted">
                    {[a.veiculo.marca, a.veiculo.modelo, a.veiculo.cor]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </Link>
            ) : (
              <p className="p-4 text-sm text-text-muted sm:p-5">
                Veículo não cadastrado no momento do atendimento.
              </p>
            )}
          </Card>

          <Card titulo="Registro">
            <dl className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-text-muted" />
                <div>
                  <dt className="text-xs text-text-muted">Data e hora</dt>
                  <dd className="text-sm tabular-nums">{dataHora(a.criadoEm)}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Identificador</dt>
                <dd className="break-all font-mono text-xs text-text-secondary selectable">
                  {a.id}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </Conteudo>
    </>
  );
}

function Dado({
  rotulo,
  valor,
  destaque,
  Icone,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
  Icone?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        {Icone && <Icone className="size-3.5" />}
        {rotulo}
      </dt>
      <dd
        className={
          destaque
            ? "mt-1 text-lg font-semibold tabular-nums"
            : "mt-1 text-[0.9375rem] tabular-nums"
        }
      >
        {valor}
      </dd>
    </div>
  );
}

function LinhaMotivo({ r, tom }: { r: LinhaRegra; tom: "bloqueio" | "aviso" }) {
  const perigo = tom === "bloqueio";
  const pct =
    r.limite > 0 ? Math.min(100, (r.atual / r.limite) * 100) : 100;
  return (
    <div
      className={
        perigo
          ? "rounded-app border border-danger/25 bg-danger-soft p-3.5"
          : "rounded-app border border-warn/30 bg-warn-soft p-3.5"
      }
    >
      <div
        className={`flex items-center gap-2 ${perigo ? "text-danger" : "text-warn"}`}
      >
        {perigo ? (
          <Ban className="size-4 shrink-0" />
        ) : (
          <AlertTriangle className="size-4 shrink-0" />
        )}
        <span className="text-sm font-semibold">{r.nome}</span>
      </div>
      <p className="mt-1.5 text-[0.9375rem] leading-snug">{r.mensagem}</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={`h-full rounded-full ${perigo ? "bg-danger" : "bg-warn"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function descreverRegra(r: {
  escopo: string;
  metrica: string;
  janela: string;
  janelaHoras: number | null;
  limite: number;
}): string {
  const escopo =
    r.escopo === "PESSOA"
      ? "por pessoa"
      : r.escopo === "VEICULO"
        ? "por veículo"
        : "global";
  const metrica =
    r.metrica === "LITROS"
      ? `${r.limite} L`
      : r.metrica === "VALOR"
        ? moeda(r.limite)
        : `${r.limite} abastecimento(s)`;
  const janela =
    r.janela === "HORAS"
      ? `a cada ${r.janelaHoras ?? 24} h`
      : r.janela === "DIA"
        ? "por dia"
        : r.janela === "SEMANA"
          ? "por semana"
          : "por mês";
  return `${escopo} · ${metrica} ${janela}`;
}
