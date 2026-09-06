"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";

import { Card } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const SENHA_MINIMA = 10;

export function FormularioConta({
  nome: nomeInicial,
  email: emailInicial,
  outrasSessoes,
}: {
  nome: string;
  email: string;
  outrasSessoes: number;
}) {
  const router = useRouter();
  const { mostrar } = useToast();

  const [nome, setNome] = useState(nomeInicial);
  const [email, setEmail] = useState(emailInicial);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const mudou =
    nome !== nomeInicial || email !== emailInicial || novaSenha.length > 0;

  async function salvar() {
    if (salvando || !mudou) return;
    if (novaSenha && novaSenha.length < SENHA_MINIMA) {
      mostrar({
        titulo: `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`,
        variante: "erro",
      });
      return;
    }
    setSalvando(true);
    try {
      const r = await fetch("/api/conta", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          senhaAtual: senhaAtual || undefined,
          novaSenha: novaSenha || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        mostrar({ titulo: d.erro ?? "Não foi possível salvar", variante: "erro" });
        setSalvando(false);
        return;
      }

      if (d.senhaAlterada) {
        // A troca de senha derruba todas as sessões, inclusive esta. Mandar
        // para o login é o que faz a tela contar a verdade sobre o que
        // acabou de acontecer, em vez de dar erro no próximo clique.
        mostrar({
          titulo: "Senha alterada",
          descricao: "Entre de novo com a senha nova.",
          variante: "sucesso",
        });
        router.replace("/login");
        router.refresh();
        return;
      }

      mostrar({ titulo: "Conta atualizada", variante: "sucesso" });
      setSenhaAtual("");
      setSalvando(false);
      router.refresh();
    } catch {
      mostrar({ titulo: "Sem conexão", variante: "erro" });
      setSalvando(false);
    }
  }

  async function encerrarOutras() {
    if (encerrando) return;
    setEncerrando(true);
    try {
      const r = await fetch("/api/conta", { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        mostrar({ titulo: d.erro ?? "Não foi possível encerrar", variante: "erro" });
      } else {
        mostrar({
          titulo:
            d.encerradas === 1
              ? "1 aparelho desconectado"
              : `${d.encerradas} aparelhos desconectados`,
          variante: "sucesso",
        });
        router.refresh();
      }
    } catch {
      mostrar({ titulo: "Sem conexão", variante: "erro" });
    }
    setEncerrando(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card titulo="Dados de acesso">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <Input
            rotulo="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
          />
          <Input
            rotulo="E-mail"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={160}
            dica="É com ele que você entra no sistema."
          />
        </div>
      </Card>

      <Card titulo="Trocar a senha">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <Input
            rotulo="Senha atual"
            type="password"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            rotulo="Nova senha"
            type="password"
            autoComplete="new-password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="••••••••"
            dica={`Mínimo de ${SENHA_MINIMA} caracteres. Trocar a senha desconecta todos os aparelhos, inclusive este.`}
          />
        </div>
      </Card>

      <Card titulo="Aparelhos conectados">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-medium">
              {outrasSessoes === 0
                ? "Nenhum outro aparelho conectado"
                : outrasSessoes === 1
                  ? "1 outro aparelho conectado"
                  : `${outrasSessoes} outros aparelhos conectados`}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-text-muted">
              {outrasSessoes === 0
                ? "Só esta sessão está ativa."
                : "Encerrar não afeta este aparelho — você continua conectado aqui."}
            </p>
          </div>
          {outrasSessoes > 0 ? (
            <Button
              variante="secundario"
              onClick={encerrarOutras}
              carregando={encerrando}
            >
              <LogOut className="size-4" />
              Encerrar as outras
            </Button>
          ) : (
            <ShieldCheck className="size-5 shrink-0 text-ok" />
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={!mudou} carregando={salvando}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
