'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { COLUNAS, type ColumnId, type GroupCard } from '@/features/kanban/logic';
import { cn } from '@/lib/utils';
import { Card } from './home-blocks';
import {
  destinoDaNotificacao,
  proximasPublicacoes,
  rascunhosDoServidor,
  type EntradaDeAtividade,
  type FeedItem,
  type ProximaAcao,
  type RascunhoLocal,
} from './logic';

/**
 * Blocos da Home v2 (SPEC home-operational-overview, mudança `add-home-operational-blocks`).
 *
 * Valem as mesmas duas regras dos blocos originais, e uma terceira:
 *
 *  1. Bloco sem conteúdo **não existe** — retorna `null`, não vira cartão vazio.
 *  2. Nenhum número é de desempenho: tudo aqui é registro do que a plataforma pediu e entregou.
 *  3. **Cada bloco falha sozinho.** Carregando e erro são do bloco, não da tela: antes, uma leitura
 *     ruim derrubava a página inteira, inclusive as partes alimentadas por outra fonte.
 */

/** carregando/erro dentro do próprio bloco — uma fonte ruim não apaga as outras */
export function BlocoAssincrono({
  titulo,
  isPending,
  isError,
  onRetry,
  children,
}: {
  titulo: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations('home');
  if (isPending) {
    return (
      <Card title={titulo}>
        <Skeleton className="h-16 rounded-md" />
      </Card>
    );
  }
  if (isError) {
    return (
      <Card title={titulo}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-compact text-graphite">{t('blockError')}</p>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={onRetry}
          >
            {t('blockRetry')}
          </Button>
        </div>
      </Card>
    );
  }
  return <>{children}</>;
}

// ---------------------------------------------------------------------------

/**
 * O próximo passo — um só, e só quando não há nada errado.
 *
 * Quem decide *qual* é `proximaAcao` em `logic.ts`, que é pura e testada. Aqui só se pinta.
 */
export function NextActionBlock({ acao }: { acao: ProximaAcao | null }) {
  const t = useTranslations('home');
  if (!acao) return null;
  const dados = acao.dados ?? {};

  return (
    <Card title={t('nextAction.title')}>
      <div className="flex min-w-0 flex-col items-start gap-2">
          <p className="text-compact font-semibold text-ink">
            {t(`nextAction.${acao.kind}Title`, dados)}
          </p>
          <p className="max-w-reading text-compact leading-relaxed text-graphite">
            {t(`nextAction.${acao.kind}Body`, dados)}
          </p>
          <Button asChild size="sm" className="mt-0.5 cursor-pointer">
            <Link href={acao.href}>{t(`nextAction.${acao.kind}Cta`, dados)}</Link>
          </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** avatar pequeno do canal, com o selo da rede — mesma linguagem do quadro */
function SeloDoCanal({ provider, nome }: { provider: string; nome: string }) {
  const icone = PROVIDER_ICONS[provider];
  return icone ? (
    <img src={icone} alt="" aria-hidden className="size-3.5 shrink-0 rounded-sm" />
  ) : (
    <span className="text-meta text-graphite">{nome.charAt(0)}</span>
  );
}

/** "Próximas publicações" — o que sai a seguir, sem abrir o calendário */
export function UpcomingBlock({
  items,
  onOpen,
}: {
  items: FeedItem[];
  onOpen: (groupId: string) => void;
}) {
  const t = useTranslations('home');
  const locale = useLocale();
  const proximas = proximasPublicacoes(items);
  if (proximas.length === 0) return null;

  const quando = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  return (
    <Card
      title={t('upcomingTitle')}
      action={
        <Button asChild size="sm" variant="ghost" className="cursor-pointer">
          <Link href="/calendario">{t('upcomingMore')}</Link>
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-line">
        {proximas.map((p) => (
          <li key={p.id} className="py-2 first:pt-0 last:pb-0">
            <button
              type="button"
              onClick={() => onOpen(p.groupId)}
              className="flex min-h-8 w-full cursor-pointer items-center gap-3 rounded-sm text-left outline-none transition-colors duration-200 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="w-24 shrink-0 text-meta tabular-nums text-graphite">
                {p.publishAt ? quando(p.publishAt) : ''}
              </span>
              <SeloDoCanal provider={p.channel.provider} nome={p.channel.name} />
              <span className="shrink-0 rounded-control bg-state-scheduled-tint px-1.5 py-0.5 text-meta font-medium text-state-scheduled">
                {t('upcomingScheduled')}
              </span>
              <span className="min-w-0 flex-1 truncate text-compact text-ink">{p.text || '…'}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------

const COR_ATIVIDADE: Record<string, string> = {
  PUBLISHED: 'bg-state-published',
  FAILED: 'bg-state-failed',
  CANCELLED: 'bg-graphite',
  NEEDS_REVIEW: 'bg-state-review',
};

const CHAVE_ATIVIDADE: Record<string, string> = {
  PUBLISHED: 'activityPublished',
  FAILED: 'activityFailed',
  CANCELLED: 'activityCancelled',
  NEEDS_REVIEW: 'activityNeedsReview',
};

/** "Atividade recente" — o que mudou desde ontem, em desfechos e aprovações */
export function ActivityBlock({
  entradas,
  agora,
  onOpen,
  incompleta = false,
  onRetry,
}: {
  entradas: EntradaDeAtividade[];
  agora: Date;
  onOpen: (groupId: string) => void;
  incompleta?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations('home');
  if (entradas.length === 0) return null;

  const haQuantoTempo = (em: number) => {
    const min = Math.round((agora.getTime() - em) / 60_000);
    if (min < 2) return t('activityJustNow');
    if (min < 60) return t('activityAgo', { tempo: t('activityMinutes', { count: min }) });
    const horas = Math.round(min / 60);
    if (horas < 24) return t('activityAgo', { tempo: t('activityHours', { count: horas }) });
    return t('activityAgo', { tempo: t('activityDays', { count: Math.round(horas / 24) }) });
  };

  return (
    <Card title={t('activityTitle')}>
      <ul className="flex flex-col divide-y divide-line">
        {entradas.map((e) => {
          if (e.tipo === 'notification') {
            const destino = destinoDaNotificacao(e.link);
            const conteudo = (
              <>
                <span className="size-1.5 shrink-0 rounded-full bg-state-review" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-meta text-ink">{e.title}</span>
                <span className="shrink-0 text-meta text-graphite">{haQuantoTempo(e.em)}</span>
              </>
            );
            return (
              <li key={e.chave} className="py-1.5 first:pt-0 last:pb-0">
                {destino ? (
                  <Link
                    href={destino}
                    className="flex min-h-8 items-center gap-2 rounded-sm outline-none transition-colors duration-200 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2">{conteudo}</span>
                )}
              </li>
            );
          }
          return (
            <li key={e.chave} className="py-1.5 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => onOpen(e.groupId)}
                className="flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-sm text-left outline-none transition-colors duration-200 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', COR_ATIVIDADE[e.state] ?? 'bg-mist')}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-meta text-ink">
                  {t(CHAVE_ATIVIDADE[e.state] ?? 'activityPublished', { canal: e.canal })}
                </span>
                <span className="shrink-0 text-meta text-graphite">{haQuantoTempo(e.em)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {incompleta ? (
        <div role="status" className="flex flex-wrap items-center gap-2 text-meta text-graphite">
          <span>{t('activityIncomplete')}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            {t('blockRetry')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------

/**
 * "Retomar de onde parou".
 *
 * O rascunho do servidor **não** oferece agendar, e isso é uma limitação declarada, não um
 * esquecimento: não existe operação na API que agende um grupo em `DRAFT` — `PATCH` num rascunho
 * mantém o grupo em `DRAFT`, e só a aprovação pública agenda. Prometer o botão seria mentir.
 */
export function DraftsBlock({
  local,
  servidor,
  agora = new Date(),
  serverPending = false,
  serverError = false,
  onRetryServer,
  onResumeLocal,
  onDuplicate,
  onApproval,
}: {
  local: RascunhoLocal | null;
  servidor: FeedItem[];
  agora?: Date;
  serverPending?: boolean;
  serverError?: boolean;
  onRetryServer?: () => void;
  onResumeLocal: () => void;
  onDuplicate: (groupId: string) => void;
  onApproval: (groupId: string) => void;
}) {
  const t = useTranslations('home');
  const orfaos = rascunhosDoServidor(servidor);
  if (!local && orfaos.length === 0 && !serverPending && !serverError) return null;

  const haQuantoTempo = (em: number) => {
    const min = Math.max(0, Math.round((agora.getTime() - em) / 60_000));
    if (min < 2) return t('activityJustNow');
    if (min < 60) return t('activityAgo', { tempo: t('activityMinutes', { count: min }) });
    const horas = Math.round(min / 60);
    if (horas < 24) return t('activityAgo', { tempo: t('activityHours', { count: horas }) });
    return t('activityAgo', { tempo: t('activityDays', { count: Math.round(horas / 24) }) });
  };

  return (
    <Card title={t('draftsTitle')}>
      <ul className="flex flex-col divide-y divide-line">
        {local ? (
          <li className="flex flex-col items-start gap-2 py-2 first:pt-0 last:pb-0">
            <span className="text-meta font-medium text-graphite">
              {t('draftsLocal')}
            </span>
            <span className="text-meta text-graphite">
              {t('draftsEdited', { tempo: haQuantoTempo(local.atualizadoEm) })}
            </span>
            <p className="line-clamp-2 text-compact leading-relaxed text-ink">
              {local.texto || '…'}
            </p>
            <Button
              size="sm"
              className="mt-0.5 cursor-pointer"
              onClick={onResumeLocal}
            >
              {t('draftsLocalCta')}
            </Button>
          </li>
        ) : null}

        {serverPending ? (
          <li className="py-2 first:pt-0 last:pb-0" aria-hidden>
            <Skeleton className="h-16 rounded-md" />
          </li>
        ) : serverError ? (
          <li className="flex flex-wrap items-center gap-3 py-2 first:pt-0 last:pb-0">
            <p className="text-compact text-graphite">{t('blockError')}</p>
            <Button size="sm" variant="outline" onClick={onRetryServer}>
              {t('blockRetry')}
            </Button>
          </li>
        ) : null}

        {orfaos.map((d) => (
          <li key={d.groupId} className="flex flex-col items-start gap-2 py-2 first:pt-0 last:pb-0">
            <p className="line-clamp-2 text-compact leading-relaxed text-ink">{d.texto || '…'}</p>
            <p className="text-meta leading-relaxed text-graphite">{t('draftsServerHint')}</p>
            <span className="mt-0.5 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => onDuplicate(d.groupId)}
              >
                {t('draftsDuplicate')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => onApproval(d.groupId)}
              >
                {t('draftsApproval')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/**
 * "Pipeline" — o quadro resumido.
 *
 * Lê a MESMA consulta do `/kanban` (mesma `queryKey`), então as duas telas não podem reportar
 * números diferentes do mesmo pipeline. Sem arraste, sem seleção: a home é a porta, o quadro é a
 * ferramenta.
 */
export function PipelineBlock({
  cards,
  truncado = false,
}: {
  cards: GroupCard[];
  truncado?: boolean;
}) {
  const t = useTranslations('home');
  const tk = useTranslations('kanban');
  if (cards.length === 0) return null;

  const contagem = (id: ColumnId) => cards.filter((c) => c.column === id).length;

  return (
    <Card
      title={t('pipelineTitle')}
      action={
        <Button asChild size="sm" variant="ghost" className="cursor-pointer">
          <Link href="/kanban">{t('pipelineOpen')}</Link>
        </Button>
      }
    >
      {/* estreito: só contagens, com rolagem — mesmo padrão do quadro em mobile */}
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {COLUNAS.map(({ id, accent }, index) => (
          <li key={id} className="min-w-28 flex-1 shrink-0">
            <Link
              href={`/kanban?col=${id}`}
              className={cn(
                'flex min-h-8 cursor-pointer flex-col gap-1 rounded-kpi p-3 transition-colors duration-200',
                index % 2 === 0 ? 'bg-kpi-lilac' : 'bg-kpi-blue',
                'hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <span className="text-panel font-medium tabular-nums leading-none text-ink">
                {contagem(id)}
              </span>
              <span className="flex items-center gap-2 truncate text-meta text-graphite">
                <span className={cn('size-1.5 shrink-0 rounded-full', accent)} aria-hidden />
                {tk(`columns.${id}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {truncado ? (
        <p className="text-meta leading-relaxed text-graphite">
          {t('pipelineTruncated')}{' '}
          <Link
            href="/kanban"
            className="inline-flex min-h-8 items-center font-medium text-accent hover:text-accent-hover"
          >
            {t('pipelineOpen')}
          </Link>
        </p>
      ) : null}
    </Card>
  );
}