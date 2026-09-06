"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Loader2,
  X,
  WifiOff,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  TicketCheck,
  Ban,
  ShieldAlert,
  History,
  User,
} from "lucide-react";
import { PlacaInput } from "@/components/placa-input";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatarPlaca, placaValida } from "@/lib/placa";
import {
  cn,
  dataHora,
  mascararCpf,
  mascararTelefone,
  tempoRelativo,
} from "@/lib/utils";
import {
  aquecerOcr,
  lerPlacaDaFoto,
  type LeituraPlaca,
  type Recorte,
} from "@/lib/ocr-placa";
import { RecortePlaca } from "./recorte-placa";
import type { ConsultaResposta, VereditoCliente } from "@/lib/tipos";
import type { Recente } from "./atendimento";

/** A placa lida já existe no cadastro? É a confirmação mais forte possível. */
async function placaConhecida(placa: string): Promise<boolean> {
  const r = await fetch(`/api/veiculos/buscar?q=${encodeURIComponent(placa)}`);
  if (!r.ok) return false;
  const d = await r.json();
  return Boolean(d.veiculos?.some((v: { placa: string }) => v.placa === placa));
}

export type DadosLancamento = {
  nome: string;
  telefone: string;
  documento: string;
  marca: string;
  modelo: string;
  cor: string;
  tipo: string;
  observacao: string;
};

/**
 * O LANÇAMENTO — uma tela só.
 *
 * Antes eram três: digitar a placa, cadastrar veículo e pessoa, e então ver
 * o veredito. Quem usa isso tem alguém esperando na frente da mesa; obrigar
 * a "cadastrar antes de registrar" é impor trabalho de escritório no meio
 * do atendimento.
 *
 * A verificação não virou etapa: ela acontece sozinha assim que a placa
 * fica válida e aparece como um aviso ali, entre a placa e o botão. Assim a
 * pergunta que se faz de verdade — *essa placa já veio aqui?* — se responde
 * sem sair do lugar onde se está preenchendo.
 */
