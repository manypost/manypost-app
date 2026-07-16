/** Utilidades de data/hora do app — armazenamento UTC, exibição no fuso local. */

/** chave local YYYY-MM-DD (agrupamentos por dia no fuso do usuário) */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date → valor de <input type="datetime-local"> no fuso local */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "há 5 min", "há 2 h", "ontem" — para carimbos de notificação/feed */
export function relativeTime(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

/** início da semana (segunda) no fuso local */
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() + 6) % 7; // 0 = segunda
  out.setDate(out.getDate() - dow);
  return out;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function startOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), 1);
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
