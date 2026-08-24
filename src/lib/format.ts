function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Local-time date formatting — never route through toISOString(), which
// converts to UTC and silently shifts the date for timezones ahead of UTC.
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toLocalYM(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Parse a `YYYY-MM-DD` string as a *local* date, never UTC. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Digit grouping is a property of the locale, not the symbol. Rendering INR
 * with en-US gives ₹1,000,000 where an Indian reader expects the lakh/crore
 * grouping ₹10,00,000, so each currency picks the locale that groups it the
 * way its readers actually write numbers.
 */
const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: 'en-IN',
  GBP: 'en-GB',
  EUR: 'de-DE',
  JPY: 'ja-JP',
  CHF: 'de-CH',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
  AED: 'en-AE',
};

function localeFor(currency: string): string {
  return LOCALE_BY_CURRENCY[currency] ?? 'en-US';
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  try {
    return (
      sign +
      new Intl.NumberFormat(localeFor(currency), {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
      }).format(abs)
    );
  } catch {
    return `${sign}$${abs.toFixed(2)}`;
  }
}

/** Short form for axis ticks and dense cards: $1.2k, $34k, $1.1M */
export function formatCompact(amount: number, currency = 'USD'): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  try {
    return (
      sign +
      new Intl.NumberFormat(localeFor(currency), {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(abs)
    );
  } catch {
    return `${sign}$${Math.round(abs)}`;
  }
}

export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "in 3 days" / "2 days ago" / "today" */
export function relativeDay(iso: string): string {
  const target = parseISODate(iso);
  const now = parseISODate(todayISO());
  const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function monthLabelShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

export function currentMonth(): string {
  return toLocalYM(new Date());
}

export function todayISO(): string {
  return toLocalISODate(new Date());
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  return toLocalYM(new Date(y, m - 1 + delta, 1));
}

export function formatPercent(value: number, digits = 0): string {
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(digits)}%`;
}
