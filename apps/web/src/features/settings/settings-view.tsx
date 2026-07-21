'use client';

import { Copy, KeyRound, Plus, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks';
import { PlanLockNotice, usePlanLocked } from '@/features/billing/plan-lock';
import { useApiErrorMessage } from '@/lib/api/errors';
import { relativeTime } from '@/lib/datetime';
import {
  type ApiKeyScope,
  type WebhookEvent,
  useApiKeys,
  useCreateApiKey,
  useCreateWebhook,
  useDeleteWebhook,
  useRevokeApiKey,
  useWebhooks,
} from './hooks';

const ALL_SCOPES: ApiKeyScope[] = [
  'posts:read',
  'posts:write',
  'channels:read',
  'channels:write',
  'media:write',
  'analytics:read',
  'webhooks:manage',
  'mcp',
];

const ALL_EVENTS: WebhookEvent[] = [
  'post.scheduled',
  'post.published',
  'post.failed',
  'channel.refresh_required',
  'channel.disconnected',
  'mention.received',
];

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.2px] text-ink">
      <Icon className="size-4 text-graphite" aria-hidden />
      {children}
    </h2>
  );
}

/** Bloco "copie agora" — segredo aparece uma única vez (API key / whsec). */
function SecretOnce({ value, onDismiss }: { value: string; onDismiss: () => void }) {
  const t = useTranslations('settings');
  return (
    <div className="flex flex-col gap-2 rounded-md border border-accent bg-accent-tint p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t('secretOnce')}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-sm border border-line bg-surface px-2 py-1.5 text-xs text-ink">
          {value}
        </code>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            toast.success(t('copied'));
          }}
        >
          <Copy aria-hidden />
          {t('copy')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t('done')}
        </Button>
      </div>
    </div>
  );
}

