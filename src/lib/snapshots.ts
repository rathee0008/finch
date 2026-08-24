import type { FinanceState } from '../types';

/**
 * Rolling local snapshots.
 *
 * The live state lives under a single key, so one bad action — a wipe, a
 * botched import, a stray console command — used to be unrecoverable. Every
 * meaningful change now also lands here, in a separate key, with a bounded
 * history the user can restore from.
 */
const SNAPSHOT_KEY = 'finance-app-snapshots-v1';
const MAX_SNAPSHOTS = 15;

export type SnapshotReason =
  | 'auto'
  | 'before-wipe'
  | 'before-sample-reset'
  | 'before-import'
  | 'before-restore';

export interface Snapshot {
  id: string;
  takenAt: string; // ISO timestamp
  reason: SnapshotReason;
  accounts: number;
  transactions: number;
  netWorth: number;
  payload: string; // serialized FinanceState
}

export interface SnapshotMeta extends Omit<Snapshot, 'payload'> {}

function read(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Snapshot[]) : [];
  } catch {
    return [];
  }
}

function write(list: Snapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list));
  } catch {
    // Quota exceeded or storage unavailable. Drop the oldest half and retry
    // once rather than losing snapshotting entirely.
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list.slice(0, Math.ceil(list.length / 2))));
    } catch {
      /* give up quietly — snapshots are best-effort, never load-bearing */
    }
  }
}

/** Metadata for every stored snapshot, newest first. */
export function listSnapshots(): SnapshotMeta[] {
  return read()
    .map(({ payload: _payload, ...meta }) => meta)
    .sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
}

/**
 * Records a snapshot unless it is byte-identical to the most recent one.
 * Returns true when something was actually stored.
 */
export function pushSnapshot(state: FinanceState, reason: SnapshotReason = 'auto'): boolean {
  // Never let routine autosaves of an empty state accumulate: they carry
  // nothing worth restoring, and in a bounded history they would gradually
  // evict the pre-wipe snapshot that does. Explicit reasons still record.
  const isEmpty = state.accounts.length === 0 && state.transactions.length === 0;
  if (reason === 'auto' && isEmpty) return false;

  const payload = JSON.stringify(state);
  const existing = read();

  // Deduping only applies to routine autosaves. A snapshot taken before a
  // destructive action must always appear, even when an autosave already holds
  // identical bytes — it is the entry the user will look for afterwards.
  if (reason === 'auto') {
    const newest = existing.reduce<Snapshot | null>(
      (acc, s) => (acc === null || s.takenAt > acc.takenAt ? s : acc),
      null
    );
    if (newest && newest.payload === payload) return false;
  }

  const snapshot: Snapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    takenAt: new Date().toISOString(),
    reason,
    accounts: state.accounts.length,
    transactions: state.transactions.length,
    netWorth: state.accounts.reduce((sum, a) => sum + a.balance, 0),
    payload,
  };

  const next = [snapshot, ...existing]
    .sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1))
    .slice(0, MAX_SNAPSHOTS);

  write(next);
  return true;
}

export function getSnapshotState(id: string): FinanceState | null {
  const found = read().find((s) => s.id === id);
  if (!found) return null;
  try {
    return JSON.parse(found.payload) as FinanceState;
  } catch {
    return null;
  }
}

export function deleteSnapshot(id: string): void {
  write(read().filter((s) => s.id !== id));
}

export function snapshotCount(): number {
  return read().length;
}

export const REASON_LABELS: Record<SnapshotReason, string> = {
  auto: 'Autosave',
  'before-wipe': 'Before delete all',
  'before-sample-reset': 'Before sample reset',
  'before-import': 'Before import',
  'before-restore': 'Before restore',
};
