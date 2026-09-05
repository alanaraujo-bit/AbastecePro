import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA.
 *
 * `display: "standalone"` é o que tira a barra de endereço quando o app é
 * instalado — sem isso, o produto continua parecendo um site aberto no
 * navegador, que é exatamente o que se quer evitar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AbastecePro",
    short_name: "AbastecePro",
    description:
      "Controle de abastecimentos: identifique, valide as regras e registre em segundos.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0f13",
    theme_color: "#1b51db",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Atalho para o que o operador faz 99% das vezes: abrir e atender.
    shortcuts: [
      {
        name: "Novo atendimento",
        short_name: "Atender",
        url: "/operador",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
