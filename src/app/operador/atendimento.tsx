"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { placaValida, normalizarPlaca } from "@/lib/placa";
import type { ConsultaResposta } from "@/lib/tipos";
import { useToast } from "@/components/ui/toast";
import { EtapaPlaca } from "./etapa-placa";
import { EtapaVeredito } from "./etapa-veredito";
import { EtapaRegistro } from "./etapa-registro";
import { EtapaConcluido } from "./etapa-concluido";
import { EtapaCadastro } from "./etapa-cadastro";

export type Recente = {
  id: string;
  placa: string;
  criadoEm: string;
  litros: number | null;
  resultado: string;
  nome: string | null;
};

type Etapa = "placa" | "cadastro" | "veredito" | "registro" | "concluido";

export type ResumoFinal = {
  placa: string;
  condutor: string | null;
  litros: number | null;
  valor: number | null;
  resultado: string;
  criadoEm: string;
};

export function Atendimento({
  podeAutorizar,
  recentes,
  combustiveis,
  litrosObrigatorios,
  fotoObrigatoria,
}: {
  podeAutorizar: boolean;
  recentes: Recente[];
  combustiveis: string[];
  litrosObrigatorios: boolean;
  fotoObrigatoria: boolean;
}) {
  const { mostrar } = useToast();

  const [etapa, setEtapa] = useState<Etapa>("placa");
  const [placa, setPlaca] = useState("");
  const [consulta, setConsulta] = useState<ConsultaResposta | null>(null);
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ arquivo: File; url: string } | null>(null);
  const [resumo, setResumo] = useState<ResumoFinal | null>(null);
  // Preenchido quando um supervisor libera um atendimento bloqueado.
  // Viaja junto com o registro para virar trilha de auditoria.
  const [autorizacao, setAutorizacao] = useState<string | null>(null);

  /**
   * A chave de idempotencia nasce junto com o atendimento, nao no envio.
   * E ela que garante que dois toques no botao de confirmar produzam um
   * registro so — o operador esta na pista, com sinal ruim, e vai tocar duas
   * vezes.
   */
  const chaveRef = useRef<string>("");

  // Cancela consulta em voo quando a placa muda: sem isso, uma resposta
  // lenta de uma placa antiga pode sobrescrever a atual.
  const abortRef = useRef<AbortController | null>(null);

  const consultar = useCallback(
    async (p: string, escolhido?: string | null) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setConsultando(true);
      setErro(null);
      try {
        const r = await fetch("/api/operador/consultar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ placa: p, pessoaId: escolhido ?? null }),
          signal: ac.signal,
        });
        const dados = await r.json();
        if (!r.ok) {
          setErro(dados.erro ?? "Não foi possível consultar.");
          setConsultando(false);
          return;
        }

        setConsulta(dados);
        setPessoaId(dados.pessoaSelecionada ?? null);
        chaveRef.current = crypto.randomUUID();
        setConsultando(false);
        setEtapa(dados.veiculo ? "veredito" : "cadastro");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErro("Sem conexão. Verifique a internet e tente de novo.");
        setConsultando(false);
      }
    },
    [],
  );

  /**
   * Consulta automatica assim que a placa fica valida.
   *
   * Economiza um toque no caminho mais percorrido do produto. A consulta e
   * so leitura, entao disparar por engano nao custa nada — se o operador
   * errou um caractere, ele corrige e a consulta refaz sozinha.
   */
  useEffect(() => {
    if (etapa !== "placa") return;
    if (placa.length !== 7 || !placaValida(placa)) return;
    const t = setTimeout(() => consultar(placa), 140);
    return () => clearTimeout(t);
  }, [placa, etapa, consultar]);

  function trocarCondutor(id: string) {
    setPessoaId(id);
    // O veredito depende de quem esta conduzindo: reavalia no servidor.
    consultar(placa, id);
  }

  function reiniciar() {
    abortRef.current?.abort();
    if (foto) URL.revokeObjectURL(foto.url);
    setEtapa("placa");
    setPlaca("");
    setConsulta(null);
    setPessoaId(null);
    setErro(null);
    setFoto(null);
    setResumo(null);
    setAutorizacao(null);
    chaveRef.current = "";
  }

  function concluir(r: ResumoFinal) {
    if (foto) URL.revokeObjectURL(foto.url);
    setFoto(null);
    setResumo(r);
    setEtapa("concluido");
  }

  const condutor =
    consulta?.condutores.find((c) => c.id === pessoaId) ??
    consulta?.condutores[0] ??
    null;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {etapa === "placa" && (
        <EtapaPlaca
          placa={placa}
          aoMudarPlaca={(v) => {
            setPlaca(normalizarPlaca(v));
            setErro(null);
          }}
          aoConsultar={() => consultar(placa)}
          consultando={consultando}
          erro={erro}
          foto={foto}
          aoFotografar={(f) => {
            if (foto) URL.revokeObjectURL(foto.url);
            setFoto(f ? { arquivo: f, url: URL.createObjectURL(f) } : null);
          }}
          recentes={recentes}
        />
      )}

      {etapa === "cadastro" && (
        <EtapaCadastro
          placa={placa}
          aoCancelar={reiniciar}
          aoCadastrar={() => consultar(placa)}
          salvando={consultando}
        />
      )}

      {etapa === "veredito" && consulta && (
        <EtapaVeredito
          consulta={consulta}
          condutor={condutor}
          aoTrocarCondutor={trocarCondutor}
          atualizando={consultando}
          podeAutorizar={podeAutorizar}
          aoRegistrar={() => {
            setAutorizacao(null);
            setEtapa("registro");
          }}
          aoAutorizar={(j) => {
            setAutorizacao(j);
            setEtapa("registro");
          }}
          aoCancelar={reiniciar}
        />
      )}

      {etapa === "registro" && consulta && (
        <EtapaRegistro
          consulta={consulta}
          condutor={condutor}
          chaveIdempotencia={chaveRef.current}
          combustiveis={combustiveis}
          foto={foto}
          aoFotografar={(f) => {
            if (foto) URL.revokeObjectURL(foto.url);
            setFoto(f ? { arquivo: f, url: URL.createObjectURL(f) } : null);
          }}
          autorizacao={autorizacao}
          litrosObrigatorios={litrosObrigatorios}
          fotoObrigatoria={fotoObrigatoria}
          aoVoltar={() => setEtapa("veredito")}
          aoConcluir={concluir}
          aoAvisar={mostrar}
        />
      )}

      {etapa === "concluido" && resumo && (
        <EtapaConcluido resumo={resumo} aoNovo={reiniciar} />
      )}
    </div>
  );
}
