import { redirect } from "next/navigation";
import { sessaoAtual, rotaInicial } from "@/lib/auth";
import { Marca, Wordmark } from "@/components/marca";
import { FormularioLogin } from "./form";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const u = await sessaoAtual();
  if (u) redirect(rotaInicial(u.papel));

  return (
    <main className="flex min-h-screen-app flex-col justify-center bg-bg px-5 py-10 safe-top safe-bottom">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Marca tamanho={56} className="text-brand" />
          <Wordmark className="mt-4 text-2xl" />
          <p className="mt-1.5 text-sm text-text-muted">
            Controle de abastecimentos
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-md)] sm:p-6">
          <FormularioLogin />
        </div>

        <p className="mt-8 text-center text-xs text-text-muted">
          Aionix · AbastecePro
        </p>
      </div>
    </main>
  );
}
