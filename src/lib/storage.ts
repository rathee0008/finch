import type { FinanceState } from '../types';
import { buildSampleState } from './sampleData';
import { DEFAULT_SETTINGS } from './defaults';

const STORAGE_KEY = 'finance-app-state-v1';

export { DEFAULT_SETTINGS };

/**
 * Fills in fields added after a save was written, so data saved by an older
 * version of the app keeps working instead of crashing on missing arrays.
 */
export function normalizeState(raw: Partial<FinanceState>): FinanceState {
  return {
    accounts: raw.accounts ?? [],
    transactions: raw.transactions ?? [],
    categories: raw.categories ?? [],
    budgets: raw.budgets ?? [],
    recurring: raw.recurring ?? [],
    goals: raw.goals ?? [],
    rules: raw.rules ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
  };
}

export function loadState(): FinanceState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return buildSampleState();
    const parsed = JSON.parse(stored) as Partial<FinanceState>;
    if (!parsed.accounts || !parsed.transactions) return buildSampleState();
    return normalizeState(parsed);
  } catch {
    return buildSampleState();
  }
}

export function saveState(state: FinanceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable; the app keeps working in memory
  }
}

export function emptyState(): FinanceState {
  return {
    accounts: [],
    transactions: [],
    categories: [],
    budgets: [],
    recurring: [],
    goals: [],
    rules: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
