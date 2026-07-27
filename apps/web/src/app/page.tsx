import { redirect } from 'next/navigation';

// raiz do app: o middleware já barrou quem não tem sessão (vai p/ /login).
// Vai para a HOME — antes vinha direto no calendário, que é ferramenta, não panorama:
// a primeira pergunta de quem abre o produto é "está tudo bem?", não "o que tem nesta semana?".
export default function Home() {
  redirect('/inicio');
}
