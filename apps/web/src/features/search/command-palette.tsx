'use client';

import { CircleAlert, CornerDownLeft, FileText, Plug, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useChannels } from '@/features/channels/hooks';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { useKanbanPrefs } from '@/features/kanban/use-kanban-prefs';
import { useMarkAllNotificationsRead } from '@/features/notifications/hooks';
import { cn } from '@/lib/utils';
import { CATALOGO, PESO, type TipoDeEntrada } from './catalog';
import { MIN_BUSCA, useCommandPalette, useSearchPosts } from './hooks';
import { abrePalette, moverSelecao } from './palette-keys';
import { ordenar, type Rankeavel } from './ranking';

const LIMITE_POR_SECAO = 6;

interface Resultado extends Rankeavel {
  tipo: TipoDeEntrada;
  descricao?: string;
  provider?: string;
  executar: () => void;
}

const ICONE_POR_TIPO: Record<TipoDeEntrada, typeof Search> = {
  action: CornerDownLeft,
  page: Search,
  channel: Plug,
  post: FileText,
};

/**
 * Paleta de comandos (SPEC global-search-command-palette).
 *
 * Construída sobre o `Dialog` do Radix, sem `cmdk`. O que era difícil num modal — armadilha de
 * foco, portal, escape, trava de rolagem, devolver o foco — o primitivo já resolve; o que sobra é
 * lista filtrada com navegação por seta, e o ranking mora em `ranking.ts`, puro e testado.
 *
 * **Seções degradam separadamente.** Telas, ações e canais saem de dado já em memória e aparecem na
 * primeira tecla; posts precisam de rede. Uma busca fora do ar mostra o erro só na seção de posts —
 * a paleta continua servindo para navegar, que é o uso mais frequente dela.
 */
