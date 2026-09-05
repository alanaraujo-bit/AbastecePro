import { exigirUsuario, podeAcessarAdmin } from "@/lib/auth";
import { Marca, Wordmark } from "@/components/marca";
import { ThemeToggle } from "@/components/theme-toggle";
import { MenuUsuario } from "@/components/menu-usuario";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";

export default async function OperadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await exigirUsuario();

  return (
    // h-screen-app + overflow-hidden: a moldura do app nunca rola.
    // Só o conteúdo interno rola, como em aplicativo nativo.
    <div className="flex h-screen-app flex-col overflow-hidden bg-bg">
      <header className="safe-top z-20 shrink-0 border-b border-border bg-bg-elevated/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-3">
          <Marca tamanho={28} className="text-brand" />
          <Wordmark className="text-[0.9375rem]" />

          <div className="ml-auto flex items-center gap-0.5">
            {podeAcessarAdmin(u.papel) && (
              <Link
                href="/admin"
                aria-label="Ir para o painel administrativo"
                className="flex size-10 items-center justify-center rounded-app text-text-secondary transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
              >
                <LayoutGrid className="size-5" />
              </Link>
            )}
            <ThemeToggle compacto />
            <MenuUsuario nome={u.nome} papel={u.papel} email={u.email} />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
