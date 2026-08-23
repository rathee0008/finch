import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { AlertTriangle, TrendingDown, TrendingUp, Wallet, CalendarClock } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { buildForecast, averageDailyDiscretionary } from '../lib/forecast';
import { formatCurrency, formatCompact, formatDate, formatDateShort, relativeDay } from '../lib/format';
import { Segmented, Toggle, Badge } from './ui/Field';
import { EmptyState } from './ui/EmptyState';

export function Forecast() {
  const { state } = useFinance();
  const [days, setDays] = useState<'30' | '60' | '90' | '180'>('90');
  const [includeTypical, setIncludeTypical] = useState(true);

  const currency = state.settings.currency;
  const horizon = Number(days);

  const result = useMemo(
    () => buildForecast(state.accounts, state.transactions, state.recurring, horizon, includeTypical),
    [state.accounts, state.transactions, state.recurring, horizon, includeTypical]
  );

  const dailyBurn = useMemo(
    () => averageDailyDiscretionary(state.transactions, state.recurring),
    [state.transactions, state.recurring]
  );

  const chartData = result.points.map((p) => ({
    date: p.date,
    balance: Math.round(p.balance * 100) / 100,
  }));

  const eventDays = result.points.filter((p) => p.events.length > 0).slice(0, 14);

  if (state.accounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Add an account first"
        description="The forecast projects your cash balance forward using your accounts and recurring items."
      />
    );
  }

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
            Cash flow forecast
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Projected liquid balance from your recurring items
          </p>
        </div>
        <Segmented
          value={days}
          onChange={setDays}
          options={[
            { value: '30', label: '30d' },
            { value: '60', label: '60d' },
            { value: '90', label: '90d' },
            { value: '180', label: '180d' },
          ]}
        />
      </div>

      {result.shortfallDate && (
        <div
          className="card p-4 flex items-start gap-3"
          style={{ background: 'var(--color-negative-soft)', borderColor: 'var(--color-negative)' }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--color-negative)' }} className="mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-negative)' }}>
              Projected shortfall on {formatDate(result.shortfallDate)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              That's {relativeDay(result.shortfallDate)}. Consider moving money from savings or deferring a
              non-essential bill before then.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Available now
          </div>
          <div className="text-xl font-semibold tnum" style={{ color: 'var(--color-text)' }}>
            {formatCurrency(result.startBalance, currency)}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            In {horizon} days
          </div>
          <div
            className="text-xl font-semibold tnum"
            style={{
              color: result.endBalance >= result.startBalance ? 'var(--color-positive)' : 'var(--color-text)',
            }}
          >
            {formatCurrency(result.endBalance, currency)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {result.endBalance >= result.startBalance ? '+' : ''}
            {formatCurrency(result.endBalance - result.startBalance, currency)} change
          </div>
        </div>
        <div className="card p-5">
          <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Projected low point
          </div>
          <div
            className="text-xl font-semibold tnum"
            style={{ color: result.lowest.balance < 0 ? 'var(--color-negative)' : 'var(--color-warning)' }}
          >
            {formatCurrency(result.lowest.balance, currency)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            around {formatDateShort(result.lowest.date)}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Expected flow
          </div>
          <div className="text-sm font-semibold tnum flex items-center gap-1.5" style={{ color: 'var(--color-positive)' }}>
            <TrendingUp size={14} /> {formatCurrency(result.totalInflow, currency)}
          </div>
          <div className="text-sm font-semibold tnum flex items-center gap-1.5 mt-1" style={{ color: 'var(--color-negative)' }}>
            <TrendingDown size={14} /> {formatCurrency(result.totalOutflow, currency)}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Projected balance
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Include typical daily spending ({formatCurrency(dailyBurn, currency)}/day)
            </span>
            <Toggle checked={includeTypical} onChange={setIncludeTypical} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v) => formatCompact(v, currency)}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip
              formatter={(v: any) => [formatCurrency(Number(v), currency), 'Balance']}
              labelFormatter={(d) => formatDate(d as string)}
              contentStyle={chartTooltip}
            />
            <ReferenceLine y={0} stroke="var(--color-negative)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="url(#forecastGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock size={16} style={{ color: 'var(--color-text-muted)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Scheduled events
          </h2>
        </div>
        {eventDays.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
            No recurring items scheduled in this window.
          </p>
        ) : (
          <div className="space-y-2">
            {eventDays.map((p) => (
              <div
                key={p.date}
                className="flex items-start gap-3 py-2 border-b last:border-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="w-24 shrink-0">
                  <div className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>
                    {formatDateShort(p.date)}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                    {relativeDay(p.date)}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  {p.events.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                        {e.name}
                      </span>
                      <span
                        className="text-[13px] font-semibold tnum"
                        style={{ color: e.amount > 0 ? 'var(--color-positive)' : 'var(--color-text)' }}
                      >
                        {e.amount > 0 ? '+' : '−'}
                        {formatCurrency(Math.abs(e.amount), currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="w-28 text-right shrink-0">
                  <span
                    className="text-[13px] font-medium tnum"
                    style={{ color: p.balance < 0 ? 'var(--color-negative)' : 'var(--color-text-muted)' }}
                  >
                    {formatCurrency(p.balance, currency)}
                  </span>
                  {p.balance < 0 && (
                    <div className="mt-0.5">
                      <Badge tone="negative">short</Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