export function CommandPalette() {
  const t = useTranslations('commandPalette');
  const router = useRouter();
  const { aberta, abrir, fechar } = useCommandPalette();
  const openComposer = useComposerModal((s) => s.openComposer);
  const { densidade, setDensidade } = useKanbanPrefs();
  const marcarLidas = useMarkAllNotificationsRead();
  const channels = useChannels();

  const [consulta, setConsulta] = useState('');
  const [selecionado, setSelecionado] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  const posts = useSearchPosts(consulta);

  // atalho global — a checagem de "está digitando?" mora em palette-keys.ts, testada
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (abrePalette({ ...e, target: e.target as HTMLElement | null })) {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abrir]);

  useEffect(() => {
    if (!aberta) {
      setConsulta('');
      setSelecionado(0);
    }
  }, [aberta]);

  const executarEFechar = (fn: () => void) => () => {
    fechar();
    fn();
  };

  const doCatalogo: Resultado[] = useMemo(
    () =>
      CATALOGO.map((e) => ({
        chave: `cat:${e.id}`,
        rotulo: t(`entries.${e.chaveDeRotulo}`),
        termos: e.termos,
        peso: PESO[e.tipo],
        tipo: e.tipo,
        executar: executarEFechar(() => {
          if (e.href) return router.push(e.href);
          if (e.acao === 'compose') return openComposer();
          if (e.acao === 'connectChannel') return router.push('/conexoes');
          if (e.acao === 'uploadMedia') return router.push('/midia');
          if (e.acao === 'markAllRead') return void marcarLidas.mutate();
          if (e.acao === 'toggleDensity') {
            setDensidade(densidade === 'compacta' ? 'confortavel' : 'compacta');
          }
        }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, router, openComposer, densidade, setDensidade],
  );

  const dosCanais: Resultado[] = useMemo(
    () =>
      (channels.data ?? []).map((c) => ({
        chave: `ch:${c.id}`,
        rotulo: c.name ?? c.provider,
        termos: `${c.provider} ${c.username ?? ''}`.toLowerCase(),
        peso: PESO.channel,
        tipo: 'channel' as const,
        descricao: c.username ?? c.provider,
        provider: c.provider,
        executar: executarEFechar(() => router.push('/conexoes')),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channels.data, router],
  );

  const dosPosts: Resultado[] = useMemo(
    () =>
      (posts.data ?? []).map((p) => ({
        chave: `post:${p.groupId}`,
        rotulo: p.text || '…',
        termos: '',
        peso: PESO.post,
        tipo: 'post' as const,
        descricao: p.channels.map((c) => c.name).join(', '),
        executar: executarEFechar(() => router.push(`/kanban?q=${encodeURIComponent(p.text.slice(0, 40))}`)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts.data, router],
  );

  // posts já vêm ranqueados pelo servidor (recência): reordenar por texto aqui seria pior
  const secoes = useMemo(() => {
    const doCat = ordenar(doCatalogo, consulta, LIMITE_POR_SECAO * 2);
    return [
      { tipo: 'action' as const, itens: doCat.filter((r) => r.tipo === 'action').slice(0, LIMITE_POR_SECAO) },
      { tipo: 'page' as const, itens: doCat.filter((r) => r.tipo === 'page').slice(0, LIMITE_POR_SECAO) },
      { tipo: 'channel' as const, itens: ordenar(dosCanais, consulta, LIMITE_POR_SECAO) },
      { tipo: 'post' as const, itens: dosPosts.slice(0, LIMITE_POR_SECAO) },
    ].filter((s) => s.itens.length > 0);
  }, [doCatalogo, dosCanais, dosPosts, consulta]);

  const achatado = useMemo(() => secoes.flatMap((s) => s.itens), [secoes]);

  useEffect(() => {
    setSelecionado(0);
  }, [consulta]);

  const buscandoPosts = consulta.trim().length >= MIN_BUSCA && posts.isPending && posts.isFetching;
  const semNada = consulta.trim() !== '' && achatado.length === 0 && !buscandoPosts;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setSelecionado((i) => moverSelecao(e.key, i, achatado.length));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      achatado[selecionado]?.executar();
    }
  };

  useEffect(() => {
    listaRef.current
      ?.querySelector('[data-selecionado="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selecionado]);

  let indiceGlobal = -1;

  return (
    <Dialog open={aberta} onOpenChange={(o) => (o ? abrir() : fechar())}>
      <DialogContent size="palette" onKeyDown={onKeyDown}>
        <DialogTitle className="sr-only">{t('dialogTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('dialogDescription')}</DialogDescription>

        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="size-4 shrink-0 text-graphite" aria-hidden />
          <input
            autoFocus
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="w-full bg-transparent text-panel text-ink outline-none placeholder:text-graphite"
          />
        </div>

        <ul ref={listaRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {consulta.trim() === '' ? (
            <li className="px-2 py-6 text-center text-compact text-graphite">{t('hint')}</li>
          ) : null}

          {secoes.map((secao) => (
            <li key={secao.tipo}>
              <p className="px-2 pb-1 pt-2 text-meta font-semibold uppercase tracking-wide text-graphite">
                {t(`sections.${secao.tipo}`)}
              </p>
              <ul>
                {secao.itens.map((r) => {
                  indiceGlobal += 1;
                  const ativo = indiceGlobal === selecionado;
                  const idx = indiceGlobal;
                  const Icone = ICONE_POR_TIPO[r.tipo];
                  return (
                    <li key={r.chave}>
                      <button
                        type="button"
                        data-selecionado={ativo}
                        onMouseEnter={() => setSelecionado(idx)}
                        onClick={r.executar}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 text-left outline-none transition-colors duration-200',
                          ativo ? 'bg-surface-2 text-ink' : 'text-ink',
                        )}
                      >
                        {r.provider && PROVIDER_ICONS[r.provider] ? (
                          <img
                            src={PROVIDER_ICONS[r.provider]}
                            alt=""
                            aria-hidden
                            className="size-3.5 shrink-0 rounded-sm"
                          />
                        ) : (
                          <Icone className="size-3.5 shrink-0 text-graphite" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1 truncate text-compact">{r.rotulo}</span>
                        {r.descricao ? (
                          <span className="max-w-40 shrink-0 truncate text-meta text-graphite">
                            {r.descricao}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}

          {/* a seção de posts carrega e falha SOZINHA: o resto da paleta segue utilizável */}
          {buscandoPosts ? (
            <li className="px-2 py-2">
              <Skeleton className="h-8 rounded-sm" />
            </li>
          ) : null}
          {posts.isError ? (
            <li className="flex items-center gap-2 px-2 py-2 text-meta text-state-failed">
              <CircleAlert className="size-3.5 shrink-0" aria-hidden />
              {t('postsError')}
            </li>
          ) : null}

          {semNada && !posts.isError ? (
            <li className="px-2 py-6 text-center text-compact text-graphite">
              {t('empty', { q: consulta.trim() })}
            </li>
          ) : null}
        </ul>

        <p className="border-t border-line px-4 py-2 text-meta text-graphite">{t('navHint')}</p>
      </DialogContent>
    </Dialog>
  );
}
