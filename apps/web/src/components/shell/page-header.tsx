import { cn } from '@/lib/utils';

/** Cabeçalho padrão de página do app: título Inter (densidade de app). */
export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.3px] text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-graphite">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
