import { PageHeader } from './page-header';

/** Vazio elegante p/ rotas ainda não implementadas (empty state do plano de UI). */
export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="grid place-items-center rounded-lg border border-dashed border-line bg-surface-2 px-6 py-20 text-center">
        <p className="max-w-md text-sm leading-relaxed text-graphite">{description}</p>
      </div>
    </>
  );
}
