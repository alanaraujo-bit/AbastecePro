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

const USUARIOS = [
  {
    nome: "Alan Araújo",
    email: "admin@aionix.com.br",
    senha: "Admin@2026",
    papel: Papel.ADMIN,
  },
  {
    nome: "Beatriz Nunes",
    email: "supervisor@aionix.com.br",
    senha: "Super@2026",
    papel: Papel.SUPERVISOR,
  },
  {
    nome: "Carlos Meireles",
    email: "operador@aionix.com.br",
    senha: "Oper@2026",
    papel: Papel.OPERADOR,
  },
];

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

const REGRAS = [
  {
    nome: "Um abastecimento por veículo ao dia",
    descricao:
      "Impede que o mesmo veículo abasteça duas vezes no mesmo dia civil.",
    escopo: "VEICULO" as const,
    metrica: "ABASTECIMENTOS" as const,
    janela: "DIA" as const,
    limite: 1,
    acao: "BLOQUEAR" as const,
    prioridade: 10,
    mensagem: "Este veículo já abasteceu hoje. Limite: {limite} por dia.",
  },
  {
    nome: "Intervalo mínimo de 6 horas",
    descricao:
      "Evita reabastecimento em sequência — normalmente indica erro de registro.",
    escopo: "VEICULO" as const,
    metrica: "ABASTECIMENTOS" as const,
    janela: "HORAS" as const,
    janelaHoras: 6,
    limite: 1,
    acao: "BLOQUEAR" as const,
    prioridade: 20,
    mensagem: "Este veículo abasteceu há menos de 6 horas.",
  },
  {
    nome: "Teto semanal de 200 L por pessoa",
    escopo: "PESSOA" as const,
    metrica: "LITROS" as const,
    janela: "SEMANA" as const,
    limite: 200,
    acao: "BLOQUEAR" as const,
    prioridade: 30,
  },
  {
    nome: "Teto mensal de R$ 2.000 por pessoa",
    escopo: "PESSOA" as const,
    metrica: "VALOR" as const,
    janela: "MES" as const,
    limite: 2000,
    acao: "BLOQUEAR" as const,
    prioridade: 40,
  },
  {
    nome: "Aviso de consumo alto do posto",
    descricao:
      "Não bloqueia: apenas alerta o operador quando o dia passa de 3.000 L.",
    escopo: "GLOBAL" as const,
    metrica: "LITROS" as const,
    janela: "DIA" as const,
    limite: 3000,
    acao: "AVISAR" as const,
    prioridade: 90,
    mensagem: "Consumo do posto já passou de {limite} L hoje.",
  },
];

async function main() {
  console.log("→ usuários");
  for (const u of USUARIOS) {
    const senhaHash = await argonHash(u.senha, ARGON);
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nome: u.nome, papel: u.papel, ativo: true },
      create: { nome: u.nome, email: u.email, papel: u.papel, senhaHash },
    });
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
  for (const r of REGRAS) {
    const existente = await prisma.regra.findFirst({ where: { nome: r.nome } });
    if (existente) {
      await prisma.regra.update({ where: { id: existente.id }, data: r });
    } else {
      await prisma.regra.create({ data: r });
    }
  }

  console.log("→ histórico");
  const operador = await prisma.usuario.findUniqueOrThrow({
    where: { email: "operador@aionix.com.br" },
  });
  const jaTem = await prisma.abastecimento.count();
  if (jaTem === 0) {
    const combustiveis = ["Diesel S10", "Gasolina comum", "Etanol", "Diesel S500"];
    const registros = [];
    // 45 dias de historico, para o dashboard e os relatorios terem forma.
    for (let d = 45; d >= 1; d--) {
      const porDia = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < porDia; k++) {
        const v = veiculos[Math.floor(Math.random() * veiculos.length)];
        const vinculo = await prisma.vinculo.findFirst({
          where: { veiculoId: v.id },
        });
        if (!vinculo) continue;
        const litros = Number((25 + Math.random() * 90).toFixed(2));
        const precoLitro = 5.4 + Math.random() * 1.4;
        const quando = new Date();
        quando.setDate(quando.getDate() - d);
        quando.setHours(7 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60), 0, 0);
        registros.push({
          chaveIdempotencia: `seed-${d}-${k}-${v.id}`,
          pessoaId: vinculo.pessoaId,
          veiculoId: v.id,
          operadorId: operador.id,
          placa: v.placa,
          litros,
          valor: Number((litros * precoLitro).toFixed(2)),
          combustivel: combustiveis[Math.floor(Math.random() * combustiveis.length)],
          hodometro: 40000 + Math.floor(Math.random() * 90000),
          resultado: "LIBERADO" as const,
          criadoEm: quando,
        });
      }
    }
    await prisma.abastecimento.createMany({ data: registros, skipDuplicates: true });
    console.log(`   ${registros.length} abastecimentos`);
  } else {
    console.log(`   ${jaTem} já existentes — mantidos`);
  }

  console.log("\n✓ seed concluído\n");
  for (const u of USUARIOS) {
    console.log(`   ${u.papel.padEnd(10)} ${u.email}  senha: ${u.senha}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
