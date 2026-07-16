'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChannels, useProviders } from '@/features/channels/hooks';
import { useApiErrorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { ChannelPicker } from './channel-picker';
import { ComposerEditor } from './editor';
import { useSchedulePost } from './hooks';
import { useComposerStore } from './store';

/** Date → valor de <input type="datetime-local"> no fuso local. */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Composer v1 (SPEC_FRONTEND §3.3): canais → texto global + override por canal
 * → agendamento. O estado vive no Zustand com persist (rascunho sobrevive a
 * F5/fechar); o gate `mounted` evita mismatch de hidratação com o localStorage.
 */
export function ComposerView() {
  const t = useTranslations('composer');
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const store = useComposerStore();
  const channels = useChannels();
  const providers = useProviders();
  const schedule = useSchedulePost();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [activeTab, setActiveTab] = useState('global');

  // primeiro uso do modo "agendar": sugere a próxima hora cheia
  useEffect(() => {
    if (!mounted || store.publishAtLocal) return;
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    store.setPublishAtLocal(toLocalInput(d));
  }, [mounted, store.publishAtLocal, store.setPublishAtLocal]);

  if (!mounted) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // seleção efetiva = ids do rascunho que ainda existem como canal
  const selected = (channels.data ?? []).filter((ch) => store.channelIds.includes(ch.id));
  const providerOf = (providerId: string) => providers.data?.find((p) => p.id === providerId);
  const textFor = (channelId: string) => store.overrides[channelId] ?? store.text;

  const counters = selected.map((ch) => {
    const max = providerOf(ch.provider)?.maxLength;
    const len = textFor(ch.id).trim().length;
    return { channel: ch, max, len, over: max !== undefined && len > max };
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const publishAt =
    store.mode === 'now'
      ? new Date()
      : store.publishAtLocal
        ? new Date(store.publishAtLocal)
        : null;

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
  if (store.mode === 'schedule') {
    if (!publishAt || Number.isNaN(publishAt.getTime())) issues.push(t('issues.noDate'));
    else if (publishAt.getTime() < Date.now() - 60_000) issues.push(t('issues.pastDate'));
  }

  const submit = () => {
    // "agora" é o instante do clique, não do último render
    const at = store.mode === 'now' ? new Date() : publishAt;
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
        requireApproval: store.requireApproval,
      },
      {
        onSuccess: () => {
          toast.success(
            store.requireApproval
              ? t('draftCreated')
              : store.mode === 'now'
                ? t('publishedNow')
                : t('scheduled'),
          );
          store.reset();
          router.push('/calendario');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="composer-channels" className="flex flex-col gap-3">
          <h2 id="composer-channels" className="text-base font-semibold tracking-[-0.2px] text-ink">
            {t('channelsTitle')}
          </h2>
          <ChannelPicker selectedIds={store.channelIds} onToggle={store.toggleChannel} />
        </section>

        <section aria-labelledby="composer-content" className="flex flex-col gap-3">
          <h2 id="composer-content" className="text-base font-semibold tracking-[-0.2px] text-ink">
            {t('contentTitle')}
          </h2>
          <Tabs
            // aba de canal desmarcado não existe mais → volta pra global
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
                  {ch.name ?? ch.username ?? ch.id}
                  {store.overrides[ch.id] !== undefined ? (
                    <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="global" className="flex flex-col gap-2">
              <ComposerEditor
                key={`global-${store.editorNonce}`}
                initialText={store.text}
                onChange={store.setText}
                placeholder={t('placeholder')}
                label={t('editorLabel')}
                autoFocus
              />
              {counters.length > 0 ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1" aria-live="polite">
                  {counters.map(({ channel, max, len, over }) => (
                    <span
                      key={channel.id}
                      className={cn(
                        'text-xs tabular-nums',
                        over ? 'font-semibold text-state-failed' : 'text-graphite',
                      )}
                    >
                      {channel.name ?? channel.id} · {len}
                      {max !== undefined ? `/${max}` : ''}
                    </span>
                  ))}
                </div>
              ) : null}
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
                    <ComposerEditor
                      key={`${ch.id}-${store.editorNonce}`}
                      initialText={store.overrides[ch.id] ?? ''}
                      onChange={(text) => store.setOverride(ch.id, text)}
                      placeholder={t('placeholder')}
                      label={t('channelEditorLabel', { name: ch.name ?? ch.id })}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed border-line bg-surface-2 px-3 py-2">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-graphite">
                        {store.text.trim() ? store.text : t('customizeHint')}
                      </p>
                    </div>
                  )}
                  {counter ? (
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        counter.over ? 'font-semibold text-state-failed' : 'text-graphite',
                      )}
                      aria-live="polite"
                    >
                      {counter.len}
                      {counter.max !== undefined ? `/${counter.max}` : ''}
                    </span>
                  ) : null}
                </TabsContent>
              );
            })}
          </Tabs>
        </section>
      </div>

      <Card className="flex flex-col gap-4 p-4 lg:sticky lg:top-20">
        <h2 className="text-base font-semibold tracking-[-0.2px] text-ink">{t('scheduleTitle')}</h2>

        <RadioGroup
          value={store.mode}
          onValueChange={(v) => store.setMode(v as 'now' | 'schedule')}
          className="gap-3"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="schedule" id="mode-schedule" />
            <Label htmlFor="mode-schedule">{t('modeSchedule')}</Label>
          </div>
          {store.mode === 'schedule' ? (
            <div className="flex flex-col gap-1 pl-6">
              <Input
                type="datetime-local"
                value={store.publishAtLocal}
                min={toLocalInput(new Date())}
                onChange={(e) => store.setPublishAtLocal(e.target.value)}
                aria-label={t('modeSchedule')}
              />
              <span className="text-xs text-graphite">{t('timezone', { tz: timezone })}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="now" id="mode-now" />
            <Label htmlFor="mode-now">{t('modeNow')}</Label>
          </div>
        </RadioGroup>

        <Separator />

        <div className="flex items-start gap-2">
          <Checkbox
            id="require-approval"
            checked={store.requireApproval}
            onCheckedChange={(checked) => store.setRequireApproval(checked === true)}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="require-approval">{t('approval')}</Label>
            <span className="text-xs leading-relaxed text-graphite">{t('approvalHint')}</span>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={issues.length > 0}
          isLoading={schedule.isPending}
          onClick={submit}
        >
          {store.requireApproval
            ? t('submitDraft')
            : store.mode === 'now'
              ? t('submitNow')
              : t('submitSchedule')}
        </Button>

        {issues.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {issues.map((issue) => (
              <li key={issue} className="text-xs leading-relaxed text-graphite">
                {issue}
              </li>
            ))}
          </ul>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => store.reset()}
          disabled={schedule.isPending}
        >
          {t('discard')}
        </Button>
      </Card>
    </div>
  );
}
