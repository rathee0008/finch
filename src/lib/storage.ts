import type { FinanceState } from '../types';
import { buildSampleState } from './sampleData';
import { DEFAULT_SETTINGS } from './defaults';

const STORAGE_KEY = 'finance-app-state-v1';
const PROBE_KEY = 'finance-app-storage-probe';

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

/**
 * Writes state to localStorage and reports whether it actually landed.
 *
 * Some browser contexts — Safari Private Browsing chief among them — let
 * `setItem` throw (or silently no-op) while every in-memory React update
 * keeps working, so the UI looks correct until the next reload wipes it.
 * That used to fail silently here; callers now get a real answer so they
 * can warn the user instead of losing data without a trace.
 */
export function saveState(state: FinanceState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Round-trips a small probe value through localStorage. Catches every variant
 * of "storage looks present but doesn't actually persist" — quota errors,
 * Private Browsing throwing on write, and the rarer case where a write
 * succeeds but silently reads back as something else.
 */
export function checkStoragePersistence(): boolean {
  const probeValue = String(Date.now());
  try {
    localStorage.setItem(PROBE_KEY, probeValue);
    const readBack = localStorage.getItem(PROBE_KEY);
    localStorage.removeItem(PROBE_KEY);
    return readBack === probeValue;
  } catch {
    return false;
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
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if storage was never writable */
  }
}
