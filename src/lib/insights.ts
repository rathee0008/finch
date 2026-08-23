import type { FinanceState } from '../types';
import {
  monthlyIncome,
  monthlyExpense,
  spendingByCategory,
  categoryAverage,
  budgetProgress,
  liquidBalance,
} from './calculations';
import { buildForecast, upcomingBills } from './forecast';
import { currentMonth, addMonths, formatCurrency, formatDate, relativeDay } from './format';

export type InsightTone = 'positive' | 'warning' | 'critical' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  icon: string;
  title: string;
  detail: string;
}

/**
 * Derives plain-language observations from the user's data — the kind of thing
 * a financial advisor would point out when glancing at the month.
 */
export function generateInsights(state: FinanceState): Insight[] {
  const { transactions, categories, budgets, accounts, recurring, settings } = state;
  const cur = currentMonth();
  const prev = addMonths(cur, -1);
  const cy = settings.currency;
  const out: Insight[] = [];

  const income = monthlyIncome(transactions, cur);
  const expense = monthlyExpense(transactions, cur);

  // --- Savings rate -------------------------------------------------------
  if (income > 0) {
    const rate = ((income - expense) / income) * 100;
    if (rate >= 20) {
      out.push({
        id: 'savings-strong',
        tone: 'positive',
        icon: '🌱',
        title: `Saving ${rate.toFixed(0)}% of income`,
        detail: `You've kept ${formatCurrency(income - expense, cy)} of ${formatCurrency(income, cy)} this month. Anything above 20% is a strong rate.`,
      });
    } else if (rate < 0) {
      out.push({
        id: 'savings-negative',
        tone: 'critical',
        icon: '🔻',
        title: 'Spending more than you earn',
        detail: `Expenses exceed income by ${formatCurrency(expense - income, cy)} this month.`,
      });
    }
  }

  // --- Category spikes vs 3-month average ---------------------------------
  const thisMonthByCat = spendingByCategory(transactions, categories, cur);
  for (const { category, amount } of thisMonthByCat.slice(0, 6)) {
    const avg = categoryAverage(transactions, category.id, cur, 3);
    if (avg < 20) continue; // ignore noise on tiny categories
    const change = ((amount - avg) / avg) * 100;
    if (change >= 40) {
      out.push({
        id: `spike-${category.id}`,
        tone: 'warning',
        icon: category.icon,
        title: `${category.name} is up ${change.toFixed(0)}%`,
        detail: `${formatCurrency(amount, cy)} so far versus a ${formatCurrency(avg, cy)} average over the last 3 months.`,
      });
    } else if (change <= -35) {
      out.push({
        id: `drop-${category.id}`,
        tone: 'positive',
        icon: category.icon,
        title: `${category.name} is down ${Math.abs(change).toFixed(0)}%`,
        detail: `${formatCurrency(amount, cy)} this month versus a ${formatCurrency(avg, cy)} average — that's ${formatCurrency(avg - amount, cy)} saved.`,
      });
    }
  }

  // --- Budgets ------------------------------------------------------------
  const monthBudgets = budgets.filter((b) => b.month === cur);
  for (const b of monthBudgets) {
    const cat = categories.find((c) => c.id === b.categoryId);
    if (!cat) continue;
    const { spent, limit, remaining } = budgetProgress(b, transactions, budgets);
    if (remaining < 0) {
      out.push({
        id: `budget-over-${b.id}`,
        tone: 'critical',
        icon: '🚨',
        title: `${cat.name} is over budget`,
        detail: `${formatCurrency(spent, cy)} spent against a ${formatCurrency(limit, cy)} limit — ${formatCurrency(Math.abs(remaining), cy)} over.`,
      });
    } else if (limit > 0 && spent / limit >= 0.85) {
      out.push({
        id: `budget-near-${b.id}`,
        tone: 'warning',
        icon: '⚠️',
        title: `${cat.name} budget almost spent`,
        detail: `${formatCurrency(remaining, cy)} left of ${formatCurrency(limit, cy)}.`,
      });
    }
  }

  // --- Unusually large single transaction ---------------------------------
  const monthTx = transactions.filter((t) => t.type === 'expense' && t.date.startsWith(cur));
  if (monthTx.length > 2) {
    const largest = monthTx.reduce((a, b) => (b.amount > a.amount ? b : a));
    const rest = monthTx.filter((t) => t.id !== largest.id);
    const avgRest = rest.reduce((s, t) => s + t.amount, 0) / Math.max(1, rest.length);
    if (avgRest > 0 && largest.amount > avgRest * 4 && largest.amount > 100) {
      out.push({
        id: `outlier-${largest.id}`,
        tone: 'neutral',
        icon: '🔍',
        title: 'Unusually large transaction',
        detail: `${largest.payee} for ${formatCurrency(largest.amount, cy)} on ${formatDate(largest.date)} — well above your typical ${formatCurrency(avgRest, cy)}.`,
      });
    }
  }

  // --- Cash-flow shortfall ahead ------------------------------------------
  const forecast = buildForecast(accounts, transactions, recurring, settings.forecastDays ?? 90);
  if (forecast.shortfallDate) {
    out.push({
      id: 'forecast-shortfall',
      tone: 'critical',
      icon: '📉',
      title: 'Projected to run short on cash',
      detail: `At the current pace your balance dips below zero around ${formatDate(forecast.shortfallDate)} (${relativeDay(forecast.shortfallDate)}).`,
    });
  } else if (forecast.lowest.balance < liquidBalance(accounts) * 0.25) {
    out.push({
      id: 'forecast-low',
      tone: 'warning',
      icon: '💧',
      title: 'Cash gets tight next month',
      detail: `Your projected low point is ${formatCurrency(forecast.lowest.balance, cy)} around ${formatDate(forecast.lowest.date)}.`,
    });
  }

  // --- Bills due soon -----------------------------------------------------
  const soon = upcomingBills(recurring, 7).filter((r) => r.type === 'expense');
  if (soon.length > 0) {
    const total = soon.reduce((s, r) => s + r.amount, 0);
    out.push({
      id: 'bills-soon',
      tone: 'neutral',
      icon: '📅',
      title: `${soon.length} bill${soon.length > 1 ? 's' : ''} due within a week`,
      detail: `${formatCurrency(total, cy)} total, starting with ${soon[0].name} ${relativeDay(soon[0].nextDate)}.`,
    });
  }

  // --- Month-over-month spending ------------------------------------------
  const prevExpense = monthlyExpense(transactions, prev);
  if (prevExpense > 0) {
    const change = ((expense - prevExpense) / prevExpense) * 100;
    if (Math.abs(change) >= 15) {
      out.push({
        id: 'mom-spend',
        tone: change > 0 ? 'warning' : 'positive',
        icon: change > 0 ? '📈' : '📉',
        title: `Spending ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}% vs last month`,
        detail: `${formatCurrency(expense, cy)} this month against ${formatCurrency(prevExpense, cy)} last month.`,
      });
    }
  }

  // --- Uncategorized backlog ----------------------------------------------
  const uncategorized = transactions.filter(
    (t) => t.type !== 'transfer' && !t.categoryId && !(t.splits && t.splits.length)
  );
  if (uncategorized.length >= 3) {
    out.push({
      id: 'uncategorized',
      tone: 'neutral',
      icon: '🏷️',
      title: `${uncategorized.length} transactions need a category`,
      detail: 'Set up a rule to categorize these automatically from now on.',
    });
  }

  const order: Record<InsightTone, number> = { critical: 0, warning: 1, positive: 2, neutral: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 8);
}
