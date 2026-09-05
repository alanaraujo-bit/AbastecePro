import { exigirAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await exigirAdmin();

  return (
    // No mobile: barra no topo, conteúdo abaixo (coluna).
    // No desktop: barra lateral fixa à esquerda, conteúdo à direita (linha),
    // com a área de conteúdo rolando por conta própria — a moldura do app
    // nunca rola.
    <div className="flex h-screen-app flex-col overflow-hidden bg-bg lg:flex-row">
      <AdminNav nome={u.nome} email={u.email} papel={u.papel} />
      <main className="scroll-area min-h-0 flex-1">{children}</main>
    </div>
  );
}
