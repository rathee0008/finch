import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, PieChart, CopyPlus, Pencil } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import type { Budget } from '../types';
import { formatCurrency, currentMonth, monthLabel } from '../lib/format';
import { budgetProgress, monthlyIncome } from '../lib/calculations';
import { Modal } from './ui/Modal';
import { Field, Select, TextInput, Button, Toggle, ProgressBar, Badge } from './ui/Field';
import { EmptyState } from './ui/EmptyState';

function BudgetModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Budget;
}) {
  const { state, addBudget, updateBudget, deleteBudget } = useFinance();
  const { toast } = useToast();

  const ym = currentMonth();
  const expenseCats = state.categories.filter((c) => c.type === 'expense' && !c.archived);
  const alreadyBudgeted = new Set(
    state.budgets.filter((b) => b.month === ym && b.id !== editing?.id).map((b) => b.categoryId)
  );
  const available = expenseCats.filter((c) => !alreadyBudgeted.has(c.id));

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [rollover, setRollover] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoryId(editing?.categoryId ?? available[0]?.id ?? '');
    setAmount(editing ? String(editing.amount) : '');
    setRollover(editing?.rollover ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!categoryId) return toast('Pick a category', { tone: 'error' });
    if (!amt || amt <= 0) return toast('Enter a limit greater than zero', { tone: 'error' });
    if (editing) {
      updateBudget(editing.id, { categoryId, amount: amt, rollover });
      toast('Budget updated');
    } else {
      addBudget({ categoryId, amount: amt, month: ym, rollover });
      toast('Budget added');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit budget' : 'New budget'}
      subtitle={monthLabel(ym)}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                deleteBudget(editing.id);
                toast('Budget removed');
                onClose();
              }}
            >
              <Trash2 size={15} /> Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? 'Save changes' : 'Add budget'}</Button>
        </>
      }
    >
      <Field label="Category">
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {editing && (
            <option value={editing.categoryId}>
              {state.categories.find((c) => c.id === editing.categoryId)?.name ?? 'Current'}
            </option>
          )}
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Monthly limit">
        <TextInput
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          autoFocus
        />
      </Field>
      <div className="flex items-start justify-between gap-4 pt-1">
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Roll over unspent
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Adds last month's leftover room to this month's limit.
          </div>
        </div>
        <Toggle checked={rollover} onChange={setRollover} />
      </div>
    </Modal>
  );
}

export function Budgets() {
  const { state, copyBudgetsFromLastMonth } = useFinance();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | undefined>(undefined);

  const ym = currentMonth();
  const currency = state.settings.currency;
  const monthBudgets = useMemo(() => state.budgets.filter((b) => b.month === ym), [state.budgets, ym]);

  const totals = useMemo(() => {
    let limit = 0;
    let spent = 0;
    for (const b of monthBudgets) {
      const p = budgetProgress(b, state.transactions, state.budgets);
      limit += p.limit;
      spent += p.spent;
    }
    return { limit, spent, remaining: limit - spent };
  }, [monthBudgets, state.transactions, state.budgets]);

  const income = monthlyIncome(state.transactions, ym);
  const unbudgeted = income - totals.limit;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Budgets
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {monthLabel(ym)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const n = copyBudgetsFromLastMonth();
              toast(
                n > 0 ? `Copied ${n} budgets from last month` : 'Nothing new to copy from last month',
                { tone: n > 0 ? 'success' : 'info' }
              );
            }}
          >
            <CopyPlus size={15} /> Copy last month
          </Button>
          <Button
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Add budget
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Total budgeted
            </span>
            <span className="text-sm font-semibold tnum" style={{ color: 'var(--color-text)' }}>
              {formatCurrency(totals.spent, currency)} / {formatCurrency(totals.limit, currency)}
            </span>
          </div>
          <ProgressBar
            percent={totals.limit > 0 ? (totals.spent / totals.limit) * 100 : 0}
            height={10}
            color={totals.spent > totals.limit ? 'var(--color-negative)' : 'var(--color-accent)'}
          />
          <div className="text-xs mt-2 tnum" style={{ color: 'var(--color-text-muted)' }}>
            {totals.remaining >= 0
              ? `${formatCurrency(totals.remaining, currency)} left to spend this month`
              : `${formatCurrency(Math.abs(totals.remaining), currency)} over budget`}
          </div>
        </div>

        <div className="card p-5">
          <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Unbudgeted income
          </div>
          <div
            className="text-xl font-semibold tnum"
            style={{ color: unbudgeted >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
          >
            {formatCurrency(unbudgeted, currency)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {unbudgeted >= 0
              ? 'Income not yet assigned to a budget'
              : 'Budgets exceed this month’s income'}
          </div>
        </div>
      </div>

      {monthBudgets.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No budgets this month"
          description="Set spending limits per category to keep the month on track — or copy last month's setup in one click."
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => copyBudgetsFromLastMonth()}>
                <CopyPlus size={15} /> Copy last month
              </Button>
              <Button onClick={() => setModalOpen(true)}>
                <Plus size={16} /> Add budget
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {monthBudgets.map((b) => {
            const cat = state.categories.find((c) => c.id === b.categoryId);
            if (!cat) return null;
            const { spent, percent, remaining, limit, rolledOver } = budgetProgress(
              b,
              state.transactions,
              state.budgets
            );
            const over = remaining < 0;
            return (
              <div key={b.id} className="card p-5 card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                      style={{ background: `${cat.color}22` }}
                    >
                      {cat.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                        {cat.name}
                        {rolledOver > 0 && (
                          <Badge tone="positive">+{formatCurrency(rolledOver, currency)} rolled</Badge>
                        )}
                      </div>
                      <div className="text-xs tnum" style={{ color: 'var(--color-text-muted)' }}>
                        {formatCurrency(spent, currency)} of {formatCurrency(limit, currency)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditing(b);
                      setModalOpen(true);
                    }}
                    className="p-1 transition hover:opacity-70"
                    style={{ color: 'var(--color-text-subtle)' }}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <ProgressBar
                  percent={percent}
                  color={over ? 'var(--color-negative)' : percent > 80 ? 'var(--color-warning)' : cat.color}
                />
                <div
                  className="text-xs mt-2 font-medium tnum"
                  style={{ color: over ? 'var(--color-negative)' : 'var(--color-text-muted)' }}
                >
                  {over
                    ? `${formatCurrency(Math.abs(remaining), currency)} over budget`
                    : `${formatCurrency(remaining, currency)} remaining`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BudgetModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
