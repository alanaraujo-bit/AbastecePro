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

## D11 — OCR da placa no aparelho, e a leitura nunca consulta sozinha

O reconhecimento roda em WebAssembly no próprio celular (Tesseract, servido
por `public/tesseract/` — ver `scripts/preparar-ocr.mjs`). Não há chave de
API, não há custo por foto e não há terceiro que possa cair no meio do
atendimento.

Três decisões que fazem isso funcionar:

1. **Recorte antes de reconhecer.** A câmera devolve a cena inteira, e nela a
   placa é uma faixa pequena cercada de bordas que também parecem texto.
   Reconhecer a foto toda erra quase sempre. Por isso existe uma moldura
   ajustável entre a foto e a leitura.
2. **`corrigirPlaca()` fecha o ciclo.** A correção posicional de O/0, I/1 e
   S/5 já existia para digitação apressada — é exatamente a classe de erro
   que OCR comete. O candidato só é aceito se, corrigido, virar placa válida.
3. **A leitura nunca dispara a consulta.** Ela preenche o campo e declara o
   quanto confia (certeza / dúvida com os caracteres fracos apontados /
   falha). A consulta automática continua existindo, mas só para placa
   **digitada**. Errar a placa aqui liberaria combustível no nome do carro
   errado; dois segundos de conferência custam menos do que desfazer isso.

A precisão é a de um OCR genérico em foto de celular: boa de perto, reta e
com luz; ruim contra o sol ou com placa suja. Daí a digitação continuar sendo
o caminho principal e o campo nunca ficar travado. Se a taxa de acerto não
convencer no uso real, troca-se apenas a etapa de reconhecimento por um
modelo de visão via API — o recorte, a correção e os três estados continuam
valendo.

## D12 — Prisma fixado na linha 6.x

`npm i prisma` instalou `8.0.0-rc.13`, um *release candidate* com uma CLI
completamente diferente (voltada à plataforma da Prisma, sem `db push`).
Fixado em `^6` — estável e com o fluxo de ORM clássico.

## D13 — Uma conta, sem papéis

O produto foi construído com três perfis (operador, supervisor, admin) porque
se imaginava um frentista na pista. **O fluxo real é outro:** uma única
pessoa — quem gere a frota — atende, consulta, libera e configura. Não existe
motorista nem frentista usando o sistema.

Papel virou, então, uma distinção sem diferença: com um usuário só, toda
checagem de permissão é trivialmente verdadeira. Ficaram: `exigirUsuario()`
para páginas e `exigirSessaoApi()` para rotas — autenticado **é** autorizado.

Dois desdobramentos:

- **`POST /api/usuarios` foi removido, não escondido.** Esconder o botão não
  fecharia a rota. No lugar da tela de usuários entrou `/admin/conta`, que
  opera sempre sobre `sessaoAtual().id` — nunca sobre um id vindo do corpo.
- **A coluna `papel` continua no banco.** Removê-la seria migração destrutiva
  na produção em troca de nenhuma mudança de comportamento. Nenhum código a
  lê; o seed a preenche só para satisfazer o schema.

Como não há criação de conta nem redefinição por e-mail, **o seed é o caminho
de recuperação de senha** — idempotente, documentado no `README.md`.

**O seed também desativa as contas do modelo antigo.** Enquanto havia papéis,
uma conta de operador via menos que o admin; sem eles, autenticado é
autorizado, e a mesma conta esquecida passaria a abrir o painel inteiro. A
mudança de modelo criou essa escalação de privilégio, e é o seed que a fecha
— desativando (não apagando, pois elas assinam abastecimentos antigos) e
revogando as sessões vivas no mesmo instante.

## D14 — O registro é uma LIBERAÇÃO, não um abastecimento

O modelo antigo descrevia o que aconteceu na bomba: litros, valor,
combustível, hodômetro, foto obrigatória. Quem opera o sistema nunca vê a
bomba — entrega um papel autorizando o abastecimento, e a pessoa vai ao posto
sozinha. Todos aqueles campos eram números que ninguém tem no momento do
registro.

O que se registra hoje é: esta placa, em nome desta pessoa, foi autorizada
nesta data. E a pergunta que a tela responde primeiro é a do balcão — *já foi
liberado antes, e para quem?*

Consequências que não são óbvias:

- **As regras passaram a contar liberações.** Métricas de litros e valor não
  teriam o que medir, e regra que não mede libera sempre — controle aparente
  é pior do que controle nenhum. O editor só oferece contagem; regras antigas
  são ignoradas pelo interpretador e aparecem marcadas como **sem efeito** na
  lista, para serem apagadas com consciência em vez de sumirem sozinhas.
- **O dashboard conta papéis emitidos.** Indicadores de litros mostrariam
  zero para sempre, o que parece sistema quebrado, não escopo deliberado.
- **As colunas `litros`/`valor` continuam no schema.** O histórico já gravado
  permanece legível na lista, no detalhe e no CSV — apagar as colunas jogaria
  fora justamente o passado que se quer auditar.
- **`litrosObrigatorios` e `fotoObrigatoria` saíram das configurações.** Um
  interruptor que não faz nada é pior do que nenhum.

## D15 — O cadastro nasce do lançamento, numa tela só

Quem testou o produto disse, em uma frase: *"não vou precisar cadastrar isso
antes, aí é mais burocrático e dá mais trabalho — só quero aquele registro
que se faz ali no lançamento"*. Estava certo. O fluxo pedia placa, depois um
formulário de cadastro (marca, modelo, tipo, busca de pessoa, CPF), e só
então o registro. Três telas para uma pessoa que tem alguém esperando em pé
na frente da mesa.

Hoje é **uma tela**: placa, nome e telefone. O resto — CPF, marca, modelo,
tipo, observação — vive atrás de "mais detalhes", disponível para quem quiser
sem custar nada a quem não quer. O servidor cria pessoa, veículo e vínculo a
partir do próprio lançamento, numa transação
(`POST /api/liberacao/registrar`).

Três consequências que não são óbvias:

1. **A verificação deixou de ser etapa.** Ela dispara sozinha quando a placa
   fica válida e aparece como um aviso entre a placa e o botão — no lugar
   onde muda o que se faz a seguir. Um "já veio há 3 dias" costuma encerrar
   o atendimento antes de qualquer digitação.
2. **A pessoa é deduplicada por CPF e por telefone.** Sem isso, cada
   lançamento criaria uma pessoa nova e as regras por pessoa nunca
   disparariam — o controle existiria só na aparência. O telefone é a chave
   que de fato se digita no balcão.
3. **A recusa tardia é mostrada com o motivo real.** A verificação parte da
   PLACA, mas há regras por PESSOA, e a pessoa só fica conhecida quando o
   telefone é digitado: placa nova de alguém que já foi atendido no mês era
   o caso em que a tela dizia "pode registrar" de boa-fé e o servidor
   recusava. O veredito que volta do servidor alimenta o mesmo aviso, e o
   botão vira "registrar mesmo assim" — em vez de deixar quem está no balcão
   sem saída.

**Litros continuou fora**, mesmo tendo sido pedido como campo opcional: uma
métrica preenchida às vezes não sustenta regra nenhuma (ver D14), e um campo
que não alimenta nada é peso na tela mais usada do produto.
