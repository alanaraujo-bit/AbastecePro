import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O produto é interno e não deve ser indexado nem embutido em iframe
  // de terceiros. Cabeçalhos aplicados a todas as respostas.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          {
            key: "Permissions-Policy",
            // A câmera é usada para fotografar a placa; o resto fica fechado.
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
