"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, Check, X, Ban, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatarPlaca } from "@/lib/placa";
import { cn, moeda } from "@/lib/utils";
import type { Condutor, ConsultaResposta, VereditoCliente } from "@/lib/tipos";
import type { ResumoFinal } from "./atendimento";

/** Aceita "62,5" e "62.5" — o operador digita como o teclado dele oferece. */
function paraNumero(v: string): number | null {
  const limpo = v.replace(/\./g, "").replace(",", ".").trim();
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const COMBUSTIVEIS_PADRAO = [
  "Diesel S10",
  "Diesel S500",
  "Gasolina comum",
  "Etanol",
];

export function EtapaRegistro({
  consulta,
  condutor,
  chaveIdempotencia,
  combustiveis,
  foto,
  aoFotografar,
  autorizacao,
  aoVoltar,
  aoConcluir,
  aoAvisar,
}: {
  consulta: ConsultaResposta;
  condutor: Condutor | null;
  chaveIdempotencia: string;
  combustiveis: string[];
  foto: { arquivo: File; url: string } | null;
  aoFotografar: (f: File | null) => void;
  autorizacao: string | null;
  aoVoltar: () => void;
  aoConcluir: (r: ResumoFinal) => void;
  aoAvisar: (t: { titulo: string; descricao?: string; variante?: "sucesso" | "erro" | "aviso" | "info" }) => void;
}) {
  const [litros, setLitros] = useState("");
  const [valor, setValor] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [hodometro, setHodometro] = useState("");
  const [observacao, setObservacao] = useState("");
  const [mostrarObs, setMostrarObs] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [bloqueio, setBloqueio] = useState<VereditoCliente | null>(null);

  const inputFoto = useRef<HTMLInputElement>(null);

  /**
   * A chave protege contra o toque duplo do MESMO envio. Quando o servidor
   * bloqueia e o operador corrige os litros, isso e um envio novo — se
   * reusassemos a chave, a correcao voltaria o resultado antigo em cache.
   */
  const chaveRef = useRef(chaveIdempotencia);

  const opcoesCombustivel = useMemo(() => {
    const vistos = new Set<string>();
    return [...combustiveis, ...COMBUSTIVEIS_PADRAO]
      .filter((c) => {
        const k = c.toLowerCase();
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .slice(0, 5);
  }, [combustiveis]);

  const litrosNum = paraNumero(litros);
  const valorNum = paraNumero(valor);
  const precoLitro =
    litrosNum && valorNum ? valorNum / litrosNum : null;

  async function enviar() {
    if (enviando) return;
    if (!litrosNum) {
      setErro("Informe quantos litros foram abastecidos.");
      return;
    }
    setErro(null);
    setBloqueio(null);
    setEnviando(true);

    try {
      // A foto sobe antes: se ela falhar, o registro nem e tentado e o
      // operador nao fica com um atendimento gravado sem imagem.
      let fotoChave: string | null = null;
      if (foto) {
        const fd = new FormData();
        fd.append("foto", foto.arquivo);
        const rf = await fetch("/api/fotos", { method: "POST", body: fd });
        const df = await rf.json().catch(() => ({}));
        if (!rf.ok) {
          setErro(df.erro ?? "Não foi possível enviar a foto.");
          setEnviando(false);
          return;
        }
        fotoChave = df.chave;
      }

      const r = await fetch("/api/operador/registrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chaveIdempotencia: chaveRef.current,
          placa: consulta.placa,
          veiculoId: consulta.veiculo?.id ?? null,
          pessoaId: condutor?.id ?? null,
          litros: litrosNum,
          valor: valorNum,
          combustivel: combustivel || null,
          hodometro: hodometro ? Number(hodometro.replace(/\D/g, "")) : null,
          observacao: observacao || null,
          fotoChave,
          autorizar: Boolean(autorizacao),
          justificativa: autorizacao,
        }),
      });
      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível registrar.");
        setEnviando(false);
        return;
      }

      if (d.repetido) {
        aoAvisar({
          titulo: "Já registrado",
          descricao: "Este atendimento havia sido gravado.",
          variante: "info",
        });
      }

      const resultado: string = d.abastecimento?.resultado ?? "LIBERADO";

      // Bloqueio que só apareceu agora: quase sempre é regra de volume,
      // que a consulta não tinha como avaliar sem saber os litros.
      if (resultado === "BLOQUEADO") {
        setBloqueio(d.veredito ?? null);
        // Envio novo exige chave nova, senão a correção volta em cache.
        chaveRef.current = crypto.randomUUID();
        setEnviando(false);
        return;
      }

      aoConcluir({
        placa: consulta.placa,
        condutor: condutor?.nome ?? null,
        litros: litrosNum,
        valor: valorNum,
        resultado,
        criadoEm: d.abastecimento?.criadoEm ?? new Date().toISOString(),
      });
    } catch {
      setErro("Sem conexão. O atendimento não foi gravado — tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-area flex-1 px-4 pb-6 pt-5">
        {/* Contexto compacto: o operador precisa confirmar de relance que
            está registrando para o carro certo. */}
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5">
          <span className="font-mono text-lg font-semibold tracking-[0.1em] selectable">
            {formatarPlaca(consulta.placa)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
            {condutor?.nome ?? "Sem condutor"}
          </span>
        </div>

        {autorizacao && (
          <div className="mt-3 flex items-start gap-2.5 rounded-app border border-warn/30 bg-warn-soft px-3.5 py-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-warn">
                Autorização excepcional
              </p>
              <p className="mt-0.5 text-sm leading-snug text-text-secondary">
                {autorizacao}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label
              htmlFor="litros"
              className="mb-1.5 block text-sm font-medium text-text-secondary"
            >
              Litros abastecidos
            </label>
            {/* Campo grande e teclado decimal: é o dado que o operador
                digita em toda operação. */}
            <div className="relative">
              <input
                id="litros"
                value={litros}
                onChange={(e) => {
                  setLitros(e.target.value.replace(/[^\d.,]/g, ""));
                  setErro(null);
                }}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                autoFocus
                className={cn(
                  "h-16 w-full rounded-card border-2 bg-surface pr-12 text-right",
                  "font-mono text-[1.75rem] font-semibold tabular-nums",
                  "pl-4 transition-[border-color,box-shadow] duration-150",
                  "focus:outline-none focus:ring-4 focus:ring-brand/15",
                  erro && !litrosNum
                    ? "border-danger"
                    : "border-border focus:border-brand",
                )}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium text-text-muted">
                L
              </span>
            </div>
          </div>

          <Input
            rotulo="Valor total (opcional)"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="0,00"
            prefixo={<span className="text-sm font-medium">R$</span>}
            className="text-right font-mono tabular-nums"
            dica={
              precoLitro
                ? `Equivale a ${moeda(precoLitro)} por litro.`
                : undefined
            }
          />

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-secondary">
              Combustível
            </span>
            <div className="flex flex-wrap gap-2">
              {opcoesCombustivel.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCombustivel(combustivel === c ? "" : c)}
                  className={cn(
                    "h-10 rounded-app border px-3.5 text-sm font-medium transition-all active:scale-95",
                    combustivel === c
                      ? "border-brand bg-brand-soft text-brand-on-soft"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-2",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <Input
            rotulo="Hodômetro (opcional)"
            value={hodometro}
            onChange={(e) => setHodometro(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="km"
            className="text-right font-mono tabular-nums"
          />

          {/* Foto: pode ser tirada aqui se não foi na etapa da placa. */}
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => aoFotografar(e.target.files?.[0] ?? null)}
          />
          {foto ? (
            <div className="flex items-center gap-3 rounded-app border border-border bg-surface p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.url}
                alt="Foto do atendimento"
                className="size-14 rounded-[0.625rem] object-cover"
              />
              <p className="min-w-0 flex-1 text-sm font-medium">Foto anexada</p>
              <button
                type="button"
                onClick={() => aoFotografar(null)}
                aria-label="Remover foto"
                className="flex size-9 items-center justify-center rounded-app text-text-muted transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
              >
                <X className="size-4.5" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variante="secundario"
              larguraTotal
              onClick={() => inputFoto.current?.click()}
            >
              <Camera className="size-5" />
              Anexar foto
            </Button>
          )}

          {mostrarObs ? (
            <Textarea
              rotulo="Observação"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={500}
              placeholder="Algo fora do comum neste atendimento?"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setMostrarObs(true)}
              className="self-start text-sm font-medium text-brand transition-opacity hover:opacity-75"
            >
              + Adicionar observação
            </button>
          )}

          {bloqueio && (
            <div className="rounded-card border border-danger/25 bg-danger-soft p-4 anim-subir">
              <div className="flex items-center gap-2 text-danger">
                <Ban className="size-4.5 shrink-0" />
                <h3 className="text-sm font-semibold">
                  Bloqueado com este volume
                </h3>
              </div>
              {bloqueio.bloqueios.map((b) => (
                <p key={b.regraId} className="mt-2 text-sm leading-snug">
                  {b.mensagem}
                </p>
              ))}
              <p className="mt-2.5 text-xs text-text-secondary">
                Ajuste os litros ou chame um supervisor para autorizar.
              </p>
            </div>
          )}

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
            onClick={aoVoltar}
            disabled={enviando}
            aria-label="Voltar"
            className="px-5"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            tamanho="xl"
            larguraTotal
            onClick={enviar}
            carregando={enviando}
            variante={autorizacao ? "sucesso" : "primario"}
          >
            {!enviando && <Check className="size-5" strokeWidth={2.5} />}
            {enviando ? "Registrando…" : "Confirmar abastecimento"}
          </Button>
        </div>
      </div>
    </div>
  );
}
