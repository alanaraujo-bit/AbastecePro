# Progresso — AbastecePro

Registro vivo do que está pronto, do que falta e de como retomar. Atualizado
a cada marco.

---

## Como rodar

```bash
npm install
npm run db:push     # aplica o schema
npm run db:seed     # popula com dados de demonstração (idempotente)
npm run dev         # http://localhost:3000
```

Contas criadas pelo seed:

| Perfil     | E-mail                     | Senha        |
| ---------- | -------------------------- | ------------ |
| Admin      | `admin@aionix.com.br`      | `Admin@2026` |
| Supervisor | `supervisor@aionix.com.br` | `Super@2026` |
| Operador   | `operador@aionix.com.br`   | `Oper@2026`  |

> O `.env` local aponta para o Postgres da Railway via proxy TCP público.
> Isso deixa o desenvolvimento **mais lento do que a produção** — cada
> consulta faz uma volta pela internet. Em produção o app fala com o banco
> pela rede privada da Railway.

---

## Estado atual

### Pronto e verificado no navegador

**Fundação**

- Design system em tokens, claro e escuro como duas experiências distintas.
- CSS de app-shell: sem overscroll, sem seleção acidental, sem scrollbar
  aparente no mobile, sem zoom gestual, safe areas respeitadas.
- Sessão opaca em tabela com argon2id; revogação imediata.
- Freio de força bruta no login, com resposta de tempo constante para não
  permitir enumerar usuários.
- Trilha de auditoria que nunca derruba a operação que a originou.

**Operador** — fluxo completo, testado ponta a ponta

- Campo de placa grande, monoespaçado, com correção de O/0 e I/1 por posição.
- **Consulta automática** assim que a placa fica válida (economiza um toque
  no caminho mais percorrido do produto).
- Veredito LIBERADO/BLOQUEADO inequívoco, com motivo estruturado, barra de
  consumo e saldo restante.
- Bloqueios cadastrais (pessoa e veículo) e de regra, todos listados.
- Troca de condutor quando o veículo tem mais de um — o veredito é
  reavaliado no servidor.
- Cadastro rápido quando a placa é desconhecida, sem sair do atendimento.
- Registro com litros, valor, combustível, hodômetro, observação e foto.
- Reavaliação das regras no momento do registro (regra de volume só pode ser
  decidida quando os litros são conhecidos) — **verificado em navegador**.
- Autorização excepcional com justificativa obrigatória, restrita a
  supervisor/admin.
- Idempotência real contra toque duplo, com chave nova a cada envio corrigido.
- Tela de conclusão com retorno automático ao início.

### Em construção

- Painel administrativo.
- PWA instalável (manifest + service worker).
- Relatórios e exportação.

---

## Achados corrigidos durante os testes

Coisas que só apareceram ao abrir o produto no navegador:

1. **Contraste do botão primário no escuro** — branco sobre `#5E8BFF` dava
   ~3,2:1. Criado token `--brand-fg` que inverte para texto escuro no tema
   escuro.
2. **Sufixo "L" colidindo com o valor** — `px-4` vinha depois de `pr-12` na
   string de classes e o `tailwind-merge` anulava o segundo. Trocado por
   `pl-4`.
3. **Números em formato errado** — a mensagem de bloqueio mostrava
   `150.28 L`. Agora tudo passa por `Intl` em pt-BR.
4. **Mensagem sem o número acionável** — dizia quanto foi consumido, mas não
   quanto **resta**. É o saldo que permite ao operador responder ao motorista
   sem chamar ninguém.
5. **"Último abastecimento" mostrando tentativa bloqueada** — uma tentativa
   bloqueada não abasteceu nada e aparecia como registro vazio. Agora o campo
   considera só o que de fato aconteceu; a tentativa continua no histórico.
6. **Bloqueio cadastral mostrando só um motivo** — pessoa e veículo podem
   estar bloqueados ao mesmo tempo. Virou lista.
7. **Telefone sem máscara** na tela do operador.

---

## Próximos passos

1. Painel administrativo (dashboard, pessoas, veículos, vínculos,
   abastecimentos, regras, usuários, auditoria).
2. PWA instalável e tratamento de offline.
3. Relatórios e exportação CSV.
4. Deploy na Railway e validação no ambiente real.
5. Otimização: `avaliarRegras` recarrega pessoa/veículo que a consulta já
   tinha em mãos — dá para eliminar duas idas ao banco no caminho crítico.

Ver `DECISIONS.md` para o porquê das escolhas e `BLOCKERS.md` para o que
depende de ação externa.
