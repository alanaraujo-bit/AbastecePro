"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PlacaInput } from "@/components/placa-input";
import { normalizarPlaca, placaValida } from "@/lib/placa";

export type VeiculoForm = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  ano: number | null;
  tipo: string;
};

const TIPOS = [
  { valor: "CARRO", rotulo: "Carro" },
  { valor: "MOTO", rotulo: "Moto" },
  { valor: "CAMINHAO", rotulo: "Caminhão" },
  { valor: "ONIBUS", rotulo: "Ônibus" },
  { valor: "MAQUINA", rotulo: "Máquina" },
  { valor: "OUTRO", rotulo: "Outro" },
];

export function FormularioVeiculo({ veiculo }: { veiculo?: VeiculoForm }) {
  const router = useRouter();
  const { mostrar } = useToast();
  const editando = Boolean(veiculo);

  const [aberto, setAberto] = useState(false);
  const [placa, setPlaca] = useState(veiculo?.placa ?? "");
  const [marca, setMarca] = useState(veiculo?.marca ?? "");
  const [modelo, setModelo] = useState(veiculo?.modelo ?? "");
  const [cor, setCor] = useState(veiculo?.cor ?? "");
  const [ano, setAno] = useState(veiculo?.ano ? String(veiculo.ano) : "");
  const [tipo, setTipo] = useState(veiculo?.tipo ?? "CARRO");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const placaCompleta = placa.length === 7;
  const placaErrada = placaCompleta && !placaValida(placa);

  function abrir() {
    setPlaca(veiculo?.placa ?? "");
    setMarca(veiculo?.marca ?? "");
    setModelo(veiculo?.modelo ?? "");
    setCor(veiculo?.cor ?? "");
    setAno(veiculo?.ano ? String(veiculo.ano) : "");
    setTipo(veiculo?.tipo ?? "CARRO");
    setErro(null);
    setAberto(true);
  }

  async function salvar() {
    if (salvando) return;
    if (!placaValida(placa)) {
      setErro("Informe uma placa válida (ABC-1234 ou ABC1D23).");
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const resp = await fetch(
        veiculo ? `/api/veiculos/${veiculo.id}` : "/api/veiculos",
        {
          method: veiculo ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            placa: normalizarPlaca(placa),
            marca: marca.trim() || null,
            modelo: modelo.trim() || null,
            cor: cor.trim() || null,
            ano: ano ? Number(ano) : null,
            tipo,
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
        titulo: editando ? "Veículo atualizado" : "Veículo cadastrado",
        variante: "sucesso",
      });
      setAberto(false);
      setSalvando(false);
      if (!editando && d.veiculo?.id)
        router.push(`/admin/veiculos/${d.veiculo.id}`);
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
          Novo veículo
        </Button>
      )}

      <Sheet
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? "Editar veículo" : "Novo veículo"}
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
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-secondary">
              Placa
            </span>
            <PlacaInput
              valor={placa}
              aoMudar={(v) => {
                setPlaca(v);
                setErro(null);
              }}
              invalido={placaErrada}
              autoFoco
            />
            {placaErrada && (
              <p className="mt-5 text-sm text-danger">
                Placa inválida. Use ABC-1234 ou ABC1D23.
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input
              rotulo="Marca"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              autoCapitalize="words"
              placeholder="Fiat"
            />
            <Input
              rotulo="Modelo"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              autoCapitalize="words"
              placeholder="Strada"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              rotulo="Cor"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              autoCapitalize="words"
              placeholder="Branco"
            />
            <Input
              rotulo="Ano"
              value={ano}
              onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="2022"
            />
          </div>

          <Select
            rotulo="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </Select>

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
