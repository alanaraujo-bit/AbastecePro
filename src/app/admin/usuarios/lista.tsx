"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, ShieldCheck, Eye, EyeOff } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Card, Etiqueta } from "@/components/admin/ui";
import { cn, iniciais, tempoRelativo, numero } from "@/lib/utils";

export type UsuarioCliente = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  criadoEm: string;
  atendimentos: number;
  ultimoAcesso: string | null;
  ehEuMesmo: boolean;
};

const PAPEIS = [
  {
    valor: "OPERADOR",
    rotulo: "Operador",
    resumo: "Só o fluxo de atendimento.",
  },
  {
    valor: "SUPERVISOR",
    rotulo: "Supervisor",
    resumo: "Atende, autoriza exceções e consulta relatórios.",
  },
  {
    valor: "ADMIN",
    rotulo: "Administrador",
    resumo: "Acesso total, incluindo regras e usuários.",
  },
];

const TOM_PAPEL: Record<string, "brand" | "warn" | "neutro"> = {
  ADMIN: "brand",
  SUPERVISOR: "warn",
  OPERADOR: "neutro",
};

const SENHA_MINIMA = 10;

export function ListaUsuarios({ usuarios }: { usuarios: UsuarioCliente[] }) {
  const [editando, setEditando] = useState<UsuarioCliente | null>(null);
  const [criando, setCriando] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <p className="text-sm text-text-secondary">
          {usuarios.filter((u) => u.ativo).length} ativo(s) de {usuarios.length}
        </p>
        <Button className="ml-auto" onClick={() => setCriando(true)}>
          <Plus className="size-4.5" strokeWidth={2.5} />
          Novo usuário
        </Button>
      </div>

      <Card>
        <ul>
          {usuarios.map((u, i) => (
            <li
              key={u.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 sm:px-5",
                i > 0 && "border-t border-border",
                !u.ativo && "opacity-60",
              )}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[0.8125rem] font-semibold text-text-secondary"
                aria-hidden
              >
                {iniciais(u.nome)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[0.9375rem] font-medium">
                    {u.nome}
                  </span>
                  <Etiqueta tom={TOM_PAPEL[u.papel] ?? "neutro"}>
                    {PAPEIS.find((p) => p.valor === u.papel)?.rotulo ?? u.papel}
                  </Etiqueta>
                  {u.ehEuMesmo && <Etiqueta>Você</Etiqueta>}
                  {!u.ativo && <Etiqueta tom="danger">Desativado</Etiqueta>}
                </div>
                <p className="truncate text-sm text-text-muted selectable">
                  {u.email}
                </p>
              </div>

              <div className="hidden shrink-0 text-right text-xs text-text-muted sm:block">
                <p>
                  {u.ultimoAcesso
                    ? `Ativo ${tempoRelativo(u.ultimoAcesso)}`
                    : "Nunca acessou"}
                </p>
                {u.atendimentos > 0 && (
                  <p className="tabular-nums">
                    {numero(u.atendimentos)} atendimentos
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setEditando(u)}
                aria-label={`Editar ${u.nome}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <Pencil className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {(criando || editando) && (
        <EditorUsuario
          usuario={editando}
          aoFechar={() => {
            setCriando(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function EditorUsuario({
  usuario,
  aoFechar,
}: {
  usuario: UsuarioCliente | null;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const editando = Boolean(usuario);

  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [papel, setPapel] = useState(usuario?.papel ?? "OPERADOR");
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const senhaCurta = senha.length > 0 && senha.length < SENHA_MINIMA;

  async function salvar() {
    if (salvando) return;
    if (nome.trim().length < 3) return setErro("Informe o nome.");
    if (!email.includes("@")) return setErro("Informe um e-mail válido.");
    if (!editando && senha.length < SENHA_MINIMA) {
      return setErro(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
    }
    if (senhaCurta) {
      return setErro(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
    }

    setErro(null);
    setSalvando(true);
    try {
      const resp = await fetch(
        usuario ? `/api/usuarios/${usuario.id}` : "/api/usuarios",
        {
          method: usuario ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nome: nome.trim(),
            email: email.trim().toLowerCase(),
            papel,
            ativo,
            ...(senha ? { senha } : {}),
          }),
        },
      );
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(d.erro ?? "Não foi possível salvar.");
        setSalvando(false);
        return;
      }
      mostrar({
        titulo: editando ? "Usuário atualizado" : "Usuário criado",
        descricao: d.sessoesRevogadas
          ? "As sessões abertas foram encerradas."
          : nome.trim(),
        variante: "sucesso",
      });
      aoFechar();
      router.refresh();
    } catch {
      setErro("Sem conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  const resumoPapel = PAPEIS.find((p) => p.valor === papel)?.resumo;

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo={editando ? "Editar usuário" : "Novo usuário"}
      focoInicial={editando ? "painel" : "campo"}
      rodape={
        <>
          <Button variante="secundario" larguraTotal onClick={aoFechar}>
            Cancelar
          </Button>
          <Button larguraTotal onClick={salvar} carregando={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2 pt-1">
        <Input
          rotulo="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoCapitalize="words"
        />
        <Input
          rotulo="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />

        <div>
          <Select
            rotulo="Permissão"
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Select>
          {/* O resumo evita que a escolha do papel dependa de adivinhação. */}
          {resumoPapel && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-text-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              {resumoPapel}
            </p>
          )}
        </div>

        <Input
          rotulo={editando ? "Nova senha (deixe vazio para manter)" : "Senha"}
          type={verSenha ? "text" : "password"}
          value={senha}
          onChange={(e) => {
            setSenha(e.target.value);
            setErro(null);
          }}
          autoComplete="new-password"
          erro={senhaCurta ? `Mínimo de ${SENHA_MINIMA} caracteres.` : undefined}
          dica={
            !senhaCurta && editando
              ? "Trocar a senha encerra as sessões abertas deste usuário."
              : undefined
          }
          sufixo={
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
              className="pointer-events-auto -m-2 p-2 text-text-muted hover:text-text"
            >
              {verSenha ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          }
        />

        {editando && !usuario?.ehEuMesmo && (
          <label className="flex items-center gap-3 rounded-app border border-border bg-surface p-3.5">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium">
                Usuário ativo
              </span>
              <span className="block text-sm text-text-muted">
                Desativar encerra as sessões abertas imediatamente.
              </span>
            </span>
          </label>
        )}

        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}
      </div>
    </Sheet>
  );
}
