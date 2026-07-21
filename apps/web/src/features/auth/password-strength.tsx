'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** 0 = escondido; 1 fraca, 2 média, 3 forte. Regra do produto: mínimo 12. */
function score(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  const variety =
    (/[a-z]/.test(pw) ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/\d/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
  if (pw.length < 12) return 1;
  if (variety >= 3 && pw.length >= 14) return 3;
  return 2;
}

const META = {
  1: { key: 'strengthWeak', fill: 'bg-state-failed', text: 'text-state-failed' },
  2: { key: 'strengthMedium', fill: 'bg-state-review', text: 'text-state-review' },
  3: { key: 'strengthStrong', fill: 'bg-state-published', text: 'text-state-published' },
} as const;

export function PasswordStrength({ value }: { value: string }) {
  const t = useTranslations('auth');
  const level = score(value);
  if (level === 0) return null;
  const meta = META[level];

  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3].map((seg) => (
          <span
            key={seg}
            className={cn(
              'h-1 flex-1 rounded-sm transition-colors duration-200',
              seg <= level ? meta.fill : 'bg-surface-2',
            )}
          />
        ))}
      </div>
      <span className={cn('text-[11px] font-semibold tabular-nums', meta.text)}>
        {t('strengthLabel')}: {t(meta.key)}
      </span>
    </div>
  );
}
