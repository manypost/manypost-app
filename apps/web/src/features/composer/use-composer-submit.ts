'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useApiErrorMessage } from '@/lib/api/errors';
import type { components } from '@/lib/api/schema';
import { useSchedulePost } from './hooks';
import { useComposerStore } from './store';
import { buildSchedulePayload } from './submit-payload';

type Channel = components['schemas']['Channel'];

/**
 * Agendamento do rascunho.
 *
 * Lê o store por `getState()` no clique, e não por assinatura: o rodapé que chama isto não
 * precisa re-renderizar a cada tecla só para ter o texto na hora de enviar.
 *
 * O corpo do POST é montado por `buildSchedulePayload` (puro, testado) — é lá que mora a
 * consequência da regra nova: com a caixa global vazia, todo override viaja explícito em
 * `textByChannel` e o `text` do grupo cai para o texto do primeiro canal.
 */
export function useComposerSubmit(onDone: () => void) {
  const t = useTranslations('composer');
  const errorMessage = useApiErrorMessage();
  const schedule = useSchedulePost();

  const submit = ({
    agora,
    selected,
    publishAt,
  }: {
    agora: boolean;
    selected: Channel[];
    publishAt: Date | null;
  }) => {
    const at = agora ? new Date() : publishAt;
    if (!at || Number.isNaN(at.getTime())) return;

    const s = useComposerStore.getState();
    const payload = buildSchedulePayload({
      text: s.text,
      overrides: s.overrides,
      channelSettings: s.channelSettings,
      mediaIds: s.mediaIds,
      thread: s.thread,
      selected,
      publishAt: at,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      requireApproval: s.requireApproval,
    });

    schedule.mutate(payload, {
      onSuccess: () => {
        toast.success(
          s.requireApproval ? t('draftCreated') : agora ? t('publishedNow') : t('scheduled'),
        );
        s.reset();
        onDone();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return { submit, isPending: schedule.isPending };
}
