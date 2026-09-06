"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { mascararCpf, mascararTelefone, soDigitos, cpfValido } from "@/lib/utils";

export type PessoaForm = {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  observacao: string | null;
};

/**
 * Cadastro e edição de pessoa.
 *
 * Sem `pessoa`, cria; com `pessoa`, edita. O mesmo componente nos dois casos
 * porque os campos são os mesmos — duplicar o formulário só criaria duas
 * versões para manter em sincronia.
 */
export function FormularioPessoa({ pessoa }: { pessoa?: PessoaForm }) {
  const router = useRouter();
  const { mostrar } = useToast();
  const editando = Boolean(pessoa);

  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(pessoa?.nome ?? "");
  const [documento, setDocumento] = useState(pessoa?.documento ?? "");
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? "");
  const [email, setEmail] = useState(pessoa?.email ?? "");
  const [observacao, setObservacao] = useState(pessoa?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cpfPreenchido = soDigitos(documento).length > 0;
  const cpfErrado = cpfPreenchido && !cpfValido(documento);

  function abrir() {
    setNome(pessoa?.nome ?? "");
    setDocumento(pessoa?.documento ?? "");
    setTelefone(pessoa?.telefone ?? "");
    setEmail(pessoa?.email ?? "");
    setObservacao(pessoa?.observacao ?? "");
    setErro(null);
    setAberto(true);
  }

  async function salvar() {
    if (salvando) return;
    if (nome.trim().length < 3) {
      setErro("Informe o nome completo.");
      return;
    }
    if (cpfErrado) {
      setErro("CPF inválido.");
      return;
    }
    setErro(null);
    setSalvando(true);

    try {
      const resp = await fetch(
        pessoa ? `/api/pessoas/${pessoa.id}` : "/api/pessoas",
        {
          method: pessoa ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nome: nome.trim(),
            documento: soDigitos(documento) || null,
            telefone: soDigitos(telefone) || null,
            email: email.trim() || null,
            observacao: observacao.trim() || null,
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
        titulo: editando ? "Cadastro atualizado" : "Pessoa cadastrada",
        descricao: nome.trim(),
        variante: "sucesso",
      });
      setAberto(false);
      setSalvando(false);
      if (!editando && d.pessoa?.id) router.push(`/admin/pessoas/${d.pessoa.id}`);
      else router.refresh();
    } catch {
      setErro("Sem conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <>
      {editando ? (
        <Button variante="secundario" onClick={abrir}>
          <Pencil className="size-4" />
          Editar
        </Button>
      ) : (
        <Button onClick={abrir}>
          <Plus className="size-4.5" strokeWidth={2.5} />
          Nova pessoa
        </Button>
      )}

      <Sheet
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? "Editar pessoa" : "Nova pessoa"}
        focoInicial={editando ? "painel" : "campo"}
        rodape={
          <>
            <Button
              variante="secundario"
              larguraTotal
              onClick={() => setAberto(false)}
            >
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
            rotulo="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoCapitalize="words"
            maxLength={120}
          />
          <Input
            rotulo="CPF"
            value={mascararCpf(documento)}
            onChange={(e) => {
              setDocumento(e.target.value);
              setErro(null);
            }}
            inputMode="numeric"
            placeholder="000.000.000-00"
            erro={cpfErrado ? "CPF inválido." : undefined}
            dica={!cpfErrado ? "Opcional. Evita cadastro duplicado." : undefined}
          />
          <Input
            rotulo="Telefone"
            value={mascararTelefone(telefone)}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="tel"
            placeholder="(00) 00000-0000"
          />
          <Input
            rotulo="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="none"
            placeholder="opcional"
          />
          <Textarea
            rotulo="Observação"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            maxLength={500}
            placeholder="Informações internas sobre esta pessoa."
          />
          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
