# Decisões de arquitetura — AbastecePro

Registro das escolhas estruturais e do *porquê*. Serve para quem continuar o
projeto entender o que é intencional e o que é apenas circunstancial.

---

## D1 — Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4

App Router com Server Components dá HTML pronto na primeira resposta, o que é
exatamente o que o fluxo do operador precisa: abrir e já ver a tela útil, sem
esperar bundle de JS montar a página.

Tailwind v4 é usado como **sistema de tokens**, não como utilitário solto —
todo cor/raio/sombra vem de variável CSS declarada em `globals.css`.

## D2 — Hospedagem: Railway (app **e** banco), não Vercel

- Container de longa duração ⇒ **sem cold start**. Velocidade é a prioridade
  número 1 do produto e serverless cobra justamente na primeira requisição.
- Banco na mesma plataforma ⇒ tráfego pela rede privada, latência baixa.
- Módulos nativos (argon2) funcionam sem adaptação.

É reversível: Next.js em modo `standalone` roda em qualquer lugar.

**Corolário:** as fotos vão para um *bucket* da Railway (S3-compatível), não
para Vercel Blob. Misturar as duas plataformas só somaria latência.

## D3 — As regras de liberação são DADOS, não código

O cliente ainda vai mudar a política depois da validação. Por isso `Regra` é
uma tabela onde escopo, métrica, janela e limite são **colunas**, e existe um
único interpretador (`src/lib/regras/avaliar.ts`) que não conhece nenhum
limite específico.

Mudar política = editar linha no painel. Não precisa de deploy.

Dois desdobramentos que não são óbvios:

1. O veredito é **estruturado** (`MotivoRegra`), não uma string. A tela de
   BLOQUEADO precisa mostrar qual regra pegou, qual o teto e quanto já foi
   consumido — texto solto não permite isso.
2. Cada `Abastecimento` guarda um **snapshot das regras vigentes** no momento
   da decisão (`regrasSnapshot`). Sem isso, auditar um atendimento meses
   depois falha se a regra tiver sido editada no intervalo.

## D4 — Sessão opaca em tabela, não JWT

Token aleatório no cookie `httpOnly`; o banco guarda só o HMAC dele.

JWT foi descartado porque **não permite revogação imediata**: bloquear um
usuário precisa derrubar o acesso no mesmo instante, não quando o token
expirar. A tabela `sessoes` também alimenta a auditoria naturalmente.

O HMAC usa `SESSION_SECRET` como *pepper*: um dump do banco não permite
forjar sessão, e rotacionar o segredo invalida tudo de uma vez.

## D5 — Idempotência no registro do abastecimento

O operador está na pista, com sinal instável, e **vai** tocar duas vezes.
Botão desabilitado não resolve isso — a requisição já saiu.

O cliente gera um UUID no início do atendimento; a coluna
`chaveIdempotencia` é `@unique`. A segunda chamada devolve o registro da
primeira em vez de criar outro.

## D6 — Placa em forma canônica

Convivem dois formatos válidos no Brasil: `ABC1234` (antigo) e `ABC1D23`
(Mercosul). Guardamos sempre normalizado — maiúscula, sem separador — para
que o mesmo carro nunca gere dois cadastros. Hífen é só apresentação.

`corrigirPlaca()` desambigua O/0, I/1, S/5 **pela posição** (posições 0-2 são
sempre letras, 3 é sempre dígito, 5-6 sempre dígitos), e só aceita a correção
se ela produzir uma placa válida — nunca "conserta" por cima de um dado que o
operador pode ter digitado certo.

## D7 — Fonte do sistema, sem webfont

`-apple-system / Segoe UI / Roboto`. Zero requisição de rede, zero FOUT, e o
app "veste" a fonte do sistema — o que ajuda a parecer nativo em vez de site.

## D8 — Fuso do negócio, não do container

O servidor roda em UTC, mas "limite por dia" significa o dia civil de quem
opera o posto. `src/lib/regras/janelas.ts` calcula toda fronteira de janela em
`America/Sao_Paulo`.

## D9 — Zoom gestual desativado (`userScalable: false`)

Decisão consciente, com contrapartida. O app é usado com uma mão, em pé, às
vezes de luva: o zoom por pinça só desalinha o layout e atrapalha. A
acessibilidade é atendida por outro caminho — alvos de toque ≥ 44 px,
contraste verificado nos dois temas e respeito a `prefers-reduced-motion`.

## D10 — Marca em azul, veredito em verde/vermelho

A cor da marca é deliberadamente **azure**, nunca verde nem vermelho. Essas
duas ficam reservadas para LIBERADO e BLOQUEADO — se a interface usasse verde
como cor de marca, o veredito perderia força justamente na tela em que ele é
a única coisa que importa.

## D11 — OCR de placa fora do caminho crítico

Não há chave de API de visão no ambiente. A digitação é o caminho primário
(campo grande, teclado otimizado, correção por posição); o OCR entra como
*enhancement* atrás de uma interface de provedor. Ver `BLOCKERS.md`.

A especificação pede reconhecimento "quando possível" — o que autoriza
exatamente essa degradação graciosa.

## D12 — Prisma fixado na linha 6.x

`npm i prisma` instalou `8.0.0-rc.13`, um *release candidate* com uma CLI
completamente diferente (voltada à plataforma da Prisma, sem `db push`).
Fixado em `^6` — estável e com o fluxo de ORM clássico.
