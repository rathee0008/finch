import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { Download } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  lastNMonths,
  incomeExpenseTrend,
  spendingByCategory,
  netWorthTrend,
  dailySpend,
  topPayees,
} from '../lib/calculations';
import {
  formatCurrency,
  formatCompact,
  monthLabel,
  monthLabelShort,
  currentMonth,
  parseISODate,
  toLocalISODate,
} from '../lib/format';
import { transactionsToCSV, downloadCSV } from '../lib/csv';
import { useToast } from '../context/ToastContext';
import { Segmented, Button, ProgressBar } from './ui/Field';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function SpendingHeatmap({ ym, currency }: { ym: string; currency: string }) {
  const { state } = useFinance();
  const spend = useMemo(() => dailySpend(state.transactions, ym), [state.transactions, ym]);

  const [y, m] = ym.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const max = Math.max(1, ...Array.from(spend.values()));

  const cells: (null | { date: string; amount: number; day: number })[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const date = toLocalISODate(new Date(y, m - 1, i + 1));
      return { date, amount: spend.get(date) ?? 0, day: i + 1 };
    }),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="text-[10px] text-center font-medium"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) =>
          cell === null ? (
            <div key={`blank-${i}`} />
          ) : (
            <div
              key={cell.date}
              title={`${parseISODate(cell.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })} — ${formatCurrency(cell.amount, currency)}`}
              className="aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition hover:scale-110 cursor-default"
              style={{
                background:
                  cell.amount === 0
                    ? 'var(--color-surface-2)'
                    : `color-mix(in srgb, var(--color-accent) ${Math.round(
                        18 + (cell.amount / max) * 72
                      )}%, transparent)`,
                color:
                  cell.amount / max > 0.5 ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {cell.day}
            </div>
          )
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
        <span>Less</span>
        {[0, 25, 50, 75, 100].map((pct) => (
          <span
            key={pct}
            className="w-4 h-4 rounded"
            style={{
              background:
                pct === 0
                  ? 'var(--color-surface-2)'
                  : `color-mix(in srgb, var(--color-accent) ${pct}%, transparent)`,
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export function Reports() {
  const { state } = useFinance();
  const { toast } = useToast();
  const [range, setRange] = useState<'3' | '6' | '12'>('6');

  const currency = state.settings.currency;
  const monthCount = Number(range);
  const months = useMemo(() => lastNMonths(monthCount), [monthCount]);
  const ieTrend = useMemo(() => incomeExpenseTrend(state.transactions, months), [state.transactions, months]);
  const nwTrend = useMemo(
    () => netWorthTrend(state.accounts, state.transactions, months),
    [state.accounts, state.transactions, months]
  );

  const totalIncome = ieTrend.reduce((s, m) => s + m.income, 0);
  const totalExpense = ieTrend.reduce((s, m) => s + m.expense, 0);
  const avgIncome = totalIncome / monthCount;
  const avgExpense = totalExpense / monthCount;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  const categoryTotals = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; color: string; amount: number }>();
    for (const ym of months) {
      for (const { category, amount } of spendingByCategory(state.transactions, state.categories, ym)) {
        const existing = map.get(category.id);
        if (existing) existing.amount += amount;
        else map.set(category.id, { name: category.name, icon: category.icon, color: category.color, amount });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [state.transactions, state.categories, months]);

  const payees = useMemo(() => topPayees(state.transactions, months), [state.transactions, months]);
  const maxCat = categoryTotals[0]?.amount ?? 1;
  const maxPayee = payees[0]?.amount ?? 1;

  const chartTooltip = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    fontSize: 13,
    boxShadow: 'var(--shadow-md)',
  };

  const exportReport = async () => {
    const inRange = state.transactions.filter((t) => months.includes(t.date.slice(0, 7)));
    const outcome = await downloadCSV(
      transactionsToCSV(inRange, state.accounts, state.categories),
      `report-${months[0]}-to-${months[months.length - 1]}.csv`
    );
    if (outcome === 'saved') toast(`Exported ${inRange.length} transactions`);
    else if (outcome === 'failed') toast("Couldn't save the file", { tone: 'error' });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
          Reports
        </h1>
        <div className="flex items-center gap-2">
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: '3', label: '3 mo' },
              { value: '6', label: '6 mo' },
              { value: '12', label: '12 mo' },
            ]}
          />
          <Button variant="secondary" onClick={exportReport}>
            <Download size={15} /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Avg monthly income', value: formatCurrency(avgIncome, currency), color: 'var(--color-positive)' },
          { label: 'Avg monthly spend', value: formatCurrency(avgExpense, currency), color: 'var(--color-negative)' },
          {
            label: `Net saved (${monthCount}mo)`,
            value: formatCurrency(totalIncome - totalExpense, currency),
            color: 'var(--color-text)',
          },
          { label: 'Savings rate', value: `${savingsRate.toFixed(0)}%`, color: 'var(--color-accent)' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {s.label}
            </div>
            <div className="text-xl font-semibold tnum tracking-tight" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Income vs expenses
        </h2>
        <ResponsiveContainer width="100%" height={260}>
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
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Income" fill="var(--color-positive)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expense" name="Expense" fill="var(--color-negative)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Net worth over time
          </h2>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={nwTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
            Spending heatmap
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {monthLabel(currentMonth())}
          </p>
          <SpendingHeatmap ym={currentMonth()} currency={currency} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            By category · {monthCount} months
          </h2>
          <div className="space-y-3">
            {categoryTotals.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 min-w-0" style={{ color: 'var(--color-text)' }}>
                    {c.icon} <span className="truncate">{c.name}</span>
                  </span>
                  <span className="font-medium tnum shrink-0" style={{ color: 'var(--color-text)' }}>
                    {formatCurrency(c.amount, currency)}
                  </span>
                </div>
                <ProgressBar percent={(c.amount / maxCat) * 100} color={c.color} height={6} />
              </div>
            ))}
            {categoryTotals.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                No expense data in this period.
              </p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Top payees · {monthCount} months
          </h2>
          <div className="space-y-3">
            {payees.map((p) => (
              <div key={p.payee}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="min-w-0 truncate" style={{ color: 'var(--color-text)' }}>
                    {p.payee}
                    <span className="text-xs ml-1.5" style={{ color: 'var(--color-text-subtle)' }}>
                      ×{p.count}
                    </span>
                  </span>
                  <span className="font-medium tnum shrink-0" style={{ color: 'var(--color-text)' }}>
                    {formatCurrency(p.amount, currency)}
                  </span>
                </div>
                <ProgressBar percent={(p.amount / maxPayee) * 100} color="var(--color-accent)" height={6} />
              </div>
            ))}
            {payees.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                No payee data in this period.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
