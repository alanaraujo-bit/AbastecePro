import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * Configurações do sistema.
 *
 * Só entram aqui parâmetros que MUDAM COMPORTAMENTO de verdade. Um painel
 * cheio de opções que não fazem nada é pior do que nenhum painel: dá a
 * impressão de controle que não existe.
 *
 * O fuso do negócio deliberadamente NÃO está aqui — é infraestrutura, muda
 * praticamente nunca, e colocá-lo no banco obrigaria a uma leitura extra
 * dentro do caminho crítico de avaliação de regras. Ele vem de `TZ_NEGOCIO`.
 */
export type Configuracoes = {
  /** Aparece no painel, no comprovante e no cabeçalho dos relatórios. */
  organizacao: string;
};

export const CONFIG_PADRAO: Configuracoes = {
  organizacao: "AbastecePro",
};

const CHAVE = "geral";

/**
 * Lê as configurações. Memoizado por requisição para que várias telas
 * possam consultar sem multiplicar idas ao banco.
 *
 * Nunca lança: se a leitura falhar, o sistema opera com os padrões em vez
 * de derrubar o atendimento.
 */
export const lerConfig = cache(async (): Promise<Configuracoes> => {
  try {
    const linha = await prisma.config.findUnique({ where: { chave: CHAVE } });
    if (!linha) return CONFIG_PADRAO;
    return { ...CONFIG_PADRAO, ...(linha.valor as Partial<Configuracoes>) };
  } catch {
    return CONFIG_PADRAO;
  }
});

export async function salvarConfig(valores: Configuracoes): Promise<void> {
  await prisma.config.upsert({
    where: { chave: CHAVE },
    update: { valor: valores as never },
    create: { chave: CHAVE, valor: valores as never },
  });
}
