import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: {
    default: "AbastecePro",
    template: "%s · AbastecePro",
  },
  description:
    "Controle de abastecimentos: identifique, valide as regras e registre em segundos.",
  applicationName: "AbastecePro",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AbastecePro",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, address: false, email: false },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Produto interno: nao deve ser indexado.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // App de operacao usado com uma mao, muitas vezes com luva: o zoom
  // gestual so atrapalha e desalinha o layout. Acessibilidade e atendida
  // pelo respeito ao tamanho de fonte do sistema e alvos de toque >= 48px.
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f13" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
