'use client';

import { CircleAlert, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HoverPopover } from '@/components/ui/hover-popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChannels, useProviders } from '@/features/channels/hooks';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { useMediaList } from '@/features/media/hooks';
import { useApiErrorMessage } from '@/lib/api/errors';
import { toLocalInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import type { Editor } from '@tiptap/react';
import { ChannelPicker } from './channel-picker';
import { ChannelSettingsCard } from './channel-settings';
import { ComposerEditor } from './editor';
import { FormattingToolbar } from './formatting-toolbar';
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
/**
 * Tela de criação de post. `onDone` = está dentro do modal (ComposerModal): publicar/agendar/
 * descartar fecha o popup. Sem `onDone` (rota /compor), navega para o calendário no submit.
 */
export function ComposerView({ onDone }: { onDone?: () => void } = {}) {
  const t = useTranslations('composer');
  const tSettings = useTranslations('composer.channelSettings');
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const store = useComposerStore();
  const channels = useChannels();
  const providers = useProviders();
  const mediaLibrary = useMediaList();
  const schedule = useSchedulePost();

  const [mounted, setMounted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => setMounted(true), []);
  const [activeTab, setActiveTab] = useState('global');
  const [globalEditor, setGlobalEditor] = useState<Editor | null>(null);
  const [channelEditors, setChannelEditors] = useState<Record<string, Editor | null>>({});

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

  // settings obrigatórias não preenchidas (ex.: canal do Discord) — acusadas no indicador,
  // genérico via `required` do JSON Schema do settingsSchema de cada provider (catálogo)
  for (const ch of selected) {
    const info = providerOf(ch.provider);
    const schema = info?.settingsSchema as
      | { required?: string[]; properties?: Record<string, { title?: string }> }
      | undefined;
    if (!schema?.required?.length) continue;
    const values = (store.channelSettings[ch.id] ?? {}) as Record<string, unknown>;
    for (const key of schema.required) {
      const v = values[key];
      const missing =
        v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (missing) {
        const field = tSettings.has(`fields.${info!.id}.${key}`)
          ? tSettings(`fields.${info!.id}.${key}`)
          : (schema.properties?.[key]?.title ?? key);
        issues.push(t('issues.missingSetting', { name: ch.name ?? ch.id, field }));
      }
    }
  }

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
    const settingsByChannel: Record<string, Record<string, unknown>> = {};
    for (const ch of selected) {
      const settings = store.channelSettings[ch.id];
      if (settings && Object.keys(settings).length > 0) settingsByChannel[ch.id] = settings;
    }
    schedule.mutate(
      {
        text: store.text.trim(),
        channelIds: selected.map((ch) => ch.id),
        publishAt: at.toISOString(),
        timezone,
        textByChannel,
        settingsByChannel,
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
          if (onDone) onDone();
          else router.push('/calendario');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const uniqueIssues = Array.from(new Set(issues));

  /** conteúdo da validação no hover-popover */
  const validationContent = (
    <div className="flex flex-col gap-2">
      {counters.length > 0 ? (
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
      ) : !uniqueIssues.includes(t('issues.noChannelSelected')) ? (
        <p className="text-xs leading-relaxed text-graphite">{t('issues.noChannelSelected')}</p>
      ) : null}
      {uniqueIssues.length > 0 ? (
        <ul className={cn('flex flex-col gap-1', counters.length > 0 ? 'border-t border-line pt-2' : '')}>
          {uniqueIssues.map((issue) => (
            <li key={issue} className="text-xs leading-relaxed text-state-failed">
              {issue}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  /** contador do canto do editor (Postiz): pill que abre a validação por canal ou erros via hover */
  const counterPill = (
    <HoverPopover align="end" className="flex w-80 flex-col gap-2 p-3" content={validationContent}>
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
    </HoverPopover>
  );

  return (
    <div
      className={cn(
        'flex flex-col justify-between',
        onDone ? 'min-h-full' : 'min-h-[calc(100dvh-7rem)]',
      )}
    >
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
                  onEditorReady={(ed) => setGlobalEditor((prev) => (prev === ed ? prev : ed))}
                />
                <div className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-1.5">
                  <MediaPicker selectedIds={store.mediaIds} onToggle={store.toggleMedia} />
                  <FormattingToolbar editor={globalEditor} />
                  {counterPill}
                </div>
              </div>
              <MediaStrip mediaIds={store.mediaIds} onRemove={store.removeMedia} />
            </TabsContent>

            {selected.map((ch) => {
              const overridden = store.overrides[ch.id] !== undefined;
              const counter = counters.find((c) => c.channel.id === ch.id);
              const providerInfo = providerOf(ch.provider);
              return (
                <TabsContent key={ch.id} value={ch.id} className="flex flex-col gap-3">
                  {overridden ? (
                    <div className="rounded-md border border-line bg-surface transition-colors duration-200 focus-within:border-accent">
                      <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-3 py-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                          <LockOpen className="size-3.5 text-accent" aria-hidden />
                          Personalizando para {ch.name ?? ch.id}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => store.clearOverride(ch.id)}
                          className="h-6 gap-1 px-2 text-[11px] font-semibold text-graphite hover:bg-surface hover:text-ink"
                        >
                          <Lock className="size-3" aria-hidden />
                          Usar texto global
                        </Button>
                      </div>
                      <ComposerEditor
                        key={`${ch.id}-${store.editorNonce}`}
                        initialText={store.overrides[ch.id] ?? ''}
                        onChange={(text) => store.setOverride(ch.id, text)}
                        placeholder={t('placeholder')}
                        label={t('channelEditorLabel', { name: ch.name ?? ch.id })}
                        className="border-0 focus-within:border-0"
                        onEditorReady={(ed) => setChannelEditors((prev) => (prev[ch.id] === ed ? prev : { ...prev, [ch.id]: ed }))}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-line px-2 py-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <FormattingToolbar editor={channelEditors[ch.id] ?? null} />
                        </div>
                        <HoverPopover align="end" className="flex w-80 flex-col gap-2 p-3" content={validationContent}>
                          <button
                            type="button"
                            className={cn(
                              'flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-semibold tabular-nums outline-none transition-colors duration-200',
                              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                              counter?.over || (store.overrides[ch.id] !== undefined && store.overrides[ch.id]?.trim().length === 0)
                                ? 'border-state-failed bg-state-failed-tint text-state-failed'
                                : 'border-line bg-surface text-graphite hover:border-ink',
                            )}
                          >
                            {counter?.over || (store.overrides[ch.id] !== undefined && store.overrides[ch.id]?.trim().length === 0) ? (
                              <CircleAlert className="size-3.5" aria-hidden />
                            ) : null}
                            {counter?.len}
                            {counter?.max !== undefined ? `/${counter.max}` : ''}
                          </button>
                        </HoverPopover>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-md border border-line bg-surface p-6 text-center transition-colors duration-200">
                      <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-ink">
                        <Lock className="size-4" aria-hidden />
                      </div>
                      <p className="text-sm font-semibold text-ink">Edição global ativa</p>
                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-graphite">
                        Clique no botão abaixo para sair da edição global e personalizar o texto exclusivamente para este canal.
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => store.setOverride(ch.id, store.text)}
                        className="mt-4 gap-1.5 font-semibold"
                      >
                        <LockOpen className="size-3.5" aria-hidden />
                        Personalizar conteúdo
                      </Button>
                    </div>
                  )}
                  {providerInfo ? (
                    <ChannelSettingsCard
                      channelId={ch.id}
                      providerId={providerInfo.id}
                      providerName={providerInfo.name}
                      channelName={ch.name ?? ch.username ?? providerInfo.name}
                      schema={providerInfo.settingsSchema}
                      values={store.channelSettings[ch.id] ?? {}}
                      onChange={(key, value) => store.setChannelSetting(ch.id, key, value)}
                    />
                  ) : null}
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
                        onEditorReady={(ed) => setChannelEditors((prev) => (prev[item.key] === ed ? prev : { ...prev, [item.key]: ed }))}
                      />
                      <div className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-1.5">
                        <MediaPicker
                          selectedIds={item.mediaIds}
                          onToggle={(mediaId) => store.toggleThreadMedia(item.key, mediaId)}
                        />
                        <FormattingToolbar editor={channelEditors[item.key] ?? null} />
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
                        <HoverPopover align="end" className="flex w-80 flex-col gap-2 p-3" content={validationContent}>
                          <button
                            type="button"
                            className={cn(
                              'ml-auto flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-semibold tabular-nums outline-none transition-colors duration-200',
                              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                              over || len === 0
                                ? 'border-state-failed bg-state-failed-tint text-state-failed'
                                : 'border-line bg-surface text-graphite hover:border-ink',
                            )}
                          >
                            {over || len === 0 ? <CircleAlert className="size-3.5" aria-hidden /> : null}
                            {len}
                            {minMax !== undefined ? `/${minMax}` : ''}
                          </button>
                        </HoverPopover>
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
            publishAt={publishAt}
          />
        </aside>
      </div>

      {/* rodapé de ações (Postiz: data + rascunho + CTA) — mobile-first */}
      <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 mt-auto border-t border-line bg-surface px-4 py-3 shadow-none sm:-mx-6 sm:-mb-6 sm:px-6 sm:py-4">
        {/* erro (mobile: em cima, largura total; desktop: fica ao lado das CTAs) */}
        {uniqueIssues.length > 0 ? (
          <p className="mb-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-state-failed sm:hidden">
            <CircleAlert className="size-3.5 shrink-0 translate-y-px" aria-hidden />
            {uniqueIssues[0]}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <div className="flex items-center gap-2">
              <Checkbox
                id="require-approval"
                checked={store.requireApproval}
                onCheckedChange={(checked) => store.setRequireApproval(checked === true)}
              />
              <Label htmlFor="require-approval">{t('approval')}</Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 hover:border-destructive hover:bg-destructive/10 hover:text-destructive sm:h-[38px] sm:px-5 sm:text-[13px]"
              onClick={() => setConfirmDiscard(true)}
              disabled={schedule.isPending}
            >
              <Trash2 aria-hidden />
              {t('discard')}
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:flex-wrap sm:items-center">
            {uniqueIssues.length > 0 ? (
              <span className="hidden text-xs text-graphite sm:inline">{uniqueIssues[0]}</span>
            ) : null}
            <DateTimePicker
              value={store.publishAtLocal}
              min={toLocalInput(new Date())}
              onChange={store.setPublishAtLocal}
              ariaLabel={t('modeSchedule')}
              className="w-full sm:w-auto"
            />
            <div className="flex gap-2">
              {!store.requireApproval ? (
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={issues.length > 0}
                  isLoading={schedule.isPending}
                  onClick={() => submit(true)}
                >
                  {t('submitNow')}
                </Button>
              ) : null}
              <Button
                className="flex-1 sm:flex-none"
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

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('discardWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('discardKeep')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-paper hover:bg-destructive/90"
              onClick={() => {
                store.reset();
                setConfirmDiscard(false);
                onDone?.();
              }}
            >
              {t('discardConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
