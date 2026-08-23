import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Landmark, TrendingDown, Sparkles } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { debtsFromAccounts, simulatePayoff, type PayoffStrategy } from '../lib/debt';
import { formatCurrency, formatCompact, formatDate } from '../lib/format';
import { Segmented, TextInput, Field, ProgressBar, Badge } from './ui/Field';
import { EmptyState } from './ui/EmptyState';

function monthsToText(months: number): string {
  if (months <= 0) return '—';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr`;
  return `${y} yr ${m} mo`;
}

export function Debt() {
  const { state } = useFinance();
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalanche');
  const [extra, setExtra] = useState('200');

  const currency = state.settings.currency;
  const debts = useMemo(() => debtsFromAccounts(state.accounts), [state.accounts]);
  const extraAmount = parseFloat(extra) || 0;

  const plan = useMemo(
    () => simulatePayoff(debts, strategy, extraAmount),
    [debts, strategy, extraAmount]
  );
  const minimumsOnly = useMemo(() => simulatePayoff(debts, strategy, 0), [debts, strategy]);
  const otherStrategy = useMemo(
    () => simulatePayoff(debts, strategy === 'avalanche' ? 'snowball' : 'avalanche', extraAmount),
    [debts, strategy, extraAmount]
  );

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const interestSaved = minimumsOnly.totalInterest - plan.totalInterest;
  const monthsSaved = minimumsOnly.months - plan.months;

  if (debts.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="No debt to plan"
        description="Credit cards and loans with a negative balance show up here with a payoff plan. Nothing owed right now — nicely done."
      />
    );
  }

  const chartData = plan.schedule
    .filter((_, i) => i % Math.max(1, Math.floor(plan.schedule.length / 60)) === 0)
    .map((s) => {
      const alt = otherStrategy.schedule.find((x) => x.month === s.month);
      return {
        month: s.month,
        [strategy]: Math.round(s.totalBalance),
        [strategy === 'avalanche' ? 'snowball' : 'avalanche']: alt ? Math.round(alt.totalBalance) : 0,
      };
    });

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
            Debt payoff
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {debts.length} {debts.length === 1 ? 'account' : 'accounts'} ·{' '}
            {formatCurrency(totalDebt, currency)} owed
          </p>
        </div>
      </div>

      <div className="card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
          <div>
            <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Strategy
            </span>
            <Segmented
              value={strategy}
              onChange={setStrategy}
              options={[
                { value: 'avalanche', label: 'Avalanche (highest APR)' },
                { value: 'snowball', label: 'Snowball (smallest first)' },
              ]}
            />
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-subtle)' }}>
              {strategy === 'avalanche'
                ? 'Targets the highest interest rate first — mathematically cheapest.'
                : 'Clears the smallest balance first — quicker wins to stay motivated.'}
            </p>
          </div>
          <Field label="Extra monthly payment" hint="On top of every minimum payment">
            <TextInput
              type="number"
              step="10"
              min="0"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
      </div>

      {plan.neverPaidOff ? (
        <div
          className="card p-4 text-sm"
          style={{ background: 'var(--color-negative-soft)', borderColor: 'var(--color-negative)', color: 'var(--color-negative)' }}
        >
          At this payment level the interest outpaces the payments and the balance never clears. Increase the
          extra monthly payment to see a payoff date.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Debt-free in
            </div>
            <div className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
              {monthsToText(plan.months)}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {plan.payoffDate ? formatDate(plan.payoffDate) : '—'}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Total interest
            </div>
            <div className="text-xl font-semibold tnum" style={{ color: 'var(--color-negative)' }}>
              {formatCurrency(plan.totalInterest, currency)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Interest saved
            </div>
            <div className="text-xl font-semibold tnum" style={{ color: 'var(--color-positive)' }}>
              {formatCurrency(Math.max(0, interestSaved), currency)}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              vs minimums only
            </div>
          </div>
          <div className="card p-5">
            <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Time saved
            </div>
            <div className="text-xl font-semibold" style={{ color: 'var(--color-positive)' }}>
              {monthsSaved > 0 ? monthsToText(monthsSaved) : '—'}
            </div>
          </div>
        </div>
      )}

      {!plan.neverPaidOff && !otherStrategy.neverPaidOff && (
        <div
          className="card p-4 flex items-start gap-3"
          style={{ background: 'var(--color-accent-soft)', borderColor: 'var(--color-accent-border)' }}
        >
          <Sparkles size={17} style={{ color: 'var(--color-accent)' }} className="mt-0.5 shrink-0" />
          <div className="text-sm" style={{ color: 'var(--color-text)' }}>
            {Math.abs(plan.totalInterest - otherStrategy.totalInterest) < 1 ? (
              <>
                <strong>Both strategies cost about the same here</strong> — your extra payment clears these
                balances fast enough that the order barely matters. Pick whichever keeps you motivated.
              </>
            ) : plan.totalInterest < otherStrategy.totalInterest ? (
              <>
                <strong>{strategy === 'avalanche' ? 'Avalanche' : 'Snowball'} is cheaper here</strong> — it saves{' '}
                {formatCurrency(otherStrategy.totalInterest - plan.totalInterest, currency)} in interest versus
                the other strategy.
              </>
            ) : (
              <>
                <strong>Switching to {strategy === 'avalanche' ? 'snowball' : 'avalanche'} would save</strong>{' '}
                {formatCurrency(plan.totalInterest - otherStrategy.totalInterest, currency)} in interest.
              </>
            )}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Balance over time
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={(m) => `${m}mo`}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={30}
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
              labelFormatter={(m) => `Month ${m}`}
              contentStyle={chartTooltip}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="avalanche"
              name="Avalanche"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="snowball"
              name="Snowball"
              stroke="var(--color-warning)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Payoff order
        </h2>
        <div className="space-y-4">
          {[...plan.perAccount]
            .sort((a, b) => (a.months || 9999) - (b.months || 9999))
            .map((acct, i) => {
              const debt = debts.find((d) => d.id === acct.id)!;
              const share = totalDebt > 0 ? (debt.balance / totalDebt) * 100 : 0;
              return (
                <div key={acct.id}>
                  <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: acct.color, color: '#fff' }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {acct.name}
                      </span>
                      <Badge tone="warning">{debt.apr}% APR</Badge>
                      <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                        min {formatCurrency(debt.minPayment, currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs tnum">
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {formatCurrency(debt.balance, currency)}
                      </span>
                      <span className="flex items-center gap-1" style={{ color: 'var(--color-negative)' }}>
                        <TrendingDown size={12} />
                        {formatCurrency(acct.interest, currency)} interest
                      </span>
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {acct.months ? monthsToText(acct.months) : 'not cleared'}
                      </span>
                    </div>
                  </div>
                  <ProgressBar percent={share} color={acct.color} height={6} />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
