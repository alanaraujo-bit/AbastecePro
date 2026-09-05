"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FormularioLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(dados.erro ?? "Não foi possível entrar. Tente novamente.");
        setEnviando(false);
        return;
      }
      // replace() para que o botao "voltar" nao devolva a tela de login.
      router.replace(dados.destino ?? "/");
      router.refresh();
    } catch {
      setErro("Sem conexão. Verifique a internet e tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Input
        rotulo="E-mail"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@empresa.com.br"
      />

      <Input
        rotulo="Senha"
        type={verSenha ? "text" : "password"}
        autoComplete="current-password"
        required
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="••••••••"
        sufixo={
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
            className="pointer-events-auto -m-2 p-2 text-text-muted transition-colors hover:text-text"
          >
            {verSenha ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        }
      />

      {erro && (
        <div
          role="alert"
          className="rounded-app border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm leading-snug text-danger"
        >
          {erro}
        </div>
      )}

      <Button
        type="submit"
        tamanho="lg"
        larguraTotal
        carregando={enviando}
        className="mt-1"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
