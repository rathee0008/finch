import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type {
  FinanceState,
  Account,
  Transaction,
  Category,
  Budget,
  RecurringTransaction,
  Goal,
  Rule,
  Settings,
} from '../types';
import { loadState, saveState, emptyState, normalizeState } from '../lib/storage';
import { uid } from '../lib/id';
import { buildSampleState } from '../lib/sampleData';
import { toLocalISODate, addMonths, currentMonth } from '../lib/format';
import { applyRules } from '../lib/rules';
import { pushSnapshot, getSnapshotState, type SnapshotReason } from '../lib/snapshots';

const HISTORY_LIMIT = 60;

interface History {
  past: FinanceState[];
  present: FinanceState;
  future: FinanceState[];
}

interface FinanceContextValue {
  state: FinanceState;

  /** False when the most recent write to localStorage did not actually persist. */
  persistenceOk: boolean;

  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  addAccount: (a: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  addTransactionsBulk: (list: Omit<Transaction, 'id'>[]) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  deleteTransactions: (ids: string[]) => void;
  categorizeTransactions: (ids: string[], categoryId: string) => void;
  tagTransactions: (ids: string[], tag: string) => void;
  setCleared: (ids: string[], cleared: boolean) => void;

  addCategory: (c: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addBudget: (b: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, patch: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  copyBudgetsFromLastMonth: () => number;

  addRecurring: (r: Omit<RecurringTransaction, 'id'>) => void;
  updateRecurring: (id: string, patch: Partial<RecurringTransaction>) => void;
  deleteRecurring: (id: string) => void;
  postRecurring: (id: string) => void;
  postAllDue: () => number;

  addGoal: (g: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  addRule: (r: Omit<Rule, 'id'>) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  deleteRule: (id: string) => void;
  applyRulesToExisting: () => number;

  updateSettings: (patch: Partial<Settings>) => void;
  resetToSample: () => void;
  wipeAll: () => void;
  importState: (s: FinanceState) => void;
  restoreSnapshot: (id: string) => boolean;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function applyBalanceDelta(accounts: Account[], accountId: string, delta: number): Account[] {
  return accounts.map((a) => (a.id === accountId ? { ...a, balance: a.balance + delta } : a));
}

/** The balance effect a transaction has, applied in the given direction. */
function applyTxEffect(
  accounts: Account[],
  t: Pick<Transaction, 'type' | 'amount' | 'accountId' | 'toAccountId'>,
  direction: 1 | -1
): Account[] {
  const amount = t.amount * direction;
  if (t.type === 'income') return applyBalanceDelta(accounts, t.accountId, amount);
  if (t.type === 'expense') return applyBalanceDelta(accounts, t.accountId, -amount);
  if (t.type === 'transfer' && t.toAccountId) {
    let next = applyBalanceDelta(accounts, t.accountId, -amount);
    next = applyBalanceDelta(next, t.toAccountId, amount);
    return next;
  }
  return accounts;
}

function advanceDate(iso: string, freq: RecurringTransaction['freq']): string {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(y, m - 1, d);
  if (freq === 'daily') next.setDate(next.getDate() + 1);
  else if (freq === 'weekly') next.setDate(next.getDate() + 7);
  else if (freq === 'biweekly') next.setDate(next.getDate() + 14);
  else if (freq === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (freq === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return toLocalISODate(next);
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: loadState(),
    future: [],
  }));

  const state = history.present;

  // Tracks whether the *last* write to localStorage actually landed. Some
  // browser contexts — Safari Private Browsing chief among them — let
  // setItem throw or silently no-op while every in-memory update keeps
  // working, so the UI looks correct right up until the next reload wipes
  // it. This used to fail without a trace; now the app can say so.
  const [persistenceOk, setPersistenceOk] = useState(true);

  useEffect(() => {
    setPersistenceOk(saveState(state));
  }, [state]);

  // Snapshot on a trailing debounce so a burst of edits costs one entry, not
  // twenty, while a single change still gets recorded a few seconds later.
  useEffect(() => {
    const timer = window.setTimeout(() => pushSnapshot(state, 'auto'), 4000);
    return () => window.clearTimeout(timer);
  }, [state]);

  /**
   * Takes an immediate snapshot before an action that destroys data.
   * Deliberately not inside a setState updater — those are re-invoked under
   * StrictMode, which would record the snapshot twice.
   */
  const snapshotNow = useCallback(
    (reason: SnapshotReason) => {
      pushSnapshot(state, reason);
    },
    [state]
  );

  /** Applies a state change and records it on the undo stack. */
  const commit = useCallback((updater: (s: FinanceState) => FinanceState) => {
    setHistory((h) => {
      const next = updater(h.present);
      if (next === h.present) return h;
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  /** Settings changes shouldn't clutter the undo stack. */
  const commitQuiet = useCallback((updater: (s: FinanceState) => FinanceState) => {
    setHistory((h) => ({ ...h, present: updater(h.present) }));
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: h.future[0],
        future: h.future.slice(1),
      };
    });
  }, []);

  // --- Accounts -----------------------------------------------------------
  const addAccount = useCallback(
    (a: Omit<Account, 'id'>) => commit((s) => ({ ...s, accounts: [...s.accounts, { ...a, id: uid() }] })),
    [commit]
  );

  const updateAccount = useCallback(
    (id: string, patch: Partial<Account>) =>
      commit((s) => ({
        ...s,
        accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      })),
    [commit]
  );

  const deleteAccount = useCallback(
    (id: string) =>
      commit((s) => ({
        ...s,
        accounts: s.accounts.filter((a) => a.id !== id),
        transactions: s.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
      })),
    [commit]
  );

  // --- Transactions -------------------------------------------------------
  const addTransaction = useCallback(
    (t: Omit<Transaction, 'id'>) =>
      commit((s) => {
        const patch = applyRules(s.rules, t);
        const full = { ...t, ...patch, id: uid() };
        return {
          ...s,
          accounts: applyTxEffect(s.accounts, full, 1),
          transactions: [full, ...s.transactions],
        };
      }),
    [commit]
  );

  const addTransactionsBulk = useCallback(
    (list: Omit<Transaction, 'id'>[]) =>
      commit((s) => {
        let accounts = s.accounts;
        const created: Transaction[] = [];
        for (const t of list) {
          const patch = applyRules(s.rules, t);
          const full = { ...t, ...patch, id: uid() };
          accounts = applyTxEffect(accounts, full, 1);
          created.push(full);
        }
        return { ...s, accounts, transactions: [...created, ...s.transactions] };
      }),
    [commit]
  );

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Transaction>) =>
      commit((s) => {
        const old = s.transactions.find((t) => t.id === id);
        if (!old) return s;
        const updated = { ...old, ...patch };
        let accounts = applyTxEffect(s.accounts, old, -1);
        accounts = applyTxEffect(accounts, updated, 1);
        return {
          ...s,
          accounts,
          transactions: s.transactions.map((t) => (t.id === id ? updated : t)),
        };
      }),
    [commit]
  );

  const deleteTransaction = useCallback(
    (id: string) =>
      commit((s) => {
        const old = s.transactions.find((t) => t.id === id);
        if (!old) return s;
        return {
          ...s,
          accounts: applyTxEffect(s.accounts, old, -1),
          transactions: s.transactions.filter((t) => t.id !== id),
        };
      }),
    [commit]
  );

  const deleteTransactions = useCallback(
    (ids: string[]) =>
      commit((s) => {
        const idSet = new Set(ids);
        let accounts = s.accounts;
        for (const t of s.transactions) {
          if (idSet.has(t.id)) accounts = applyTxEffect(accounts, t, -1);
        }
        return { ...s, accounts, transactions: s.transactions.filter((t) => !idSet.has(t.id)) };
      }),
    [commit]
  );

  const categorizeTransactions = useCallback(
    (ids: string[], categoryId: string) =>
      commit((s) => {
        const idSet = new Set(ids);
        return {
          ...s,
          transactions: s.transactions.map((t) =>
            idSet.has(t.id) ? { ...t, categoryId, splits: undefined } : t
          ),
        };
      }),
    [commit]
  );

  const tagTransactions = useCallback(
    (ids: string[], tag: string) =>
      commit((s) => {
        const idSet = new Set(ids);
        return {
          ...s,
          transactions: s.transactions.map((t) =>
            idSet.has(t.id)
              ? { ...t, tags: Array.from(new Set([...(t.tags ?? []), tag])) }
              : t
          ),
        };
      }),
    [commit]
  );

  const setCleared = useCallback(
    (ids: string[], cleared: boolean) =>
      commit((s) => {
        const idSet = new Set(ids);
        return {
          ...s,
          transactions: s.transactions.map((t) => (idSet.has(t.id) ? { ...t, cleared } : t)),
        };
      }),
    [commit]
  );

  // --- Categories ---------------------------------------------------------
  const addCategory = useCallback(
    (c: Omit<Category, 'id'>) =>
      commit((s) => ({ ...s, categories: [...s.categories, { ...c, id: uid() }] })),
    [commit]
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Category>) =>
      commit((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    [commit]
  );

  const deleteCategory = useCallback(
    (id: string) =>
      commit((s) => ({
        ...s,
        categories: s.categories.filter((c) => c.id !== id),
        budgets: s.budgets.filter((b) => b.categoryId !== id),
        transactions: s.transactions.map((t) =>
          t.categoryId === id ? { ...t, categoryId: undefined } : t
        ),
      })),
    [commit]
  );

  // --- Budgets ------------------------------------------------------------
  const addBudget = useCallback(
    (b: Omit<Budget, 'id'>) => commit((s) => ({ ...s, budgets: [...s.budgets, { ...b, id: uid() }] })),
    [commit]
  );

  const updateBudget = useCallback(
    (id: string, patch: Partial<Budget>) =>
      commit((s) => ({ ...s, budgets: s.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
    [commit]
  );

  const deleteBudget = useCallback(
    (id: string) => commit((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) })),
    [commit]
  );

  const copyBudgetsFromLastMonth = useCallback((): number => {
    const cur = currentMonth();
    const prev = addMonths(cur, -1);
    const source = state.budgets.filter((b) => b.month === prev);
    const existing = new Set(
      state.budgets.filter((b) => b.month === cur).map((b) => b.categoryId)
    );
    const toAdd = source.filter((b) => !existing.has(b.categoryId));
    if (toAdd.length === 0) return 0;
    commit((s) => ({
      ...s,
      budgets: [...s.budgets, ...toAdd.map((b) => ({ ...b, id: uid(), month: cur }))],
    }));
    return toAdd.length;
  }, [commit, state.budgets]);

  // --- Recurring ----------------------------------------------------------
  const addRecurring = useCallback(
    (r: Omit<RecurringTransaction, 'id'>) =>
      commit((s) => ({ ...s, recurring: [...s.recurring, { ...r, id: uid() }] })),
    [commit]
  );

  const updateRecurring = useCallback(
    (id: string, patch: Partial<RecurringTransaction>) =>
      commit((s) => ({
        ...s,
        recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),
    [commit]
  );

  const deleteRecurring = useCallback(
    (id: string) => commit((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== id) })),
    [commit]
  );

  const postOne = (s: FinanceState, r: RecurringTransaction): FinanceState => {
    const newTx: Transaction = {
      id: uid(),
      date: r.nextDate,
      accountId: r.accountId,
      categoryId: r.categoryId,
      type: r.type,
      amount: r.amount,
      payee: r.payee,
      notes: `Recurring: ${r.name}`,
      cleared: true,
    };
    return {
      ...s,
      accounts: applyTxEffect(s.accounts, newTx, 1),
      transactions: [newTx, ...s.transactions],
      recurring: s.recurring.map((x) =>
        x.id === r.id ? { ...x, nextDate: advanceDate(x.nextDate, x.freq) } : x
      ),
    };
  };

  const postRecurring = useCallback(
    (id: string) =>
      commit((s) => {
        const r = s.recurring.find((x) => x.id === id);
        return r ? postOne(s, r) : s;
      }),
    [commit]
  );

  const postAllDue = useCallback((): number => {
    const today = toLocalISODate(new Date());
    const due = state.recurring.filter((r) => r.active && r.nextDate <= today);
    if (due.length === 0) return 0;
    commit((s) => {
      let next = s;
      for (const r of due) {
        const current = next.recurring.find((x) => x.id === r.id);
        if (current) next = postOne(next, current);
      }
      return next;
    });
    return due.length;
  }, [commit, state.recurring]);

  // --- Goals --------------------------------------------------------------
  const addGoal = useCallback(
    (g: Omit<Goal, 'id'>) => commit((s) => ({ ...s, goals: [...s.goals, { ...g, id: uid() }] })),
    [commit]
  );

  const updateGoal = useCallback(
    (id: string, patch: Partial<Goal>) =>
      commit((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
    [commit]
  );

  const deleteGoal = useCallback(
    (id: string) => commit((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),
    [commit]
  );

  // --- Rules --------------------------------------------------------------
  const addRule = useCallback(
    (r: Omit<Rule, 'id'>) => commit((s) => ({ ...s, rules: [...s.rules, { ...r, id: uid() }] })),
    [commit]
  );

  const updateRule = useCallback(
    (id: string, patch: Partial<Rule>) =>
      commit((s) => ({ ...s, rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
    [commit]
  );

  const deleteRule = useCallback(
    (id: string) => commit((s) => ({ ...s, rules: s.rules.filter((r) => r.id !== id) })),
    [commit]
  );

  const applyRulesToExisting = useCallback((): number => {
    let changed = 0;
    commit((s) => {
      const transactions = s.transactions.map((t) => {
        if (t.type === 'transfer') return t;
        const patch = applyRules(s.rules, t);
        if (Object.keys(patch).length === 0) return t;
        changed++;
        return { ...t, ...patch };
      });
      return changed > 0 ? { ...s, transactions } : s;
    });
    return changed;
  }, [commit]);

  // --- Settings & data ----------------------------------------------------
  const updateSettings = useCallback(
    (patch: Partial<Settings>) =>
      commitQuiet((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    [commitQuiet]
  );

  const resetToSample = useCallback(() => {
    snapshotNow('before-sample-reset');
    commit(() => buildSampleState());
  }, [commit, snapshotNow]);

  const wipeAll = useCallback(() => {
    snapshotNow('before-wipe');
    commit(() => emptyState());
  }, [commit, snapshotNow]);

  const importState = useCallback(
    (s: FinanceState) => {
      snapshotNow('before-import');
      commit(() => normalizeState(s));
    },
    [commit, snapshotNow]
  );

  const restoreSnapshot = useCallback(
    (id: string): boolean => {
      const restored = getSnapshotState(id);
      if (!restored) return false;
      // Snapshot the current state too, so restoring is itself reversible.
      snapshotNow('before-restore');
      commit(() => normalizeState(restored));
      return true;
    },
    [commit, snapshotNow]
  );

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      persistenceOk,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      undo,
      redo,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      addTransactionsBulk,
      updateTransaction,
      deleteTransaction,
      deleteTransactions,
      categorizeTransactions,
      tagTransactions,
      setCleared,
      addCategory,
      updateCategory,
      deleteCategory,
      addBudget,
      updateBudget,
      deleteBudget,
      copyBudgetsFromLastMonth,
      addRecurring,
      updateRecurring,
      deleteRecurring,
      postRecurring,
      postAllDue,
      addGoal,
      updateGoal,
      deleteGoal,
      addRule,
      updateRule,
      deleteRule,
      applyRulesToExisting,
      updateSettings,
      resetToSample,
      wipeAll,
      importState,
      restoreSnapshot,
    }),
    [
      state,
      persistenceOk,
      history.past.length,
      history.future.length,
      undo,
      redo,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      addTransactionsBulk,
      updateTransaction,
      deleteTransaction,
      deleteTransactions,
      categorizeTransactions,
      tagTransactions,
      setCleared,
      addCategory,
      updateCategory,
      deleteCategory,
      addBudget,
      updateBudget,
      deleteBudget,
      copyBudgetsFromLastMonth,
      addRecurring,
      updateRecurring,
      deleteRecurring,
      postRecurring,
      postAllDue,
      addGoal,
      updateGoal,
      deleteGoal,
      addRule,
      updateRule,
      deleteRule,
      applyRulesToExisting,
      updateSettings,
      resetToSample,
      wipeAll,
      importState,
      restoreSnapshot,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
