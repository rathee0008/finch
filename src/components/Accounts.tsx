import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  TrendingUp,
  Landmark,
  Users,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import type { Account, AccountType } from '../types';
import { formatCurrency } from '../lib/format';
import { Modal } from './ui/Modal';
import { Field, TextInput, Select, Button, Badge } from './ui/Field';
import { Sparkline } from './ui/Sparkline';
import { EmptyState } from './ui/EmptyState';
import { netWorth, totalAssets, totalLiabilities } from '../lib/calculations';

const TYPE_ICONS: Record<AccountType, React.ElementType> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
  loan: Landmark,
};

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  cash: 'Cash',
  investment: 'Investment',
  loan: 'Loan',
};

const COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#0891b2', '#db2777', '#7c3aed', '#65a30d'];

const isDebtType = (t: AccountType) => t === 'credit' || t === 'loan';

function AccountModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Account;
}) {
  const { state, addAccount, updateAccount, deleteAccount } = useFinance();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [institution, setInstitution] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [owner, setOwner] = useState('');

  const knownOwners = useMemo(
    () => Array.from(new Set(state.accounts.map((a) => a.owner).filter(Boolean))) as string[],
    [state.accounts]
  );

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setType(editing?.type ?? 'checking');
    setBalance(editing ? String(editing.balance) : '');
    setColor(editing?.color ?? COLORS[0]);
    setInstitution(editing?.institution ?? '');
    setApr(editing?.apr != null ? String(editing.apr) : '');
    setMinPayment(editing?.minPayment != null ? String(editing.minPayment) : '');
    setOwner(editing?.owner ?? '');
  }, [open, editing]);

  const submit = () => {
    if (!name.trim()) return toast('Give the account a name', { tone: 'error' });
    const payload = {
      name: name.trim(),
      type,
      balance: parseFloat(balance) || 0,
      color,
      currency: 'USD',
      institution: institution.trim() || undefined,
      apr: isDebtType(type) && apr ? parseFloat(apr) : undefined,
      minPayment: isDebtType(type) && minPayment ? parseFloat(minPayment) : undefined,
      owner: owner.trim() || undefined,
    };
    if (editing) {
      updateAccount(editing.id, payload);
      toast('Account updated');
    } else {
      addAccount(payload);
      toast('Account added');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit account' : 'New account'}
      subtitle={isDebtType(type) ? 'Enter the balance as a negative number for money owed.' : undefined}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                deleteAccount(editing.id);
                toast('Account and its transactions deleted', { tone: 'warning' });
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
          <Button onClick={submit}>{editing ? 'Save changes' : 'Add account'}</Button>
        </>
      }
    >
      <Field label="Account name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Checking" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Current balance">
          <TextInput
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Institution (optional)">
          <TextInput
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. Chase"
          />
        </Field>
        <Field label="Owner (optional)" hint="For a shared or family setup">
          <TextInput
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="e.g. Papa"
            list="account-owners"
          />
          <datalist id="account-owners">
            {knownOwners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
      </div>

      {isDebtType(type) && (
        <div
          className="grid grid-cols-2 gap-3 p-3 rounded-lg mb-3"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        >
          <Field label="APR %" hint="Used by the payoff planner">
            <TextInput
              type="number"
              step="0.01"
              value={apr}
              onChange={(e) => setApr(e.target.value)}
              placeholder="19.99"
            />
          </Field>
          <Field label="Minimum payment">
            <TextInput
              type="number"
              step="0.01"
              value={minPayment}
              onChange={(e) => setMinPayment(e.target.value)}
              placeholder="75.00"
            />
          </Field>
        </div>
      )}

      <Field label="Color">
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full transition"
              style={{ background: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
            />
          ))}
        </div>
      </Field>
    </Modal>
  );
}

export function Accounts() {
  const { state } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>(undefined);
  const currency = state.settings.currency;

  const active = state.accounts.filter((a) => !a.archived);
  const assets = active.filter((a) => a.balance >= 0);
  const debts = active.filter((a) => a.balance < 0);

  const byOwner = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of active) {
      if (!a.owner) continue;
      map.set(a.owner, (map.get(a.owner) ?? 0) + a.balance);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [active]);

  /** Reconstructs a short balance history per account for the sparklines. */
  const historyByAccount = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const acct of active) {
      const txs = state.transactions
        .filter((t) => t.accountId === acct.id || t.toAccountId === acct.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 24);

      const series: number[] = [acct.balance];
      let running = acct.balance;
      for (const t of txs) {
        if (t.type === 'transfer') {
          running += t.toAccountId === acct.id ? -t.amount : t.amount;
        } else if (t.type === 'income') running -= t.amount;
        else running += t.amount;
        series.push(running);
      }
      map.set(acct.id, series.reverse());
    }
    return map;
  }, [active, state.transactions]);

  const openEdit = (a: Account) => {
    setEditing(a);
    setModalOpen(true);
  };

  const AccountCard = ({ a }: { a: Account }) => {
    const Icon = TYPE_ICONS[a.type];
    const series = historyByAccount.get(a.id) ?? [];
    return (
      <button onClick={() => openEdit(a)} className="card p-5 text-left card-hover w-full">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `${a.color}22`, color: a.color }}
          >
            <Icon size={19} />
          </div>
          <Pencil size={13} style={{ color: 'var(--color-text-subtle)' }} />
        </div>
        <div className="text-sm font-medium mb-0.5 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
          {a.name}
        </div>
        <div className="text-xs mb-3 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
          {TYPE_LABELS[a.type]}
          {a.institution && <span>· {a.institution}</span>}
          {a.owner && <Badge tone="accent">{a.owner}</Badge>}
          {a.apr != null && <Badge tone="warning">{a.apr}% APR</Badge>}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div
            className="text-xl font-semibold tnum tracking-tight"
            style={{ color: a.balance < 0 ? 'var(--color-negative)' : 'var(--color-text)' }}
          >
            {formatCurrency(a.balance, currency)}
          </div>
          {series.length > 1 && (
            <Sparkline
              values={series}
              color={a.balance < 0 ? 'var(--color-negative)' : a.color}
              width={72}
              height={28}
            />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
          Accounts
        </h1>
        <Button
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add account
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Net worth', value: netWorth(active), color: 'var(--color-text)' },
          { label: 'Total assets', value: totalAssets(active), color: 'var(--color-positive)' },
          { label: 'Total liabilities', value: totalLiabilities(active), color: 'var(--color-negative)' },
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

      {byOwner.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
            <Users size={15} /> By person
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {byOwner.map(([person, total]) => (
              <div key={person}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {person}
                </div>
                <div
                  className="text-base font-semibold tnum"
                  style={{ color: total < 0 ? 'var(--color-negative)' : 'var(--color-text)' }}
                >
                  {formatCurrency(total, currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your checking, savings, credit cards and loans to see your full financial picture."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Add account
            </Button>
          }
        />
      ) : (
        <>
          {assets.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Assets
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.map((a) => (
                  <AccountCard key={a.id} a={a} />
                ))}
              </div>
            </div>
          )}

          {debts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Liabilities
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {debts.map((a) => (
                  <AccountCard key={a.id} a={a} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AccountModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
