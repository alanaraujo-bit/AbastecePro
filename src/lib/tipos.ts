/** Tipos compartilhados entre as rotas de API e a interface do operador. */

export type Condutor = {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  bloqueado: boolean;
  motivoBloqueio: string | null;
  principal: boolean;
};

export type VeiculoConsulta = {
  id: string;
  placa: string;
  modelo: string | null;
  marca: string | null;
  cor: string | null;
  ano: number | null;
  tipo: string;
  bloqueado: boolean;
  motivoBloqueio: string | null;
};

export type MotivoRegraCliente = {
  regraId: string;
  nome: string;
  escopo: string;
  metrica: string;
  janela: string;
  limite: number;
  atual: number;
  proposto: number;
  restante: number;
  acao: "BLOQUEAR" | "AVISAR";
  mensagem: string;
};

export type VereditoCliente = {
  liberado: boolean;
  cadastrais: {
    tipo: "PESSOA" | "VEICULO";
    nome: string;
    motivo: string | null;
    desde: string | null;
  }[];
  bloqueios: MotivoRegraCliente[];
  avisos: MotivoRegraCliente[];
};

export type RegistroHistorico = {
  id: string;
  criadoEm: string;
  litros: number | null;
  valor: number | null;
  resultado: string;
  pessoa: { nome: string } | null;
};

export type ConsultaResposta = {
  placa: string;
  veiculo: VeiculoConsulta | null;
  condutores: Condutor[];
  pessoaSelecionada?: string | null;
  veredito: VereditoCliente | null;
  ultimo:
    | (RegistroHistorico & {
        combustivel: string | null;
        operador: { nome: string } | null;
      })
    | null;
  historico: RegistroHistorico[];
};
