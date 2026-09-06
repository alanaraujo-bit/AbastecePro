# AbastecePro

Sistema de controle de abastecimentos da **Aionix**.

Quem gere a frota **libera abastecimentos**: identifica a placa (fotografando
ou digitando), o sistema responde se aquele veículo **pode** ou **já foi
liberado**, e a autorização entregue fica registrada com histórico e
auditoria.

O sistema tem **um único acesso** — a mesma pessoa consulta, libera e
administra. Não há perfil de motorista nem de frentista.

- **Produção:** https://app-production-400d.up.railway.app
- **Saúde:** `/api/saude` — diz se o banco responde e se as fotos estão
  indo para o bucket ou para o disco efêmero do contêiner.

---

## Rodando localmente

```bash
npm install
npm run db:deploy   # aplica as migrações
npm run db:seed     # dados de demonstração (idempotente)
npm run dev         # http://localhost:3000
```

A conta criada pelo seed:

| E-mail                | Senha        |
| --------------------- | ------------ |
| `admin@aionix.com.br` | `Admin@2026` |

> **Atenção:** trocar essa senha antes de qualquer uso real, em **Minha
> conta** no painel.

### Perdeu a senha?

Não existe redefinição por e-mail: o sistema tem uma conta só e nenhuma rota
para criar outra. O caminho de recuperação é rodar o seed **no servidor**:

```bash
npm run db:seed
```

Ele é idempotente e devolve a senha ao valor da tabela acima sem tocar em
pessoas, veículos ou histórico. Troque-a em seguida.

O seed também **desativa qualquer outra conta** que exista no banco — as do
modelo antigo, com perfil de operador ou supervisor, que sem papéis passariam
a abrir o painel inteiro (ver `DECISIONS.md`, D13).

O `.env` local aponta para o Postgres da Railway por um proxy TCP público.
Isso deixa o desenvolvimento **mais lento que a produção** — cada consulta
dá uma volta pela internet. Em produção o app fala com o banco pela rede
privada da Railway.

### Variáveis de ambiente

| Variável                                 | Obrigatória | Para quê                                                  |
| ---------------------------------------- | ----------- | --------------------------------------------------------- |
| `DATABASE_URL`                           | sim         | Postgres                                                   |
| `SESSION_SECRET`                         | sim         | Assina os tokens de sessão. Rotacionar invalida todas.     |
| `S3_BUCKET` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` `S3_REGION` `S3_ENDPOINT` | em produção | Fotos. **Sem elas, as imagens vão para o disco do contêiner e somem no próximo deploy.** |
| `TZ_NEGOCIO`                             | não         | Fuso usado nas janelas das regras (padrão `America/Sao_Paulo`) |
| `S3_FORCE_PATH_STYLE`                    | não         | `true` para buckets que exigem URL path-style               |

---

## O painel

Tudo vive em `/admin`. Não existe mais um "modo operador" separado — a rota
antiga `/operador` só redireciona, para não quebrar o atalho de quem já
instalou o app.

### `/admin/liberar` — a tela que se usa com alguém na frente

**Uma tela só:** placa, nome e telefone. CPF, marca, modelo, tipo e observação
ficam atrás de "mais detalhes". Não existe cadastrar antes de registrar — o
servidor cria pessoa, veículo e vínculo a partir do próprio lançamento.

```
lançamento → comprovante
```

A placa entra fotografada ou digitada. Digitada, a verificação dispara
**sozinha** assim que fica válida; fotografada, **nunca** — a leitura preenche
o campo e espera confirmação, porque errar a placa aqui liberaria combustível
no nome do carro errado.

A verificação não é etapa: o resultado aparece como aviso entre a placa e o
botão — *já foi liberado, quando e para quem*. Bloqueado, o botão vira
"registrar mesmo assim" e pede um motivo, que vai para a auditoria.

### Resto do painel

Dashboard, liberações (com detalhe que explica cada decisão), pessoas,
veículos, vínculos, regras, auditoria, relatórios, configurações e **Minha
conta**.

Barra lateral fixa no desktop, gaveta no celular. Funciona por inteiro nos
dois, mas o desktop usa o espaço de verdade — tabelas densas e duas colunas —
em vez de esticar o layout do celular.

---

## Estrutura

```
prisma/
  schema.prisma          modelo de dados (regras são DADOS, não código)
  migrations/            migrações versionadas
  seed.ts                dados de demonstração
src/
  app/
    admin/
      liberar/           fluxo de liberação (etapa-*, recorte-placa)
      ...                resto do painel
    operador/            redireciona para /admin/liberar
    api/                 rotas HTTP
  components/
    ui/                  primitivos (button, input, sheet, toast)
    admin/               componentes do painel
  lib/
    auth.ts              sessão e senhas (uma conta, sem papéis)
    ocr-placa.ts         leitura da placa no aparelho (Tesseract em WASM)
    regras/
      avaliar.ts         ← o interpretador de regras
      janelas.ts         fronteiras de dia/semana/mês no fuso do negócio
      descrever.ts       regra → frase em português
    storage.ts           fotos (bucket S3 ou disco local)
    config.ts            configurações do sistema
```

---

## O que é importante entender antes de mexer

**As regras são dados.** `src/lib/regras/avaliar.ts` não conhece nenhum
limite específico: lê a tabela `regras` e mede o consumo na janela de cada
uma. Mudar política é editar linha no painel, não fazer deploy.

**Cada abastecimento guarda a cópia da regra usada.** Sem isso, auditar um
atendimento de meses atrás falharia se a regra tivesse sido editada depois.

**A sessão é uma linha no banco, não um JWT.** Foi escolhido justamente para
permitir revogação imediata: trocar a senha ou encerrar os outros aparelhos
derruba o acesso no mesmo instante, sem esperar token expirar.

**A API nunca é cacheada** — nem pelo service worker, nem por CDN. Servir um
"LIBERADO" velho seria pior do que não responder.

**Fotos não têm URL pública.** Passam por `/api/fotos/[chave]`, que exige
sessão. Imagem de pessoa e veículo é dado pessoal, não asset estático.

Os porquês completos estão em [`DECISIONS.md`](./DECISIONS.md). O estado do
projeto e o que vem a seguir, em [`PROGRESS.md`](./PROGRESS.md). O que
depende de ação externa, em [`BLOCKERS.md`](./BLOCKERS.md).

---

## Comandos

| Comando              | O que faz                              |
| -------------------- | -------------------------------------- |
| `npm run dev`        | desenvolvimento                        |
| `npm run build`      | build de produção                      |
| `npm run typecheck`  | verificação de tipos                   |
| `npm run db:deploy`  | aplica migrações (usado no deploy)     |
| `npm run db:migrate` | cria migração a partir do schema       |
| `npm run db:seed`    | dados de demonstração + **reset da senha** |
| `npm run db:studio`  | inspeciona o banco                     |
| `npm run icones`     | regera os ícones do PWA a partir da marca |
| `npm run ocr`        | copia os arquivos do Tesseract para `public/` |

---

## Deploy

Railway, com deploy automático a cada push na `main`. As migrações rodam no
`pre-deploy`; se falharem, a versão nova não sobe.

Serviços do projeto: **app** (Next.js), **Postgres**, **abastecepro-fotos**
(bucket). As credenciais do bucket chegam ao app por variável de referência.
