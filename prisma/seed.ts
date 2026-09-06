/**
 * Semeia o banco com um conjunto coerente para demonstracao e validacao.
 *
 * E idempotente: pode rodar quantas vezes for preciso sem duplicar nada.
 * Os dados sao ficticios, mas o formato e real (placas nos dois padroes,
 * CPFs validos, historico com datas plausiveis) para que a demonstracao
 * exercite as regras de verdade.
 */
import { PrismaClient, Papel, TipoVeiculo } from "../src/generated/prisma";
import { hash as argonHash } from "@node-rs/argon2";

const prisma = new PrismaClient();
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/**
 * A CONTA. Uma so.
 *
 * O sistema nao tem cadastro de usuarios nem recuperacao de senha por
 * e-mail — quem opera e uma pessoa, e a rota de criacao foi removida de
 * proposito. Por isso este upsert e tambem o caminho de recuperacao:
 * perdeu a senha, roda `npm run db:seed` no servidor e ela volta a ser a
 * daqui. A coluna `papel` continua no banco por compatibilidade com os
 * registros antigos, mas nenhum codigo a le.
 */
const DONO = {
  nome: "Alan Araújo",
  email: "admin@aionix.com.br",
  senha: "Admin@2026",
  papel: Papel.ADMIN,
};

const PESSOAS = [
  { nome: "João Batista Ferreira", documento: "52998224725", telefone: "11987654321" },
  { nome: "Maria Aparecida Souza", documento: "16899535009", telefone: "11976543210" },
  { nome: "Rafael Lima Costa", documento: "11144477735", telefone: "21965432109" },
  { nome: "Patrícia Gomes Alves", documento: "12345678909", telefone: "31954321098" },
  { nome: "Eduardo Tavares", documento: "39053344705", telefone: "41943210987" },
  { nome: "Luciana Prado", documento: "48746127808", telefone: "51932109876" },
  { nome: "Marcos Vinícius Rocha", documento: "77373463302", telefone: "62921098765" },
  {
    nome: "Sandra Regina Dias",
    documento: "23554835048",
    telefone: "71910987654",
    bloqueado: true,
    motivoBloqueio: "Pendência financeira em aberto com a empresa.",
  },
];

const VEICULOS = [
  { placa: "RQP2A18", modelo: "Strada", marca: "Fiat", cor: "Branco", ano: 2022, tipo: TipoVeiculo.CARRO },
  { placa: "FLK7823", modelo: "Saveiro", marca: "Volkswagen", cor: "Prata", ano: 2019, tipo: TipoVeiculo.CARRO },
  { placa: "GHT4C09", modelo: "Hilux", marca: "Toyota", cor: "Preto", ano: 2023, tipo: TipoVeiculo.CARRO },
  { placa: "MNB5432", modelo: "Constellation", marca: "Volkswagen", cor: "Branco", ano: 2018, tipo: TipoVeiculo.CAMINHAO },
  { placa: "PWE1D34", modelo: "Ducato", marca: "Fiat", cor: "Branco", ano: 2021, tipo: TipoVeiculo.OUTRO },
  { placa: "JKL9087", modelo: "CG 160", marca: "Honda", cor: "Vermelho", ano: 2020, tipo: TipoVeiculo.MOTO },
  { placa: "TYU6B72", modelo: "Ranger", marca: "Ford", cor: "Cinza", ano: 2022, tipo: TipoVeiculo.CARRO },
  {
    placa: "ZXC3456",
    modelo: "Retroescavadeira",
    marca: "Case",
    cor: "Amarelo",
    ano: 2017,
    tipo: TipoVeiculo.MAQUINA,
    bloqueado: true,
    motivoBloqueio: "Veículo em manutenção — abastecimento suspenso pela frota.",
  },
];

/*
 * As regras contam LIBERACOES. Litros e valor sairam do modelo: quem
 * libera entrega um papel e nunca ve a bomba, entao uma regra de volume
 * nao teria o que medir — e regra que nao mede libera sempre.
 */
