'use client';

import { CircleAlert, EllipsisVertical, Unplug } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiErrorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { ConnectDialog } from './connect-dialog';
import { useChannels, useConnectChannel, useDisconnectChannel, useProviders } from './hooks';
import { connectionFields } from './provider-fields';
import { PROVIDER_ICONS, ProviderIcon } from './provider-icon';
import { useOauthFlow } from './use-oauth-flow';

type ProviderInfo = {
  id: string;
  name: string;
  editor: boolean;
  threads: boolean;
  twoStepConnect: boolean;
  connectType: 'fields' | 'oauth';
  connectionFieldsSchema?: Record<string, unknown>;
};
type Channel = {
  id: string;
  provider: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: string;
};

const STATUS_VARIANT: Record<string, 'published' | 'review' | 'neutral'> = {
  ACTIVE: 'published',
  REFRESH_REQUIRED: 'review',
  DISABLED: 'neutral',
};

export function ConnectionsView() {
  const t = useTranslations('connections');
  const errorMessage = useApiErrorMessage();
  const providers = useProviders();
  const channels = useChannels();
  const connect = useConnectChannel();
  const runOauth = useOauthFlow();

  const [fieldsProvider, setFieldsProvider] = useState<ProviderInfo | null>(null);
  const [toDisconnect, setToDisconnect] = useState<Channel | null>(null);

  /** Com campos de conexão no catálogo → dialog; OAuth puro → direto pro popup. */
  const startConnect = async (provider: ProviderInfo) => {
    if (provider.connectType === 'fields' || connectionFields(provider.connectionFieldsSchema).length > 0) {
      setFieldsProvider(provider);
      return;
    }
    const data = await connect
      .mutateAsync({ provider: provider.id })
      .catch((err) => {
        toast.error(errorMessage(err));
        return null;
      });
    if (data && 'url' in data) await runOauth(data.url);
  };

  const reconnect = (channel: Channel) => {
    const provider = providers.data?.find((p) => p.id === channel.provider);
    if (provider) void startConnect(provider);
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="channels-title" className="flex flex-col gap-4">
        <h2 id="channels-title" className="text-base font-semibold tracking-[-0.2px] text-ink">
          {t('channelsTitle')}
          {channels.data ? (
            <span className="ml-1.5 font-normal text-graphite">({channels.data.length})</span>
          ) : null}
        </h2>
        {channels.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-[76px] rounded-lg" />
            <Skeleton className="h-[76px] rounded-lg" />
            <Skeleton className="h-[76px] rounded-lg" />
          </div>
        ) : channels.isError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {errorMessage(channels.error)}
              <Button variant="outline" size="sm" onClick={() => channels.refetch()}>
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : channels.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-surface-2 px-6 py-10 text-center">
            <p className="text-sm leading-relaxed text-graphite">{t('empty')}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {channels.data.map((ch) => {
              const provider = providers.data?.find((p) => p.id === ch.provider);
              return (
                <li key={ch.id}>
                  <Card className="group flex items-center gap-3 p-3 transition-all hover:border-accent/40 hover:bg-surface-2/30 hover:shadow-sm">
                    <span className="relative shrink-0">
                      <Avatar className="size-10">
                        {ch.avatarUrl ? <AvatarImage src={ch.avatarUrl} alt="" /> : null}
                        <AvatarFallback>{(ch.name ?? ch.username ?? '?').charAt(0)}</AvatarFallback>
                      </Avatar>
                      {PROVIDER_ICONS[ch.provider] ? (
                        <img
                          src={PROVIDER_ICONS[ch.provider]}
                          alt=""
                          aria-hidden
                          className="absolute -bottom-0.5 -right-0.5 size-4 rounded-sm border-2 border-surface bg-surface"
                        />
                      ) : null}
                    </span>
                    
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {ch.name ?? ch.username ?? ch.id}
                        </p>
                        <Badge variant={STATUS_VARIANT[ch.status] ?? 'neutral'} className="h-4 px-1 text-[9px] uppercase tracking-wider">
                          {t.has(`status.${ch.status}`) ? t(`status.${ch.status}`) : ch.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-graphite">
                        {provider?.name ?? ch.provider}
                        {ch.username ? ` · @${ch.username.replace(/^@/, '')}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {ch.status === 'REFRESH_REQUIRED' ? (
                        <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => reconnect(ch)}>
                          {t('reconnect')}
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="size-7" aria-label={t('channelActions')}>
                            <EllipsisVertical className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => setToDisconnect(ch)}
                            className="text-state-failed focus:text-state-failed [&_svg]:text-state-failed"
                          >
                            <Unplug aria-hidden />
                            {t('disconnect')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="catalog-title" className="flex flex-col gap-4">
        <h2 id="catalog-title" className="text-base font-semibold tracking-[-0.2px] text-ink">
          {t('catalogTitle')}
        </h2>
        {providers.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-[88px] rounded-lg" />
            <Skeleton className="h-[88px] rounded-lg" />
            <Skeleton className="h-[88px] rounded-lg" />
          </div>
        ) : providers.isError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {errorMessage(providers.error)}
              <Button variant="outline" size="sm" onClick={() => providers.refetch()}>
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : providers.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-surface-2 px-6 py-10 text-center">
            <p className="text-sm leading-relaxed text-graphite">{t('catalogEmpty')}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {providers.data.map((p) => {
              const connecting = connect.isPending && connect.variables?.provider === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => startConnect(p as ProviderInfo)}
                    disabled={connecting}
                    aria-label={t('connectTitle', { provider: p.name })}
                    className={cn(
                      'group flex h-full w-full items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left outline-none transition-all duration-200',
                      'hover:border-accent/40 hover:bg-surface-2 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      'disabled:cursor-progress disabled:opacity-60',
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 transition-colors group-hover:bg-surface">
                      <ProviderIcon provider={p.id} name={p.name} className="size-5" />
                    </div>
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <span className="truncate text-[13px] font-medium text-ink">{p.name}</span>
                      <span className="truncate text-xs text-graphite">
                        {p.threads ? t('capabilities.threads') : t('connect')}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {fieldsProvider ? (
        <ConnectDialog
          provider={fieldsProvider}
          open
          onOpenChange={(open) => {
            if (!open) setFieldsProvider(null);
          }}
        />
      ) : null}

      <DisconnectDialog channel={toDisconnect} onClose={() => setToDisconnect(null)} />
    </div>
  );
}

function DisconnectDialog({
  channel,
  onClose,
}: {
  channel: Channel | null;
  onClose: () => void;
}) {
  const t = useTranslations('connections');
  const tc = useTranslations('common');
  const errorMessage = useApiErrorMessage();
  const disconnect = useDisconnectChannel();

  return (
    <Dialog open={channel !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('disconnectTitle', { name: channel?.name ?? channel?.username ?? '' })}
          </DialogTitle>
          <DialogDescription>{t('disconnectWarning')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="destructive"
            isLoading={disconnect.isPending}
            onClick={() => {
              if (!channel) return;
              disconnect.mutate(channel.id, {
                onSuccess: () => {
                  toast.success(t('disconnected'));
                  onClose();
                },
                onError: (err) => toast.error(errorMessage(err)),
              });
            }}
          >
            {t('disconnect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
