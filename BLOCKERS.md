# Bloqueios — precisam de ação do Alan

Nada aqui interrompe o restante do projeto. Cada item lista o que falta e o
que fazer quando houver acesso.

---

## B1 — OCR automático de placa (sem chave de API de visão)

**Estado:** contornado. Não bloqueia o produto.

O fluxo do operador pede leitura automática da placa a partir da foto. Não há
nenhuma chave de modelo de visão no ambiente (`ANTHROPIC_API_KEY`,
`OPENAI_API_KEY` etc. — nenhuma presente).

**Como está resolvido hoje:** a foto é capturada e armazenada normalmente, e a
digitação da placa é o caminho primário — campo grande, teclado otimizado,
correção automática de O/0 e I/1 por posição. O reconhecimento está atrás de
uma interface de provedor (`src/lib/ocr/`), com o provedor `manual` ativo.

**O que fazer quando voltar:** definir `OCR_PROVIDER=anthropic` e
`ANTHROPIC_API_KEY=...` nas variáveis do serviço na Railway. O provedor já
está implementado; nenhuma mudança de código é necessária.

Alternativa sem custo por chamada: rodar OCR no próprio dispositivo
(Tesseract.js / `TextDetector`). Foi descartado por ora — o modelo é pesado
para celular comum e a precisão em placa suja/à noite é baixa, o que
contraria a prioridade de velocidade.

---

## B2 — Domínio próprio

**Estado:** não bloqueante. O app está em domínio `*.up.railway.app`.

Quando houver um domínio da Aionix, apontar o DNS e registrar em
`generate_domain` na Railway.