const REGRAS = [
  {
    nome: "Uma liberação por veículo a cada 30 dias",
    descricao:
      "Regra principal: cada veículo recebe um papel por mês. Ajuste o intervalo conforme a política real.",
    escopo: "VEICULO" as const,
    metrica: "ABASTECIMENTOS" as const,
    janela: "HORAS" as const,
    janelaHoras: 720,
    limite: 1,
    acao: "BLOQUEAR" as const,
    prioridade: 10,
    mensagem:
      "Este veículo já foi liberado nos últimos 30 dias. Limite: {limite} por período.",
  },
  {
    nome: "Uma liberação por pessoa no mês",
    descricao:
      "Impede que a mesma pessoa retire papéis para vários veículos no mesmo mês civil.",
    escopo: "PESSOA" as const,
    metrica: "ABASTECIMENTOS" as const,
    janela: "MES" as const,
    limite: 1,
    acao: "BLOQUEAR" as const,
    prioridade: 20,
    mensagem: "Esta pessoa já foi atendida neste mês.",
  },
  {
    nome: "Aviso de volume de liberações no dia",
    descricao:
      "Não bloqueia: apenas alerta quando o dia passa de 30 papéis emitidos.",
    escopo: "GLOBAL" as const,
    metrica: "ABASTECIMENTOS" as const,
    janela: "DIA" as const,
    limite: 30,
    acao: "AVISAR" as const,
    prioridade: 90,
    mensagem: "Já foram emitidas mais de {limite} liberações hoje.",
  },
];