export function EtapaLancamento({
  placa,
  aoMudarPlaca,
  aoLerPlaca,
  consulta,
  vereditoTardio,
  consultando,
  erro,
  dados,
  aoMudarDados,
  foto,
  aoFotografar,
  salvando,
  aoRegistrar,
  recentes,
}: {
  placa: string;
  aoMudarPlaca: (v: string) => void;
  /** Placa vinda da foto: preenche o campo, mas nunca dispara a consulta. */
  aoLerPlaca: (v: string) => void;
  consulta: ConsultaResposta | null;
  /** Recusa que só apareceu ao registrar — ver `atendimento.tsx`. */
  vereditoTardio: VereditoCliente | null;
  consultando: boolean;
  erro: string | null;
  dados: DadosLancamento;
  aoMudarDados: (d: Partial<DadosLancamento>) => void;
  foto: { arquivo: File; url: string } | null;
  aoFotografar: (f: File | null) => void;
  salvando: boolean;
  /** `justificativa` só vem preenchida quando as regras bloquearam. */
  aoRegistrar: (justificativa: string | null) => void;
  recentes: Recente[];
}) {
  const inputFoto = useRef<HTMLInputElement>(null);
  const [recortando, setRecortando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [leitura, setLeitura] = useState<LeituraPlaca | null>(null);
  const [detalhes, setDetalhes] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [erroJust, setErroJust] = useState<string | null>(null);

  const completa = placa.length === 7;
  const placaInvalida = completa && !placaValida(placa);

  const veiculo = consulta?.veiculo ?? null;
  // O veredito do servidor tem precedência: ele viu a pessoa digitada, que
  // a consulta por placa não conhecia.
  const veredito = vereditoTardio ?? consulta?.veredito ?? null;
  const bloqueado = Boolean(veredito && !veredito.liberado);
  const conhecida = Boolean(veiculo);

  async function ler(recorte: Recorte) {
    if (!foto) return;
    setLendo(true);
    const r = await lerPlacaDaFoto(foto.url, recorte, placaConhecida);
    setLeitura(r);
    if (r.placa) aoLerPlaca(r.placa);
    setLendo(false);
    setRecortando(false);
  }

  function registrar() {
    if (!bloqueado) {
      aoRegistrar(null);
      return;
    }
    const j = justificativa.trim();
    if (j.length < 5) {
      setErroJust("Descreva o motivo — isso fica registrado na auditoria.");
      return;
    }
    aoRegistrar(j);
  }

  if (recortando && foto) {
    return (
      <RecortePlaca
        url={foto.url}
        lendo={lendo}
        aoConfirmar={ler}
        aoCancelar={() => setRecortando(false)}
      />
    );
  }

  const podeRegistrar = completa && !placaInvalida && dados.nome.trim().length >= 3;

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-area flex-1">
        <div className="px-4 pb-6 pt-6">
          <h1 className="text-center text-[1.375rem] font-semibold tracking-[-0.01em]">
            Registrar liberação
          </h1>
          <p className="mt-1 text-center text-sm text-text-muted">
            Placa, nome e telefone. O cadastro sai daqui mesmo.
          </p>

          {/* ---------------- Placa ---------------- */}
          <div className="mt-6">
            <PlacaInput
              valor={placa}
              aoMudar={(v) => {
                setLeitura(null);
                aoMudarPlaca(v);
              }}
              autoFoco
              invalido={placaInvalida}
              desabilitado={salvando}
            />
          </div>

          <div className="mt-3">
            {/* capture="environment" abre a câmera traseira nativa direto. */}
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                aoFotografar(f);
                setLeitura(null);
                if (f) setRecortando(true);
                // Permite refotografar o mesmo arquivo sem o input ignorar.
                e.target.value = "";
              }}
            />
            {foto ? (
              <div className="flex items-center gap-3 rounded-app border border-border bg-surface p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.url}
                  alt="Foto da placa"
                  className="size-12 rounded-[0.5rem] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Foto anexada</p>
                  <button
                    type="button"
                    onClick={() => setRecortando(true)}
                    className="text-xs font-medium text-brand underline-offset-2 hover:underline"
                  >
                    Ler a placa de novo
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    aoFotografar(null);
                    setLeitura(null);
                  }}
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
                onClick={() => {
                  // Só aqui vale carregar o reconhecedor: são alguns MB, e
                  // quem digita a placa não deve pagar por eles.
                  aquecerOcr();
                  inputFoto.current?.click();
                }}
              >
                <Camera className="size-5" />
                Fotografar placa
              </Button>
            )}
          </div>

          {leitura && <AvisoLeitura leitura={leitura} placa={placa} />}

          {placaInvalida && !leitura && (
            <p className="mt-4 text-center text-sm text-danger anim-fade">
              Placa inválida. Use ABC-1234 ou ABC1D23.
            </p>
          )}

          {erro && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-app border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger anim-fade"
            >
              <WifiOff className="mt-0.5 size-4 shrink-0" />
              <span className="leading-snug">{erro}</span>
            </div>
          )}

          {consultando && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-brand anim-fade">
              <Loader2 className="size-4 animate-spin" />
              Verificando {formatarPlaca(placa)}…
            </div>
          )}

          {/* ------- A resposta: essa placa já veio aqui? ------- */}
          {(consulta || vereditoTardio) && !consultando && (
            <AvisoSituacao
              consulta={consulta}
              veredito={veredito}
              placa={placa}
            />
          )}

          {/* ---------------- Pessoa ---------------- */}
          <div className="mt-5 flex flex-col gap-4">
            <Input
              rotulo="Nome"
              value={dados.nome}
              onChange={(e) => aoMudarDados({ nome: e.target.value })}
              maxLength={120}
              placeholder="Nome de quem vai abastecer"
              autoCapitalize="words"
              disabled={salvando}
              dica={
                conhecida && consulta!.condutores.length > 1
                  ? "Este veículo tem mais de uma pessoa vinculada — confira o nome."
                  : undefined
              }
            />
            <Input
              rotulo="Telefone"
              type="tel"
              inputMode="numeric"
              value={mascararTelefone(dados.telefone)}
              onChange={(e) => aoMudarDados({ telefone: e.target.value })}
              maxLength={16}
              placeholder="(00) 00000-0000"
              disabled={salvando}
            />
          </div>

          {/* ---------------- Mais detalhes ---------------- */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDetalhes((d) => !d)}
              aria-expanded={detalhes}
              className="flex w-full items-center justify-between rounded-app px-1 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text"
            >
              Mais detalhes (opcional)
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  detalhes && "rotate-180",
                )}
              />
            </button>

            {detalhes && (
              <div className="flex flex-col gap-4 pt-2 anim-fade">
                <Input
                  rotulo="CPF"
                  inputMode="numeric"
                  value={mascararCpf(dados.documento)}
                  onChange={(e) => aoMudarDados({ documento: e.target.value })}
                  maxLength={14}
                  placeholder="000.000.000-00"
                  disabled={salvando}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    rotulo="Marca"
                    value={dados.marca}
                    onChange={(e) => aoMudarDados({ marca: e.target.value })}
                    maxLength={80}
                    placeholder="Fiat"
                    disabled={salvando}
                  />
                  <Input
                    rotulo="Modelo"
                    value={dados.modelo}
                    onChange={(e) => aoMudarDados({ modelo: e.target.value })}
                    maxLength={80}
                    placeholder="Strada"
                    disabled={salvando}
                  />
                </div>
                <Select
                  rotulo="Tipo"
                  value={dados.tipo}
                  onChange={(e) => aoMudarDados({ tipo: e.target.value })}
                  disabled={salvando}
                >
                  <option value="CARRO">Carro</option>
                  <option value="MOTO">Moto</option>
                  <option value="CAMINHAO">Caminhão</option>
                  <option value="ONIBUS">Ônibus</option>
                  <option value="MAQUINA">Máquina</option>
                  <option value="OUTRO">Outro</option>
                </Select>
                <Textarea
                  rotulo="Observação"
                  value={dados.observacao}
                  onChange={(e) => aoMudarDados({ observacao: e.target.value })}
                  maxLength={500}
                  rows={2}
                  placeholder="Ex.: retirou o papel na secretaria."
                  disabled={salvando}
                />
              </div>
            )}
          </div>

          {/* ------- Justificativa, só quando as regras bloqueiam ------- */}
          {bloqueado && (
            <div className="mt-4 anim-fade">
              <Textarea
                rotulo="Motivo para registrar mesmo assim"
                value={justificativa}
                onChange={(e) => {
                  setJustificativa(e.target.value);
                  setErroJust(null);
                }}
                erro={erroJust ?? undefined}
                maxLength={500}
                rows={2}
                placeholder="Ex.: viagem a trabalho autorizada pela secretaria."
                disabled={salvando}
              />
            </div>
          )}
        </div>

        {recentes.length > 0 && !consulta && (
          <div className="border-t border-border px-4 pb-8 pt-5">
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Últimas liberações
            </h2>
            <ul className="flex flex-col">
              {recentes.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => aoMudarPlaca(r.placa)}
                    className="flex w-full items-center gap-3 rounded-app px-2 py-2.5 text-left transition-colors hover:bg-surface-2 active:bg-surface-2"
                  >
                    <span className="font-mono text-[0.9375rem] font-semibold tracking-wider">
                      {formatarPlaca(r.placa)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                      {r.nome ?? "—"}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-text-muted">
                      {tempoRelativo(r.criadoEm)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ------- Ação fixa: sempre ao alcance do polegar ------- */}
      <div className="safe-bottom shrink-0 border-t border-border bg-bg-elevated px-4 pb-3 pt-3">
        <Button
          tamanho="xl"
          larguraTotal
          onClick={registrar}
          disabled={!podeRegistrar || consultando}
          carregando={salvando}
          variante={bloqueado ? "secundario" : "primario"}
          className={bloqueado ? "border-warn/40 text-warn" : undefined}
        >
          {!salvando &&
            (bloqueado ? (
              <ShieldAlert className="size-5" />
            ) : (
              <TicketCheck className="size-5" />
            ))}
          {bloqueado ? "Registrar mesmo assim" : "Registrar liberação"}
        </Button>
      </div>
    </div>
  );
}

/**
 * A resposta à pergunta do balcão.
 *
 * Fica entre a placa e os campos porque é aí que ela muda o que se faz a
 * seguir: um "já veio há 3 dias" costuma encerrar o atendimento antes de
 * qualquer digitação.
 */
function AvisoSituacao({
  consulta,
  veredito,
  placa,
}: {
  consulta: ConsultaResposta | null;
  veredito: VereditoCliente | null;
  placa: string;
}) {
  const v = veredito;
  const ultimo = consulta?.ultimo ?? null;
  const bloqueadoAgora = Boolean(v && !v.liberado);
  // "Placa nova" só enquanto nada a recusou: uma placa nova cuja PESSOA já
  // estourou o limite não é notícia boa, e anunciá-la como tal esconderia
  // justamente o motivo da recusa.
  const nova = consulta ? !consulta.veiculo && !bloqueadoAgora : false;

  if (nova) {
    return (
      <div className="mt-4 flex items-start gap-2.5 rounded-app border border-border bg-surface px-3.5 py-3 text-sm anim-fade">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
        <span className="leading-snug">
          <strong className="font-semibold">Placa nova.</strong> Nunca passou
          por aqui — preencha nome e telefone abaixo.
        </span>
      </div>
    );
  }

  const bloqueado = bloqueadoAgora;
  const motivos = v ? [...v.cadastrais, ...v.bloqueios] : [];

  return (
    <div
      className={cn(
        "mt-4 rounded-card border px-3.5 py-3 anim-fade",
        bloqueado ? "border-danger/30 bg-danger-soft" : "border-ok/30 bg-ok-soft",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          bloqueado ? "text-danger" : "text-ok",
        )}
      >
        {bloqueado ? (
          <Ban className="size-4.5 shrink-0" />
        ) : (
          <CheckCircle2 className="size-4.5 shrink-0" />
        )}
        <p className="text-sm font-semibold">
          {bloqueado ? "Já foi liberado — bloqueado" : "Pode liberar"}
        </p>
      </div>

      {/* Quem e quando: é o que se diz em voz alta para a pessoa. */}
      {!consulta?.veiculo && bloqueado ? (
        <p className="mt-2 text-[0.9375rem] leading-snug text-text">
          A placa {formatarPlaca(placa)} é nova, mas as regras recusaram —
          veja abaixo.
        </p>
      ) : ultimo ? (
        <p className="mt-2 flex items-start gap-2 text-[0.9375rem] leading-snug text-text">
          <History className="mt-0.5 size-4 shrink-0 text-text-muted" />
          <span>
            Última liberação {tempoRelativo(ultimo.criadoEm)} para{" "}
            <strong className="font-semibold">
              {ultimo.pessoa?.nome ?? "sem nome"}
            </strong>
            <span className="block text-xs text-text-muted">
              {dataHora(ultimo.criadoEm)}
              {ultimo.operador ? ` · por ${ultimo.operador.nome}` : ""}
            </span>
          </span>
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-[0.9375rem] text-text">
          <User className="size-4 shrink-0 text-text-muted" />
          Veículo cadastrado, mas nunca liberado.
        </p>
      )}

      {motivos.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
          {v!.cadastrais.map((c) => (
            <li key={`${c.tipo}-${c.nome}`} className="text-sm text-danger">
              {c.tipo === "PESSOA" ? "Pessoa bloqueada" : "Veículo bloqueado"}
              {c.motivo ? `: ${c.motivo}` : "."}
            </li>
          ))}
          {v!.bloqueios.map((b) => (
            <li key={b.regraId} className="text-sm text-danger">
              {b.mensagem}
            </li>
          ))}
        </ul>
      )}

      {v && v.avisos.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
          {v.avisos.map((a) => (
            <li key={a.regraId} className="text-sm text-warn">
              {a.mensagem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * O que a leitura da foto devolveu, em três estados.
 *
 * Nenhum deles consulta sozinho: mesmo com nota cheia, o que aparece é um
 * pedido de conferência. Errar a placa aqui liberaria combustível no nome
 * do carro errado.
 */
function AvisoLeitura({
  leitura,
  placa,
}: {
  leitura: LeituraPlaca;
  placa: string;
}) {
  if (leitura.estado === "falha") {
    return (
      <div className="mt-4 flex items-start gap-2.5 rounded-app border border-border bg-surface px-3.5 py-3 text-sm anim-fade">
        <ScanLine className="mt-0.5 size-4 shrink-0 text-text-muted" />
        <span className="leading-snug text-text-secondary">
          Não consegui ler a placa. Fotografe de novo mais perto e de frente —
          ou digite no campo acima.
        </span>
      </div>
    );
  }

  const certeza = leitura.estado === "certeza";
  // Se a pessoa já corrigiu o campo, o aviso deixa de falar da leitura.
  const intocada = placa === leitura.placa;

  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-2.5 rounded-app border px-3.5 py-3 text-sm anim-fade",
        certeza
          ? "border-ok/30 bg-ok-soft text-ok"
          : "border-warn/30 bg-warn-soft text-warn",
      )}
    >
      {certeza ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="leading-snug">
        {certeza ? (
          <p>
            Placa lida com {Math.round(leitura.confianca)}% de certeza.
            {intocada ? " Confira antes de registrar." : ""}
          </p>
        ) : (
          <p>
            Não tenho certeza desta leitura ({Math.round(leitura.confianca)}%).
            {leitura.fracos.length > 0 && intocada
              ? ` Confira ${leitura.fracos.length === 1 ? "o caractere" : "os caracteres"} ${leitura.fracos
                  .map((i) => `${i + 1}º`)
                  .join(", ")} — ou fotografe de novo.`
              : " Confira os caracteres ou fotografe de novo."}
          </p>
        )}
      </div>
    </div>
  );
}
