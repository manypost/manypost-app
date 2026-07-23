'use client';

import {
  Ban,
  Check,
  Copy,
  ExternalLink,
  Files,
  Link2,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useChannels, useProviders } from '@/features/channels/hooks';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { ChannelSettingsCard } from '@/features/composer/channel-settings';
import { NetworkPreview } from '@/features/composer/network-preview';
import { useDuplicatePost } from '@/features/composer/use-duplicate';
import { MediaThumb } from '@/features/media/media-thumb';
import { useApiErrorMessage } from '@/lib/api/errors';
import type { components } from '@/lib/api/schema';
import { toLocalInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  useApprovalLinkStatus,
  useCancelPost,
  useCreateApprovalLink,
  usePostGroup,
  useReschedulePost,
  useRetryPost,
  useRevokeApprovalLink,
} from './hooks';
import { CANCELLABLE_STATES, EDITABLE_STATES, RETRYABLE_STATES, stateBadgeVariant } from './state';

type FeedItem = components['schemas']['FeedItem'];
type PublicationDetail = components['schemas']['PublicationDetail'];

/**
 * Detalhe de um grupo — abre no MESMO popup grande do composer, no modo
 * VISUALIZAÇÃO: à esquerda o "post preenchido" (canais + conteúdo + estados,
 * editável) e à direita o preview ao vivo por rede (reusa NetworkPreview).
 * Tela cheia no mobile (X no topo direito). Mantém editar texto/horário,
 * cancelar, retry por canal/grupo, duplicar e o ciclo do link de aprovação.
 * (Compartilhado por calendário e kanban — nome histórico "Sheet".)
 */
