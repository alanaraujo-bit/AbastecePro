/**
 * Aplica o tema antes da primeira pintura.
 *
 * Sem isto o app pisca branco antes de virar escuro — o tipo de detalhe que
 * denuncia na hora que aquilo e um site, nao um aplicativo.
 */
const SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('ap-tema') || 'sistema';
    var escuro = t === 'escuro' ||
      (t === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    el.classList.toggle('dark', escuro);
    el.style.colorScheme = escuro ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return (
    <script
      // Conteudo estatico definido em build; nao ha entrada de usuario aqui.
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}

export const TEMA_STORAGE_KEY = "ap-tema";
export type Tema = "claro" | "escuro" | "sistema";
