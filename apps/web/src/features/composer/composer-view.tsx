'use client';

import { CircleAlert, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChannels, useProviders } from '@/features/channels/hooks';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { useMediaList } from '@/features/media/hooks';
import { useApiErrorMessage } from '@/lib/api/errors';
import { toLocalInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { ChannelPicker } from './channel-picker';
import { ComposerEditor } from './editor';
import { useSchedulePost } from './hooks';
import { MediaPicker, MediaStrip } from './media-picker';
import { validateMediaForProvider } from './media-validation';
import { PostPreview } from './post-preview';
import { useComposerStore } from './store';

/**
 * Composer (SPEC_FRONTEND §3.3, direção do Postiz): avatares p/ escolher
 * canais → abas global/por canal → editor com toolbar e contador no canto →
 * thread empilhada → preview ao vivo à direita → rodapé com data e CTA.
 * Estado no Zustand com persist (rascunho sobrevive a F5).
 */
export function ComposerView() {
  const t = useTranslations('composer');
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const store = useComposerStore();
  const channels = useChannels();
  const providers = useProviders();
  const mediaLibrary = useMediaList();
  const schedule = useSchedulePost();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [activeTab, setActiveTab] = useState('global');

  // primeiro uso: sugere a próxima hora cheia
  useEffect(() => {
    if (!mounted || store.publishAtLocal) return;
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    store.setPublishAtLocal(toLocalInput(d));
  }, [mounted, store.publishAtLocal, store.setPublishAtLocal]);

  if (!mounted) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // seleção efetiva = ids do rascunho que ainda existem como canal
  const selected = (channels.data ?? []).filter((ch) => store.channelIds.includes(ch.id));
  const providerOf = (providerId: string) => providers.data?.find((p) => p.id === providerId);
  const textFor = (channelId: string) => store.overrides[channelId] ?? store.text;
  const mediaById = new Map((mediaLibrary.data ?? []).map((m) => [m.id, m]));
  const selectedMedia = store.mediaIds.map((id) => mediaById.get(id)).filter((m) => m !== undefined);

  const counters = selected.map((ch) => {
    const max = providerOf(ch.provider)?.maxLength;
    const len = textFor(ch.id).trim().length;
    return { channel: ch, max, len, over: max !== undefined && len > max };
  });

  // limite mais apertado entre os canais selecionados — vale p/ itens de thread
  const minMax = selected.reduce<number | undefined>((acc, ch) => {
    const max = providerOf(ch.provider)?.maxLength;
    if (max === undefined) return acc;
    return acc === undefined ? max : Math.min(acc, max);
  }, undefined);

  const threadSupported = selected.length > 0 && selected.every((ch) => providerOf(ch.provider)?.threads);
  const threadUnsupportedNames = selected
    .filter((ch) => !providerOf(ch.provider)?.threads)
    .map((ch) => ch.name ?? ch.id);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const publishAt = store.publishAtLocal ? new Date(store.publishAtLocal) : null;

  // ---- validação client-side (o servidor revalida tudo) ----
  const issues: string[] = [];
  if (store.text.trim().length === 0) issues.push(t('issues.emptyText'));
  if (selected.length === 0) issues.push(t('issues.noChannelSelected'));
  for (const c of counters) {
    const override = store.overrides[c.channel.id];
    if (override !== undefined && override.trim().length === 0) {
      issues.push(t('issues.emptyOverride', { name: c.channel.name ?? c.channel.id }));
    }
  }
  const overNames = counters.filter((c) => c.over).map((c) => c.channel.name ?? c.channel.id);
  if (overNames.length > 0) issues.push(t('issues.overLimit', { channels: overNames.join(', ') }));

  if (selectedMedia.length > 0) {
    const seen = new Set<string>();
    for (const ch of selected) {
      const info = providerOf(ch.provider);
      if (!info) continue;
      for (const issue of validateMediaForProvider(info, selectedMedia)) {
        const msg = t(`issues.media.${issue.code}`, {
          name: ch.name ?? ch.id,
          max: 'max' in issue ? issue.max : 0,
          mime: 'mime' in issue ? issue.mime : '',
        });
        if (!seen.has(msg)) {
          seen.add(msg);
          issues.push(msg);
        }
      }
    }
  }

  if (store.thread.length > 0 && threadUnsupportedNames.length > 0) {
    issues.push(t('issues.threadUnsupported', { channels: threadUnsupportedNames.join(', ') }));
  }
  store.thread.forEach((item, i) => {
    if (item.text.trim().length === 0) issues.push(t('issues.threadEmpty', { index: i + 1 }));
    if (minMax !== undefined && item.text.trim().length > minMax)
      issues.push(t('issues.threadOverLimit', { index: i + 1 }));
    if (item.delaySec < 0 || item.delaySec > 600)
      issues.push(t('issues.threadDelay', { index: i + 1 }));
  });

  const scheduleIssues: string[] = [];
  if (!publishAt || Number.isNaN(publishAt.getTime())) scheduleIssues.push(t('issues.noDate'));
  else if (publishAt.getTime() < Date.now() - 60_000) scheduleIssues.push(t('issues.pastDate'));

  const globalLen = store.text.trim().length;
  const counterInvalid = issues.length > 0;

  const submit = (now: boolean) => {
    const at = now ? new Date() : publishAt;
    if (!at || Number.isNaN(at.getTime())) return;
    const textByChannel: Record<string, string> = {};
    for (const ch of selected) {
      const override = store.overrides[ch.id]?.trim();
      if (override && override !== store.text.trim()) textByChannel[ch.id] = override;
    }
    schedule.mutate(
      {
        text: store.text.trim(),
        channelIds: selected.map((ch) => ch.id),
        publishAt: at.toISOString(),
        timezone,
        textByChannel,
        mediaIds: store.mediaIds,
        thread: store.thread.map((item) => ({
          text: item.text.trim(),
          ...(item.mediaIds.length > 0 ? { mediaIds: item.mediaIds } : {}),
          ...(item.delaySec > 0 ? { delaySec: item.delaySec } : {}),
        })),
        requireApproval: store.requireApproval,
      },
      {
        onSuccess: () => {
          toast.success(
            store.requireApproval ? t('draftCreated') : now ? t('publishedNow') : t('scheduled'),
          );
          store.reset();
          router.push('/calendario');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  /** contador do canto do editor (Postiz): pill que abre a validação por canal */
  const counterPill = (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'ml-auto flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-semibold tabular-nums outline-none transition-colors duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            counterInvalid
              ? 'border-state-failed bg-state-failed-tint text-state-failed'
              : 'border-line bg-surface text-graphite hover:border-ink',
          )}
        >
          {counterInvalid ? <CircleAlert className="size-3.5" aria-hidden /> : null}
          {globalLen}
          {minMax !== undefined ? `/${minMax}` : ''}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-2 p-3">
        {counters.length === 0 ? (
          <p className="text-xs leading-relaxed text-graphite">{t('issues.noChannelSelected')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {counters.map(({ channel, max, len, over }) => (
              <li
                key={channel.id}
                className={cn(
                  'flex items-center justify-between gap-2 text-xs tabular-nums',
                  over ? 'font-semibold text-state-failed' : 'text-graphite',
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {PROVIDER_ICONS[channel.provider] ? (
                    <img src={PROVIDER_ICONS[channel.provider]} alt="" aria-hidden className="size-3.5 rounded-sm" />
                  ) : null}
                  <span className="truncate">{channel.name ?? channel.id}</span>
                </span>
                {len}
                {max !== undefined ? `/${max}` : ''}
              </li>
            ))}
          </ul>
        )}
        {issues.length > 0 ? (
          <ul className="flex flex-col gap-1 border-t border-line pt-2">
            {issues.map((issue) => (
              <li key={issue} className="text-xs leading-relaxed text-state-failed">
                {issue}
              </li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* coluna principal */}
        <div className="flex min-w-0 flex-col gap-5">
          <ChannelPicker selectedIds={store.channelIds} onToggle={store.toggleChannel} />

          <Tabs
            value={
              activeTab === 'global' || selected.some((ch) => ch.id === activeTab)
                ? activeTab
                : 'global'
            }
            onValueChange={setActiveTab}
          >
            <TabsList>
              <TabsTrigger value="global">{t('globalTab')}</TabsTrigger>
              {selected.map((ch) => (
                <TabsTrigger key={ch.id} value={ch.id}>
                  <Avatar className="size-4">
                    {ch.avatarUrl ? <AvatarImage src={ch.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-[9px]">
                      {(ch.name ?? '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {ch.name ?? ch.username ?? ch.id}
                  {store.overrides[ch.id] !== undefined ? (
                    <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="global" className="flex flex-col gap-3">
              {/* cartão do editor com toolbar embaixo (Postiz) */}
              <div className="rounded-md border border-line bg-surface transition-colors duration-200 focus-within:border-accent">
                <ComposerEditor
                  key={`global-${store.editorNonce}`}
                  initialText={store.text}
                  onChange={store.setText}
                  placeholder={t('placeholder')}
                  label={t('editorLabel')}
                  autoFocus
                  className="border-0 focus-within:border-0"
                />
                <div className="flex items-center gap-2 border-t border-line px-2 py-1.5">
                  <MediaPicker selectedIds={store.mediaIds} onToggle={store.toggleMedia} />
                  {counterPill}
                </div>
              </div>
              <MediaStrip mediaIds={store.mediaIds} onRemove={store.removeMedia} />
            </TabsContent>

            {selected.map((ch) => {
              const overridden = store.overrides[ch.id] !== undefined;
              const counter = counters.find((c) => c.channel.id === ch.id);
              return (
                <TabsContent key={ch.id} value={ch.id} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`override-${ch.id}`}
                      checked={overridden}
                      onCheckedChange={(checked) =>
                        checked ? store.setOverride(ch.id, store.text) : store.clearOverride(ch.id)
                      }
                    />
                    <Label htmlFor={`override-${ch.id}`}>{t('customize')}</Label>
                  </div>
                  {overridden ? (
                    <div className="rounded-md border border-line bg-surface transition-colors duration-200 focus-within:border-accent">
                      <ComposerEditor
                        key={`${ch.id}-${store.editorNonce}`}
                        initialText={store.overrides[ch.id] ?? ''}
                        onChange={(text) => store.setOverride(ch.id, text)}
                        placeholder={t('placeholder')}
                        label={t('channelEditorLabel', { name: ch.name ?? ch.id })}
                        className="border-0 focus-within:border-0"
                      />
                      <div className="flex items-center justify-end gap-2 border-t border-line px-2 py-1.5">
                        <span
                          className={cn(
                            'text-[11px] font-semibold tabular-nums',
                            counter?.over ? 'text-state-failed' : 'text-graphite',
                          )}
                          aria-live="polite"
                        >
                          {counter?.len}
                          {counter?.max !== undefined ? `/${counter.max}` : ''}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-line bg-surface-2 px-3 py-2">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-graphite">
                        {store.text.trim() ? store.text : t('customizeHint')}
                      </p>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          {/* thread (réplicas encadeadas) */}
          {selected.length > 0 && !threadSupported && store.thread.length === 0 ? null : (
            <div className="flex flex-col gap-3">
              {store.thread.map((item, i) => {
                const len = item.text.trim().length;
                const over = minMax !== undefined && len > minMax;
                return (
                  <div key={item.key} className="relative pl-6">
                    {/* conector vertical da thread */}
                    <span aria-hidden className="absolute bottom-0 left-2.5 top-0 w-px bg-line" />
                    <div className="rounded-md border border-line bg-surface transition-colors duration-200 focus-within:border-accent">
                      <ComposerEditor
                        key={`${item.key}-${store.editorNonce}`}
                        initialText={item.text}
                        onChange={(text) => store.setThreadText(item.key, text)}
                        placeholder={t('threadPlaceholder')}
                        label={t('threadItem', { index: i + 1 })}
                        className="border-0 focus-within:border-0 [&_.tiptap]:min-h-16"
                      />
                      <div className="flex flex-wrap items-center gap-2 border-t border-line px-2 py-1.5">
                        <MediaPicker
                          selectedIds={item.mediaIds}
                          onToggle={(mediaId) => store.toggleThreadMedia(item.key, mediaId)}
                        />
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor={`delay-${item.key}`} className="text-xs text-graphite">
                            {t('threadDelay')}
                          </Label>
                          <Input
                            id={`delay-${item.key}`}
                            type="number"
                            min={0}
                            max={600}
                            step={15}
                            value={item.delaySec}
                            onChange={(e) => store.setThreadDelay(item.key, Number(e.target.value))}
                            className="h-7 w-18 text-xs"
                          />
                          <span className="text-xs text-mist">s</span>
                        </div>
                        <span
                          className={cn(
                            'ml-auto text-[11px] font-semibold tabular-nums',
                            over ? 'text-state-failed' : 'text-graphite',
                          )}
                        >
                          {len}
                          {minMax !== undefined ? `/${minMax}` : ''}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('threadRemove')}
                          className="text-graphite hover:text-state-failed"
                          onClick={() => store.removeThreadItem(item.key)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      {item.mediaIds.length > 0 ? (
                        <div className="border-t border-line p-2">
                          <MediaStrip
                            mediaIds={item.mediaIds}
                            onRemove={(mediaId) => store.toggleThreadMedia(item.key, mediaId)}
                            size="sm"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {threadSupported ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit gap-1.5 bg-accent-tint text-accent hover:bg-accent-tint hover:text-accent-hover"
                  disabled={store.thread.length >= 24}
                  onClick={() => store.addThreadItem()}
                >
                  <Plus aria-hidden />
                  {t('threadAdd')}
                </Button>
              ) : store.thread.length > 0 ? (
                <p className="text-[13px] leading-relaxed text-state-failed">
                  {t('threadUnavailable', { channels: threadUnsupportedNames.join(', ') })}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* preview ao vivo */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:border-l lg:border-line lg:pl-6">
          <h2 className="text-base font-semibold tracking-[-0.2px] text-ink">{t('preview.title')}</h2>
          <PostPreview
            channels={selected}
            textFor={textFor}
            mediaIds={store.mediaIds}
            thread={store.thread.map((item) => ({ text: item.text, mediaIds: item.mediaIds }))}
          />
        </aside>
      </div>

      {/* rodapé de ações (Postiz: data + rascunho + CTA) */}
      <div className="sticky bottom-0 z-10 -mx-6 mt-8 border-t border-line bg-surface px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="require-approval"
              checked={store.requireApproval}
              onCheckedChange={(checked) => store.setRequireApproval(checked === true)}
            />
            <Label htmlFor="require-approval">{t('approval')}</Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => store.reset()}
            disabled={schedule.isPending}
          >
            {t('discard')}
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {issues.length > 0 ? (
              <span className="text-xs text-graphite">{issues[0]}</span>
            ) : null}
            <Input
              type="datetime-local"
              value={store.publishAtLocal}
              min={toLocalInput(new Date())}
              onChange={(e) => store.setPublishAtLocal(e.target.value)}
              aria-label={t('modeSchedule')}
              className="w-52"
            />
            {!store.requireApproval ? (
              <Button
                variant="outline"
                disabled={issues.length > 0}
                isLoading={schedule.isPending}
                onClick={() => submit(true)}
              >
                {t('submitNow')}
              </Button>
            ) : null}
            <Button
              disabled={issues.length > 0 || scheduleIssues.length > 0}
              isLoading={schedule.isPending}
              onClick={() => submit(false)}
            >
              {store.requireApproval ? t('submitDraft') : t('submitSchedule')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
