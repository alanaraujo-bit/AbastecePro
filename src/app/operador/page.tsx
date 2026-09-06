import { redirect } from "next/navigation";

/**
 * A tela de atendimento virou "Liberar", dentro do painel.
 *
 * Este redirecionamento existe porque o PWA ja instalado guarda o atalho
 * para /operador, e um atalho que abre em 404 e a forma mais rapida de
 * fazer o app parecer quebrado depois de uma atualizacao.
 */
export default function OperadorRedirect() {
  redirect("/admin/liberar");
}
