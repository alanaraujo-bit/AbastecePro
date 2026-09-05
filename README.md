# AbastecePro

Sistema de controle de abastecimentos da **Aionix**.

Um operador identifica a placa, o sistema responde **LIBERADO** ou
**BLOQUEADO** conforme regras configuráveis, e todo o atendimento fica
registrado com foto, histórico e auditoria.

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

Contas criadas pelo seed:

| Perfil     | E-mail                     | Senha        |
| ---------- | -------------------------- | ------------ |
| Admin      | `admin@aionix.com.br`      | `Admin@2026` |
| Supervisor | `supervisor@aionix.com.br` | `Super@2026` |
| Operador   | `operador@aionix.com.br`   | `Oper@2026`  |

> **Atenção:** trocar essas senhas antes de qualquer uso real.

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

## Os dois ambientes

### `/operador` — a experiência principal

Rota única com máquina de estados no cliente, para que o caminho feliz não
pague nenhuma navegação:

```
placa → veredito → registro → concluído
```

A consulta dispara **sozinha** assim que a placa fica válida — economiza um
toque no percurso mais repetido do dia. Placa desconhecida abre cadastro
rápido sem sair do atendimento.

### `/admin` — painel

Dashboard, abastecimentos (com detalhe que explica cada decisão), pessoas,
veículos, vínculos, regras, usuários, auditoria, relatórios e configurações.

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
    operador/            fluxo do operador (etapa-*.tsx)
    admin/               painel
    api/                 rotas HTTP
  components/
    ui/                  primitivos (button, input, sheet, toast)
    admin/               componentes do painel
  lib/
    auth.ts              sessão, senhas, permissões
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
permitir revogação imediata: desativar um usuário derruba o acesso dele no
mesmo instante.

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
| `npm run db:seed`    | popula dados de demonstração           |
| `npm run db:studio`  | inspeciona o banco                     |
| `npm run icones`     | regera os ícones do PWA a partir da marca |

---

## Deploy

Railway, com deploy automático a cada push na `main`. As migrações rodam no
`pre-deploy`; se falharem, a versão nova não sobe.

Serviços do projeto: **app** (Next.js), **Postgres**, **abastecepro-fotos**
(bucket). As credenciais do bucket chegam ao app por variável de referência.
