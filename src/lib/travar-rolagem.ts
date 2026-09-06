/**
 * Trava de rolagem do fundo, com contagem.
 *
 * Por que contada: mais de uma camada pode estar aberta ao mesmo tempo —
 * o painel de detalhe do abastecimento abre a foto ampliada por cima. Se
 * cada uma salvasse e restaurasse `overflow` por conta própria, fechar a
 * de cima devolveria a rolagem enquanto a de baixo ainda está aberta, e a
 * página atrás voltaria a rolar sob um modal. Com contador, só o último a
 * sair destrava.
 *
 * A largura da barra de rolagem vira padding no body: sem isso, no desktop
 * o conteúdo pula alguns pixels para o lado no instante em que o modal
 * abre — o tipo de movimento de página que este produto não deve ter.
 */

let abertos = 0;
let overflowAntes = "";
let paddingAntes = "";

export function travarRolagem(): () => void {
  if (typeof document === "undefined") return () => {};

  if (abertos === 0) {
    const body = document.body;
    overflowAntes = body.style.overflow;
    paddingAntes = body.style.paddingRight;

    const barra = window.innerWidth - document.documentElement.clientWidth;
    if (barra > 0) {
      const atual = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${atual + barra}px`;
    }
    body.style.overflow = "hidden";
  }

  abertos++;

  let liberado = false;
  return () => {
    // Guarda contra liberar duas vezes: o efeito do React em modo estrito
    // roda a limpeza mais de uma vez, e isso zeraria o contador com uma
    // camada ainda aberta.
    if (liberado) return;
    liberado = true;

    abertos = Math.max(0, abertos - 1);
    if (abertos === 0) {
      document.body.style.overflow = overflowAntes;
      document.body.style.paddingRight = paddingAntes;
    }
  };
}
