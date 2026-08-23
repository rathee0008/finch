import type { Account, Transaction, Category, Budget } from '../types';
import { toLocalISODate, toLocalYM, todayISO, addMonths } from './format';

export function netWorth(accounts: Account[]): number {
  return accounts.filter((a) => !a.archived).reduce((sum, a) => sum + a.balance, 0);
}

export function totalAssets(accounts: Account[]): number {
  return accounts.filter((a) => !a.archived && a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
}

export function totalLiabilities(accounts: Account[]): number {
  return accounts
    .filter((a) => !a.archived && a.balance < 0)
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);
}

/** Liquid cash available right now — excludes investments and debt. */
export function liquidBalance(accounts: Account[]): number {
  return accounts
    .filter((a) => !a.archived && (a.type === 'checking' || a.type === 'savings' || a.type === 'cash'))
    .reduce((sum, a) => sum + a.balance, 0);
}

export function isInMonth(dateIso: string, ym: string): boolean {
  return dateIso.slice(0, 7) === ym;
}

export function monthlyIncome(transactions: Transaction[], ym: string): number {
  return transactions
    .filter((t) => t.type === 'income' && isInMonth(t.date, ym))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function monthlyExpense(transactions: Transaction[], ym: string): number {
  return transactions
    .filter((t) => t.type === 'expense' && isInMonth(t.date, ym))
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Expands a transaction into per-category amounts, honouring splits.
 * A split transaction contributes to each of its categories separately.
 */
export function categoryAmounts(t: Transaction): { categoryId: string; amount: number }[] {
  if (t.splits && t.splits.length > 0) {
    return t.splits
      .filter((s) => s.categoryId)
      .map((s) => ({ categoryId: s.categoryId, amount: s.amount }));
  }
  if (!t.categoryId) return [];
  return [{ categoryId: t.categoryId, amount: t.amount }];
}

/** Total spent in one category for one month, split-aware. */
export function spentInCategory(
  transactions: Transaction[],
  categoryId: string,
  ym: string
): number {
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'expense' || !isInMonth(t.date, ym)) continue;
    for (const part of categoryAmounts(t)) {
      if (part.categoryId === categoryId) total += part.amount;
    }
  }
  return total;
}

export function spendingByCategory(
  transactions: Transaction[],
  categories: Category[],
  ym: string
): { category: Category; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense' || !isInMonth(t.date, ym)) continue;
    for (const { categoryId, amount } of categoryAmounts(t)) {
      map.set(categoryId, (map.get(categoryId) ?? 0) + amount);
    }
  }
  return Array.from(map.entries())
    .map(([categoryId, amount]) => ({
      category: categories.find((c) => c.id === categoryId)!,
      amount,
    }))
    .filter((x) => x.category)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Budget progress including rollover: when a budget has rollover enabled,
 * unspent room from the previous month is added to this month's limit.
 */
export function budgetProgress(
  budget: Budget,
  transactions: Transaction[],
  allBudgets: Budget[] = []
): { spent: number; percent: number; remaining: number; limit: number; rolledOver: number } {
  const spent = spentInCategory(transactions, budget.categoryId, budget.month);

  let rolledOver = 0;
  if (budget.rollover) {
    const prevMonth = addMonths(budget.month, -1);
    const prev = allBudgets.find(
      (b) => b.categoryId === budget.categoryId && b.month === prevMonth
    );
    if (prev) {
      const prevSpent = spentInCategory(transactions, prev.categoryId, prev.month);
      rolledOver = Math.max(0, prev.amount - prevSpent);
    }
  }

  const limit = budget.amount + rolledOver;
  const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  return { spent, percent, remaining: limit - spent, limit, rolledOver };
}

export function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    out.push(toLocalYM(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return out;
}

export function netWorthTrend(
  accounts: Account[],
  transactions: Transaction[],
  months: string[]
): { month: string; value: number }[] {
  const currentNW = netWorth(accounts);
  const today = todayISO();
  const now = new Date();
  const out: { month: string; value: number }[] = [];

  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number);
    const isCurrentMonth = y === now.getFullYear() && m - 1 === now.getMonth();
    if (isCurrentMonth) {
      out.push({ month: ym, value: currentNW });
      continue;
    }
    const monthEnd = toLocalISODate(new Date(y, m, 0));
    const delta = transactions
      .filter((t) => t.date > monthEnd && t.date <= today)
      .reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount;
        if (t.type === 'expense') return sum - t.amount;
        return sum;
      }, 0);
    out.push({ month: ym, value: currentNW - delta });
  }
  return out;
}

export function incomeExpenseTrend(
  transactions: Transaction[],
  months: string[]
): { month: string; income: number; expense: number; net: number }[] {
  return months.map((ym) => {
    const income = monthlyIncome(transactions, ym);
    const expense = monthlyExpense(transactions, ym);
    return { month: ym, income, expense, net: income - expense };
  });
}

/** Average monthly spend for a category over the N months before `ym`. */
export function categoryAverage(
  transactions: Transaction[],
  categoryId: string,
  ym: string,
  lookback = 3
): number {
  let total = 0;
  for (let i = 1; i <= lookback; i++) {
    total += spentInCategory(transactions, categoryId, addMonths(ym, -i));
  }
  return total / lookback;
}

/** Daily spend totals for a month, used by the calendar heatmap. */
export function dailySpend(transactions: Transaction[], ym: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense' || !isInMonth(t.date, ym)) continue;
    map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
  }
  return map;
}

export function allTags(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) for (const tag of t.tags ?? []) set.add(tag);
  return Array.from(set).sort();
}

/** Top payees by total spend, for the reports page. */
export function topPayees(
  transactions: Transaction[],
  months: string[],
  limit = 8
): { payee: string; amount: number; count: number }[] {
  const monthSet = new Set(months);
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of transactions) {
    if (t.type !== 'expense' || !monthSet.has(t.date.slice(0, 7))) continue;
    const key = t.payee.trim();
    const cur = map.get(key) ?? { amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([payee, v]) => ({ payee, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
