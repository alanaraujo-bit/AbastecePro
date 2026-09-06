import { redirect } from "next/navigation";
import { sessaoAtual, rotaInicial } from "@/lib/auth";
import { Marca, Wordmark } from "@/components/marca";
import { ThemeToggle } from "@/components/theme-toggle";
import { AssinaturaAionix } from "@/components/assinatura-aionix";
import { FormularioLogin } from "./form";
import { VitrineVeredito } from "./vitrine";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const u = await sessaoAtual();
  if (u) redirect(rotaInicial(u.papel));

  return (
    // O formulario vem primeiro no DOM: quem ja e cliente vem entrar, nao
    // ler. No desktop a grade recoloca o painel de marca a esquerda; no
    // celular ele desce para depois do formulario, onde nao atrapalha.
    <main className="grid min-h-screen-app grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      {/* ============ Coluna do acesso ============ */}
      <section className="safe-top safe-bottom flex flex-col px-5 py-8 sm:px-8 lg:col-start-2 lg:row-start-1 lg:px-12 lg:py-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <Marca tamanho={30} className="text-brand" />
            <Wordmark className="text-lg" />
          </div>
          <ThemeToggle compacto />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 lg:py-14">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.025em] text-text">
            Entrar
          </h1>

          <div className="mt-7">
            <FormularioLogin />
          </div>

          {/* Unica linha de apoio que sobrevive: nao ha fluxo de redefinicao,
              entao sem ela o usuario sem senha fica sem saida. */}
          <p className="mt-6 text-sm text-text-muted">
            Esqueceu a senha? Peça a um administrador.
          </p>
        </div>

        {/* Canto inferior direito da tela. No celular, onde as colunas
            empilham, ela fecha o bloco de acesso — continua a direita. */}
        <AssinaturaAionix className="self-end" />
      </section>

      {/* ============ Painel de marca ============ */}
      <aside className="painel-marca safe-bottom relative flex flex-col overflow-hidden border-t border-border px-5 py-12 sm:px-8 lg:col-start-1 lg:row-start-1 lg:border-r lg:border-t-0 lg:px-14 lg:py-12">
        <div className="relative hidden items-center gap-2.5 lg:flex">
          <Marca tamanho={32} className="text-brand" />
          <Wordmark className="text-xl" />
        </div>

        <div className="relative mx-auto my-auto flex w-full max-w-[26rem] flex-col pt-10 lg:mx-0 lg:pt-12">
          <h2 className="text-[2rem] font-bold leading-[1.08] tracking-[-0.035em] text-text sm:text-[2.5rem] lg:text-[2.75rem]">
            Toda bomba, uma decisão.
            <br />
            <span className="text-brand">Registrada.</span>
          </h2>
          <p className="mt-4 max-w-[32ch] text-[1.0625rem] leading-relaxed text-text-secondary">
            A placa basta. A resposta vem antes de encostar a mangueira — e o
            atendimento inteiro fica registrado.
          </p>

          <VitrineVeredito className="mt-9" />
        </div>
      </aside>
    </main>
  );
}
