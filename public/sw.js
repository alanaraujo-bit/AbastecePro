/*
 * Service worker do AbastecePro.
 *
 * Faz duas coisas, e só duas:
 *   1. Torna o app instalável (o Chrome exige um SW com handler de fetch).
 *   2. Serve os estáticos com hash do cache, para abrir rápido em 3G ruim.
 *
 * O QUE ELE NÃO FAZ, DE PROPÓSITO:
 *
 * a) Não cacheia a API. Este é um sistema de controle. Servir um "LIBERADO"
 *    velho porque a rede caiu seria pior do que não responder — o operador
 *    liberaria um abastecimento que as regras atuais recusariam.
 *
 * b) NÃO CACHEIA HTML DE PÁGINA. As páginas vêm autenticadas e trazem dado
 *    pessoal dentro: a tela do operador lista nomes e placas dos últimos
 *    atendimentos. Guardá-las no Cache Storage deixaria esse conteúdo no
 *    dispositivo depois do logout — num tablet compartilhado, o próximo
 *    operador veria o histórico do anterior ao abrir sem rede. É a mesma
 *    exposição que a rota autenticada de fotos existe para evitar.
 *
 *    Sem rede, portanto, a navegação mostra uma tela de "sem conexão", não
 *    uma cópia antiga. O ganho de velocidade vem dos bundles em
 *    /_next/static/, que têm hash no nome e nenhum dado de usuário.
 */

const VERSAO = "abastecepro-v2";
const CACHE_CASCO = `${VERSAO}-casco`;

// Só arquivos públicos e estáveis. Nenhum deles depende de sessão.
const PRECACHE = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icon.svg",
  "/manifest.webmanifest",
];

const PAGINA_OFFLINE = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    display:grid;place-items:center;height:100dvh;margin:0;background:#0d0f13;
    color:#f2f3f5;text-align:center;padding:24px}
  h1{font-size:1.25rem;margin:0}
  p{color:#8a909c;margin:8px 0 0;font-size:.9375rem;line-height:1.4}
  @media (prefers-color-scheme: light){body{background:#f4f5f8;color:#171a20}}
</style>
<div>
  <h1>Sem conexão</h1>
  <p>Verifique a internet e tente de novo.<br>Nenhum atendimento foi perdido.</p>
</div>`;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_CASCO)
      .then((c) => c.addAll(PRECACHE))
      // Um precache que falha não pode impedir a instalação do SW.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          // Remove caches de versões anteriores — inclusive o v1, que
          // chegou a guardar HTML de página.
          chaves
            .filter((k) => !k.startsWith(VERSAO))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // --- API: rede ou nada. Nunca servir decisão velha. ---
  if (url.pathname.startsWith("/api/")) return;

  // --- Estáticos com hash no nome: cache primeiro, são imutáveis
  //     e não carregam nada de usuário. ---
  if (
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE.includes(url.pathname)
  ) {
    evento.respondWith(
      caches.match(req).then(
        (cacheado) =>
          cacheado ||
          fetch(req).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone();
              caches.open(CACHE_CASCO).then((c) => c.put(req, copia));
            }
            return resp;
          }),
      ),
    );
    return;
  }

  // --- Navegação: sempre da rede. Sem cópia guardada e sem recorrer a
  //     cache — ver o item (b) no topo. ---
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req).catch(
        () =>
          new Response(PAGINA_OFFLINE, {
            status: 503,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
            },
          }),
      ),
    );
  }
});
