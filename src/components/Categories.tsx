import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Tags } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import type { Category } from '../types';
import { Modal } from './ui/Modal';
import { Field, TextInput, Segmented, Button } from './ui/Field';
import { EmptyState } from './ui/EmptyState';
import { spendingByCategory } from '../lib/calculations';
import { formatCurrency, currentMonth } from '../lib/format';

const EMOJIS = [
  '💰', '🛒', '🏠', '🍽️', '🚗', '💡', '🎬', '💊', '🛍️', '📱',
  '💼', '🧑‍💻', '✈️', '🎓', '🐾', '🎁', '⚡', '📚', '☕', '🏋️',
  '🧾', '🚌', '🍿', '🧴', '🎨', '➕',
];
const COLORS = [
  '#4f46e5', '#059669', '#dc2626', '#d97706', '#0891b2',
  '#db2777', '#7c3aed', '#65a30d', '#ca8a04', '#0284c7',
];

function CategoryModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Category;
}) {
  const { addCategory, updateCategory, deleteCategory } = useFinance();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setType(editing?.type ?? 'expense');
    setIcon(editing?.icon ?? EMOJIS[0]);
    setColor(editing?.color ?? COLORS[0]);
  }, [open, editing]);

  const submit = () => {
    if (!name.trim()) return toast('Give the category a name', { tone: 'error' });
    if (editing) {
      updateCategory(editing.id, { name: name.trim(), type, icon, color });
      toast('Category updated');
    } else {
      addCategory({ name: name.trim(), type, icon, color });
      toast('Category added');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                deleteCategory(editing.id);
                toast('Category deleted — its transactions are now uncategorized', { tone: 'warning' });
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
          <Button onClick={submit}>{editing ? 'Save changes' : 'Add category'}</Button>
        </>
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${color}22` }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            autoFocus
          />
        </div>
      </div>

      <div className="mb-4">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
          className="w-full [&>button]:flex-1"
        />
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

export function Categories() {
  const { state } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>(undefined);

  const ym = currentMonth();
  const currency = state.settings.currency;

  const spendMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const { category, amount } of spendingByCategory(state.transactions, state.categories, ym)) {
      map.set(category.id, amount);
    }
    return map;
  }, [state.transactions, state.categories, ym]);

  const income = state.categories.filter((c) => c.type === 'income' && !c.archived);
  const expense = state.categories.filter((c) => c.type === 'expense' && !c.archived);

  const Grid = ({ items, showSpend }: { items: Category[]; showSpend: boolean }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((c) => {
        const spent = spendMap.get(c.id) ?? 0;
        return (
          <button
            key={c.id}
            onClick={() => {
              setEditing(c);
              setModalOpen(true);
            }}
            className="card p-4 text-left card-hover"
          >
            <div className="flex items-start justify-between mb-2.5">
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                style={{ background: `${c.color}22` }}
              >
                {c.icon}
              </span>
              <Pencil size={13} style={{ color: 'var(--color-text-subtle)' }} />
            </div>
            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
              {c.name}
            </div>
            {showSpend && (
              <div className="text-xs mt-0.5 tnum" style={{ color: 'var(--color-text-muted)' }}>
                {spent > 0 ? `${formatCurrency(spent, currency)} this month` : 'No spend yet'}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
          Categories
        </h1>
        <Button
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add category
        </Button>
      </div>

      {state.categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories"
          description="Categories are how spending gets grouped in budgets, reports and insights."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Add category
            </Button>
          }
        />
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Expense · {expense.length}
            </h2>
            <Grid items={expense} showSpend />
          </div>
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Income · {income.length}
            </h2>
            <Grid items={income} showSpend={false} />
          </div>
        </>
      )}

      <CategoryModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
