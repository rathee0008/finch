import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Plus,
  ArrowRight,
  CalendarClock,
  Check,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import {
  netWorth,
  monthlyIncome,
  monthlyExpense,
  spendingByCategory,
  lastNMonths,
  netWorthTrend,
  incomeExpenseTrend,
  budgetProgress,
} from '../lib/calculations';
import { generateInsights, type InsightTone } from '../lib/insights';
import { upcomingBills } from '../lib/forecast';
import {
  formatCurrency,
  formatCompact,
  formatDateShort,
  currentMonth,
  monthLabel,
  monthLabelShort,
  relativeDay,
  addMonths,
} from '../lib/format';
import { TransactionModal } from './TransactionModal';
import { Sparkline } from './ui/Sparkline';
import { Button, ProgressBar, Badge } from './ui/Field';
import type { Page } from '../nav';

const TONE_STYLES: Record<InsightTone, { bg: string; fg: string }> = {
  positive: { bg: 'var(--color-positive-soft)', fg: 'var(--color-positive)' },
  warning: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  critical: { bg: 'var(--color-negative-soft)', fg: 'var(--color-negative)' },
  neutral: { bg: 'var(--color-surface-2)', fg: 'var(--color-text-muted)' },
};

function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  sparkValues,
  sparkColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  delta?: { text: string; positive: boolean };
  sparkValues?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="card p-5 card-hover">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tnum tracking-tight" style={{ color: 'var(--color-text)' }}>
            {value}
          </div>
          {delta && (
            <div
              className="text-xs mt-1 font-medium"
              style={{ color: delta.positive ? 'var(--color-positive)' : 'var(--color-negative)' }}
            >
              {delta.text}
            </div>
          )}
        </div>
        {sparkValues && sparkValues.length > 1 && (
          <Sparkline values={sparkValues} color={sparkColor ?? 'var(--color-accent)'} width={84} height={34} />
        )}
      </div>
    </div>
  );
}

