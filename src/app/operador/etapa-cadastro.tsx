"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, CarFront, Search, UserPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatarPlaca } from "@/lib/placa";
import { cn, mascararCpf, mascararTelefone } from "@/lib/utils";

type PessoaEncontrada = {
  id: string;
  nome: string;
  telefone: string | null;
  documento: string | null;
  bloqueado: boolean;
};

/**
 * Placa desconhecida.
 *
 * Não é um erro — é o começo de um cadastro. O objetivo aqui é o mínimo
 * necessário para atender agora; o cadastro completo fica para o painel.
 */
export function EtapaCadastro({
  placa,
  aoCancelar,
  aoCadastrar,
  salvando,
}: {
  placa: string;
  aoCancelar: () => void;
  aoCadastrar: () => void;
  salvando: boolean;
}) {
  const [modelo, setModelo] = useState("");
  const [marca, setMarca] = useState("");
  const [tipo, setTipo] = useState("CARRO");

  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<PessoaEncontrada[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [pessoaNome, setPessoaNome] = useState<string | null>(null);

  const [novaPessoa, setNovaPessoa] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [documento, setDocumento] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Busca conforme digita, com folga suficiente para não disparar a cada tecla.
  useEffect(() => {
    if (pessoaId || novaPessoa || busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setBuscando(true);
      try {
        const r = await fetch(
          `/api/pessoas/buscar?q=${encodeURIComponent(busca.trim())}`,
          { signal: ac.signal },
        );
        const d = await r.json();
        setResultados(d.pessoas ?? []);
      } catch {
        /* busca cancelada ou offline: a tela segue utilizável */
      } finally {
        setBuscando(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [busca, pessoaId, novaPessoa]);

  const podeSalvar = Boolean(pessoaId) || (novaPessoa && nome.trim().length >= 3);

  async function salvar() {
    if (enviando || !podeSalvar) return;
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/operador/cadastro-rapido", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placa,
          modelo: modelo || null,
          marca: marca || null,
          tipo,
          pessoaId,
          pessoaNova: pessoaId
            ? null
            : { nome, telefone: telefone || null, documento: documento || null },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível cadastrar.");
        setEnviando(false);
        return;
      }
      // Recarrega a consulta: o veredito agora tem veículo e condutor reais.
      aoCadastrar();
    } catch {
      setErro("Sem conexão. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-area flex-1 px-4 pb-6 pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft">
            <CarFront className="size-7 text-brand-on-soft" />
          </div>
          <h1 className="mt-3.5 text-xl font-semibold tracking-[-0.01em]">
            Veículo não cadastrado
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Registre o essencial para atender agora
          </p>
          <p className="mt-4 font-mono text-2xl font-semibold tracking-[0.14em] selectable">
            {formatarPlaca(placa)}
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              rotulo="Marca"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Fiat"
              autoCapitalize="words"
            />
            <Input
              rotulo="Modelo"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Strada"
              autoCapitalize="words"
            />
          </div>

          <Select
            rotulo="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="CARRO">Carro</option>
            <option value="MOTO">Moto</option>
            <option value="CAMINHAO">Caminhão</option>
            <option value="ONIBUS">Ônibus</option>
            <option value="MAQUINA">Máquina</option>
            <option value="OUTRO">Outro</option>
          </Select>

          <div className="border-t border-border pt-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Condutor
            </h2>

            {pessoaId ? (
              <div className="flex items-center gap-3 rounded-app border border-brand bg-brand-soft p-3.5">
                <Check className="size-5 shrink-0 text-brand-on-soft" />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">
                  {pessoaNome}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPessoaId(null);
                    setPessoaNome(null);
                    setBusca("");
                  }}
                  className="shrink-0 text-sm font-medium text-brand-on-soft underline-offset-2 hover:underline"
                >
                  Trocar
                </button>
              </div>
            ) : novaPessoa ? (
              <div className="flex flex-col gap-3.5">
                <Input
                  rotulo="Nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoCapitalize="words"
                  autoFocus
                  placeholder="Nome do condutor"
                />
                <Input
                  rotulo="Telefone (opcional)"
                  value={mascararTelefone(telefone)}
                  onChange={(e) => setTelefone(e.target.value)}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                />
                <Input
                  rotulo="CPF (opcional)"
                  value={mascararCpf(documento)}
                  onChange={(e) => setDocumento(e.target.value)}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
                <button
                  type="button"
                  onClick={() => setNovaPessoa(false)}
                  className="self-start text-sm font-medium text-brand"
                >
                  Buscar pessoa já cadastrada
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, telefone ou CPF"
                  autoCapitalize="words"
                  prefixo={<Search className="size-4.5" />}
                  sufixo={
                    buscando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : undefined
                  }
                />

                {resultados.length > 0 && (
                  <ul className="overflow-hidden rounded-app border border-border bg-surface">
                    {resultados.map((p, i) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPessoaId(p.id);
                            setPessoaNome(p.nome);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2",
                            i > 0 && "border-t border-border",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.9375rem] font-medium">
                              {p.nome}
                            </span>
                            {p.telefone && (
                              <span className="block truncate text-xs text-text-muted">
                                {mascararTelefone(p.telefone)}
                              </span>
                            )}
                          </span>
                          {p.bloqueado && (
                            <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
                              Bloqueado
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {busca.trim().length >= 2 &&
                  !buscando &&
                  resultados.length === 0 && (
                    <p className="px-1 text-sm text-text-muted">
                      Ninguém encontrado com “{busca.trim()}”.
                    </p>
                  )}

                <Button
                  type="button"
                  variante="secundario"
                  larguraTotal
                  onClick={() => {
                    setNovaPessoa(true);
                    setNome(busca.trim());
                  }}
                >
                  <UserPlus className="size-5" />
                  Cadastrar nova pessoa
                </Button>
              </div>
            )}
          </div>

          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}
        </div>
      </div>

      <div className="safe-bottom shrink-0 border-t border-border bg-bg-elevated px-4 pb-3 pt-3">
        <div className="flex gap-2.5">
          <Button
            variante="secundario"
            tamanho="xl"
            onClick={aoCancelar}
            disabled={enviando || salvando}
            aria-label="Voltar"
            className="px-5"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            tamanho="xl"
            larguraTotal
            onClick={salvar}
            disabled={!podeSalvar}
            carregando={enviando || salvando}
          >
            Cadastrar e continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
