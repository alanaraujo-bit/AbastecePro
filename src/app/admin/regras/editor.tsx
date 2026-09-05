"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatarPlaca } from "@/lib/placa";
import { cn } from "@/lib/utils";
import {
  descreverRegra,
  OPCOES_ACAO,
  OPCOES_ESCOPO,
  OPCOES_JANELA,
  OPCOES_METRICA,
} from "@/lib/regras/descrever";
import type { RegraCliente } from "./lista";

type Alvo = { id: string; rotulo: string } | null;

/** Select inline, do tamanho do conteúdo, para compor a frase. */
function SelectFrase({
  valor,
  aoMudar,
  opcoes,
  rotuloAcessivel,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: readonly { valor: string; rotulo: string }[];
  rotuloAcessivel: string;
}) {
  return (
    <select
      aria-label={rotuloAcessivel}
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      className="h-9 cursor-pointer rounded-app border border-border bg-surface px-2.5 text-[0.9375rem] font-medium text-text focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/12"
    >
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}

export function EditorRegra({
  regra,
  aoFechar,
  aoSalvar,
}: {
  regra: RegraCliente | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { mostrar } = useToast();
  const editando = Boolean(regra);

  const [nome, setNome] = useState(regra?.nome ?? "");
  const [descricao, setDescricao] = useState(regra?.descricao ?? "");
  const [escopo, setEscopo] = useState(regra?.escopo ?? "PESSOA");
  const [metrica, setMetrica] = useState(regra?.metrica ?? "LITROS");
  const [janela, setJanela] = useState(regra?.janela ?? "SEMANA");
  const [janelaHoras, setJanelaHoras] = useState(
    String(regra?.janelaHoras ?? 6),
  );
  const [limite, setLimite] = useState(
    regra ? String(regra.limite).replace(".", ",") : "",
  );
  const [acao, setAcao] = useState(regra?.acao ?? "BLOQUEAR");
  const [prioridade, setPrioridade] = useState(String(regra?.prioridade ?? 100));
  const [mensagem, setMensagem] = useState(regra?.mensagem ?? "");
  const [alvo, setAlvo] = useState<Alvo>(
    regra?.alvoNome
      ? {
          id: regra.alvoPessoaId ?? regra.alvoVeiculoId ?? "",
          rotulo: regra.alvoNome,
        }
      : null,
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const limiteNum = Number(limite.replace(/\./g, "").replace(",", "."));
  const limiteValido = Number.isFinite(limiteNum) && limiteNum > 0;

  // Escopo global não tem alvo: manter um selecionado deixaria a regra
  // descrevendo algo que ela não faz.
  useEffect(() => {
    if (escopo === "GLOBAL") setAlvo(null);
  }, [escopo]);

  const previa = useMemo(
    () =>
      descreverRegra({
        escopo,
        metrica,
        janela,
        janelaHoras: Number(janelaHoras) || 24,
        limite: limiteValido ? limiteNum : 0,
        acao,
        alvoNome: alvo?.rotulo ?? null,
      }),
    [escopo, metrica, janela, janelaHoras, limiteNum, limiteValido, acao, alvo],
  );

  async function salvar() {
    if (salvando) return;
    if (nome.trim().length < 3) {
      setErro("Dê um nome à regra (mínimo 3 caracteres).");
      return;
    }
    if (!limiteValido) {
      setErro("Informe um limite maior que zero.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const corpo = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      ativo: regra?.ativo ?? true,
      prioridade: Number(prioridade) || 100,
      escopo,
      metrica,
      janela,
      janelaHoras: janela === "HORAS" ? Number(janelaHoras) || 24 : null,
      limite: limiteNum,
      acao,
      mensagem: mensagem.trim() || null,
      alvoPessoaId: escopo === "PESSOA" ? (alvo?.id ?? null) : null,
      alvoVeiculoId: escopo === "VEICULO" ? (alvo?.id ?? null) : null,
    };

    try {
      const resp = await fetch(
        regra ? `/api/regras/${regra.id}` : "/api/regras",
        {
          method: regra ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corpo),
        },
      );
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(d.erro ?? "Não foi possível salvar.");
        setSalvando(false);
        return;
      }
      mostrar({
        titulo: editando ? "Regra atualizada" : "Regra criada",
        descricao: nome.trim(),
        variante: "sucesso",
      });
      aoSalvar();
    } catch {
      setErro("Sem conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo={editando ? "Editar regra" : "Nova regra"}
      descricao="A frase abaixo é exatamente o que esta regra vai fazer."
      larguraMaxima="max-w-lg"
      rodape={
        <>
          <Button variante="secundario" larguraTotal onClick={aoFechar}>
            Cancelar
          </Button>
          <Button larguraTotal onClick={salvar} carregando={salvando}>
            {editando ? "Salvar" : "Criar regra"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2 pt-1">
        <Input
          rotulo="Nome da regra"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Teto semanal por pessoa"
          autoFocus={!editando}
          maxLength={120}
        />

        {/* ---------- Construtor em forma de frase ---------- */}
        <div>
          <span className="mb-2 block text-sm font-medium text-text-secondary">
            Comportamento
          </span>
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface-2 p-3">
            <SelectFrase
              rotuloAcessivel="Ação"
              valor={acao}
              aoMudar={setAcao}
              opcoes={OPCOES_ACAO}
            />
            <SelectFrase
              rotuloAcessivel="Escopo"
              valor={escopo}
              aoMudar={setEscopo}
              opcoes={OPCOES_ESCOPO}
            />
            <span className="text-sm text-text-muted">acima de</span>
            <input
              value={limite}
              onChange={(e) => {
                setLimite(e.target.value.replace(/[^\d.,]/g, ""));
                setErro(null);
              }}
              inputMode="decimal"
              placeholder="0"
              aria-label="Limite"
              className="h-9 w-20 rounded-app border border-border bg-surface px-2.5 text-right font-mono text-[0.9375rem] font-semibold tabular-nums focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/12"
            />
            <SelectFrase
              rotuloAcessivel="Métrica"
              valor={metrica}
              aoMudar={setMetrica}
              opcoes={OPCOES_METRICA}
            />
            <SelectFrase
              rotuloAcessivel="Janela"
              valor={janela}
              aoMudar={setJanela}
              opcoes={OPCOES_JANELA}
            />
            {janela === "HORAS" && (
              <>
                <input
                  value={janelaHoras}
                  onChange={(e) =>
                    setJanelaHoras(e.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  aria-label="Horas da janela"
                  className="h-9 w-16 rounded-app border border-border bg-surface px-2.5 text-right font-mono text-[0.9375rem] font-semibold tabular-nums focus:border-brand focus:outline-none"
                />
                <span className="text-sm text-text-muted">horas</span>
              </>
            )}
          </div>

          {/* Pré-visualização: mesma função que a lista usa, então o que se
              lê aqui é literalmente o que vai aparecer depois. */}
          <p
            className={cn(
              "mt-2 rounded-app px-3.5 py-2.5 text-[0.9375rem] font-medium",
              limiteValido
                ? "bg-brand-soft text-brand-on-soft"
                : "bg-surface-2 text-text-muted",
            )}
            aria-live="polite"
          >
            {limiteValido ? previa : "Informe um limite para ver o efeito."}
          </p>
        </div>

        {/* ---------- Alvo específico ---------- */}
        {escopo !== "GLOBAL" && (
          <SeletorAlvo escopo={escopo} alvo={alvo} aoEscolher={setAlvo} />
        )}

        <Input
          rotulo="Prioridade"
          value={prioridade}
          onChange={(e) => setPrioridade(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          dica="Menor número é avaliado primeiro. Define qual motivo aparece no topo quando mais de uma regra bloqueia."
          className="w-28 text-right font-mono tabular-nums"
        />

        <Textarea
          rotulo="Mensagem para o operador (opcional)"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={300}
          placeholder="Deixe em branco para usar a mensagem automática."
          dica="Aceita {limite}, {atual}, {restante} e {janela} — trocados pelos números reais no momento do bloqueio."
        />

        <Textarea
          rotulo="Descrição interna (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={500}
          placeholder="Por que esta regra existe?"
        />

        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Busca de pessoa ou veículo para restringir a regra a um alvo. */
function SeletorAlvo({
  escopo,
  alvo,
  aoEscolher,
}: {
  escopo: string;
  alvo: Alvo;
  aoEscolher: (a: Alvo) => void;
}) {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<{ id: string; rotulo: string }[]>([]);
  const [buscando, setBuscando] = useState(false);

  const ehPessoa = escopo === "PESSOA";

  useEffect(() => {
    if (alvo || busca.trim().length < 2) {
      setItens([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const url = ehPessoa
          ? `/api/pessoas/buscar?q=${encodeURIComponent(busca.trim())}`
          : `/api/veiculos/buscar?q=${encodeURIComponent(busca.trim())}`;
        const r = await fetch(url);
        const d = await r.json();
        setItens(
          ehPessoa
            ? (d.pessoas ?? []).map((p: { id: string; nome: string }) => ({
                id: p.id,
                rotulo: p.nome,
              }))
            : (d.veiculos ?? []).map((v: { id: string; placa: string }) => ({
                id: v.id,
                rotulo: formatarPlaca(v.placa),
              })),
        );
      } catch {
        /* offline: o campo continua utilizável, só não sugere */
      } finally {
        setBuscando(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [busca, alvo, ehPessoa]);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-text-secondary">
        Aplicar somente a {ehPessoa ? "uma pessoa" : "um veículo"} (opcional)
      </span>

      {alvo ? (
        <div className="flex items-center gap-3 rounded-app border border-brand bg-brand-soft px-3.5 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">
            {alvo.rotulo}
          </span>
          <button
            type="button"
            onClick={() => {
              aoEscolher(null);
              setBusca("");
            }}
            aria-label="Remover alvo"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-brand-on-soft transition-colors hover:bg-brand/15"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={ehPessoa ? "Nome, telefone ou CPF" : "Placa ou modelo"}
            prefixo={<Search className="size-4.5" />}
            sufixo={
              buscando ? <Loader2 className="size-4 animate-spin" /> : undefined
            }
            dica="Deixe vazio para a regra valer para todos."
          />
          {itens.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-app border border-border bg-surface">
              {itens.map((i, idx) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => aoEscolher(i)}
                    className={cn(
                      "w-full px-3.5 py-2.5 text-left text-[0.9375rem] transition-colors hover:bg-surface-2",
                      idx > 0 && "border-t border-border",
                    )}
                  >
                    {i.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
