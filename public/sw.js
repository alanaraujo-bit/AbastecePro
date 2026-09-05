/*
 * Service worker do AbastecePro.
 *
 * Faz duas coisas, e só duas:
 *   1. Torna o app instalável (o Chrome exige um SW com handler de fetch).
 *   2. Serve o casco do app do cache, para abrir instantâneo mesmo em
 *      3G ruim — que é a rede real da pista.
 *
 * O QUE ELE NÃO FAZ, DE PROPÓSITO: cachear a API. Este é um sistema de
 * controle. Servir um "LIBERADO" velho porque a rede caiu seria pior do
 * que não responder — o operador liberaria um abastecimento que as regras
 * atuais recusariam. Toda chamada a /api/ é rede ou nada.
 */

const VERSAO = "abastecepro-v1";
const CACHE_CASCO = `${VERSAO}-casco`;

// Só o que é estável e leve. As páginas em si vêm da rede.
const PRECACHE = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icon.svg",
  "/manifest.webmanifest",
];

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

  // Só GET entra em qualquer estratégia de cache.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // --- API: rede ou nada. Nunca servir decisão velha. ---
  if (url.pathname.startsWith("/api/")) return;

  // --- Estáticos com hash no nome: cache primeiro, são imutáveis. ---
  if (url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname)) {
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

  // --- Navegação: rede primeiro (o conteúdo precisa estar atual),
  //     com a última cópia como rede de segurança se a conexão cair. ---
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE_CASCO).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() =>
          caches
            .match(req)
            .then((cacheado) => cacheado || caches.match("/operador"))
            .then(
              (r) =>
                r ||
                new Response(
                  "<!doctype html><meta charset=utf-8><title>Sem conexão</title>" +
                    "<style>body{font-family:system-ui;display:grid;place-items:center;" +
                    "height:100dvh;margin:0;background:#0d0f13;color:#f2f3f5;text-align:center;padding:24px}" +
                    "p{color:#8a909c;margin-top:8px}</style>" +
                    "<div><h1>Sem conexão</h1><p>Verifique a internet e tente de novo.</p></div>",
                  { headers: { "content-type": "text/html; charset=utf-8" } },
                ),
            ),
        ),
    );
  }
});
