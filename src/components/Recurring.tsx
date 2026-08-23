import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Check, Pause, Play, Repeat, Sparkles, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import type { RecurrenceFreq, TransactionType } from '../types';
import { formatCurrency, formatDate, todayISO, relativeDay } from '../lib/format';
import { Modal } from './ui/Modal';
import { Field, TextInput, Select, Button, Segmented, Badge } from './ui/Field';
import { EmptyState } from './ui/EmptyState';
import { detectRecurring } from '../lib/detectRecurring';

const FREQ_LABELS: Record<RecurrenceFreq, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const MONTHLY_MULTIPLIER: Record<RecurrenceFreq, number> = {
  daily: 30,
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  yearly: 1 / 12,
};

function RecurringModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addRecurring } = useFinance();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [freq, setFreq] = useState<RecurrenceFreq>('monthly');
  const [nextDate, setNextDate] = useState(todayISO());

  useEffect(() => {
    if (!open) return;
    setName('');
    setType('expense');
    setAccountId(state.accounts[0]?.id ?? '');
    setCategoryId('');
    setAmount('');
    setPayee('');
    setFreq('monthly');
    setNextDate(todayISO());
  }, [open, state.accounts]);

  const categories = state.categories.filter(
    (c) => c.type === (type === 'income' ? 'income' : 'expense')
  );

  const submit = () => {
    const amt = parseFloat(amount);
    if (!name.trim()) return toast('Give it a name', { tone: 'error' });
    if (!amt || amt <= 0) return toast('Enter an amount', { tone: 'error' });
    if (!accountId) return toast('Pick an account', { tone: 'error' });
    addRecurring({
      name: name.trim(),
      accountId,
      categoryId: categoryId || undefined,
      type,
      amount: amt,
      payee: payee.trim() || name.trim(),
      freq,
      nextDate,
      active: true,
    });
    toast('Recurring item added');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New recurring item"
      footer={
        <>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add recurring</Button>
        </>
      }
    >
      <div className="mb-4">
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v);
            setCategoryId('');
          }}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
          className="w-full [&>button]:flex-1"
        />
      </div>
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent" autoFocus />
      </Field>
      <Field label="Payee">
        <TextInput
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder="Defaults to the name"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <TextInput
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Next date">
          <TextInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Frequency">
          <Select value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}>
            {Object.entries(FREQ_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Category">
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

export function Recurring() {
  const { state, deleteRecurring, updateRecurring, postRecurring, postAllDue, addRecurring } = useFinance();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const currency = state.settings.currency;
  const today = todayISO();

  const sorted = [...state.recurring].sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
  const dueCount = state.recurring.filter((r) => r.active && r.nextDate <= today).length;

  const monthlyOut = state.recurring
    .filter((r) => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount * MONTHLY_MULTIPLIER[r.freq], 0);
  const monthlyIn = state.recurring
    .filter((r) => r.active && r.type === 'income')
    .reduce((sum, r) => sum + r.amount * MONTHLY_MULTIPLIER[r.freq], 0);

  const suggestions = useMemo(
    () =>
      detectRecurring(state.transactions, state.recurring)
        .filter((s) => !dismissed.has(s.payee))
        .slice(0, 4),
    [state.transactions, state.recurring, dismissed]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
          Recurring
        </h1>
        <div className="flex items-center gap-2">
          {dueCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                const n = postAllDue();
                toast(`Posted ${n} due ${n === 1 ? 'item' : 'items'}`);
              }}
            >
              <Check size={15} /> Post {dueCount} due
            </Button>
          )}
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Add recurring
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Monthly outflow', value: -monthlyOut, color: 'var(--color-negative)' },
          { label: 'Monthly inflow', value: monthlyIn, color: 'var(--color-positive)' },
          {
            label: 'Net monthly',
            value: monthlyIn - monthlyOut,
            color: monthlyIn - monthlyOut >= 0 ? 'var(--color-positive)' : 'var(--color-negative)',
          },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {s.label}
            </div>
            <div className="text-xl font-semibold tnum tracking-tight" style={{ color: s.color }}>
              {formatCurrency(s.value, currency)}
            </div>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Detected in your history
            </h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            These charges repeat on a schedule but aren't tracked yet.
          </p>
          <div className="space-y-2">
            {suggestions.map((s) => {
              const cat = state.categories.find((c) => c.id === s.categoryId);
              return (
                <div
                  key={s.payee}
                  className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-lg"
                  style={{ background: 'var(--color-surface-2)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{ background: 'var(--color-surface)' }}
                    >
                      {cat?.icon ?? '🔁'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {s.payee}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        {FREQ_LABELS[s.freq]} · seen {s.occurrences}× · next {formatDate(s.nextDate)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[13px] font-semibold tnum" style={{ color: 'var(--color-text)' }}>
                      {formatCurrency(s.amount, currency)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        addRecurring({
                          name: s.payee,
                          accountId: s.accountId,
                          categoryId: s.categoryId,
                          type: 'expense',
                          amount: s.amount,
                          payee: s.payee,
                          freq: s.freq,
                          nextDate: s.nextDate,
                          active: true,
                        });
                        toast(`Now tracking ${s.payee}`);
                      }}
                    >
                      <Plus size={13} /> Track
                    </Button>
                    <button
                      onClick={() => setDismissed((d) => new Set(d).add(s.payee))}
                      className="p-1.5 rounded-md transition hover:opacity-70"
                      style={{ color: 'var(--color-text-muted)' }}
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring items"
          description="Track rent, subscriptions and paychecks so your forecast knows what's coming."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Add recurring
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {sorted.map((r) => {
            const cat = state.categories.find((c) => c.id === r.categoryId);
            const acct = state.accounts.find((a) => a.id === r.accountId);
            const due = r.nextDate <= today;
            return (
              <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ background: 'var(--color-surface-2)', opacity: r.active ? 1 : 0.5 }}
                  >
                    {cat?.icon ?? '🔁'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-text)' }}>
                      {r.name}
                      {!r.active && <Badge>paused</Badge>}
                      {due && r.active && <Badge tone="warning">due {relativeDay(r.nextDate)}</Badge>}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {FREQ_LABELS[r.freq]} · next {formatDate(r.nextDate)} · {acct?.name ?? '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span
                    className="text-sm font-semibold tnum"
                    style={{ color: r.type === 'income' ? 'var(--color-positive)' : 'var(--color-text)' }}
                  >
                    {r.type === 'income' ? '+' : '−'}
                    {formatCurrency(r.amount, currency)}
                  </span>
                  {r.active && (
                    <button
                      title="Post now"
                      onClick={() => {
                        postRecurring(r.id);
                        toast(`Posted ${r.name}`);
                      }}
                      className="p-2 rounded-lg transition hover:opacity-80"
                      style={{ background: 'var(--color-positive-soft)', color: 'var(--color-positive)' }}
                    >
                      <Check size={15} />
                    </button>
                  )}
                  <button
                    title={r.active ? 'Pause' : 'Resume'}
                    onClick={() => updateRecurring(r.id, { active: !r.active })}
                    className="p-2 rounded-lg transition hover:opacity-80"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                  >
                    {r.active ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button
                    title="Delete"
                    onClick={() => {
                      deleteRecurring(r.id);
                      toast(`Removed ${r.name}`, { tone: 'warning' });
                    }}
                    className="p-2 rounded-lg transition hover:opacity-80"
                    style={{ background: 'var(--color-negative-soft)', color: 'var(--color-negative)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecurringModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
