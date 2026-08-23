import { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Download,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  X,
  Tag as TagIcon,
  CheckCircle2,
  Circle,
  ArrowLeftRight,
  SlidersHorizontal,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import type { Transaction } from '../types';
import { formatCurrency, formatDate, currentMonth, addMonths } from '../lib/format';
import { TransactionModal } from './TransactionModal';
import { transactionsToCSV, downloadCSV, parseTransactionsCSV } from '../lib/csv';
import { allTags, categoryAmounts } from '../lib/calculations';
import { Button, Select, TextInput, Badge } from './ui/Field';
import { EmptyState } from './ui/EmptyState';

type SortKey = 'date' | 'amount' | 'payee';
type DateRange = 'all' | 'thisMonth' | 'lastMonth' | 'last90';

const PAGE_SIZE = 60;

export function Transactions() {
  const { state, addTransactionsBulk, deleteTransactions, categorizeTransactions, tagTransactions, setCleared } =
    useFinance();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [clearedFilter, setClearedFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [bulkTag, setBulkTag] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const currency = state.settings.currency;
  const tags = useMemo(() => allTags(state.transactions), [state.transactions]);

  const filtered = useMemo(() => {
    let list = [...state.transactions];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.payee.toLowerCase().includes(q) ||
          (t.notes ?? '').toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    if (accountFilter !== 'all')
      list = list.filter((t) => t.accountId === accountFilter || t.toAccountId === accountFilter);
    if (categoryFilter !== 'all')
      list = list.filter((t) => categoryAmounts(t).some((p) => p.categoryId === categoryFilter));
    if (typeFilter !== 'all') list = list.filter((t) => t.type === typeFilter);
    if (tagFilter !== 'all') list = list.filter((t) => (t.tags ?? []).includes(tagFilter));
    if (clearedFilter === 'cleared') list = list.filter((t) => t.cleared !== false);
    if (clearedFilter === 'pending') list = list.filter((t) => t.cleared === false);

    if (dateRange === 'thisMonth') {
      const ym = currentMonth();
      list = list.filter((t) => t.date.startsWith(ym));
    } else if (dateRange === 'lastMonth') {
      const ym = addMonths(currentMonth(), -1);
      list = list.filter((t) => t.date.startsWith(ym));
    } else if (dateRange === 'last90') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const iso = cutoff.toISOString().slice(0, 10);
      list = list.filter((t) => t.date >= iso);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      else if (sortKey === 'amount') cmp = a.amount - b.amount;
      else cmp = a.payee.localeCompare(b.payee);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [
    state.transactions,
    search,
    accountFilter,
    categoryFilter,
    typeFilter,
    tagFilter,
    clearedFilter,
    dateRange,
    sortKey,
    sortDir,
  ]);

  const visible = filtered.slice(0, visibleCount);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const activeFilterCount = [
    accountFilter !== 'all',
    categoryFilter !== 'all',
    typeFilter !== 'all',
    tagFilter !== 'all',
    clearedFilter !== 'all',
    dateRange !== 'all',
  ].filter(Boolean).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'payee' ? 'asc' : 'desc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(visible.map((t) => t.id)));
  };

  const clearFilters = () => {
    setAccountFilter('all');
    setCategoryFilter('all');
    setTypeFilter('all');
    setTagFilter('all');
    setClearedFilter('all');
    setDateRange('all');
    setSearch('');
  };

  const handleExport = () => {
    downloadCSV(
      transactionsToCSV(filtered, state.accounts, state.categories),
      `transactions-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast(`Exported ${filtered.length} transactions`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { rows, skipped } = parseTransactionsCSV(String(reader.result ?? ''));
      if (rows.length === 0) {
        toast('No importable rows found in that file', { tone: 'error' });
        return;
      }
      const fallbackAccount = state.accounts[0]?.id ?? '';
      addTransactionsBulk(
        rows.map((row) => {
          const account = state.accounts.find(
            (a) => a.name.toLowerCase() === row.accountName.toLowerCase()
          );
          const category = state.categories.find(
            (c) => c.name.toLowerCase() === row.categoryName.toLowerCase()
          );
          return {
            date: row.date,
            accountId: account?.id ?? fallbackAccount,
            categoryId: category?.id,
            type: row.type,
            amount: row.amount,
            payee: row.payee,
            notes: row.notes || undefined,
            tags: row.tags.length ? row.tags : undefined,
            cleared: true,
          };
        })
      );
      toast(
        `Imported ${rows.length} transactions${skipped ? ` · skipped ${skipped} unreadable rows` : ''}`,
        { tone: skipped ? 'warning' : 'success' }
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const SortHeader = ({ label, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) => (
    <th
      className={`px-4 py-3 font-medium text-xs ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--color-text-muted)' }}
    >
      <button
        className={`inline-flex items-center gap-1 transition hover:opacity-70 ${
          align === 'right' ? 'ml-auto' : ''
        }`}
        onClick={() => toggleSort(k)}
      >
        {label}
        {sortKey === k &&
          (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Transactions
          </h1>
          <p className="text-sm mt-0.5 tnum" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} shown · net{' '}
            <span style={{ color: totals.net >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
              {formatCurrency(totals.net, currency)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
            <span
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition hover:opacity-90"
              style={{
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Upload size={15} /> Import
            </span>
          </label>
          <Button variant="secondary" onClick={handleExport}>
            <Download size={15} /> Export
          </Button>
          <Button
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Add
          </Button>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="card p-3 space-y-3">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <TextInput
              ref={searchRef}
              data-search-input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payee, note or tag…"
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilters || activeFilterCount ? 'subtle' : 'secondary'}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="ml-0.5 text-[10px] font-bold px-1.5 rounded-full"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 items-center pt-1">
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="!w-auto"
            >
              <option value="all">Any date</option>
              <option value="thisMonth">This month</option>
              <option value="lastMonth">Last month</option>
              <option value="last90">Last 90 days</option>
            </Select>
            <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="!w-auto">
              <option value="all">All accounts</option>
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="!w-auto">
              <option value="all">All categories</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="!w-auto">
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </Select>
            {tags.length > 0 && (
              <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="!w-auto">
                <option value="all">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </Select>
            )}
            <Select value={clearedFilter} onChange={(e) => setClearedFilter(e.target.value)} className="!w-auto">
              <option value="all">Cleared & pending</option>
              <option value="cleared">Cleared only</option>
              <option value="pending">Pending only</option>
            </Select>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X size={13} /> Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="card p-3 flex items-center gap-2 flex-wrap sticky top-2 z-20 animate-fade-up"
          style={{ borderColor: 'var(--color-accent-border)', boxShadow: 'var(--shadow-md)' }}
        >
          <span className="text-sm font-medium px-1" style={{ color: 'var(--color-text)' }}>
            {selected.size} selected
          </span>

          <Select
            value=""
            className="!w-auto"
            onChange={(e) => {
              if (!e.target.value) return;
              const n = selected.size;
              categorizeTransactions(Array.from(selected), e.target.value);
              toast(`Recategorized ${n} transactions`);
              setSelected(new Set());
            }}
          >
            <option value="">Set category…</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-1">
            <TextInput
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              placeholder="Add tag"
              className="!w-28"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && bulkTag.trim()) {
                  tagTransactions(Array.from(selected), bulkTag.trim());
                  toast(`Tagged ${selected.size} transactions`);
                  setBulkTag('');
                  setSelected(new Set());
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!bulkTag.trim()}
              onClick={() => {
                tagTransactions(Array.from(selected), bulkTag.trim());
                toast(`Tagged ${selected.size} transactions`);
                setBulkTag('');
                setSelected(new Set());
              }}
            >
              <TagIcon size={13} />
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCleared(Array.from(selected), true);
              toast(`Marked ${selected.size} as cleared`);
              setSelected(new Set());
            }}
          >
            <CheckCircle2 size={13} /> Clear
          </Button>

          <div className="flex-1" />

          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              const n = selected.size;
              deleteTransactions(Array.from(selected));
              toast(`Deleted ${n} transactions`, { tone: 'warning' });
              setSelected(new Set());
            }}
          >
            <Trash2 size={13} /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            <X size={14} />
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions match"
          description={
            state.transactions.length === 0
              ? 'Add your first transaction, or import a CSV from your bank to get started.'
              : 'Try widening your filters or clearing the search.'
          }
          action={
            state.transactions.length === 0 ? (
              <Button onClick={() => setModalOpen(true)}>
                <Plus size={16} /> Add transaction
              </Button>
            ) : (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
                  <th className="w-10 pl-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="cursor-pointer accent-[var(--color-accent)]"
                      aria-label="Select all"
                    />
                  </th>
                  <SortHeader label="Date" k="date" />
                  <SortHeader label="Payee" k="payee" />
                  <th className="px-4 py-3 font-medium text-xs text-left" style={{ color: 'var(--color-text-muted)' }}>
                    Category
                  </th>
                  <th className="px-4 py-3 font-medium text-xs text-left" style={{ color: 'var(--color-text-muted)' }}>
                    Account
                  </th>
                  <SortHeader label="Amount" k="amount" align="right" />
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const cat = state.categories.find((c) => c.id === t.categoryId);
                  const acct = state.accounts.find((a) => a.id === t.accountId);
                  const toAcct = state.accounts.find((a) => a.id === t.toAccountId);
                  const isSelected = selected.has(t.id);
                  const splitCats = (t.splits ?? [])
                    .map((s) => state.categories.find((c) => c.id === s.categoryId))
                    .filter(Boolean);

                  return (
                    <tr
                      key={t.id}
                      className="border-b transition cursor-pointer"
                      style={{
                        borderColor: 'var(--color-border)',
                        background: isSelected ? 'var(--color-accent-soft)' : 'transparent',
                      }}
                      onClick={() => {
                        setEditing(t);
                        setModalOpen(true);
                      }}
                    >
                      <td className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                          className="cursor-pointer accent-[var(--color-accent)]"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="flex items-center gap-1.5">
                          {t.cleared === false ? (
                            <Circle size={11} style={{ color: 'var(--color-warning)' }} />
                          ) : (
                            <CheckCircle2 size={11} style={{ color: 'var(--color-positive)' }} />
                          )}
                          {formatDate(t.date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {t.payee}
                          {(t.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </span>
                        {t.notes && (
                          <div className="text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {t.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                        {t.type === 'transfer' ? (
                          <span className="flex items-center gap-1">
                            <ArrowLeftRight size={12} /> Transfer
                          </span>
                        ) : splitCats.length > 0 ? (
                          <span className="flex items-center gap-1.5">
                            <Badge tone="accent">split</Badge>
                            <span className="truncate">{splitCats.map((c) => c!.name).join(', ')}</span>
                          </span>
                        ) : cat ? (
                          `${cat.icon} ${cat.name}`
                        ) : (
                          <span style={{ color: 'var(--color-text-subtle)' }}>Uncategorized</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                        {acct?.name ?? '—'}
                        {toAcct && ` → ${toAcct.name}`}
                      </td>
                      <td
                        className="px-4 py-3 text-right font-semibold whitespace-nowrap tnum"
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibleCount < filtered.length && (
            <div className="p-3 flex justify-center border-t" style={{ borderColor: 'var(--color-border)' }}>
              <Button variant="secondary" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
              </Button>
            </div>
          )}
        </div>
      )}

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
