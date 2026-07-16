import { redirect } from 'next/navigation';

// raiz do app: o middleware já barrou quem não tem sessão (vai p/ /login)
export default function Home() {
  redirect('/calendario');
}