async function main() {
  console.log("→ conta");
  const senhaHash = await argonHash(DONO.senha, ARGON);
  // A senha volta ao padrao a cada execucao: e isso que faz do seed um
  // caminho de recuperacao, e nao so um preenchimento inicial.
  const dono = await prisma.usuario.upsert({
    where: { email: DONO.email },
    update: { nome: DONO.nome, ativo: true, senhaHash },
    create: {
      nome: DONO.nome,
      email: DONO.email,
      papel: DONO.papel,
      senhaHash,
    },
  });

  /*
   * Contas do modelo antigo (operador, supervisor) NÃO podem continuar
   * vivas. Quando havia papéis, elas viam menos que o admin; agora que a
   * permissão acabou, autenticado é autorizado — uma conta de operador
   * esquecida passaria a abrir o painel inteiro. É escalação de privilégio
   * criada pela própria mudança de modelo.
   *
   * Desativar em vez de apagar: elas assinam abastecimentos antigos
   * (`operadorId`), e apagá-las levaria junto o histórico. `ativo: false`
   * fecha o acesso e `sessaoAtual()` verifica isso a cada requisição.
   */
  const antigas = await prisma.usuario.updateMany({
    where: { email: { not: DONO.email }, ativo: true },
    data: { ativo: false },
  });
  if (antigas.count > 0) {
    // Desativar sozinho não derruba quem já está dentro até a próxima
    // requisição; revogar a sessão fecha a porta no mesmo instante.
    const sessoes = await prisma.sessao.updateMany({
      where: { usuario: { email: { not: DONO.email } }, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
    console.log(
      `   ${antigas.count} conta(s) antiga(s) desativada(s), ${sessoes.count} sessão(ões) revogada(s)`,
    );
  }

  console.log("→ pessoas");
  for (const p of PESSOAS) {
    await prisma.pessoa.upsert({
      where: { documento: p.documento },
      update: {},
      create: {
        ...p,
        bloqueadoEm: p.bloqueado ? new Date() : null,
      },
    });
  }

  console.log("→ veículos");
  for (const v of VEICULOS) {
    await prisma.veiculo.upsert({
      where: { placa: v.placa },
      update: {},
      create: { ...v, bloqueadoEm: v.bloqueado ? new Date() : null },
    });
  }

  console.log("→ vínculos");
  const pessoas = await prisma.pessoa.findMany({ orderBy: { criadoEm: "asc" } });
  const veiculos = await prisma.veiculo.findMany({ orderBy: { criadoEm: "asc" } });
  for (let i = 0; i < veiculos.length; i++) {
    const pessoa = pessoas[i % pessoas.length];
    await prisma.vinculo.upsert({
      where: {
        pessoaId_veiculoId: { pessoaId: pessoa.id, veiculoId: veiculos[i].id },
      },
      update: {},
      create: { pessoaId: pessoa.id, veiculoId: veiculos[i].id, principal: true },
    });
  }
  // Um veiculo com dois condutores: o operador precisa poder escolher.
  if (veiculos[0] && pessoas[1]) {
    await prisma.vinculo.upsert({
      where: {
        pessoaId_veiculoId: { pessoaId: pessoas[1].id, veiculoId: veiculos[0].id },
      },
      update: {},
      create: { pessoaId: pessoas[1].id, veiculoId: veiculos[0].id },
    });
  }

  console.log("→ regras");
  // Regras da época em que o sistema anotava a bomba: medem litros ou
  // valor, números que ninguém mais informa. Ficariam ativas sem nunca
  // disparar — controle aparente é pior do que controle nenhum.
  const orfas = await prisma.regra.deleteMany({
    where: { metrica: { in: ["LITROS", "VALOR"] } },
  });
  if (orfas.count > 0) {
    console.log(`   ${orfas.count} regra(s) de litros/valor removida(s)`);
  }
  // Regras de seed com os nomes antigos: ficariam ativas em paralelo com as
  // novas e o veredito passaria a citar a regra errada.
  await prisma.regra.deleteMany({
    where: {
      nome: {
        in: [
          "Um abastecimento por veículo ao dia",
          "Intervalo mínimo de 6 horas",
          "Teto semanal de 200 L por pessoa",
        ],
      },
    },
  });
  for (const r of REGRAS) {
    const existente = await prisma.regra.findFirst({ where: { nome: r.nome } });
    if (existente) {
      await prisma.regra.update({ where: { id: existente.id }, data: r });
    } else {
      await prisma.regra.create({ data: r });
    }
  }

  // Regra dirigida a UM veículo: mostra que dá para apertar o limite de um
  // registro específico sem mexer na política geral.
  const ducato = veiculos.find((v) => v.placa === "PWE1D34");
  if (ducato) {
    const nomeRegra = "Limite reforçado do Ducato";
    const dados = {
      nome: nomeRegra,
      descricao:
        "Exemplo de regra dirigida: vale só para este veículo, sem alterar a política geral.",
      escopo: "VEICULO" as const,
      metrica: "ABASTECIMENTOS" as const,
      janela: "HORAS" as const,
      janelaHoras: 1440,
      limite: 1,
      acao: "AVISAR" as const,
      prioridade: 50,
      alvoVeiculoId: ducato.id,
      mensagem:
        "Este veículo já foi liberado nos últimos 60 dias. Confirme com a frota.",
    };
    const existe = await prisma.regra.findFirst({ where: { nome: nomeRegra } });
    if (existe) await prisma.regra.update({ where: { id: existe.id }, data: dados });
    else await prisma.regra.create({ data: dados });
  }

  console.log("→ histórico");

  // Regerar o histórico quando pedido: RESEED=1 npm run db:seed
  if (process.env.RESEED === "1") {
    const apagados = await prisma.abastecimento.deleteMany({
      where: { chaveIdempotencia: { startsWith: "seed-" } },
    });
    console.log(`   ${apagados.count} registros de seed removidos`);
  }

  // Registros feitos a mão durante testes não podem impedir a regeração:
  // o que importa é se o histórico DE SEED existe.
  const jaTem = await prisma.abastecimento.count({
    where: { chaveIdempotencia: { startsWith: "seed-" } },
  });
  if (jaTem === 0) {
    /*
     * O histórico precisa ser COERENTE COM AS REGRAS que ele demonstra.
     *
     * A regra principal é "uma liberação por veículo a cada 30 dias". Um
     * passado com o mesmo veículo aparecendo toda semana mostraria um
     * sistema que contradiz a própria política — e abriria a demonstração
     * com quase toda placa bloqueada, escondendo o caminho feliz.
     *
     * Por isso: uma liberação por veículo. Metade delas há mais de 30 dias
     * (placa livre hoje) e metade dentro da janela (placa bloqueada), para
     * que os dois caminhos apareçam já na primeira consulta.
     */
    const condutorDoVeiculo = new Map<string, string>();
    for (const v of veiculos) {
      const vinculo = await prisma.vinculo.findFirst({ where: { veiculoId: v.id } });
      if (vinculo) condutorDoVeiculo.set(v.id, vinculo.pessoaId);
    }

    const registros: {
      chaveIdempotencia: string;
      pessoaId: string;
      veiculoId: string;
      operadorId: string;
      placa: string;
      resultado: "LIBERADO";
      criadoEm: Date;
    }[] = [];
    veiculos.forEach((v, i) => {
      const pessoaId = condutorDoVeiculo.get(v.id);
      if (!pessoaId) return;
      // Pares: liberação recente (ainda dentro dos 30 dias, bloqueia).
      // Ímpares: liberação antiga (janela vencida, libera).
      const diasAtras =
        i % 2 === 0
          ? 3 + Math.floor(Math.random() * 20)
          : 38 + Math.floor(Math.random() * 40);
      const quando = new Date();
      quando.setDate(quando.getDate() - diasAtras);
      quando.setHours(
        8 + Math.floor(Math.random() * 9),
        Math.floor(Math.random() * 60),
        0,
        0,
      );
      registros.push({
        chaveIdempotencia: `seed-${v.id}`,
        pessoaId,
        veiculoId: v.id,
        operadorId: dono.id,
        placa: v.placa,
        resultado: "LIBERADO" as const,
        criadoEm: quando,
      });
    });
    await prisma.abastecimento.createMany({ data: registros, skipDuplicates: true });
    console.log(`   ${registros.length} liberações`);
  } else {
    console.log(`   ${jaTem} já existentes (use RESEED=1 para regerar)`);
  }

  console.log("\n✓ seed concluído\n");
  console.log(`   acesso: ${DONO.email}   senha: ${DONO.senha}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
