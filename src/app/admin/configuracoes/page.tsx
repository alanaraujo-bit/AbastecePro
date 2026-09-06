import { exigirUsuario } from "@/lib/auth";
import { lerConfig } from "@/lib/config";
import { FUSO_PADRAO } from "@/lib/regras/janelas";
import { descricaoArmazenamento } from "@/lib/storage";
import { PageHeader, Conteudo, Card } from "@/components/admin/ui";
import { AssinaturaAionix } from "@/components/assinatura-aionix";
import { FormularioConfig } from "./formulario";

export const metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await exigirUsuario();
  const config = await lerConfig();

  return (
    <>
      <PageHeader
        titulo="Configurações"
        descricao="Parâmetros que mudam o comportamento da liberação"
      />

      <Conteudo className="flex max-w-3xl flex-col gap-5">
        <FormularioConfig config={config} />

        {/* Informações de ambiente: não são editáveis aqui de propósito —
            são infraestrutura, e mudá-las é um deploy, não um clique. */}
        <Card titulo="Ambiente">
          <dl className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-sm text-text-secondary">Fuso do negócio</dt>
              <dd className="font-mono text-sm">{FUSO_PADRAO}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-sm text-text-secondary">
                Armazenamento de fotos
              </dt>
              <dd className="font-mono text-sm">{descricaoArmazenamento()}</dd>
            </div>
          </dl>
          <p className="border-t border-border px-4 py-3 text-xs leading-snug text-text-muted sm:px-5">
            Definidos por variável de ambiente (<code>TZ_NEGOCIO</code> e{" "}
            <code>S3_*</code>). O fuso é usado para calcular as janelas das
            regras — “por dia” significa o dia civil de quem opera o sistema, não
            o do servidor.
          </p>
        </Card>

        <AssinaturaAionix className="mt-2 self-start" />
      </Conteudo>
    </>
  );
}
