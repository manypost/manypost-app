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
import { ConnectDialog } from './connect-dialog';
import { useChannels, useConnectChannel, useDisconnectChannel, useProviders } from './hooks';
import { PROVIDER_FIELDS } from './provider-fields';
import { PROVIDER_ICONS, ProviderIcon } from './provider-icon';
import { useOauthFlow } from './use-oauth-flow';

type ProviderInfo = {
  id: string;
  name: string;
  editor: boolean;
  threads: boolean;
  twoStepConnect: boolean;
  connectType: 'fields' | 'oauth';
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

  /** Com campos mapeados → dialog; OAuth puro → direto pro popup. */
  const startConnect = async (provider: ProviderInfo) => {
    if (PROVIDER_FIELDS[provider.id]?.length) {
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
    <div className="flex flex-col gap-10">
      <section aria-labelledby="channels-title" className="flex flex-col gap-4">
        <h2 id="channels-title" className="text-base font-semibold tracking-[-0.2px] text-ink">
          {t('channelsTitle')}
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
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {channels.data.map((ch) => {
              const provider = providers.data?.find((p) => p.id === ch.provider);
              return (
                <li key={ch.id}>
                  <Card className="flex items-center gap-3 p-4">
                    <span className="relative shrink-0">
                      <Avatar className="size-10">
                        {ch.avatarUrl ? <AvatarImage src={ch.avatarUrl} alt="" /> : null}
                        <AvatarFallback>{(ch.name ?? ch.username ?? '?').charAt(0)}</AvatarFallback>
                      </Avatar>
                      {PROVIDER_ICONS[ch.provider] ? (
                        // badge da rede sobre o avatar da conta (padrão multi-rede)
                        <img
                          src={PROVIDER_ICONS[ch.provider]}
                          alt=""
                          aria-hidden
                          className="absolute -bottom-0.5 -right-0.5 size-4 rounded-sm border border-surface"
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {ch.name ?? ch.username ?? ch.id}
                      </p>
                      <p className="truncate text-xs text-graphite">
                        {provider?.name ?? ch.provider}
                        {ch.username ? ` · @${ch.username.replace(/^@/, '')}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[ch.status] ?? 'neutral'}>
                          {t.has(`status.${ch.status}`) ? t(`status.${ch.status}`) : ch.status}
                        </Badge>
                        {ch.status === 'REFRESH_REQUIRED' ? (
                          <Button variant="outline" size="sm" onClick={() => reconnect(ch)}>
                            {t('reconnect')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t('channelActions')}>
                          <EllipsisVertical aria-hidden />
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
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.data.map((p) => (
              <li key={p.id}>
                <Card className="flex h-full items-center gap-3 p-4 transition-colors duration-200 hover:border-accent">
                  <ProviderIcon provider={p.id} name={p.name} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p.threads ? <Badge>{t('capabilities.threads')}</Badge> : null}
                      {p.twoStepConnect ? <Badge>{t('capabilities.twoStep')}</Badge> : null}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startConnect(p as ProviderInfo)}
                    isLoading={connect.isPending && connect.variables?.provider === p.id}
                  >
                    {t('connect')}
                  </Button>
                </Card>
              </li>
            ))}
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