export function SettingsView() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const me = useMe();
  // "API REST e servidor MCP" (chaves e webhooks) é linha do Pro no gerenciado
  const apiLocked = usePlanLocked('public_api');

  // ---- API keys ----
  const apiKeys = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<ApiKeyScope[]>(['posts:read', 'posts:write']);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);

  // ---- webhooks ----
  const webhooks = useWebhooks();
  const createHook = useCreateWebhook();
  const deleteHook = useDeleteWebhook();
  const [hookDialogOpen, setHookDialogOpen] = useState(false);
  const [hookName, setHookName] = useState('');
  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState<WebhookEvent[]>(['post.published', 'post.failed']);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [hookToDelete, setHookToDelete] = useState<string | null>(null);

  const user = me.data?.user;

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      {/* perfil */}
      <section className="flex flex-col gap-4">
        <SectionTitle icon={KeyRound}>{t('profileTitle')}</SectionTitle>
        {me.isPending ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : (
          <div className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
            <Avatar className="size-12">
              {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback>{(user?.name ?? user?.email ?? '?').charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-[13px] text-graphite">{user?.email}</p>
            </div>
            {me.data?.role ? <Badge variant="accent">{me.data.role}</Badge> : null}
          </div>
        )}
      </section>

      {/* API keys */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionTitle icon={KeyRound}>{t('apiKeysTitle')}</SectionTitle>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={apiLocked}
            onClick={() => setKeyDialogOpen(true)}
          >
            <Plus aria-hidden />
            {t('newKey')}
          </Button>
        </div>
        <p className="-mt-2 text-[13px] leading-relaxed text-graphite">{t('apiKeysHint')}</p>
        <PlanLockNotice feature="public_api" />

        {freshKey ? <SecretOnce value={freshKey} onDismiss={() => setFreshKey(null)} /> : null}

        {apiKeys.isPending ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : apiKeys.isError ? (
          <p className="rounded-md border border-line bg-surface-2 px-3 py-4 text-center text-[13px] text-graphite">
            {errorMessage(apiKeys.error)}
          </p>
        ) : apiKeys.data.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-surface-2 px-3 py-6 text-center text-[13px] text-graphite">
            {t('noKeys')}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-line bg-surface">
            {apiKeys.data.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
                    {key.name}
                    <code className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-normal text-graphite">
                      {key.prefix}…
                    </code>
                    {key.revokedAt ? <Badge>{t('revoked')}</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-graphite">
                    {key.scopes.join(' · ')}
                    {key.lastUsedAt
                      ? ` — ${t('lastUsed', { when: relativeTime(key.lastUsedAt, locale) })}`
                      : ''}
                  </p>
                </div>
                {!key.revokedAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-state-failed hover:text-state-failed"
                    onClick={() => setKeyToRevoke(key.id)}
                  >
                    <Trash2 aria-hidden />
                    {t('revoke')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* webhooks */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionTitle icon={WebhookIcon}>{t('webhooksTitle')}</SectionTitle>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={apiLocked}
            onClick={() => setHookDialogOpen(true)}
          >
            <Plus aria-hidden />
            {t('newWebhook')}
          </Button>
        </div>
        <p className="-mt-2 text-[13px] leading-relaxed text-graphite">{t('webhooksHint')}</p>
        <PlanLockNotice feature="public_api" />

        {freshSecret ? <SecretOnce value={freshSecret} onDismiss={() => setFreshSecret(null)} /> : null}

        {webhooks.isPending ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : webhooks.isError ? (
          <p className="rounded-md border border-line bg-surface-2 px-3 py-4 text-center text-[13px] text-graphite">
            {errorMessage(webhooks.error)}
          </p>
        ) : webhooks.data.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-surface-2 px-3 py-6 text-center text-[13px] text-graphite">
            {t('noWebhooks')}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-line bg-surface">
            {webhooks.data.map((hook) => (
              <li
                key={hook.id}
                className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
                    {hook.name}
                    {hook.disabledAt ? <Badge>{t('disabled')}</Badge> : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-graphite">{hook.url}</p>
                  <p className="mt-0.5 text-xs text-graphite">{hook.events.join(' · ')}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-state-failed hover:text-state-failed"
                  onClick={() => setHookToDelete(hook.id)}
                >
                  <Trash2 aria-hidden />
                  {t('delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* dialog: nova API key */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newKey')}</DialogTitle>
            <DialogDescription>{t('newKeyHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="key-name">{t('keyName')}</Label>
            <Input
              id="key-name"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder={t('keyNamePlaceholder')}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-semibold text-ink">{t('scopes')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-[13px] text-ink">
                  <Checkbox
                    checked={keyScopes.includes(scope)}
                    onCheckedChange={(checked) =>
                      setKeyScopes((prev) =>
                        checked ? [...prev, scope] : prev.filter((s) => s !== scope),
                      )
                    }
                  />
                  <code className="text-xs">{scope}</code>
                </label>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              disabled={keyName.trim() === '' || keyScopes.length === 0}
              isLoading={createKey.isPending}
              onClick={() =>
                createKey.mutate(
                  { name: keyName.trim(), scopes: keyScopes },
                  {
                    onSuccess: (data) => {
                      setFreshKey(data.apiKey);
                      setKeyDialogOpen(false);
                      setKeyName('');
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                )
              }
            >
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog: novo webhook */}
      <Dialog open={hookDialogOpen} onOpenChange={setHookDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newWebhook')}</DialogTitle>
            <DialogDescription>{t('newWebhookHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hook-name">{t('webhookName')}</Label>
            <Input id="hook-name" value={hookName} onChange={(e) => setHookName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hook-url">URL</Label>
            <Input
              id="hook-url"
              type="url"
              placeholder="https://…"
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-semibold text-ink">{t('events')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {ALL_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 text-[13px] text-ink">
                  <Checkbox
                    checked={hookEvents.includes(event)}
                    onCheckedChange={(checked) =>
                      setHookEvents((prev) =>
                        checked ? [...prev, event] : prev.filter((e) => e !== event),
                      )
                    }
                  />
                  <code className="text-xs">{event}</code>
                </label>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHookDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              disabled={hookName.trim() === '' || hookUrl.trim() === '' || hookEvents.length === 0}
              isLoading={createHook.isPending}
              onClick={() =>
                createHook.mutate(
                  { name: hookName.trim(), url: hookUrl.trim(), events: hookEvents },
                  {
                    onSuccess: (data) => {
                      setFreshSecret(data.secret);
                      setHookDialogOpen(false);
                      setHookName('');
                      setHookUrl('');
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                )
              }
            >
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* confirmações destrutivas */}
      <AlertDialog open={keyToRevoke !== null} onOpenChange={(open) => !open && setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revokeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('revokeWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!keyToRevoke) return;
                revokeKey.mutate(keyToRevoke, {
                  onSuccess: () => toast.success(t('keyRevoked')),
                  onError: (err) => toast.error(errorMessage(err)),
                });
                setKeyToRevoke(null);
              }}
            >
              {t('revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={hookToDelete !== null} onOpenChange={(open) => !open && setHookToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteWebhookTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteWebhookWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!hookToDelete) return;
                deleteHook.mutate(hookToDelete, {
                  onSuccess: () => toast.success(t('webhookDeleted')),
                  onError: (err) => toast.error(errorMessage(err)),
                });
                setHookToDelete(null);
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
