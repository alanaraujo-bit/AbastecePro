import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";

// A raiz nao tem conteudo proprio: ela so decide para onde a pessoa vai.
// Com uma conta so, o destino e sempre o painel.
export default async function Home() {
  const u = await sessaoAtual();
  redirect(u ? "/admin" : "/login");
}
