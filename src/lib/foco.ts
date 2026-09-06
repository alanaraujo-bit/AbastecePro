/**
 * Confinamento de foco para camadas modais.
 *
 * Sem isto, o Tab dentro de um painel aberto continua andando pelos links
 * da página atrás: o teclado sai do modal sem que nada na tela indique
 * isso. É o mesmo problema que `aria-modal` promete resolver e nenhum
 * navegador resolve sozinho fora de `<dialog>`.
 *
 * Devolve uma função de limpeza que também **restaura o foco** para onde
 * ele estava. Fechar um painel e ver o foco cair no começo da página é o
 * que mais atrapalha quem opera o admin sem mouse.
 *
 * `anterior` vem de fora de propósito. Ler `document.activeElement` aqui
 * dentro seria tarde demais: quando o efeito do painel roda, um campo com
 * `autoFocus` lá dentro já tomou o foco, e o painel acabaria "restaurando"
 * o foco para um campo que ele mesmo vai desmontar. Quem abre precisa
 * capturar o gatilho antes de renderizar o painel.
 */

const SELETOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR)).filter(
    // `offsetParent` nulo cobre o que está escondido por display:none ou
    // por um ancestral com [hidden] — não adianta mandar o foco para lá.
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function prenderFoco(
  raiz: HTMLElement,
  anterior?: HTMLElement | null,
): () => void {
  function aoTeclar(e: KeyboardEvent) {
    if (e.key !== "Tab") return;

    const lista = focaveis(raiz);
    if (lista.length === 0) {
      // Painel sem nada focável: segura o foco no próprio painel em vez de
      // deixá-lo escapar para a página.
      e.preventDefault();
      raiz.focus();
      return;
    }

    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    const ativo = document.activeElement;

    if (e.shiftKey && (ativo === primeiro || ativo === raiz)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && ativo === ultimo) {
      e.preventDefault();
      primeiro.focus();
    } else if (!raiz.contains(ativo)) {
      // O foco já estava fora (clique no fundo, por exemplo): traz de volta.
      e.preventDefault();
      primeiro.focus();
    }
  }

  document.addEventListener("keydown", aoTeclar, true);

  return () => {
    document.removeEventListener("keydown", aoTeclar, true);
    // `isConnected`: se o gatilho saiu do DOM junto com a ação (uma linha
    // excluída, por exemplo), focá-lo não faz nada e o foco some.
    if (anterior?.isConnected) anterior.focus();
  };
}

/* ------------------------------------------------------------------ */

/**
 * Quem tinha o foco antes de a camada modal abrir.
 *
 * Guardado fora do React de propósito. O componente do painel não
 * consegue capturar isso sozinho: quando o efeito dele roda, um campo com
 * `autoFocus` lá dentro já tomou o foco; e ler `document.activeElement`
 * durante a renderização é justamente o que não se deve fazer.
 *
 * Então um ouvinte único acompanha o foco da página e ignora tudo que
 * estiver dentro de um diálogo — o que sobra é sempre o gatilho.
 */
let ultimoFoco: HTMLElement | null = null;

if (typeof document !== "undefined") {
  ultimoFoco = document.activeElement as HTMLElement | null;
  document.addEventListener(
    "focusin",
    (e) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo || alvo === document.body) return;
      if (alvo.closest('[role="dialog"]')) return;
      ultimoFoco = alvo;
    },
    true,
  );
}

/** O último elemento focado fora de qualquer diálogo. */
export function focoAnterior(): HTMLElement | null {
  return ultimoFoco;
}
