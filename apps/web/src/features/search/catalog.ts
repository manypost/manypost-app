/**
 * Telas e ações da paleta, como DADO.
 *
 * Ser dado (e não JSX) é o que permite dois testes que valem mais que qualquer revisão manual:
 * que toda tela do catálogo existe de fato como rota, e que toda entrada tem tradução.
 */

export type TipoDeEntrada = 'action' | 'page' | 'channel' | 'post';

/** peso do desempate: ação antes de tela, tela antes de canal, canal antes de post */
export const PESO: Record<TipoDeEntrada, number> = {
  action: 1,
  page: 2,
  channel: 3,
  post: 4,
};

export interface EntradaDoCatalogo {
  id: string;
  tipo: 'page' | 'action';
  /** chave em `messages.commandPalette.entries.<id>` */
  chaveDeRotulo: string;
  /** sinônimos, sem acento — o que a pessoa digita quando não lembra o nome exato */
  termos: string;
  /** telas navegam; ações são resolvidas por quem monta a paleta */
  href?: string;
  acao?: 'compose' | 'connectChannel' | 'uploadMedia' | 'markAllRead' | 'toggleDensity';
}

export const TELAS: EntradaDoCatalogo[] = [
  { id: 'home', tipo: 'page', chaveDeRotulo: 'home', termos: 'inicio home resumo painel', href: '/inicio' },
  {
    id: 'calendar',
    tipo: 'page',
    chaveDeRotulo: 'calendar',
    termos: 'calendario agenda semana mes',
    href: '/calendario',
  },
  { id: 'board', tipo: 'page', chaveDeRotulo: 'board', termos: 'kanban quadro pipeline etapas', href: '/kanban' },
  { id: 'media', tipo: 'page', chaveDeRotulo: 'media', termos: 'midia biblioteca imagens videos', href: '/midia' },
  {
    id: 'channels',
    tipo: 'page',
    chaveDeRotulo: 'channels',
    termos: 'conexoes canais redes contas integracoes',
    href: '/conexoes',
  },
  { id: 'compose', tipo: 'page', chaveDeRotulo: 'compose', termos: 'compor editor escrever', href: '/compor' },
  {
    id: 'notifications',
    tipo: 'page',
    chaveDeRotulo: 'notifications',
    termos: 'notificacoes avisos alertas',
    href: '/notificacoes',
  },
  {
    id: 'settings',
    tipo: 'page',
    chaveDeRotulo: 'settings',
    termos: 'configuracoes ajustes preferencias chaves api',
    href: '/configuracoes',
  },
  { id: 'plans', tipo: 'page', chaveDeRotulo: 'plans', termos: 'planos assinatura cobranca billing', href: '/planos' },
];

export const ACOES: EntradaDoCatalogo[] = [
  {
    id: 'newPost',
    tipo: 'action',
    chaveDeRotulo: 'newPost',
    termos: 'novo post criar publicar escrever',
    acao: 'compose',
  },
  {
    id: 'connectChannel',
    tipo: 'action',
    chaveDeRotulo: 'connectChannel',
    termos: 'conectar canal rede adicionar conta',
    acao: 'connectChannel',
  },
  {
    id: 'uploadMedia',
    tipo: 'action',
    chaveDeRotulo: 'uploadMedia',
    termos: 'enviar midia upload imagem video',
    acao: 'uploadMedia',
  },
  {
    id: 'markAllRead',
    tipo: 'action',
    chaveDeRotulo: 'markAllRead',
    termos: 'marcar tudo lido notificacoes limpar',
    acao: 'markAllRead',
  },
  {
    id: 'toggleDensity',
    tipo: 'action',
    chaveDeRotulo: 'toggleDensity',
    termos: 'densidade compacta confortavel quadro',
    acao: 'toggleDensity',
  },
];

export const CATALOGO: EntradaDoCatalogo[] = [...ACOES, ...TELAS];
