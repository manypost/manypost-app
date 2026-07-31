'use client';

import { RotateCcw, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { Button } from '@/components/ui/button';
import { useCancelPost, useRetryPost } from '@/features/publications/hooks';
import { useApiErrorMessage } from '@/lib/api/errors';
import {
  CONCORRENCIA_DO_LOTE,
  executarComConcorrencia,
  LIMITE_DO_LOTE,
  planoDoLote,
  resumoDoLote,
  type AcaoEmLote,
} from './bulk';
import type { GroupCard } from './logic';

/**
 * Barra de ações em lote.
 *
 * Ela **não** anuncia sucesso: anuncia o que aconteceu. Um retry sobre oito canais quase sempre tem
 * algum canal ainda desconectado, então falha parcial é o caso normal e o relatório é a resposta
 * honesta — "12 concluídos, 2 com erro" com os erros inspecionáveis, em vez de um toast verde que
 * ensina a não conferir.
 */
export function BulkBar({
  selecionados,
  onLimpar,
}: {
  selecionados: GroupCard[];
  onLimpar: () => void;
}) {
  const t = useTranslations('kanban');
  const errorMessage = useApiErrorMessage();
  const retry = useRetryPost();
  const cancel = useCancelPost();

  const [rodando, setRodando] = useState(false);
  const [confirmarCancel, setConfirmarCancel] = useState(false);

  if (selecionados.length === 0) return null;

  const executar = async (acao: AcaoEmLote) => {
    const plano = planoDoLote(selecionados, acao);

    if (plano.excedeLimite) {
      toast.error(t('bulk.limit', { max: LIMITE_DO_LOTE }));
      return;
    }
    if (plano.ignorados.length > 0) {
      toast.info(t('bulk.skipped', { count: plano.ignorados.length }));
    }
    if (plano.elegiveis.length === 0) return;

    setRodando(true);
    const resultados = await executarComConcorrencia(
      plano.elegiveis,
      CONCORRENCIA_DO_LOTE,
      async (card) => {
        try {
          if (acao === 'retry') await retry.mutateAsync({ groupId: card.groupId });
          else await cancel.mutateAsync(card.groupId);
          return { groupId: card.groupId, ok: true };
        } catch (err) {
          return { groupId: card.groupId, ok: false, erro: errorMessage(err) };
        }
      },
    );
    setRodando(false);

    const resumo = resumoDoLote(resultados);
    if (resumo.tipo === 'allOk') toast.success(t('bulk.allOk', { count: resumo.ok }));
    else if (resumo.tipo === 'allFailed')
      toast.error(t('bulk.allFailed'), { description: resumo.falhas[0]?.erro });
    else if (resumo.tipo === 'partial')
      toast.warning(t('bulk.partial', { ok: resumo.ok, fail: resumo.fail }), {
        description: resumo.falhas.map((f) => f.erro).join(' · '),
      });

    onLimpar();
  };

  return (
    <>
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2">
        <span className="px-1 text-compact font-semibold tabular-nums text-ink">
          {t('bulk.selected', { count: selecionados.length })}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer gap-1.5"
          isLoading={rodando}
          onClick={() => void executar('retry')}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t('bulk.retry')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer gap-1.5 text-state-failed"
          disabled={rodando}
          onClick={() => setConfirmarCancel(true)}
        >
          <XCircle className="size-3.5" aria-hidden />
          {t('bulk.cancel')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto cursor-pointer gap-1.5"
          disabled={rodando}
          onClick={onLimpar}
        >
          <X className="size-3.5" aria-hidden />
          {t('bulk.clear')}
        </Button>
      </div>

      <AlertDialog open={confirmarCancel} onOpenChange={setConfirmarCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('bulk.cancelTitle', { count: selecionados.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('bulk.cancelBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer border-destructive bg-destructive text-paper"
              onClick={() => {
                setConfirmarCancel(false);
                void executar('cancel');
              }}
            >
              {t('cancelConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
