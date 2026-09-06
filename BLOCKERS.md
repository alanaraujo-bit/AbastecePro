# Bloqueios — precisam de ação do Alan

Nada aqui interrompe o restante do projeto. Cada item lista o que falta e o
que fazer quando houver acesso.

---

## B1 — OCR automático de placa — RESOLVIDO, sem chave de API

**Estado:** implementado. Não depende de mais nada.

A leitura roda no próprio aparelho (Tesseract em WebAssembly, servido de
`public/tesseract/`), sem chave de API e sem custo por foto. Fluxo: fotografa
→ enquadra a placa numa moldura ajustável → o sistema lê e mostra o quanto
confia → a pessoa confirma. Detalhes e porquês em `DECISIONS.md`, D11.

**O que sobra para você decidir:** se a taxa de acerto **no seu uso real** não
convencer — foto contra o sol, placa suja, à noite —, a alternativa é trocar a
etapa de reconhecimento por um modelo de visão via API (`ANTHROPIC_API_KEY`
na Railway), a centavos por foto. Nada do que existe hoje seria jogado fora:
o recorte, a correção posicional e os três estados de tela continuam valendo.

Isso é uma decisão de custo × precisão, medida com fotos suas — não um
bloqueio técnico.

---

## B2 — Domínio próprio

**Estado:** não bloqueante. O app está em domínio `*.up.railway.app`.

Quando houver um domínio da Aionix, apontar o DNS e registrar em
`generate_domain` na Railway.
