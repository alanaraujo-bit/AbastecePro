"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { placaValida, normalizarPlaca } from "@/lib/placa";
import { soDigitos } from "@/lib/utils";
import type { ConsultaResposta, VereditoCliente } from "@/lib/tipos";
import { useToast } from "@/components/ui/toast";
import { EtapaLancamento, type DadosLancamento } from "./etapa-lancamento";
import { EtapaConcluido } from "./etapa-concluido";

export type Recente = {
  id: string;
  placa: string;
  criadoEm: string;
  resultado: string;
  nome: string | null;
};

export type ResumoFinal = {
  id: string;
  placa: string;
  condutor: string | null;
  resultado: string;
  criadoEm: string;
};

const VAZIO: DadosLancamento = {
  nome: "",
  telefone: "",
  documento: "",
  marca: "",
  modelo: "",
  cor: "",
  tipo: "CARRO",
  observacao: "",
};

/**
 * Duas telas: lançar e o comprovante.
 *
 * O cadastro deixou de ser etapa. Placa, nome e telefone entram juntos e o
 * servidor cria pessoa, veículo e vínculo a partir do próprio lançamento —
 * ver `POST /api/liberacao/registrar`.
 */
export function Atendimento({
  organizacao,
  recentes,
}: {
  organizacao: string;
  recentes: Recente[];
}) {
  const { mostrar } = useToast();

  const [placa, setPlaca] = useState("");
  const [dados, setDados] = useState<DadosLancamento>(VAZIO);
  const [consulta, setConsulta] = useState<ConsultaResposta | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ arquivo: File; url: string } | null>(null);
  const [resumo, setResumo] = useState<ResumoFinal | null>(null);

  /**
   * Recusa que só o servidor podia ver.
   *
   * A verificação da tela parte da PLACA; algumas regras são por PESSOA, e
   * a pessoa só fica conhecida quando o telefone é digitado. Placa nova de
   * alguém que já foi atendido no mês é o caso comum: a tela dizia "pode
   * registrar" de boa-fé e o servidor recusava.
   *
   * Guardar o veredito do servidor faz o mesmo aviso da consulta aparecer,
   * com o motivo verdadeiro — e o botão vira "registrar mesmo assim", em
   * vez de deixar quem está no balcão sem saída.
   */
  const [vereditoTardio, setVereditoTardio] = useState<VereditoCliente | null>(
    null,
  );

  /**
   * A chave de idempotência nasce com o lançamento, não no envio. É ela que
   * garante que dois toques no botão produzam um papel só — o toque duplo em
   * rede ruim é regra, não exceção.
   */
  const chaveRef = useRef<string>(crypto.randomUUID());

  // Cancela consulta em voo quando a placa muda: sem isso, uma resposta
  // lenta de uma placa antiga pode sobrescrever a atual.
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Verificação em segundo plano, disparada pela placa.
   *
   * Não é navegação nem etapa: o resultado aparece como aviso na própria
   * tela, entre a placa e os campos. É o que responde "essa placa já veio
   * aqui?" sem tirar ninguém do lugar onde está preenchendo.
   */
  const verificar = useCallback(async (p: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setConsultando(true);
    setErro(null);
    try {
      const r = await fetch("/api/liberacao/consultar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placa: p }),
        signal: ac.signal,
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível verificar.");
        setConsultando(false);
        return;
      }

      setConsulta(d);
      // Placa conhecida preenche o que já se sabe: redigitar o nome de quem
      // o sistema já conhece é trabalho que a pessoa na frente da mesa paga
      // em espera. Só preenche campo vazio — nunca por cima do que foi
      // digitado à mão.
      const c = d.condutores?.[0];
      if (c) {
        setDados((atual) => ({
          ...atual,
          nome: atual.nome || c.nome,
          telefone: atual.telefone || (c.telefone ?? ""),
          documento: atual.documento || (c.documento ?? ""),
        }));
      }
      if (d.veiculo) {
        setDados((atual) => ({
          ...atual,
          marca: atual.marca || (d.veiculo.marca ?? ""),
          modelo: atual.modelo || (d.veiculo.modelo ?? ""),
          tipo: d.veiculo.tipo ?? atual.tipo,
        }));
      }
      setConsultando(false);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setErro("Sem conexão. Verifique a internet e tente de novo.");
      setConsultando(false);
    }
  }, []);

  /**
   * A verificação dispara sozinha para placa DIGITADA.
   *
   * Vale só para digitação: uma placa vinda da leitura da foto precisa
   * passar pelos olhos de quem opera antes de virar consulta.
   */
  const [origemPlaca, setOrigemPlaca] = useState<"digitada" | "foto">(
    "digitada",
  );

  useEffect(() => {
    if (origemPlaca !== "digitada") return;
    if (placa.length !== 7 || !placaValida(placa)) return;
    const t = setTimeout(() => verificar(placa), 140);
    return () => clearTimeout(t);
  }, [placa, origemPlaca, verificar]);

  /**
   * Trocar a placa invalida o que se sabia sobre a anterior.
   *
   * Limpar aqui, e não dentro do efeito: um aviso de "já foi liberado" que
   * sobrevive à correção de um caractere está falando de outro veículo, e
   * é o tipo de erro que passa despercebido porque a tela continua
   * plausível.
   */
  function trocarPlaca(v: string, origem: "digitada" | "foto") {
    setPlaca(normalizarPlaca(v));
    setOrigemPlaca(origem);
    setConsulta(null);
    setVereditoTardio(null);
    setErro(null);
  }

  function reiniciar() {
    abortRef.current?.abort();
    if (foto) URL.revokeObjectURL(foto.url);
    setPlaca("");
    setOrigemPlaca("digitada");
    setDados(VAZIO);
    setConsulta(null);
    setVereditoTardio(null);
    setErro(null);
    setFoto(null);
    setResumo(null);
    chaveRef.current = crypto.randomUUID();
  }

  /**
   * Registra. A foto, quando existe, sobe antes — mas uma falha ao enviar
   * imagem nunca pode impedir o registro: o papel é o que a pessoa precisa,
   * a foto é apoio.
   */
  async function registrar(justificativa: string | null) {
    if (salvando) return;
    setSalvando(true);

    let fotoChave: string | null = null;
    if (foto) {
      try {
        const fd = new FormData();
        fd.append("foto", foto.arquivo);
        const r = await fetch("/api/fotos", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.chave) fotoChave = d.chave;
        else
          mostrar({
            titulo: "A foto não subiu",
            descricao: "O registro segue normalmente.",
            variante: "aviso",
          });
      } catch {
        mostrar({
          titulo: "A foto não subiu",
          descricao: "O registro segue normalmente.",
          variante: "aviso",
        });
      }
    }

    // A pessoa que a consulta reconheceu só vale se o nome não foi trocado
    // à mão. Trocado, é outra pessoa — e mandar o id antigo gravaria a
    // liberação no nome errado.
    const reconhecida = consulta?.condutores?.[0];
    const pessoaId =
      reconhecida && reconhecida.nome === dados.nome.trim()
        ? reconhecida.id
        : null;

    try {
      const r = await fetch("/api/liberacao/registrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chaveIdempotencia: chaveRef.current,
          placa,
          pessoaId,
          nome: dados.nome.trim() || null,
          telefone: soDigitos(dados.telefone) || null,
          documento: soDigitos(dados.documento) || null,
          marca: dados.marca.trim() || null,
          modelo: dados.modelo.trim() || null,
          tipo: dados.tipo,
          observacao: dados.observacao.trim() || null,
          fotoChave,
          autorizar: justificativa !== null,
          justificativa,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        mostrar({
          titulo: d.erro ?? "Não foi possível registrar. Tente de novo.",
          variante: "erro",
        });
        setSalvando(false);
        return;
      }

      /*
       * O servidor reavalia as regras no instante do registro, e pode
       * recusar mesmo depois de a tela ter mostrado "pode liberar" — a
       * mesma placa registrada em outro aparelho segundos antes, ou duas
       * abas abertas. Nesse caso o registro fica gravado como BLOQUEADO.
       *
       * Mostrar o comprovante aqui seria entregar um papel que o sistema
       * acabou de recusar. Melhor dizer o que houve e reverificar.
       */
      if (d.abastecimento.resultado === "BLOQUEADO") {
        setVereditoTardio(d.veredito ?? null);
        mostrar({
          titulo: "As regras recusaram este registro",
          descricao: "Veja o motivo acima do botão.",
          variante: "erro",
        });
        // Chave nova: o registro bloqueado já ocupou a anterior, e sem
        // trocá-la o "registrar mesmo assim" devolveria aquele mesmo
        // registro recusado em vez de criar a exceção.
        chaveRef.current = crypto.randomUUID();
        setSalvando(false);
        return;
      }

      if (foto) URL.revokeObjectURL(foto.url);
      setFoto(null);
      setResumo({
        id: d.abastecimento.id,
        placa,
        condutor: d.pessoa?.nome ?? (dados.nome.trim() || null),
        resultado: d.abastecimento.resultado,
        criadoEm: d.abastecimento.criadoEm,
      });
      setSalvando(false);
    } catch {
      mostrar({
        titulo: "Sem conexão",
        descricao: "O registro não foi salvo.",
        variante: "erro",
      });
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {resumo ? (
        <EtapaConcluido
          resumo={resumo}
          organizacao={organizacao}
          aoNovo={reiniciar}
        />
      ) : (
        <EtapaLancamento
          placa={placa}
          aoMudarPlaca={(v) => trocarPlaca(v, "digitada")}
          aoLerPlaca={(v) => trocarPlaca(v, "foto")}
          consulta={consulta}
          vereditoTardio={vereditoTardio}
          consultando={consultando}
          erro={erro}
          dados={dados}
          aoMudarDados={(d) => setDados((atual) => ({ ...atual, ...d }))}
          foto={foto}
          aoFotografar={(f) => {
            if (foto) URL.revokeObjectURL(foto.url);
            setFoto(f ? { arquivo: f, url: URL.createObjectURL(f) } : null);
          }}
          salvando={salvando}
          aoRegistrar={registrar}
          recentes={recentes}
        />
      )}
    </div>
  );
}
