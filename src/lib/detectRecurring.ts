import type { Transaction, RecurringTransaction, RecurrenceFreq } from '../types';
import { parseISODate, toLocalISODate } from './format';

export interface RecurringSuggestion {
  payee: string;
  accountId: string;
  categoryId?: string;
  amount: number;
  freq: RecurrenceFreq;
  nextDate: string;
  occurrences: number;
  confidence: number; // 0..1
}

const FREQ_DAYS: { freq: RecurrenceFreq; days: number; tolerance: number }[] = [
  { freq: 'weekly', days: 7, tolerance: 2 },
  { freq: 'biweekly', days: 14, tolerance: 3 },
  { freq: 'monthly', days: 30.4, tolerance: 5 },
  { freq: 'yearly', days: 365, tolerance: 20 },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function normalizePayee(payee: string): string {
  return payee.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Finds repeating charges in transaction history — subscriptions, rent, bills —
 * that the user has not already set up as a recurring item.
 */
export function detectRecurring(
  transactions: Transaction[],
  existing: RecurringTransaction[]
): RecurringSuggestion[] {
  const known = new Set(existing.map((r) => normalizePayee(r.payee)));
  const groups = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (t.type === 'transfer') continue;
    const key = normalizePayee(t.payee);
    if (known.has(key)) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const suggestions: RecurringSuggestion[] = [];

  for (const [, list] of groups) {
    if (list.length < 3) continue;

    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = parseISODate(sorted[i - 1].date).getTime();
      const cur = parseISODate(sorted[i].date).getTime();
      gaps.push((cur - prev) / 86400000);
    }
    if (gaps.length === 0) continue;

    const medianGap = median(gaps);
    const match = FREQ_DAYS.find((f) => Math.abs(medianGap - f.days) <= f.tolerance);
    if (!match) continue;

    // Reject groups whose intervals are erratic even if the median fits.
    const consistentGaps = gaps.filter((g) => Math.abs(g - medianGap) <= match.tolerance);
    const intervalScore = consistentGaps.length / gaps.length;
    if (intervalScore < 0.6) continue;

    const amounts = sorted.map((t) => t.amount);
    const medianAmount = median(amounts);
    const amountSpread =
      medianAmount > 0
        ? amounts.reduce((sum, a) => sum + Math.abs(a - medianAmount), 0) /
          amounts.length /
          medianAmount
        : 1;
    if (amountSpread > 0.25) continue;

    const last = sorted[sorted.length - 1];
    const next = parseISODate(last.date);
    next.setDate(next.getDate() + Math.round(medianGap));

    suggestions.push({
      payee: last.payee,
      accountId: last.accountId,
      categoryId: last.categoryId,
      amount: Math.round(medianAmount * 100) / 100,
      freq: match.freq,
      nextDate: toLocalISODate(next),
      occurrences: sorted.length,
      confidence: Math.min(1, intervalScore * (1 - amountSpread) * Math.min(1, sorted.length / 4)),
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
