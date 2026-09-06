# Progresso — AbastecePro

Registro vivo do que está pronto, do que ficou de fora e de como retomar.

- **Produção:** https://app-production-400d.up.railway.app
- Como rodar, variáveis e estrutura: [`README.md`](./README.md)
- Porquês das escolhas: [`DECISIONS.md`](./DECISIONS.md)
- O que depende de você: [`BLOCKERS.md`](./BLOCKERS.md)

---

## Estado: modelo corrigido — um usuário, liberação como papel

> **Mudança de modelo, setembro/2026.** A primeira versão foi construída
> sobre uma leitura errada do negócio: três perfis e um "modo operador" que
> imitava o frentista na pista, registrando litros e valor da bomba.
>
> O fluxo real é outro: **uma única pessoa** — quem gere a frota — atende no
> balcão, consulta a placa e **libera** o abastecimento, entregando um papel.
> Ela nunca vê a bomba. O que se registra é a autorização, não o consumo.
>
> O porquê de cada consequência está em `DECISIONS.md`, D11, D13 e D14.

### Liberação — uma tela

Rota `/admin/liberar`, dentro do painel: `lançamento → comprovante`.

> **Segunda rodada, após teste com usuário.** A primeira versão do fluxo
> ainda pedia cadastro antes do registro. Quem testou resumiu: *"não vou
> precisar cadastrar isso antes, aí é mais burocrático e dá mais trabalho"*.
> As três telas viraram uma. Ver `DECISIONS.md`, D15.

- ✅ **Leitura da placa pela foto, no próprio aparelho** — sem chave de API e
  sem custo: fotografa, enquadra na moldura, o sistema lê e diz o quanto
  confia (certeza / dúvida com os caracteres fracos apontados / falha)
- ✅ A leitura **nunca** dispara a consulta sozinha; a consulta automática
  vale só para placa digitada
- ✅ Campo de placa com correção de O/0, I/1 e S/5 **por posição** — a mesma
  função serve à digitação e ao OCR
- ✅ A verificação não é etapa: dispara sozinha com a placa e responde
  **"já foi liberado?"** ali mesmo — data, em nome de quem e por quem
- ✅ Bloqueio cadastral (pessoa **e** veículo, ambos listados) e por regra,
  com motivo estruturado e barra de consumo
- ✅ Troca de pessoa com reavaliação no servidor
- ✅ **Cadastro nasce do lançamento** — placa, nome e telefone numa tela; o
  resto atrás de "mais detalhes". Pessoa e veículo são criados pelo servidor
  numa transação
- ✅ Pessoa deduplicada por CPF e por telefone — sem isso as regras por
  pessoa nunca disparariam
- ✅ Recusa que só o servidor enxerga (placa nova de quem já foi atendido)
  aparece com o motivo real, e não como erro genérico
- ✅ **Liberar mesmo assim**, com justificativa obrigatória, para o caso que
  as regras recusaram
- ✅ Comprovante com protocolo curto e impressão em folha própria
- ✅ Idempotência contra toque duplo

### Painel

- ✅ Dashboard contando **liberações** — por dia, por pessoa, bloqueios e
  exceções (litros e valor sairiam sempre zero; ver D14)
- ✅ Liberações: filtros na URL, tabela no desktop, cartões no celular
- ✅ **Detalhe lendo `motivo` e `regrasSnapshot`** — é esta tela que torna a
  auditoria de decisões antigas possível
- ✅ Pessoas e veículos: CRUD, bloqueio com motivo, histórico
- ✅ Vínculos com condutor principal único
- ✅ **Editor de regras como frase**, com pré-visualização ao vivo; regras
  antigas de litros/valor aparecem marcadas como **sem efeito**
- ✅ **Minha conta**: nome, e-mail, troca de senha e encerrar os outros
  aparelhos — a rota de criar usuário foi removida, não escondida
- ✅ Auditoria em linguagem legível
- ✅ Relatórios por período + exportação CSV (abre direto no Excel pt-BR)

### Plataforma

- ✅ Deploy automático na Railway a cada push, com migrações no pre-deploy
- ✅ Fotos em bucket S3, servidas apenas por rota autenticada
- ✅ PWA instalável; `/operador` redireciona para `/admin/liberar`, para não
  quebrar o atalho de quem já instalou
- ✅ Service worker que **não** cacheia API nem HTML autenticado
- ✅ Aviso de conexão perdida
- ✅ `/api/saude` confirmando banco e destino das fotos

---

## Achados corrigidos — só apareceram ao olhar o produto

1. **Contraste do botão primário no escuro** — branco sobre `#5E8BFF` dava
   ~3,2:1. Criado o token `--brand-fg`.
2. **A correção acima não estava valendo.** CSS sem camada vence qualquer
   `@layer`, inclusive `utilities`: `button { color: inherit }` solto em
   `globals.css` anulava todo `text-*` em botões, e `font: inherit` fazia o
   `text-lg` do botão xl renderizar 16px. Descoberto com `getComputedStyle`
   em produção, não a olho nu. Resets movidos para `@layer base`.
3. **Sufixo "L" colidindo com o valor** — `px-4` depois de `pr-12` e o
   `tailwind-merge` descartava o segundo.
