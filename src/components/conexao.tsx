"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Registra o service worker e avisa quando a conexão cai.
 *
 * O aviso não é decorativo: o operador precisa saber ANTES de tentar
 * registrar um abastecimento que a rede está fora, senão ele digita tudo
 * e só descobre no toque final.
 */
export function Conexao() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // `navigator.onLine` só é confiável para o negativo (falso = certamente
    // sem rede); por isso ele é usado apenas para acender o aviso.
    setOffline(!navigator.onLine);
    const caiu = () => setOffline(true);
    const voltou = () => setOffline(false);
    window.addEventListener("offline", caiu);
    window.addEventListener("online", voltou);

    // O SW é o que torna o app instalável e faz o casco abrir instantâneo.
    // Em dev ele só atrapalharia o hot reload.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sem SW o app continua funcionando — só perde a instalação.
      });
    }

    return () => {
      window.removeEventListener("offline", caiu);
      window.removeEventListener("online", voltou);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-x-0 top-0 z-[110] flex items-center justify-center gap-2 bg-danger px-4 py-2 text-sm font-medium text-white safe-top anim-subir"
    >
      <WifiOff className="size-4 shrink-0" />
      Sem conexão — os registros não serão salvos
    </div>
  );
}
