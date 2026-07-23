'use client';

import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useApiErrorMessage } from '@/lib/api/errors';
import { useConnectChannel, useInvalidateChannels } from './hooks';
import { connectionFields } from './provider-fields';
import { useProviderNote } from './provider-note';
import { useOauthFlow } from './use-oauth-flow';

type Provider = {
  id: string;
  name: string;
  connectType: 'fields' | 'oauth';
  connectionFieldsSchema?: Record<string, unknown>;
};

/**
 * Formulário de conexão p/ providers com campos (credenciais ou instância
 * própria). 201 = canal criado direto; 200 = URL OAuth → popup.
 */
export function ConnectDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('connections');
  const tc = useTranslations('common');
  const tv = useTranslations('validation');
  const errorMessage = useApiErrorMessage();
  const connect = useConnectChannel();
  const invalidate = useInvalidateChannels();
  const runOauth = useOauthFlow();
  const note = useProviderNote()(provider);

  const fields = connectionFields(provider.connectionFieldsSchema);
  const form = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, ''])),
  });

  const close = (next: boolean) => {
    if (!next) {
      form.reset();
      connect.reset();
    }
    onOpenChange(next);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.trim() !== ''),
    );
    const data = await connect.mutateAsync({ provider: provider.id, fields: cleaned }).catch(() => null);
    if (!data) return; // erro já está em connect.error
    close(false);
    if ('url' in data) {
      await runOauth(data.url);
      return;
    }
    await invalidate();
    toast.success(t('connected'));
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('connectTitle', { provider: provider.name })}</DialogTitle>
          {provider.connectType === 'oauth' ? (
            <DialogDescription>{t('oauthHint')}</DialogDescription>
          ) : null}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed">
              <p className="text-ink">{note.what}</p>
              {note.setup ? (
                <p className="mt-1.5 text-graphite">
                  <span className="font-medium text-ink">{note.modeLabel}:</span> {note.setup}
                </p>
              ) : null}
            </div>
            {connect.isError ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>{errorMessage(connect.error)}</AlertDescription>
              </Alert>
            ) : null}
            {fields.map((f) => (
              <FormField
                key={f.name}
                control={form.control}
                name={f.name}
                rules={f.required ? { required: tv('required') } : undefined}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {/* label do i18n; provider ainda sem tradução cai no nome do campo */}
                      {t.has(`fields.${provider.id}.${f.name}`)
                        ? t(`fields.${provider.id}.${f.name}`)
                        : f.name}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type={f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text'}
                        placeholder={
                          t.has(`fields.${provider.id}.${f.name}Placeholder`)
                            ? t(`fields.${provider.id}.${f.name}Placeholder`)
                            : undefined
                        }
                        {...field}
                      />
                    </FormControl>
                    {f.description ? <FormDescription>{f.description}</FormDescription> : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {tc('cancel')}
              </Button>
              <Button type="submit" isLoading={connect.isPending}>
                {t('connect')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