4. **Números fora do padrão pt-BR** — `150.28 L` em vez de `150,28 L`.
5. **Mensagem sem o número acionável** — dizia o consumido, não o que resta.
6. **"Último abastecimento" mostrando tentativa bloqueada** — uma tentativa
   bloqueada não abasteceu nada e aparecia como registro vazio.
7. **Bloqueio cadastral mostrando só um motivo** — pessoa e veículo podem
   estar bloqueados ao mesmo tempo.
8. **Telefone sem máscara** em três telas.
9. **Só a placa era clicável** na tabela de abastecimentos; o meio da linha,
   que é onde as pessoas clicam, não fazia nada.
10. **Pílula de período apagada em Relatórios** — o cabeçalho dizia "30 dias"
    e nenhum filtro aparecia selecionado.
11. **Botão desabilitado parecia clicável** — "azul mais claro" em vez de
    neutro.
12. **Exclusão existia na API mas não na interface.**
13. **`prisma` instalou `8.0.0-rc.13`**, um release candidate com CLI
    incompatível. Fixado em `^6`.
14. **Porta errada no domínio** — o serviço escuta na `PORT` da Railway
    (8080) e o domínio apontava para 3000: deploy "SUCCESS" e aplicação
    inacessível.
15. **`forcePathStyle` fixo** quebraria os buckets novos da Railway, que
    usam URL virtual-hosted.
16. **O service worker guardava HTML de página autenticada.** As telas
    trazem nome e placa dentro; ficavam no Cache Storage depois do logout e
    apareceriam para quem usasse o aparelho em seguida — a
    mesma exposição que a rota autenticada de fotos existe para evitar.
    Agora só `/_next/static/` é cacheado, e sem rede a navegação mostra uma
    tela de "sem conexão" em vez de uma cópia antiga.
17. **O foco escapava dos painéis modais.** O Tab dentro de um painel
    aberto continuava andando pelos links da página atrás, sem nada na tela
    indicando isso, e fechar o painel largava o foco no começo da página.
    `aria-modal` promete resolver isso e nenhum navegador resolve sozinho
    fora de `<dialog>`.
18. **O foco inicial dos painéis dependia de `autoFocus` nos campos**, o
    que deixava o resultado à mercê da ordem em que o React monta efeitos —
    em desenvolvimento o cursor chegava a sair do campo e voltar. Hoje o
    painel decide: cursor no primeiro campo ao cadastrar, no próprio painel
    ao editar ou confirmar. Nunca no primeiro botão — num painel de
    confirmação isso deixaria uma exclusão a um Enter de distância.

---

## Deliberadamente fora desta versão

Nenhum destes bloqueia a demonstração; todos são decisões conscientes.

- **Fila offline de atendimentos.** O service worker não guarda registros
  para enviar depois. Um "LIBERADO" decidido offline poderia contrariar as
  regras vigentes no momento do envio — o certo é recusar e avisar, que é o
  que o app faz hoje. Uma fila real exige revalidação no servidor no momento
  do envio e uma tela de conflitos.
- **Retenção automática de fotos (LGPD).** As imagens ficam no bucket
  indefinidamente. O próximo passo natural é uma rotina de expurgo por
  idade, configurável, chamada por cron da Railway.
- **Região do servidor.** A Railway hospeda em `sjc` (Califórnia); a Railway
  não oferece região na América do Sul. São ~100 ms de ida e volta que não
  dependem do código. Se latência virar problema, é troca de plataforma, não
  de implementação.
- **Testes automatizados.** A verificação desta versão foi manual e visual.
  O primeiro alvo natural de teste unitário é `src/lib/regras/` — placas,
  janelas e o interpretador são funções puras e é onde um erro custa caro.
- **Precisão do OCR em campo.** A leitura no aparelho está implementada e
  funciona; o que ninguém mediu ainda é a taxa de acerto com foto de sol a
  pino, contraluz e placa suja. Se não convencer, a troca é pontual — ver
  `BLOCKERS.md`, B1.
- **Prestação de contas do posto.** Não há tela para lançar depois quantos
  litros o papel virou. Se o cliente quiser controle de gasto, é aí que
  entra.

### Uma coisa que parecia defeito e não era

Ao mexer nas camadas modais, escrevi uma trava de rolagem de fundo contada
e a espalhei pela gaveta e pela foto ampliada, convencido de estar
corrigindo "a página rolando atrás do painel". **Não estava.** Medido no
navegador: `document.scrollingElement.scrollHeight === clientHeight` em
todas as telas com painel — a moldura do app é `h-screen-app
overflow-hidden` e quem rola são os contêineres internos. Com um painel
aberto, rolar sobre a sobreposição não move nada (verificado: `scrollTop`
0 antes e depois).

Ou seja: `overflow: hidden` no body ali era inerte, e a máquina toda foi
removida. O que impede a rolagem de fundo é o próprio layout, mais o
`overscroll-behavior: contain` das áreas de rolagem. As duas linhas que
sobraram no painel são rede de segurança barata para telas fora da moldura,
como o login.

Fica registrado porque a lição é reaproveitável: *ver o estilo aplicado não
é ver o comportamento corrigido.* A primeira "verificação" só confirmava
que a propriedade tinha sido escrita.

---

## Se for continuar

1. Trocar as senhas do seed antes de qualquer uso real.
2. Validar as regras com o cliente e ajustá-las pelo painel (não pelo
   código — é para isso que elas são dados).
3. Testes de `src/lib/regras/`.
4. Expurgo de fotos por idade.
