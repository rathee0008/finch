import type { Account } from '../types';
import { toLocalISODate } from './format';

export type PayoffStrategy = 'avalanche' | 'snowball';

export interface DebtInput {
  id: string;
  name: string;
  balance: number; // positive amount owed
  apr: number; // annual percentage rate
  minPayment: number;
  color: string;
}

export interface PayoffPerAccount {
  id: string;
  name: string;
  color: string;
  months: number;
  interest: number;
  payoffDate: string;
}

export interface PayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: string | null;
  /** True when payments never cover the interest — the debt never clears. */
  neverPaidOff: boolean;
  schedule: { month: number; totalBalance: number; interest: number }[];
  perAccount: PayoffPerAccount[];
}

export function debtsFromAccounts(accounts: Account[]): DebtInput[] {
  return accounts
    .filter((a) => !a.archived && a.balance < 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      balance: Math.abs(a.balance),
      apr: a.apr ?? 19.99,
      minPayment: a.minPayment ?? Math.max(25, Math.abs(a.balance) * 0.02),
      color: a.color,
    }));
}

function monthsFromNow(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toLocalISODate(d);
}

const MAX_MONTHS = 600;

/**
 * Simulates paying off debts month by month. Every debt gets its minimum
 * payment; whatever is left over goes to the single target debt chosen by
 * the strategy (highest APR for avalanche, smallest balance for snowball).
 */
export function simulatePayoff(
  debts: DebtInput[],
  strategy: PayoffStrategy,
  extraMonthly: number
): PayoffResult {
  const working = debts.map((d) => ({ ...d, interestPaid: 0, clearedMonth: 0 }));
  const schedule: { month: number; totalBalance: number; interest: number }[] = [];

  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;

  const remaining = () => working.filter((d) => d.balance > 0.005);

  while (remaining().length > 0 && month < MAX_MONTHS) {
    month++;
    let monthInterest = 0;

    // 1. Accrue interest on every outstanding debt.
    for (const d of remaining()) {
      const interest = (d.balance * (d.apr / 100)) / 12;
      d.balance += interest;
      d.interestPaid += interest;
      monthInterest += interest;
    }
    totalInterest += monthInterest;

    // 2. Budget for the month = every minimum payment plus the extra.
    let budget = remaining().reduce((sum, d) => sum + d.minPayment, 0) + extraMonthly;

    // 3. Pay minimums first so nothing falls delinquent.
    for (const d of remaining()) {
      const pay = Math.min(d.minPayment, d.balance, budget);
      d.balance -= pay;
      budget -= pay;
      totalPaid += pay;
    }

    // 4. Funnel everything left into the strategy's target debt.
    while (budget > 0.005 && remaining().length > 0) {
      const open = remaining();
      const target =
        strategy === 'avalanche'
          ? open.reduce((best, d) => (d.apr > best.apr ? d : best), open[0])
          : open.reduce((best, d) => (d.balance < best.balance ? d : best), open[0]);

      const pay = Math.min(target.balance, budget);
      target.balance -= pay;
      budget -= pay;
      totalPaid += pay;
      if (pay <= 0.005) break;
    }

    for (const d of working) {
      if (d.balance <= 0.005 && d.clearedMonth === 0) d.clearedMonth = month;
    }

    schedule.push({
      month,
      totalBalance: working.reduce((sum, d) => sum + Math.max(0, d.balance), 0),
      interest: monthInterest,
    });
  }

  const neverPaidOff = remaining().length > 0;

  return {
    months: month,
    totalInterest,
    totalPaid,
    payoffDate: neverPaidOff ? null : monthsFromNow(month),
    neverPaidOff,
    schedule,
    perAccount: working.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      months: d.clearedMonth,
      interest: d.interestPaid,
      payoffDate: d.clearedMonth ? monthsFromNow(d.clearedMonth) : '',
    })),
  };
}