export function PostDetailSheet({
  groupId,
  items,
  onClose,
}: {
  groupId: string | null;
  /** itens do feed do grupo (texto/canal) — evita esperar o GET do grupo p/ exibir */
  items: FeedItem[];
  onClose: () => void;
}) {
  const t = useTranslations('postDetail');
  const tCal = useTranslations('calendar');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const group = usePostGroup(groupId);
  const channels = useChannels();
  const providers = useProviders();
  const reschedule = useReschedulePost();
  const cancel = useCancelPost();
  const retry = useRetryPost();
  const duplicatePost = useDuplicatePost();

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editAt, setEditAt] = useState('');
  /** settings por canal em edição (objeto efetivo completo) + snapshot p/ diff no save */
  const [editSettings, setEditSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [originalSettings, setOriginalSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [confirmCancel, setConfirmCancel] = useState(false);

  // reset do modo edição ao trocar de grupo
  useEffect(() => {
    setEditing(false);
    setConfirmCancel(false);
  }, [groupId]);

  const channelById = new Map((channels.data ?? []).map((c) => [c.id, c]));
  const itemByChannel = new Map(items.map((i) => [i.channelId, i]));
  const groupState = group.data?.state ?? items[0]?.group.state ?? 'SCHEDULED';
  const publishAt = group.data?.publishAt ?? items[0]?.publishAt ?? null;
  const publishAtDate = publishAt ? new Date(publishAt) : null;
  const texts = [...new Set(items.map((i) => i.text))];
  const hasOverrides = texts.length > 1;
  const publications = (group.data?.publications ?? []) as PublicationDetail[];
  const media = publications[0]?.media ?? [];

  // ---- resolve identidade do canal (real → feed → id) ----
  const resolveChannel = (channelId: string) => {
    const ch = channelById.get(channelId);
    const feedItem = itemByChannel.get(channelId);
    return {
      id: channelId,
      provider: ch?.provider ?? feedItem?.channel.provider ?? '',
      name: ch?.name ?? feedItem?.channel.name ?? ch?.username ?? channelId,
      username: ch?.username ?? null,
      avatarUrl: ch?.avatarUrl ?? feedItem?.channel.avatarUrl ?? null,
    };
  };

  // ---- settings por canal (edição): catálogo do provider + defaults do schema ----
  const providerInfoFor = (channelId: string) => {
    const provider = channelById.get(channelId)?.provider ?? itemByChannel.get(channelId)?.channel.provider;
    return provider ? providers.data?.find((p) => p.id === provider) : undefined;
  };
  const schemaDefaults = (schema: Record<string, unknown> | undefined): Record<string, unknown> => {
    const props =
      (schema as { properties?: Record<string, { default?: unknown }> } | undefined)?.properties ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) if (v.default !== undefined) out[k] = v.default;
    return out;
  };
  const onSettingChange = (channelId: string, key: string, value: unknown) => {
    const defaults = schemaDefaults(providerInfoFor(channelId)?.settingsSchema);
    setEditSettings((prev) => {
      const cur = { ...(prev[channelId] ?? {}) };
      const effective = value !== undefined ? value : defaults[key];
      if (effective === undefined) delete cur[key];
      else cur[key] = effective;
      return { ...prev, [channelId]: cur };
    });
  };

  // ---- preview por rede (mesmo componente do composer/aprovação) ----
  const toRefs = (refs: components['schemas']['MediaRef'][]) =>
    refs.map((m) => ({ url: m.url, mime: m.mime, alt: m.alt }));
  const previewList = publications.length
    ? publications.map((pub) => ({
        ...resolveChannel(pub.channelId),
        entries: [
          { text: pub.text, media: toRefs(pub.media ?? []) },
          ...(pub.thread ?? []).map((ti) => ({ text: ti.text, media: toRefs(ti.media ?? []) })),
        ],
      }))
    : items.map((item) => ({
        ...resolveChannel(item.channelId),
        entries: [{ text: item.text, media: [] }],
      }));

  const dateLabel = publishAtDate
    ? new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(publishAtDate)
    : null;

  const startEdit = () => {
    setEditText(items[0]?.text ?? '');
    setEditAt(publishAt ? toLocalInput(new Date(publishAt)) : '');
    const seed: Record<string, Record<string, unknown>> = {};
    for (const pub of publications) {
      seed[pub.channelId] = { ...((pub.settings as Record<string, unknown> | null) ?? {}) };
    }
    setEditSettings(seed);
    setOriginalSettings(JSON.parse(JSON.stringify(seed)));
    setEditing(true);
  };

  const saveEdit = () => {
    if (!groupId) return;
    const at = editAt ? new Date(editAt) : null;
    const textChanged = editText.trim() !== (items[0]?.text ?? '');
    const atChanged = at !== null && publishAt !== null && at.getTime() !== new Date(publishAt).getTime();
    const settingsByChannel: Record<string, Record<string, unknown>> = {};
    for (const pub of publications) {
      const cur = editSettings[pub.channelId] ?? {};
      const orig = originalSettings[pub.channelId] ?? {};
      if (JSON.stringify(cur) !== JSON.stringify(orig)) settingsByChannel[pub.channelId] = cur;
    }
    const settingsChanged = Object.keys(settingsByChannel).length > 0;
    if (!textChanged && !atChanged && !settingsChanged) {
      setEditing(false);
      return;
    }
    reschedule.mutate(
      {
        groupId,
        ...(textChanged ? { text: editText.trim() } : {}),
        ...(atChanged && at ? { publishAt: at.toISOString() } : {}),
        ...(settingsChanged ? { settingsByChannel } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          setEditing(false);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const retryable = publications.some((p) => RETRYABLE_STATES.has(p.state));
  const cancellable = CANCELLABLE_STATES.has(groupState);

  return (
    <Dialog open={groupId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="panel">
        {/* cabeçalho */}
        <header className="flex shrink-0 flex-col gap-1 border-b border-line px-4 py-3 pr-12 sm:px-6 sm:py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {t('title')}
            <Badge variant={stateBadgeVariant(groupState)}>
              {tCal.has(`state.${groupState}`) ? tCal(`state.${groupState}`) : groupState}
            </Badge>
            {items[0]?.group.awaitingApproval ? (
              <Badge variant="review">{tCal('awaitingApproval')}</Badge>
            ) : null}
          </DialogTitle>
          {dateLabel ? (
            <DialogDescription className="text-xs first-letter:uppercase sm:text-sm">{dateLabel}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{t('title')}</DialogDescription>
          )}
        </header>

        {/* corpo rolável: post preenchido à esquerda, preview à direita */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            {/* coluna do "post preenchido" (view mode) */}
            <div className="flex min-w-0 flex-col gap-5">
              {/* canais (avatares — como o composer, porém só leitura) */}
              {previewList.length > 0 ? (
                <div className="bevel-surface rounded-lg border p-3">
                  <ul className="flex flex-wrap gap-2.5">
                    {previewList.map((c) => (
                      <li key={c.id}>
                        <span className="relative block">
                          <Avatar className="size-11 border-2 border-accent">
                            {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
                            <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {PROVIDER_ICONS[c.provider] ? (
                            <img
                              src={PROVIDER_ICONS[c.provider]}
                              alt=""
                              aria-hidden
                              className="absolute -bottom-0.5 -right-0.5 size-4 rounded-sm border border-surface"
                            />
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* conteúdo */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-graphite">
                    {t('content')}
                  </h3>
                  {!editing && EDITABLE_STATES.has(groupState) ? (
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={startEdit}>
                      <Pencil aria-hidden />
                      {t('edit')}
                    </Button>
                  ) : null}
                </div>

                {editing ? (
                  <div className="flex flex-col gap-3">
                    {hasOverrides ? (
                      <p className="bevel-chip rounded-md border border-line bg-state-review-tint px-3 py-2 text-xs leading-relaxed text-state-review">
                        {t('editResetsOverrides')}
                      </p>
                    ) : null}
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={5}
                      aria-label={t('content')}
                    />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="edit-publish-at">{t('when')}</Label>
                      <DateTimePicker
                        id="edit-publish-at"
                        value={editAt}
                        onChange={setEditAt}
                        className="w-full sm:w-fit"
                      />
                    </div>
                    {/* settings por canal (mesmo acordeão do composer, reusa ChannelSettingsCard) */}
                    {publications.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-graphite">
                          {t('settings')}
                        </h4>
                        {publications.map((pub) => {
                          const info = providerInfoFor(pub.channelId);
                          if (!info) return null;
                          const c = resolveChannel(pub.channelId);
                          return (
                            <ChannelSettingsCard
                              key={pub.channelId}
                              channelId={pub.channelId}
                              providerId={info.id}
                              providerName={info.name}
                              channelName={c.name}
                              schema={info.settingsSchema ?? {}}
                              values={editSettings[pub.channelId] ?? {}}
                              onChange={(key, value) => onSettingChange(pub.channelId, key, value)}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <Button
                        className="w-full sm:w-auto"
                        onClick={saveEdit}
                        isLoading={reschedule.isPending}
                        disabled={editText.trim() === ''}
                      >
                        {t('save')}
                      </Button>
                      <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setEditing(false)}>
                        {t('cancelEdit')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bevel-surface rounded-md border">
                    {texts.length <= 1 ? (
                      <p className="whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed text-ink">
                        {items[0]?.text ?? '…'}
                      </p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {items.map((item) => (
                          <li key={item.id} className="px-3 py-2.5">
                            <span className="text-xs font-semibold text-graphite">{item.channel.name}</span>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                              {item.text}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {media.length > 0 ? (
                      <ul className="flex flex-wrap gap-2 border-t border-line p-2">
                        {media.map((m, i) => (
                          <li key={m.mediaId ?? i}>
                            <MediaThumb
                              url={m.url}
                              mime={m.mime}
                              alt={m.alt}
                              className="size-16 rounded-md border border-line"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
              </section>

              {/* canais (estados + ações por canal) */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-graphite">
                  {t('channels')}
                </h3>
                {group.isPending ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-14 rounded-md" />
                    <Skeleton className="h-14 rounded-md" />
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {publications.map((pub) => {
                      const channel = channelById.get(pub.channelId);
                      const feedItem = itemByChannel.get(pub.channelId);
                      const name =
                        channel?.name ?? feedItem?.channel.name ?? channel?.username ?? pub.channelId;
                      const provider = channel?.provider ?? feedItem?.channel.provider ?? '';
                      const avatarUrl = channel?.avatarUrl ?? feedItem?.channel.avatarUrl ?? null;
                      return (
                        <li
                          key={pub.id}
                          className="bevel-surface flex flex-col gap-2.5 rounded-md border p-3 sm:flex-row sm:items-center sm:gap-3"
                        >
                          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="relative shrink-0">
                                <Avatar className="size-8">
                                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                                  <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {PROVIDER_ICONS[provider] ? (
                                  <img
                                    src={PROVIDER_ICONS[provider]}
                                    alt=""
                                    aria-hidden
                                    className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-sm border border-surface"
                                  />
                                ) : null}
                              </span>
                              <span className="truncate text-[13px] font-semibold text-ink sm:hidden">{name}</span>
                            </div>

                            <span className="flex shrink-0 items-center gap-1 sm:hidden">
                              <Badge variant={stateBadgeVariant(pub.state)} className="text-[10px]">
                                {tCal.has(`state.${pub.state}`) ? tCal(`state.${pub.state}`) : pub.state}
                              </Badge>
                              {RETRYABLE_STATES.has(pub.state) && groupId ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('retryChannel')}
                                  onClick={() =>
                                    retry.mutate(
                                      { groupId, channelId: pub.channelId },
                                      {
                                        onSuccess: () => toast.success(t('retryStarted')),
                                        onError: (err) => toast.error(errorMessage(err)),
                                      },
                                    )
                                  }
                                >
                                  <RotateCcw aria-hidden />
                                </Button>
                              ) : null}
                              {pub.releaseUrl ? (
                                <Button asChild variant="ghost" size="icon-sm" aria-label={tCal('view')}>
                                  <a href={pub.releaseUrl} target="_blank" rel="noreferrer noopener">
                                    <ExternalLink aria-hidden />
                                  </a>
                                </Button>
                              ) : null}
                            </span>
                          </div>

                          <span className="w-full min-w-0 flex-1 sm:w-auto">
                            <span className="hidden truncate text-[13px] font-semibold text-ink sm:block">{name}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-graphite">
                              {pub.itemCount > 1 ? (
                                <span>
                                  {t('threadProgress', {
                                    done: (pub.lastPublishedIndex ?? -1) + 1,
                                    total: pub.itemCount,
                                  })}
                                </span>
                              ) : null}
                              {pub.attemptCount > 0 && RETRYABLE_STATES.has(pub.state) ? (
                                <span>{t('attempts', { count: pub.attemptCount })}</span>
                              ) : null}
                            </span>
                            {pub.errorMessage && RETRYABLE_STATES.has(pub.state) ? (
                              <span className="mt-0.5 block break-words text-xs leading-relaxed text-state-failed">
                                {pub.errorMessage}
                              </span>
                            ) : null}
                          </span>
                          <span className="hidden shrink-0 items-center gap-1 sm:flex">
                            <Badge variant={stateBadgeVariant(pub.state)}>
                              {tCal.has(`state.${pub.state}`) ? tCal(`state.${pub.state}`) : pub.state}
                            </Badge>
                            {RETRYABLE_STATES.has(pub.state) && groupId ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('retryChannel')}
                                onClick={() =>
                                  retry.mutate(
                                    { groupId, channelId: pub.channelId },
                                    {
                                      onSuccess: () => toast.success(t('retryStarted')),
                                      onError: (err) => toast.error(errorMessage(err)),
                                    },
                                  )
                                }
                              >
                                <RotateCcw aria-hidden />
                              </Button>
                            ) : null}
                            {pub.releaseUrl ? (
                              <Button asChild variant="ghost" size="icon-sm" aria-label={tCal('view')}>
                                <a href={pub.releaseUrl} target="_blank" rel="noreferrer noopener">
                                  <ExternalLink aria-hidden />
                                </a>
                              </Button>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* link de aprovação — só para rascunho */}
              {groupState === 'DRAFT' && groupId ? (
                <>
                  <Separator />
                  <ApprovalLinkSection groupId={groupId} />
                </>
              ) : null}
            </div>

            {/* preview ao vivo por rede */}
            <aside className="flex flex-col gap-3 self-start lg:sticky lg:top-0 lg:border-l lg:border-line lg:pl-6">
              <h3 className="text-base font-semibold tracking-[-0.2px] text-ink">{t('preview')}</h3>
              {previewList.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {previewList.map((c) => (
                    <NetworkPreview
                      key={c.id}
                      provider={c.provider}
                      name={c.name}
                      username={c.username}
                      avatarUrl={c.avatarUrl}
                      entries={c.entries}
                      publishAt={publishAtDate}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-graphite">{t('previewEmpty')}</p>
              )}
            </aside>
          </div>
        </div>

        {/* rodapé de ações mobile-first */}
        <footer className="bevel-surface shrink-0 border-t border-line px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!groupId}
              onClick={() => groupId && duplicatePost.duplicate(groupId)}
            >
              <Files aria-hidden />
              {t('duplicate')}
            </Button>
            {retryable && groupId ? (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                isLoading={retry.isPending}
                onClick={() =>
                  retry.mutate(
                    { groupId },
                    {
                      onSuccess: () => toast.success(t('retryStarted')),
                      onError: (err) => toast.error(errorMessage(err)),
                    },
                  )
                }
              >
                <RotateCcw aria-hidden />
                {t('retryAll')}
              </Button>
            ) : null}
            {cancellable ? (
              <Button
                variant="outline"
                className="w-full hover:border-state-failed hover:bg-state-failed-tint hover:text-state-failed sm:ml-auto sm:w-auto"
                onClick={() => setConfirmCancel(true)}
              >
                <Ban aria-hidden />
                {t('cancelPost')}
              </Button>
            ) : null}
          </div>
        </footer>

        {duplicatePost.dialog}

        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('cancelTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('cancelWarning')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('keep')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!groupId) return;
                  cancel.mutate(groupId, {
                    onSuccess: () => {
                      toast.success(t('cancelled'));
                      setConfirmCancel(false);
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  });
                }}
              >
                {t('cancelConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

const EXPIRY_OPTIONS = [24, 72, 168] as const;

/** Ciclo do link público: criar (URL aparece 1x), copiar, revogar, feedback. */
function ApprovalLinkSection({ groupId }: { groupId: string }) {
  const t = useTranslations('postDetail.approval');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const status = useApprovalLinkStatus(groupId);
  const create = useCreateApprovalLink();
  const revoke = useRevokeApprovalLink();
  const [expiry, setExpiry] = useState('168');
  /** URL só existe na resposta do POST — guardada p/ copiar enquanto o painel vive */
  const [freshUrl, setFreshUrl] = useState<string | null>(null);

  useEffect(() => setFreshUrl(null), [groupId]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t('copied'));
  };

  const link = status.data ?? null;
  const pending = link?.status === 'PENDING' && new Date(link.expiresAt).getTime() > Date.now();

  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-graphite">
        <Link2 className="size-4" aria-hidden />
        {t('title')}
      </h3>

      {status.isPending ? (
        <Skeleton className="h-16 rounded-md" />
      ) : (
        <>
          {link?.status === 'CHANGES_REQUESTED' ? (
            <div className="bevel-chip rounded-md border border-line bg-state-review-tint px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-state-review">
                {t('changesRequested', { name: link.approverName ?? t('anonymous') })}
              </p>
              {link.feedback ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {link.feedback}
                </p>
              ) : null}
            </div>
          ) : null}

          {freshUrl ? (
            <div className="bevel-chip flex items-center gap-2 rounded-md border border-accent bg-accent-tint px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-accent">{freshUrl}</span>
              <Button variant="ghost" size="icon-sm" aria-label={t('copy')} onClick={() => copy(freshUrl)}>
                <Copy aria-hidden />
              </Button>
            </div>
          ) : null}

          {pending ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[13px] text-graphite">
                <Check className="size-4 text-state-published" aria-hidden />
                {t('pendingUntil', {
                  date: new Intl.DateTimeFormat(locale, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(link!.expiresAt)),
                })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-state-failed hover:text-state-failed"
                isLoading={revoke.isPending}
                onClick={() =>
                  revoke.mutate(groupId, {
                    onSuccess: () => {
                      setFreshUrl(null);
                      toast.success(t('revoked'));
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              >
                <Trash2 aria-hidden />
                {t('revoke')}
              </Button>
            </div>
          ) : null}

          <div className={cn('flex flex-wrap items-center gap-2', pending && 'opacity-90')}>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="h-8 w-40 text-xs" aria-label={t('expiry')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {t('expiresIn', { days: h / 24 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              isLoading={create.isPending}
              onClick={() =>
                create.mutate(
                  { groupId, expiresInHours: Number(expiry) },
                  {
                    onSuccess: (data) => {
                      setFreshUrl(data.url);
                      void copy(data.url);
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                )
              }
            >
              <Link2 aria-hidden />
              {pending ? t('regenerate') : t('create')}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-graphite">
            {pending ? t('regenerateHint') : t('createHint')}
          </p>
        </>
      )}
    </section>
  );
}
