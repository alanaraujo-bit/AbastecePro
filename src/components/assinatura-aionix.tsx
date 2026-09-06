import { cn } from "@/lib/utils";

/**
 * Assinatura institucional: "Um produto" + AIONIX.
 *
 * Composicao: o simbolo oficial (SVG copiado de /marca sem uma alteracao
 * sequer) e a palavra AIONIX escrita com a tipografia do proprio sistema.
 *
 * RESSALVA REGISTRADA: o manual da marca diz que o logotipo "AIONIX" e
 * vetor exclusivo e nao deve ser recriado digitando o nome. Escrever a
 * palavra aqui contraria isso, e foi uma escolha consciente do dono da
 * marca — o lockup horizontal completo tem minimo de 100px de largura, e
 * nesta assinatura ele ficava grande demais. O simbolo, esse sim, e o
 * ativo oficial e existe justamente para tamanho pequeno (minimo 20px).
 * Para voltar ao lockup, troque este bloco por
 * `aionix-horizontal-cor{,-negativo}.svg` a 24px de altura.
 *
 * Duas variacoes do simbolo viajam juntas porque o app troca de tema por
 * classe (`.dark`), e nao por `prefers-color-scheme` — o usuario pode fixar
 * claro com o sistema no escuro, caso em que a media query erraria. A
 * escondida sai da arvore de acessibilidade, entao o leitor de tela le
 * "Um produto AIONIX" uma vez.
 *
 * Respiro: o manual pede 40% da altura do simbolo livre em volta. A 20px,
 * sao 8px — o espacamento abaixo respeita isso nos dois lados.
 */
export function AssinaturaAionix({ className }: { className?: string }) {
  return (
    <a
      href="https://www.aionixdev.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn("group inline-flex w-fit items-center gap-3", className)}
    >
      <span className="text-[0.6875rem] leading-none text-text-muted transition-colors duration-200 group-hover:text-text-secondary">
        Um produto
      </span>

      <span className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG de tamanho
            fixo servido de /public: nao ha o que o otimizador de imagem faca. */}
        <img
          src="/marca/aionix-simbolo-cor.svg"
          alt="AIONIX"
          width={156}
          height={160}
          className="h-5 w-auto dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- idem. */}
        <img
          src="/marca/aionix-simbolo-cor-negativo.svg"
          alt="AIONIX"
          width={156}
          height={160}
          className="hidden h-5 w-auto dark:block"
        />
        {/* Peso medio e cor secundaria: em corpo pequeno o branco puro dos
            titulos faz a assinatura competir com a marca do produto, que e
            exatamente o que ela nao pode fazer. */}
        <span
          aria-hidden
          className="text-xs font-medium leading-none tracking-[0.1em] text-text-secondary transition-colors duration-200 group-hover:text-text"
        >
          AIONIX
        </span>
      </span>
    </a>
  );
}
