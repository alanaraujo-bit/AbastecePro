import Link from "next/link";
import { Users, Ban, Car } from "lucide-react";

import { prisma } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { soDigitos, mascararCpf, mascararTelefone, numero, iniciais } from "@/lib/utils";
import {
  PageHeader,
  Conteudo,
  Card,
  Vazio,
  Etiqueta,
} from "@/components/admin/ui";
import { BuscaFiltro, AbasFiltro, Paginacao } from "@/components/admin/filtros";
import { FormularioPessoa } from "./formulario";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Pessoas" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirAdmin();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const situacao = sp.situacao ?? "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const where: Prisma.PessoaWhereInput = {};
  if (q) {
    const digitos = soDigitos(q);
    where.OR = [
      { nome: { contains: q, mode: "insensitive" } },
      ...(digitos.length >= 3
        ? [
            { telefone: { contains: digitos } },
            { documento: { contains: digitos } },
          ]
        : []),
    ];
  }
  if (situacao === "bloqueados") where.bloqueado = true;
  if (situacao === "inativos") where.ativo = false;
  if (situacao === "ativos") where.ativo = true;

  const [total, pessoas] = await Promise.all([
    prisma.pessoa.count({ where }),
    prisma.pessoa.findMany({
      where,
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        nome: true,
        documento: true,
        telefone: true,
        bloqueado: true,
        ativo: true,
        _count: { select: { vinculos: true, abastecimentos: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        titulo="Pessoas"
        descricao={total > 0 ? `${numero(total)} cadastrada(s)` : undefined}
        acoes={<FormularioPessoa />}
      />

      <Conteudo className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <BuscaFiltro placeholder="Nome, telefone ou CPF" />
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <AbasFiltro
            chave="situacao"
            opcoes={[
              { valor: "", rotulo: "Todas" },
              { valor: "ativos", rotulo: "Ativas" },
              { valor: "bloqueados", rotulo: "Bloqueadas" },
              { valor: "inativos", rotulo: "Inativas" },
            ]}
          />
        </div>

        <Card>
          {pessoas.length === 0 ? (
            <Vazio
              Icone={Users}
              titulo="Nenhuma pessoa encontrada"
              descricao={
                q || situacao
                  ? "Nenhum cadastro corresponde aos filtros aplicados."
                  : "Cadastre as pessoas autorizadas a abastecer."
              }
            />
          ) : (
            <>
              <ul>
                {pessoas.map((p, i) => (
                  <li
                    key={p.id}
                    className={i > 0 ? "border-t border-border" : undefined}
                  >
                    <Link
                      href={`/admin/pessoas/${p.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[0.8125rem] font-semibold text-text-secondary"
                        aria-hidden
                      >
                        {iniciais(p.nome)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[0.9375rem] font-medium">
                            {p.nome}
                          </span>
                          {p.bloqueado && (
                            <Etiqueta tom="danger">
                              <Ban className="size-3" />
                              Bloqueada
                            </Etiqueta>
                          )}
                          {!p.ativo && <Etiqueta>Inativa</Etiqueta>}
                        </div>
                        <p className="truncate text-sm text-text-muted">
                          {[
                            p.documento ? mascararCpf(p.documento) : null,
                            p.telefone ? mascararTelefone(p.telefone) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Sem contato cadastrado"}
                        </p>
                      </div>

                      <div className="hidden shrink-0 items-center gap-4 text-sm tabular-nums text-text-muted sm:flex">
                        <span className="flex items-center gap-1">
                          <Car className="size-3.5" />
                          {p._count.vinculos}
                        </span>
                        <span className="w-24 text-right">
                          {numero(p._count.abastecimentos)} abast.
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} />
            </>
          )}
        </Card>
      </Conteudo>
    </>
  );
}
