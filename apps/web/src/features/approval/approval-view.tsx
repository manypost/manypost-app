'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, MessageSquareText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/wordmark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { NetworkPreview } from '@/features/composer/network-preview';
import { api } from '@/lib/api/client';
import { useApiErrorMessage } from '@/lib/api/errors';
import type { components } from '@/lib/api/schema';
import { cn } from '@/lib/utils';

type Preview = components['schemas']['ApprovalPreview'];

/**
 * Página pública de aprovação (SPEC_FRONTEND §3.6, DECISIONS v1.1 §12):
 * sem login, por token — preview por rede + Aprovar / Pedir ajustes.
 * 404 é uniforme (inválido/expirado/revogado) e a resolução é idempotente.
 */
export function ApprovalView({ token }: { token: string }) {
  const t = useTranslations('approval');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const preview = useQuery({
    queryKey: ['public-approval', token],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/public/approval/{token}', {
        params: { path: { token } },
      });
      if (error) throw Object.assign(error as object, { httpStatus: response.status });
      return data;
    },
    retry: false,
  });

  const [name, setName] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['public-approval', token] });

  const approve = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/public/approval/{token}/approve', {
        params: { path: { token } },
        body: { ...(name.trim() ? { name: name.trim() } : {}) },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t('approvedToast'));
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const requestChanges = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/public/approval/{token}/request-changes', {
        params: { path: { token } },
        body: { feedback: feedback.trim(), ...(name.trim() ? { name: name.trim() } : {}) },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t('changesToast'));
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="min-h-dvh bg-surface-2">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8">
        <header className="flex items-center justify-between">
          <Wordmark />
          <Badge variant="accent">{t('badge')}</Badge>
        </header>

        {preview.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ) : preview.isError ? (
          // mensagem neutra — não vaza existência do conteúdo (SPEC §3.6)
          <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-6 py-16 text-center">
            <CircleAlert className="size-8 text-mist" aria-hidden />
            <h1 className="text-lg font-semibold tracking-[-0.2px] text-ink">{t('notFoundTitle')}</h1>
            <p className="max-w-sm text-sm leading-relaxed text-graphite">{t('notFoundBody')}</p>
          </div>
        ) : (
          <ApprovalContent
            data={preview.data}
            locale={locale}
            name={name}
            setName={setName}
            feedbackOpen={feedbackOpen}
            setFeedbackOpen={setFeedbackOpen}
            feedback={feedback}
            setFeedback={setFeedback}
            onApprove={() => approve.mutate()}
            approving={approve.isPending}
            onRequestChanges={() => requestChanges.mutate()}
            requesting={requestChanges.isPending}
          />
        )}
      </div>
    </div>
  );
}

function ApprovalContent({
  data,
  locale,
  name,
  setName,
  feedbackOpen,
  setFeedbackOpen,
  feedback,
  setFeedback,
  onApprove,
  approving,
  onRequestChanges,
  requesting,
}: {
  data: Preview;
  locale: string;
  name: string;
  setName: (v: string) => void;
  feedbackOpen: boolean;
  setFeedbackOpen: (v: boolean) => void;
  feedback: string;
  setFeedback: (v: string) => void;
  onApprove: () => void;
  approving: boolean;
  onRequestChanges: () => void;
  requesting: boolean;
}) {
  const t = useTranslations('approval');
  const pending = data.status === 'PENDING';
  const approved = data.status === 'APPROVED';

  const when = data.publishAt
    ? new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(data.publishAt))
    : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-[-0.3px] text-ink">{t('title')}</h1>
        {when ? (
          <p className="text-sm leading-relaxed text-graphite">
            {t('scheduledFor', { when })}{' '}
            <span className="text-mist">({Intl.DateTimeFormat().resolvedOptions().timeZone})</span>
          </p>
        ) : null}
      </div>

      {/* já resolvido: banner idempotente, ações desativadas */}
      {!pending ? (
        <div
          className={cn(
            'flex items-start gap-3 rounded-lg border p-4',
            approved
              ? 'border-line bg-state-published-tint text-state-published'
              : 'border-line bg-state-review-tint text-state-review',
          )}
        >
          {approved ? <Check className="mt-0.5 size-5 shrink-0" aria-hidden /> : <MessageSquareText className="mt-0.5 size-5 shrink-0" aria-hidden />}
          <div>
            <p className="text-sm font-semibold">
              {approved
                ? t('resolvedApproved', { name: data.approverName ?? t('someone') })
                : t('resolvedChanges', { name: data.approverName ?? t('someone') })}
            </p>
            {data.feedback ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{data.feedback}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* preview por rede — mesmos componentes do composer (SPEC §3.6) */}
      <div className="flex flex-col gap-3">
        {data.publications.map((pub, pi) => (
          <NetworkPreview
            key={pi}
            provider={pub.provider}
            name={pub.channelName}
            username={pub.channelUsername}
            avatarUrl={pub.channelAvatarUrl}
            publishAt={data.publishAt ? new Date(data.publishAt) : null}
            entries={pub.items.map((item) => ({ text: item.text, media: item.media }))}
          />
        ))}
      </div>

      {/* ações */}
      {pending ? (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="approver-name">{t('yourName')}</Label>
            <Input
              id="approver-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('yourNamePlaceholder')}
            />
          </div>
          {feedbackOpen ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="feedback">{t('feedbackLabel')}</Label>
              <Textarea
                id="feedback"
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t('feedbackPlaceholder')}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={feedback.trim() === ''}
                  isLoading={requesting}
                  onClick={onRequestChanges}
                >
                  {t('sendFeedback')}
                </Button>
                <Button variant="ghost" onClick={() => setFeedbackOpen(false)}>
                  {t('back')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="gap-1.5" isLoading={approving} onClick={onApprove}>
                <Check aria-hidden />
                {t('approve')}
              </Button>
              <Button variant="outline" size="lg" className="gap-1.5" onClick={() => setFeedbackOpen(true)}>
                <MessageSquareText aria-hidden />
                {t('requestChanges')}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <p className="mt-auto pt-4 text-center text-xs text-mist">{t('poweredBy')}</p>
    </>
  );
}
