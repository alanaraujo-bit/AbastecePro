import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Conteudo } from "@/components/admin/ui";
import { FormularioConta } from "./formulario";

export const metadata = { title: "Minha conta" };
export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const eu = await exigirUsuario();

  const [usuario, outrasSessoes] = await Promise.all([
    prisma.usuario.findUniqueOrThrow({
      where: { id: eu.id },
      select: { nome: true, email: true, criadoEm: true },
    }),
    // Sessões vivas em OUTROS aparelhos. É o número que responde à pergunta
    // "deixei isso aberto em algum lugar?" — a única forma de saber, já que
    // a sessão é uma linha no banco e não um token solto.
    prisma.sessao.count({
      where: {
        usuarioId: eu.id,
        revogadaEm: null,
        expiraEm: { gt: new Date() },
        id: { not: eu.sessaoId },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        titulo="Minha conta"
        descricao="O sistema tem um único acesso — este"
      />
      <Conteudo className="max-w-2xl">
        <FormularioConta
          nome={usuario.nome}
          email={usuario.email}
          outrasSessoes={outrasSessoes}
        />
      </Conteudo>
    </>
  );
}
