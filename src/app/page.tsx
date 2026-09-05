import { redirect } from "next/navigation";
import { sessaoAtual, rotaInicial } from "@/lib/auth";

// A raiz nao tem conteudo proprio: ela so decide para onde a pessoa vai.
// Operador cai direto no atendimento; admin e supervisor, no painel.
export default async function Home() {
  const u = await sessaoAtual();
  redirect(u ? rotaInicial(u.papel) : "/login");
}
