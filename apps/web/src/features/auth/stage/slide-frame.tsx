import { cn } from '@/lib/utils';

/**
 * Moldura única de todos os slides do palco. O ponto é a ALTURA CONSTANTE: a
 * zona de título e a zona de arte têm medida fixa, então trocar de slide não
 * muda a altura nem a posição dos controles e do rodapé (era a origem do
 * "vão" que sobrava nos slides curtos). Cada slide só preenche a moldura.
 */
export function SlideFrame({
  kicker,
  lines,
  sub,
  children,
}: {
  kicker: string;
  lines: string[];
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* zona de título — reservada para 3 linhas de display, a maior do conjunto */}
      <div className="flex min-h-[13.5rem] max-w-xl flex-col justify-center gap-3.5">
        <p
          className="auth-enter text-meta font-semibold uppercase tracking-[0.14em] text-accent-on-dark"
          style={{ '--i': 0 } as React.CSSProperties}
        >
          {kicker}
        </p>
        <h2 className="font-display text-[38px] font-medium leading-[1.05] tracking-[-0.5px]">
          {lines.map((line, i) => (
            <span
              key={line}
              className={cn(
                'auth-enter block',
                i === lines.length - 1 && 'text-accent-on-dark',
              )}
              style={{ '--i': i + 1 } as React.CSSProperties}
            >
              {line}
            </span>
          ))}
        </h2>
        <p
          className="auth-enter max-w-md text-compact leading-relaxed text-paper/70"
          style={{ '--i': lines.length + 1 } as React.CSSProperties}
        >
          {sub}
        </p>
      </div>

      {/* zona de arte — medida fixa, compartilhada pelos três slides */}
      <div className="h-[20rem]">{children}</div>
    </div>
  );
}
