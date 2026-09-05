import { prisma } from "@/lib/db";
import { exigirConfigurador } from "@/lib/auth";
import { PageHeader, Conteudo } from "@/components/admin/ui";
import { ListaUsuarios, type UsuarioCliente } from "./lista";

export const metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const eu = await exigirConfigurador();

  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      ativo: true,
      criadoEm: true,
      _count: { select: { abastecimentos: true } },
      sessoes: {
        where: { revogadaEm: null, expiraEm: { gt: new Date() } },
        orderBy: { usadaEm: "desc" },
        take: 1,
        select: { usadaEm: true },
      },
    },
  });

  const itens: UsuarioCliente[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    ativo: u.ativo,
    criadoEm: u.criadoEm.toISOString(),
    atendimentos: u._count.abastecimentos,
    ultimoAcesso: u.sessoes[0]?.usadaEm.toISOString() ?? null,
    ehEuMesmo: u.id === eu.id,
  }));

  return (
    <>
      <PageHeader
        titulo="Usuários"
        descricao="Quem acessa o sistema e com qual permissão"
      />
      <Conteudo>
        <ListaUsuarios usuarios={itens} />
      </Conteudo>
    </>
  );
}
