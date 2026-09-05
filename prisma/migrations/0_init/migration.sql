-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'SUPERVISOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoVeiculo" AS ENUM ('CARRO', 'MOTO', 'CAMINHAO', 'ONIBUS', 'MAQUINA', 'OUTRO');

-- CreateEnum
CREATE TYPE "EscopoRegra" AS ENUM ('GLOBAL', 'PESSOA', 'VEICULO');

-- CreateEnum
CREATE TYPE "MetricaRegra" AS ENUM ('ABASTECIMENTOS', 'LITROS', 'VALOR');

-- CreateEnum
CREATE TYPE "JanelaRegra" AS ENUM ('DIA', 'SEMANA', 'MES', 'HORAS');

-- CreateEnum
CREATE TYPE "AcaoRegra" AS ENUM ('BLOQUEAR', 'AVISAR');

-- CreateEnum
CREATE TYPE "ResultadoAbastecimento" AS ENUM ('LIBERADO', 'BLOQUEADO', 'AUTORIZADO_EXCECAO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'OPERADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alteradoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "observacao" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "motivoBloqueio" TEXT,
    "bloqueadoEm" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alteradoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculos" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "modelo" TEXT,
    "marca" TEXT,
    "cor" TEXT,
    "ano" INTEGER,
    "tipo" "TipoVeiculo" NOT NULL DEFAULT 'CARRO',
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "motivoBloqueio" TEXT,
    "bloqueadoEm" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alteradoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculos" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alteradoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "prioridade" INTEGER NOT NULL DEFAULT 100,
    "escopo" "EscopoRegra" NOT NULL,
    "metrica" "MetricaRegra" NOT NULL,
    "janela" "JanelaRegra" NOT NULL,
    "janelaHoras" INTEGER,
    "limite" DECIMAL(12,2) NOT NULL,
    "acao" "AcaoRegra" NOT NULL DEFAULT 'BLOQUEAR',
    "mensagem" TEXT,
    "alvoPessoaId" TEXT,
    "alvoVeiculoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alteradoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abastecimentos" (
    "id" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "pessoaId" TEXT,
    "veiculoId" TEXT,
    "operadorId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "litros" DECIMAL(10,3),
    "valor" DECIMAL(10,2),
    "combustivel" TEXT,
    "hodometro" INTEGER,
    "observacao" TEXT,
    "fotoChave" TEXT,
    "resultado" "ResultadoAbastecimento" NOT NULL,
    "motivo" JSONB,
    "regrasSnapshot" JSONB,
    "autorizadoPorId" TEXT,
    "justificativa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abastecimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dados" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "alteradoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_ativo_idx" ON "usuarios"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_tokenHash_key" ON "sessoes"("tokenHash");

-- CreateIndex
CREATE INDEX "sessoes_usuarioId_idx" ON "sessoes"("usuarioId");

-- CreateIndex
CREATE INDEX "sessoes_expiraEm_idx" ON "sessoes"("expiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_documento_key" ON "pessoas"("documento");

-- CreateIndex
CREATE INDEX "pessoas_nome_idx" ON "pessoas"("nome");

-- CreateIndex
CREATE INDEX "pessoas_telefone_idx" ON "pessoas"("telefone");

-- CreateIndex
CREATE INDEX "pessoas_bloqueado_idx" ON "pessoas"("bloqueado");

-- CreateIndex
CREATE UNIQUE INDEX "veiculos_placa_key" ON "veiculos"("placa");

-- CreateIndex
CREATE INDEX "veiculos_bloqueado_idx" ON "veiculos"("bloqueado");

-- CreateIndex
CREATE INDEX "vinculos_veiculoId_idx" ON "vinculos"("veiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "vinculos_pessoaId_veiculoId_key" ON "vinculos"("pessoaId", "veiculoId");

-- CreateIndex
CREATE INDEX "regras_ativo_prioridade_idx" ON "regras"("ativo", "prioridade");

-- CreateIndex
CREATE INDEX "regras_alvoPessoaId_idx" ON "regras"("alvoPessoaId");

-- CreateIndex
CREATE INDEX "regras_alvoVeiculoId_idx" ON "regras"("alvoVeiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "abastecimentos_chaveIdempotencia_key" ON "abastecimentos"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "abastecimentos_criadoEm_idx" ON "abastecimentos"("criadoEm");

-- CreateIndex
CREATE INDEX "abastecimentos_pessoaId_criadoEm_idx" ON "abastecimentos"("pessoaId", "criadoEm");

-- CreateIndex
CREATE INDEX "abastecimentos_veiculoId_criadoEm_idx" ON "abastecimentos"("veiculoId", "criadoEm");

-- CreateIndex
CREATE INDEX "abastecimentos_resultado_criadoEm_idx" ON "abastecimentos"("resultado", "criadoEm");

-- CreateIndex
CREATE INDEX "abastecimentos_placa_idx" ON "abastecimentos"("placa");

-- CreateIndex
CREATE INDEX "auditoria_criadoEm_idx" ON "auditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidadeId_idx" ON "auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "auditoria_usuarioId_criadoEm_idx" ON "auditoria"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras" ADD CONSTRAINT "regras_alvoPessoaId_fkey" FOREIGN KEY ("alvoPessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras" ADD CONSTRAINT "regras_alvoVeiculoId_fkey" FOREIGN KEY ("alvoVeiculoId") REFERENCES "veiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