export function Dashboard({ setPage }: { setPage: (p: Page) => void }) {
  const { state, postAllDue } = useFinance();
  const { toast } = useToast();
  const [txModalOpen, setTxModalOpen] = useState(false);

  const ym = currentMonth();
  const prevYm = addMonths(ym, -1);
  const currency = state.settings.currency;

  const nw = netWorth(state.accounts);
  const income = monthlyIncome(state.transactions, ym);
  const expense = monthlyExpense(state.transactions, ym);
  const prevExpense = monthlyExpense(state.transactions, prevYm);
  const prevIncome = monthlyIncome(state.transactions, prevYm);
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

  const months = useMemo(() => lastNMonths(6), []);
  const nwTrend = useMemo(
    () => netWorthTrend(state.accounts, state.transactions, months),
    [state.accounts, state.transactions, months]
  );
  const ieTrend = useMemo(
    () => incomeExpenseTrend(state.transactions, months),
    [state.transactions, months]
  );
  const catSpend = useMemo(
    () => spendingByCategory(state.transactions, state.categories, ym).slice(0, 6),
    [state.transactions, state.categories, ym]
  );
  const insights = useMemo(() => generateInsights(state), [state]);

  const dueNow = useMemo(
    () => state.recurring.filter((r) => r.active && r.nextDate <= new Date().toISOString().slice(0, 10)),
    [state.recurring]
  );
  const upcoming = useMemo(() => upcomingBills(state.recurring, 14).slice(0, 5), [state.recurring]);

  const monthBudgets = state.budgets.filter((b) => b.month === ym).slice(0, 4);

  const recentTx = [...state.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7);

  const pct = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : 0;

  const chartTooltip = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    fontSize: 13,
    boxShadow: 'var(--shadow-md)',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Overview
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {monthLabel(ym)}
          </p>
        </div>
        <Button onClick={() => setTxModalOpen(true)}>
          <Plus size={16} /> Add transaction
        </Button>
      </div>

      {dueNow.length > 0 && (
        <div
          className="card p-4 flex items-center gap-3 flex-wrap animate-fade-up"
          style={{ borderColor: 'var(--color-accent-border)', background: 'var(--color-accent-soft)' }}
        >
          <CalendarClock size={18} style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>
            <strong>
              {dueNow.length} recurring {dueNow.length === 1 ? 'item is' : 'items are'} due
            </strong>{' '}
            — {dueNow.map((r) => r.name).slice(0, 3).join(', ')}
            {dueNow.length > 3 ? '…' : ''}
          </span>
          <Button
            size="sm"
            onClick={() => {
              const n = postAllDue();
              toast(`Posted ${n} recurring ${n === 1 ? 'transaction' : 'transactions'}`);
            }}
          >
            <Check size={14} /> Post all
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net worth"
          value={formatCurrency(nw, currency)}
          icon={Wallet}
          sparkValues={nwTrend.map((p) => p.value)}
          sparkColor="var(--color-accent)"
        />
        <StatCard
          label="Income this month"
          value={formatCurrency(income, currency)}
          icon={TrendingUp}
          delta={
            prevIncome > 0
              ? {
                  text: `${pct(income, prevIncome) >= 0 ? '+' : ''}${pct(income, prevIncome).toFixed(0)}% vs last month`,
                  positive: income >= prevIncome,
                }
              : undefined
          }
          sparkValues={ieTrend.map((m) => m.income)}
          sparkColor="var(--color-positive)"
        />
        <StatCard
          label="Spent this month"
          value={formatCurrency(expense, currency)}
          icon={TrendingDown}
          delta={
            prevExpense > 0
              ? {
                  text: `${pct(expense, prevExpense) >= 0 ? '+' : ''}${pct(expense, prevExpense).toFixed(0)}% vs last month`,
                  positive: expense <= prevExpense,
                }
              : undefined
          }
          sparkValues={ieTrend.map((m) => m.expense)}
          sparkColor="var(--color-negative)"
        />
        <StatCard
          label="Savings rate"
          value={`${savingsRate.toFixed(0)}%`}
          icon={PiggyBank}
          delta={{
            text: savingsRate >= 20 ? 'Healthy' : savingsRate >= 0 ? 'Could improve' : 'Overspending',
            positive: savingsRate >= 20,
          }}
          sparkValues={ieTrend.map((m) => m.net)}
          sparkColor="var(--color-accent)"
        />
      </div>

      {insights.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2.5" style={{ color: 'var(--color-text)' }}>
            Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {insights.map((ins, i) => {
              const tone = TONE_STYLES[ins.tone];
              return (
                <div
                  key={ins.id}
                  className="card p-4 flex gap-3 animate-fade-up"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: tone.bg }}
                  >
                    {ins.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold mb-0.5" style={{ color: tone.fg }}>
                      {ins.title}
                    </div>
                    <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                      {ins.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Net worth trend
          </h2>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={nwTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabelShort}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCompact(v, currency)}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={58}
              />
              <Tooltip
                formatter={(v: any) => [formatCurrency(Number(v), currency), 'Net worth']}
                labelFormatter={(m) => monthLabel(m as string)}
                contentStyle={chartTooltip}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill="url(#nwGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            Where money went
          </h2>
          {catSpend.length === 0 ? (
            <p className="text-sm py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
              No expenses yet this month
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={168}>
                <PieChart>
                  <Pie
                    data={catSpend}
                    dataKey="amount"
                    nameKey="category.name"
                    innerRadius={46}
                    outerRadius={74}
                    paddingAngle={2}
                    isAnimationActive={false}
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                  >
                    {catSpend.map((entry) => (
                      <Cell key={entry.category.id} fill={entry.category.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, _n, p: any) => [
                      formatCurrency(Number(v), currency),
                      p.payload.category.name,
                    ]}
                    contentStyle={chartTooltip}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {catSpend.map((c) => (
                  <div key={c.category.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 min-w-0" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.category.color }} />
                      <span className="truncate">{c.category.name}</span>
                    </span>
                    <span className="font-medium tnum shrink-0" style={{ color: 'var(--color-text)' }}>
                      {formatCurrency(c.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Income vs expenses
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ieTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabelShort}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCompact(v, currency)}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={58}
              />
              <Tooltip
                formatter={(v: any, n: any) => [formatCurrency(Number(v), currency), n]}
                labelFormatter={(m) => monthLabel(m as string)}
                contentStyle={chartTooltip}
                cursor={{ fill: 'var(--color-surface-2)' }}
              />
              <Bar dataKey="income" name="Income" fill="var(--color-positive)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="expense" name="Expense" fill="var(--color-negative)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Coming up
            </h2>
            <button
              onClick={() => setPage('recurring')}
              className="text-xs font-medium flex items-center gap-1 transition hover:opacity-70"
              style={{ color: 'var(--color-accent)' }}
            >
              All <ArrowRight size={12} />
            </button>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
              Nothing scheduled in the next two weeks.
            </p>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((r) => {
                const cat = state.categories.find((c) => c.id === r.categoryId);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ background: 'var(--color-surface-2)' }}
                      >
                        {cat?.icon ?? '🔁'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }}>
                          {r.name}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          {relativeDay(r.nextDate)}
                        </div>
                      </div>
                    </div>
                    <span
                      className="text-[13px] font-semibold tnum shrink-0"
                      style={{ color: r.type === 'income' ? 'var(--color-positive)' : 'var(--color-text)' }}
                    >
                      {r.type === 'income' ? '+' : '−'}
                      {formatCurrency(r.amount, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Budgets
            </h2>
            <button
              onClick={() => setPage('budgets')}
              className="text-xs font-medium flex items-center gap-1 transition hover:opacity-70"
              style={{ color: 'var(--color-accent)' }}
            >
              All <ArrowRight size={12} />
            </button>
          </div>
          {monthBudgets.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
              No budgets set this month.
            </p>
          ) : (
            <div className="space-y-3.5">
              {monthBudgets.map((b) => {
                const cat = state.categories.find((c) => c.id === b.categoryId);
                if (!cat) return null;
                const { spent, percent, limit, remaining } = budgetProgress(b, state.transactions, state.budgets);
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span style={{ color: 'var(--color-text)' }}>
                        {cat.icon} {cat.name}
                      </span>
                      <span className="tnum" style={{ color: 'var(--color-text-muted)' }}>
                        {formatCurrency(spent, currency)} / {formatCurrency(limit, currency)}
                      </span>
                    </div>
                    <ProgressBar
                      percent={percent}
                      height={6}
                      color={
                        remaining < 0
                          ? 'var(--color-negative)'
                          : percent > 80
                          ? 'var(--color-warning)'
                          : cat.color
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Recent activity
            </h2>
            <button
              onClick={() => setPage('transactions')}
              className="text-xs font-medium flex items-center gap-1 transition hover:opacity-70"
              style={{ color: 'var(--color-accent)' }}
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2.5">
            {recentTx.map((t) => {
              const cat = state.categories.find((c) => c.id === t.categoryId);
              const isSplit = Boolean(t.splits?.length);
              return (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{ background: 'var(--color-surface-2)' }}
                    >
                      {isSplit ? '🧾' : cat?.icon ?? (t.type === 'transfer' ? '↔️' : '💵')}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                        {t.payee}
                        {isSplit && <Badge tone="accent">split</Badge>}
                        {t.cleared === false && <Badge tone="warning">pending</Badge>}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        {formatDateShort(t.date)}
                        {cat && ` · ${cat.name}`}
                      </div>
                    </div>
                  </div>
                  <span
                    className="text-[13px] font-semibold tnum shrink-0"
                    style={{
                      color:
                        t.type === 'income'
                          ? 'var(--color-positive)'
                          : t.type === 'expense'
                          ? 'var(--color-text)'
                          : 'var(--color-text-muted)',
                    }}
                  >
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                    {formatCurrency(t.amount, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TransactionModal open={txModalOpen} onClose={() => setTxModalOpen(false)} />
    </div>
  );
}
