"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Fuel,
  Users,
  Car,
  SlidersHorizontal,
  ScrollText,
  BarChart3,
  UserCog,
  Menu,
  X,
  TicketCheck,
  Settings,
} from "lucide-react";
import { Marca, Wordmark } from "@/components/marca";
import { ThemeToggle } from "@/components/theme-toggle";
import { MenuUsuario } from "@/components/menu-usuario";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  rotulo: string;
  Icone: typeof Fuel;
};

const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Operação",
    itens: [
      // Primeiro item do painel de propósito: é o que se faz com alguém
      // esperando na frente da mesa. O resto é consulta.
      { href: "/admin/liberar", rotulo: "Liberar", Icone: TicketCheck },
      { href: "/admin", rotulo: "Dashboard", Icone: LayoutDashboard },
      { href: "/admin/abastecimentos", rotulo: "Liberações", Icone: Fuel },
    ],
  },
  {
    titulo: "Cadastro",
    itens: [
      { href: "/admin/pessoas", rotulo: "Pessoas", Icone: Users },
      { href: "/admin/veiculos", rotulo: "Veículos", Icone: Car },
    ],
  },
  {
    titulo: "Controle",
    itens: [
      {
        href: "/admin/regras",
        rotulo: "Regras",
        Icone: SlidersHorizontal,
      },
      { href: "/admin/auditoria", rotulo: "Auditoria", Icone: ScrollText },
      { href: "/admin/relatorios", rotulo: "Relatórios", Icone: BarChart3 },
      {
        href: "/admin/configuracoes",
        rotulo: "Configurações",
        Icone: Settings,
      },
      { href: "/admin/conta", rotulo: "Minha conta", Icone: UserCog },
    ],
  },
];

function ehAtivo(pathname: string, href: string): boolean {
  // "/admin" só casa exato, senão ficaria aceso em todas as subrotas.
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Links({ aoNavegar }: { aoNavegar?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3">
      {GRUPOS.map((grupo) => {
        return (
          <div key={grupo.titulo}>
            <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">
              {grupo.titulo}
            </p>
            <ul className="flex flex-col gap-0.5">
              {grupo.itens.map(({ href, rotulo, Icone }) => {
                const ativo = ehAtivo(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={aoNavegar}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-app px-3 text-[0.9375rem] font-medium transition-colors",
                        ativo
                          ? "bg-brand-soft text-brand-on-soft"
                          : "text-text-secondary hover:bg-surface-2 hover:text-text",
                      )}
                    >
                      <Icone className="size-4.5 shrink-0" />
                      {rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminNav({ nome, email }: { nome: string; email: string }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  // Trocar de rota fecha o menu: no celular ele cobre a tela inteira.
  useEffect(() => setAberto(false), [pathname]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto]);

  return (
    <>
      {/* ---------- Barra superior (só no mobile/tablet) ---------- */}
      <header className="safe-top sticky top-0 z-30 shrink-0 border-b border-border bg-bg-elevated/85 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            className="flex size-10 items-center justify-center rounded-app text-text-secondary transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
          >
            <Menu className="size-5" />
          </button>
          <Marca tamanho={26} className="text-brand" />
          <Wordmark className="text-[0.9375rem]" />
          <div className="ml-auto flex items-center gap-0.5">
            <ThemeToggle compacto />
            <MenuUsuario nome={nome} email={email} />
          </div>
        </div>
      </header>

      {/* ---------- Gaveta (mobile) ---------- */}
      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--overlay)] anim-fade"
            onClick={() => setAberto(false)}
            aria-hidden
          />
          <div className="safe-top absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-bg-elevated motion-safe:animate-[gaveta-in_240ms_var(--ease-out-app)]">
            <div className="flex h-14 items-center gap-2 px-4">
              <Marca tamanho={26} className="text-brand" />
              <Wordmark className="text-[0.9375rem]" />
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="ml-auto flex size-9 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="scroll-area safe-bottom flex-1 py-3">
              <Links aoNavegar={() => setAberto(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ---------- Barra lateral fixa (desktop) ----------
          Coluna própria que não rola com o conteúdo: no desktop o admin
          precisa de navegação sempre presente, não de um menu escondido. */}
      <aside className="hidden w-[264px] shrink-0 flex-col border-r border-border bg-bg-elevated lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <Marca tamanho={28} className="text-brand" />
          <Wordmark className="text-base" />
        </div>

        <div className="scroll-area flex-1 py-2">
          <Links />
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 px-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{nome}</p>
              <p className="truncate text-xs text-text-muted">{email}</p>
            </div>
            <ThemeToggle compacto />
            <MenuUsuario nome={nome} email={email} acima />
          </div>
        </div>
      </aside>
    </>
  );
}
