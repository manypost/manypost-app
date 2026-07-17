'use client';

import {
  Ban,
  Check,
  Copy,
  ExternalLink,
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useChannels } from '@/features/channels/hooks';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
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

/**
 * Painel de detalhe de um grupo (compartilhado por calendário e kanban):
 * estados por canal, editar texto/horário (PATCH re-agenda), cancelar, retry
 * por canal ou do grupo, e o ciclo do link público de aprovação.
 */
export function PostDetailSheet({
  groupId,
  items,
  onClose,
}: {
  groupId: string | null;
  /** itens do feed do grupo (texto/canal) — o GET do grupo não embute texto */
  items: FeedItem[];
  onClose: () => void;
}) {
  const t = useTranslations('postDetail');
  const tCal = useTranslations('calendar');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const group = usePostGroup(groupId);
  const channels = useChannels();
  const reschedule = useReschedulePost();
  const cancel = useCancelPost();
  const retry = useRetryPost();

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editAt, setEditAt] = useState('');
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
  const texts = [...new Set(items.map((i) => i.text))];
  const hasOverrides = texts.length > 1;
  const media = group.data?.publications[0]?.media ?? [];

  const dateLabel = publishAt
    ? new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(publishAt))
    : null;

  const startEdit = () => {
    setEditText(items[0]?.text ?? '');
    setEditAt(publishAt ? toLocalInput(new Date(publishAt)) : '');
    setEditing(true);
  };

  const saveEdit = () => {
    if (!groupId) return;
    const at = editAt ? new Date(editAt) : null;
    const textChanged = editText.trim() !== (items[0]?.text ?? '');
    const atChanged = at !== null && publishAt !== null && at.getTime() !== new Date(publishAt).getTime();
    if (!textChanged && !atChanged) {
      setEditing(false);
      return;
    }
    reschedule.mutate(
      {
        groupId,
        ...(textChanged ? { text: editText.trim() } : {}),
        ...(atChanged && at ? { publishAt: at.toISOString() } : {}),
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

  return (
    <Sheet open={groupId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2 pr-8">
            {t('title')}
            <Badge variant={stateBadgeVariant(groupState)}>
              {tCal.has(`state.${groupState}`) ? tCal(`state.${groupState}`) : groupState}
            </Badge>
            {items[0]?.group.awaitingApproval ? (
              <Badge variant="review">{tCal('awaitingApproval')}</Badge>
            ) : null}
          </SheetTitle>
          {dateLabel ? <p className="text-sm text-graphite">{dateLabel}</p> : null}
        </SheetHeader>

        <div className="flex flex-col gap-5 sm:gap-6 p-4 sm:p-6">
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
                  <p className="rounded-md border border-line bg-state-review-tint px-3 py-2 text-xs leading-relaxed text-state-review">
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
                    className="w-fit"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    isLoading={reschedule.isPending}
                    disabled={editText.trim() === ''}
                  >
                    {t('save')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    {t('cancelEdit')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {texts.length <= 1 ? (
                  <p className="whitespace-pre-wrap rounded-md border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink">
                    {items[0]?.text ?? '…'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-md border border-line bg-surface-2 px-3 py-2">
                        <span className="text-xs font-semibold text-graphite">{item.channel.name}</span>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {media.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
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
              </>
            )}
          </section>

          <Separator />

          {/* canais */}
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
                {(group.data?.publications ?? []).map((pub) => {
                  const channel = channelById.get(pub.channelId);
                  const feedItem = itemByChannel.get(pub.channelId);
                  const name =
                    channel?.name ?? feedItem?.channel.name ?? channel?.username ?? pub.channelId;
                  const provider = channel?.provider ?? feedItem?.channel.provider ?? '';
                  const avatarUrl = channel?.avatarUrl ?? feedItem?.channel.avatarUrl ?? null;
                  return (
                    <li
                      key={pub.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 rounded-md border border-line bg-surface p-3"
                    >
                      <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:shrink-0">
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

                      <span className="min-w-0 flex-1 w-full sm:w-auto">
                        <span className="hidden sm:block truncate text-[13px] font-semibold text-ink">{name}</span>
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
                          <span className="mt-0.5 block text-xs leading-relaxed text-state-failed break-words">
                            {pub.errorMessage}
                          </span>
                        ) : null}
                      </span>
                      <span className="hidden sm:flex shrink-0 items-center gap-1">
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

          {/* ações do grupo */}
          <Separator />
          <section className="flex flex-wrap gap-2">
            {(group.data?.publications ?? []).some((p) => RETRYABLE_STATES.has(p.state)) && groupId ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
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
            {CANCELLABLE_STATES.has(groupState) ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-state-failed hover:text-state-failed"
                onClick={() => setConfirmCancel(true)}
              >
                <Ban aria-hidden />
                {t('cancelPost')}
              </Button>
            ) : null}
          </section>
        </div>

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
      </SheetContent>
    </Sheet>
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
            <div className="rounded-md border border-line bg-state-review-tint px-3 py-2">
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
            <div className="flex items-center gap-2 rounded-md border border-accent bg-accent-tint px-3 py-2">
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
