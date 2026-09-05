# Progresso — AbastecePro

Registro vivo do que está pronto, do que ficou de fora e de como retomar.

- **Produção:** https://app-production-400d.up.railway.app
- Como rodar, variáveis e estrutura: [`README.md`](./README.md)
- Porquês das escolhas: [`DECISIONS.md`](./DECISIONS.md)
- O que depende de você: [`BLOCKERS.md`](./BLOCKERS.md)

---

## Estado: primeira versão completa, no ar e testada

Tudo abaixo foi verificado **no navegador**, não apenas compilado.

### Operador — fluxo completo

Rota única, máquina de estados no cliente: `placa → veredito → registro →
concluído`. Consulta dispara sozinha quando a placa fica válida.

- ✅ Campo de placa com correção de O/0 e I/1 **por posição**
- ✅ Foto pela câmera nativa (`capture="environment"`)
- ✅ Veredito LIBERADO/BLOQUEADO com motivo estruturado, barra de consumo e
  **saldo restante** — o número que o operador precisa para responder ao
  motorista
- ✅ Bloqueio cadastral (pessoa **e** veículo, ambos listados) e por regra
- ✅ Troca de condutor com reavaliação no servidor
- ✅ Cadastro rápido quando a placa é desconhecida
- ✅ Registro com litros, valor, combustível, hodômetro, observação e foto
- ✅ Reavaliação no registro (regra de volume só decide com os litros)
- ✅ Autorização excepcional com justificativa, restrita ao perfil
- ✅ Idempotência contra toque duplo, com chave nova a cada correção
- ✅ Retorno automático ao início após concluir

### Administrador — painel completo

- ✅ Dashboard com indicadores, consumo diário e ranking
- ✅ Abastecimentos: filtros na URL, tabela no desktop, cartões no celular
- ✅ **Detalhe do abastecimento lendo `motivo` e `regrasSnapshot`** — é esta
  tela que torna a auditoria de decisões antigas possível
- ✅ Pessoas e veículos: CRUD, bloqueio com motivo, histórico
- ✅ Vínculos com condutor principal único
- ✅ **Editor de regras como frase**, com pré-visualização ao vivo
- ✅ Usuários (ADMIN) com trava de último administrador e revogação
  imediata de sessões
- ✅ Auditoria em linguagem legível
- ✅ Relatórios por período + exportação CSV (abre direto no Excel pt-BR)
- ✅ Configurações que mudam comportamento de verdade

### Plataforma

- ✅ Deploy automático na Railway a cada push, com migrações no pre-deploy
- ✅ Fotos em bucket S3, servidas apenas por rota autenticada
- ✅ PWA instalável (manifesto + ícones + service worker)
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
- **OCR automático de placa** — ver `BLOCKERS.md`.

---

## Se for continuar

1. Trocar as senhas do seed antes de qualquer uso real.
2. Validar as regras com o cliente e ajustá-las pelo painel (não pelo
   código — é para isso que elas são dados).
3. Testes de `src/lib/regras/`.
4. Expurgo de fotos por idade.
