import { useEffect, useState } from 'react';
import { Plus, Trash2, PlusCircle, Target, Pencil } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import type { Goal } from '../types';
import { formatCurrency, formatDate, parseISODate, todayISO } from '../lib/format';
import { Modal } from './ui/Modal';
import { Field, TextInput, Button, ProgressBar, Badge } from './ui/Field';
import { EmptyState } from './ui/EmptyState';

const EMOJIS = ['🛟', '✈️', '💻', '🏡', '🚗', '🎓', '💍', '🏖️', '🎸', '👶', '🩺', '🎯'];
const COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#0891b2', '#db2777', '#7c3aed', '#65a30d'];

/** Months of contributions still needed, and whether that beats the target date. */
function projectGoal(goal: Goal): { monthsLeft: number | null; onTrack: boolean | null } {
  const remaining = goal.targetAmount - goal.currentAmount;
  if (remaining <= 0) return { monthsLeft: 0, onTrack: true };
  if (!goal.monthlyContribution || goal.monthlyContribution <= 0) {
    return { monthsLeft: null, onTrack: null };
  }
  const monthsLeft = Math.ceil(remaining / goal.monthlyContribution);
  if (!goal.targetDate) return { monthsLeft, onTrack: null };

  const target = parseISODate(goal.targetDate);
  const now = parseISODate(todayISO());
  const monthsAvailable =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return { monthsLeft, onTrack: monthsLeft <= monthsAvailable };
}

function GoalModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Goal;
}) {
  const { addGoal, updateGoal, deleteGoal } = useFinance();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [monthly, setMonthly] = useState('');
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setTarget(editing ? String(editing.targetAmount) : '');
    setCurrent(editing ? String(editing.currentAmount) : '');
    setTargetDate(editing?.targetDate ?? '');
    setMonthly(editing?.monthlyContribution ? String(editing.monthlyContribution) : '');
    setIcon(editing?.icon ?? EMOJIS[0]);
    setColor(editing?.color ?? COLORS[0]);
  }, [open, editing]);

  const submit = () => {
    const t = parseFloat(target);
    if (!name.trim()) return toast('Name your goal', { tone: 'error' });
    if (!t || t <= 0) return toast('Enter a target amount', { tone: 'error' });
    const payload = {
      name: name.trim(),
      targetAmount: t,
      currentAmount: parseFloat(current) || 0,
      targetDate: targetDate || undefined,
      monthlyContribution: monthly ? parseFloat(monthly) : undefined,
      icon,
      color,
    };
    if (editing) {
      updateGoal(editing.id, payload);
      toast('Goal updated');
    } else {
      addGoal(payload);
      toast('Goal created');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit goal' : 'New goal'}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                deleteGoal(editing.id);
                toast('Goal deleted');
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
          <Button onClick={submit}>{editing ? 'Save changes' : 'Add goal'}</Button>
        </>
      }
    >
      <Field label="Goal name">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency Fund"
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target amount">
          <TextInput
            type="number"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Saved so far">
          <TextInput
            type="number"
            step="0.01"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="0.00"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target date" hint="Optional">
          <TextInput type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        <Field label="Monthly contribution" hint="Drives the projection">
          <TextInput
            type="number"
            step="0.01"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="0.00"
          />
        </Field>
      </div>
      <Field label="Icon">
        <div className="flex gap-1.5 flex-wrap">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setIcon(e)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-base transition"
              style={{
                background: icon === e ? 'var(--color-accent-soft)' : 'var(--color-surface-2)',
                outline: icon === e ? '2px solid var(--color-accent)' : 'none',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Color">
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full"
              style={{ background: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
            />
          ))}
        </div>
      </Field>
    </Modal>
  );
}

function ContributeModal({
  open,
  onClose,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  goal?: Goal;
}) {
  const { updateGoal, state } = useFinance();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (open) setAmount('');
  }, [open]);

  if (!goal) return null;

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt) return toast('Enter an amount', { tone: 'error' });
    const next = Math.max(0, goal.currentAmount + amt);
    updateGoal(goal.id, { currentAmount: next });
    toast(
      `${amt > 0 ? 'Added' : 'Withdrew'} ${formatCurrency(Math.abs(amt), state.settings.currency)} · ${goal.name}`
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Update ${goal.name}`}
      width={400}
      footer={
        <>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Update</Button>
        </>
      }
    >
      <Field label="Amount" hint="Use a negative number to withdraw">
        <TextInput
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </Field>
      <div className="flex gap-2">
        {[50, 100, 250, 500].map((v) => (
          <Button key={v} variant="secondary" size="sm" onClick={() => setAmount(String(v))}>
            +{v}
          </Button>
        ))}
      </div>
    </Modal>
  );
}

export function Goals() {
  const { state } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>(undefined);
  const [contributeGoal, setContributeGoal] = useState<Goal | undefined>(undefined);

  const currency = state.settings.currency;
  const active = state.goals.filter((g) => !g.archived);

  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Goals
          </h1>
          {active.length > 0 && (
            <p className="text-sm mt-0.5 tnum" style={{ color: 'var(--color-text-muted)' }}>
              {formatCurrency(totalSaved, currency)} of {formatCurrency(totalTarget, currency)} saved
            </p>
          )}
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add goal
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No savings goals"
          description="Set a target and a monthly contribution — Finch projects when you'll get there."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Create a goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((g) => {
            const percent = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
            const complete = g.currentAmount >= g.targetAmount;
            const { monthsLeft, onTrack } = projectGoal(g);
            return (
              <div key={g.id} className="card p-5 card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ background: `${g.color}22` }}
                    >
                      {g.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                        {g.name}
                        {complete && <Badge tone="positive">reached</Badge>}
                      </div>
                      {g.targetDate && (
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          by {formatDate(g.targetDate)}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditing(g);
                      setModalOpen(true);
                    }}
                    className="p-1 transition hover:opacity-70"
                    style={{ color: 'var(--color-text-subtle)' }}
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                <ProgressBar percent={percent} color={complete ? 'var(--color-positive)' : g.color} height={10} />

                <div className="flex items-center justify-between text-sm mt-2.5 mb-1">
                  <span className="font-semibold tnum" style={{ color: 'var(--color-text)' }}>
                    {formatCurrency(g.currentAmount, currency)}
                  </span>
                  <span className="text-xs tnum" style={{ color: 'var(--color-text-muted)' }}>
                    of {formatCurrency(g.targetAmount, currency)} · {percent.toFixed(0)}%
                  </span>
                </div>

                {!complete && monthsLeft != null && (
                  <div
                    className="text-xs mb-3"
                    style={{
                      color:
                        onTrack === false ? 'var(--color-warning)' : 'var(--color-text-muted)',
                    }}
                  >
                    {monthsLeft} {monthsLeft === 1 ? 'month' : 'months'} to go at{' '}
                    {formatCurrency(g.monthlyContribution ?? 0, currency)}/mo
                    {onTrack === false && ' — behind your target date'}
                    {onTrack === true && ' — on track'}
                  </div>
                )}
                {!complete && monthsLeft == null && (
                  <div className="text-xs mb-3" style={{ color: 'var(--color-text-subtle)' }}>
                    Set a monthly contribution to see a projection
                  </div>
                )}
                {complete && <div className="mb-3" />}

                <Button variant="secondary" className="w-full" onClick={() => setContributeGoal(g)}>
                  <PlusCircle size={15} /> Add funds
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <GoalModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
      <ContributeModal
        open={!!contributeGoal}
        onClose={() => setContributeGoal(undefined)}
        goal={contributeGoal}
      />
    </div>
  );
}
