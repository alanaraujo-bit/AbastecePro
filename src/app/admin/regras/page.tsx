import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { PageHeader, Conteudo } from "@/components/admin/ui";
import { ListaRegras, type RegraCliente } from "./lista";

export const metadata = { title: "Regras" };
export const dynamic = "force-dynamic";

export default async function RegrasPage() {
  await exigirUsuario();

  const regras = await prisma.regra.findMany({
    orderBy: [{ ativo: "desc" }, { prioridade: "asc" }, { criadoEm: "asc" }],
    include: {
      alvoPessoa: { select: { id: true, nome: true } },
      alvoVeiculo: { select: { id: true, placa: true } },
    },
  });

  const itens: RegraCliente[] = regras.map((r) => ({
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    ativo: r.ativo,
    prioridade: r.prioridade,
    escopo: r.escopo,
    metrica: r.metrica,
    janela: r.janela,
    janelaHoras: r.janelaHoras,
    limite: Number(r.limite),
    acao: r.acao,
    mensagem: r.mensagem,
    alvoPessoaId: r.alvoPessoaId,
    alvoVeiculoId: r.alvoVeiculoId,
    alvoNome: r.alvoPessoa?.nome ?? r.alvoVeiculo?.placa ?? null,
  }));

  return (
    <>
      <PageHeader
        titulo="Regras de liberação"
        descricao="Definem quando um abastecimento é liberado ou bloqueado"
      />
      <Conteudo>
        <ListaRegras regras={itens} />
      </Conteudo>
    </>
  );
}
