import type { Account, RecurringTransaction, Transaction, RecurrenceFreq } from '../types';
import { liquidBalance } from './calculations';
import { toLocalISODate, parseISODate, todayISO } from './format';

export interface ForecastEvent {
  name: string;
  payee: string;
  amount: number; // signed: negative for expenses
  recurringId: string;
}

export interface ForecastPoint {
  date: string;
  balance: number;
  events: ForecastEvent[];
}

export interface ForecastResult {
  points: ForecastPoint[];
  startBalance: number;
  endBalance: number;
  /** Lowest projected balance and the day it happens. */
  lowest: { date: string; balance: number };
  /** First day the projected balance goes negative, if any. */
  shortfallDate: string | null;
  totalInflow: number;
  totalOutflow: number;
}

function advance(date: Date, freq: RecurrenceFreq): void {
  switch (freq) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
}

/** All occurrences of a recurring item from its next date through `horizon`. */
export function occurrencesUntil(r: RecurringTransaction, horizon: string): string[] {
  const out: string[] = [];
  const cursor = parseISODate(r.nextDate);
  const end = parseISODate(horizon);
  let guard = 0;
  while (cursor <= end && guard < 2000) {
    out.push(toLocalISODate(cursor));
    advance(cursor, r.freq);
    guard++;
  }
  return out;
}

/**
 * Average daily spend from transactions that are *not* covered by a recurring
 * rule — i.e. everyday discretionary spending, used to make the projection realistic.
 */
export function averageDailyDiscretionary(
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  lookbackDays = 90
): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffIso = toLocalISODate(cutoff);
  const recurringPayees = new Set(recurring.map((r) => r.payee.trim().toLowerCase()));

  const total = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.date >= cutoffIso &&
        !recurringPayees.has(t.payee.trim().toLowerCase())
    )
    .reduce((sum, t) => sum + t.amount, 0);

  return total / lookbackDays;
}

export function buildForecast(
  accounts: Account[],
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  days: number,
  includeTypicalSpending = true
): ForecastResult {
  const start = todayISO();
  const horizonDate = parseISODate(start);
  horizonDate.setDate(horizonDate.getDate() + days);
  const horizon = toLocalISODate(horizonDate);

  const active = recurring.filter((r) => r.active);
  const eventsByDate = new Map<string, ForecastEvent[]>();

  for (const r of active) {
    for (const date of occurrencesUntil(r, horizon)) {
      const signed = r.type === 'income' ? r.amount : -r.amount;
      const list = eventsByDate.get(date) ?? [];
      list.push({ name: r.name, payee: r.payee, amount: signed, recurringId: r.id });
      eventsByDate.set(date, list);
    }
  }

  const dailyBurn = includeTypicalSpending
    ? averageDailyDiscretionary(transactions, recurring)
    : 0;

  const startBalance = liquidBalance(accounts);
  let balance = startBalance;
  let totalInflow = 0;
  let totalOutflow = 0;

  const points: ForecastPoint[] = [];
  const cursor = parseISODate(start);
  let lowest = { date: start, balance: startBalance };

  for (let i = 0; i <= days; i++) {
    const iso = toLocalISODate(cursor);
    const events = eventsByDate.get(iso) ?? [];

    if (i > 0) {
      for (const e of events) {
        balance += e.amount;
        if (e.amount > 0) totalInflow += e.amount;
        else totalOutflow += Math.abs(e.amount);
      }
      balance -= dailyBurn;
      totalOutflow += dailyBurn;
    }

    points.push({ date: iso, balance, events });
    if (balance < lowest.balance) lowest = { date: iso, balance };

    cursor.setDate(cursor.getDate() + 1);
  }

  const shortfall = points.find((p) => p.balance < 0);

  return {
    points,
    startBalance,
    endBalance: balance,
    lowest,
    shortfallDate: shortfall ? shortfall.date : null,
    totalInflow,
    totalOutflow,
  };
}

/** Upcoming recurring items due within `days`, soonest first. */
export function upcomingBills(
  recurring: RecurringTransaction[],
  days = 14
): RecurringTransaction[] {
  const end = new Date();
  end.setDate(end.getDate() + days);
  const endIso = toLocalISODate(end);
  return recurring
    .filter((r) => r.active && r.nextDate <= endIso)
    .sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
}
