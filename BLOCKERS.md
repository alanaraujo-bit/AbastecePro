# Bloqueios — precisam de ação do Alan

Nada aqui interrompe o restante do projeto. Cada item lista o que falta e o
que fazer quando houver acesso.

---

## B1 — Leitura automática de placa: encerrado, não pendente

**Estado:** fora do produto, por decisão. Não é bloqueio.

Foi implementada rodando no aparelho, testada com placa real, e falhou em
todas as configurações — inclusive porque placa de moto tem duas linhas. A
alternativa por API (modelo de visão, ~R$ 0,0065 por foto) foi apresentada
com os números e recusada: não vale uma chave de API no caminho crítico
quando a digitação já é rápida.

A medição está registrada em `DECISIONS.md`, D11. **Não reabra isto com
"vamos ajustar o Tesseract"** — esse caminho já foi medido e não funciona.
Se a leitura automática voltar à pauta, começa em modelo de visão ou ALPR
dedicado, e vira decisão de custo, não de implementação.

A foto continua existindo como **comprovante**: é anexada ao registro,
guardada no bucket e aparece no detalhe da liberação.

---

## B2 — Domínio próprio

**Estado:** não bloqueante. O app está em domínio `*.up.railway.app`.

Quando houver um domínio da Aionix, apontar o DNS e registrar em
`generate_domain` na Railway.
