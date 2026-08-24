import type { Transaction, Account, Category, TransactionType } from '../types';
import { categoryAmounts } from './calculations';

export function transactionsToCSV(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[]
): string {
  const header = ['Date', 'Account', 'Type', 'Category', 'Payee', 'Amount', 'Tags', 'Notes', 'Cleared'];
  const rows = transactions.map((t) => {
    const account = accounts.find((a) => a.id === t.accountId)?.name ?? '';
    const parts = categoryAmounts(t);
    const categoryLabel =
      t.splits && t.splits.length
        ? parts
            .map((p) => categories.find((c) => c.id === p.categoryId)?.name ?? '?')
            .join(' + ')
        : categories.find((c) => c.id === t.categoryId)?.name ?? '';
    return [
      t.date,
      account,
      t.type,
      categoryLabel,
      t.payee,
      t.amount.toFixed(2),
      (t.tags ?? []).join(' '),
      t.notes ?? '',
      t.cleared ? 'yes' : 'no',
    ];
  });
  return [header, ...rows]
    .map((row) =>
      row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')
    )
    .join('\n');
}

export type SaveOutcome = 'saved' | 'declined' | 'failed';

interface DownloadsNamespace {
  save(request: { filename: string; data: string }): Promise<{ status: string }>;
}

/** The claude.ai artifact host exposes capabilities behind `claude.use(name)`. */
async function getHostDownloads(): Promise<DownloadsNamespace | null> {
  const host = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!host?.use) return null;
  try {
    return ((await host.use('downloads')) as DownloadsNamespace | null) ?? null;
  } catch {
    return null;
  }
}

function errorCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : 'unknown';
}

/**
 * Hands a generated file to the user.
 *
 * In a normal browser this is an anchor download. Inside a claude.ai artifact
 * the viewer sandbox makes anchor downloads inert, so route through the host's
 * `downloads` capability instead, which shows the viewer a confirmation.
 */
export async function downloadFile(
  content: string,
  filename: string,
  mime: string
): Promise<SaveOutcome> {
  const downloads = await getHostDownloads();

  if (downloads) {
    try {
      await downloads.save({ filename, data: content });
      return 'saved';
    } catch (err) {
      const code = errorCode(err);
      if (code === 'declined') return 'declined';
      // `.csv` sits in the host's extended extension set and isn't always
      // enabled. The bytes are plain text either way, so retry as `.txt`.
      if (code === 'extension_not_enabled' && filename.endsWith('.csv')) {
        try {
          await downloads.save({ filename: filename.replace(/\.csv$/, '.txt'), data: content });
          return 'saved';
        } catch (retryErr) {
          return errorCode(retryErr) === 'declined' ? 'declined' : 'failed';
        }
      }
      return 'failed';
    }
  }

  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return 'saved';
  } catch {
    return 'failed';
  }
}

export function downloadCSV(csv: string, filename: string): Promise<SaveOutcome> {
  return downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

export function exportFullBackup(data: unknown): Promise<SaveOutcome> {
  return downloadFile(
    JSON.stringify(data, null, 2),
    `finance-backup-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json'
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        result.push(cur);
        cur = '';
      } else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** Header aliases seen across common bank and app exports. */
const FIELD_ALIASES: Record<string, string[]> = {
  date: ['date', 'transaction date', 'posted date', 'post date', 'date posted'],
  payee: ['payee', 'description', 'name', 'merchant', 'details', 'memo/payee', 'transaction'],
  amount: ['amount', 'value'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'money out', 'paid out'],
  credit: ['credit', 'deposit', 'deposits', 'money in', 'paid in'],
  category: ['category', 'categories'],
  account: ['account', 'account name'],
  type: ['type', 'transaction type'],
  notes: ['notes', 'note', 'memo', 'comment'],
  tags: ['tags', 'labels'],
};

function findColumn(header: string[], field: keyof typeof FIELD_ALIASES): number {
  const aliases = FIELD_ALIASES[field];
  return header.findIndex((h) => aliases.includes(h));
}

/** Handles 1,234.56 / (45.00) / $12.00 / -12.00 */
function parseAmount(raw: string): number {
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw.trim()) || raw.includes('-');
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return negative ? -value : value;
}

/** Normalizes M/D/YYYY, D-M-YYYY and YYYY-MM-DD into YYYY-MM-DD. */
function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  const parts = trimmed.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length === 3) {
    let [a, b, c] = parts;
    if (c.length === 2) c = `20${c}`;
    // Ambiguous D/M vs M/D: treat >12 in the first slot as a day.
    const first = parseInt(a, 10);
    const second = parseInt(b, 10);
    if (Number.isNaN(first) || Number.isNaN(second)) return null;
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${c}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
      parsed.getDate()
    ).padStart(2, '0')}`;
  }
  return null;
}

export interface ParsedCSVRow {
  date: string;
  accountName: string;
  type: TransactionType;
  categoryName: string;
  payee: string;
  amount: number;
  notes: string;
  tags: string[];
}

export interface CSVParseResult {
  rows: ParsedCSVRow[];
  skipped: number;
  detectedColumns: string[];
}

/**
 * Parses a transaction CSV, auto-detecting the column layout. Supports both
 * single signed-amount columns and separate debit/credit columns.
 */
export function parseTransactionsCSV(text: string): CSVParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0, detectedColumns: [] };

  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));

  const idxDate = findColumn(header, 'date');
  const idxPayee = findColumn(header, 'payee');
  const idxAmount = findColumn(header, 'amount');
  const idxDebit = findColumn(header, 'debit');
  const idxCredit = findColumn(header, 'credit');
  const idxCategory = findColumn(header, 'category');
  const idxAccount = findColumn(header, 'account');
  const idxType = findColumn(header, 'type');
  const idxNotes = findColumn(header, 'notes');
  const idxTags = findColumn(header, 'tags');

  const detectedColumns = [
    idxDate >= 0 && `date → "${header[idxDate]}"`,
    idxPayee >= 0 && `payee → "${header[idxPayee]}"`,
    idxAmount >= 0 && `amount → "${header[idxAmount]}"`,
    idxDebit >= 0 && `debit → "${header[idxDebit]}"`,
    idxCredit >= 0 && `credit → "${header[idxCredit]}"`,
    idxCategory >= 0 && `category → "${header[idxCategory]}"`,
  ].filter(Boolean) as string[];

  const rows: ParsedCSVRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const at = (idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '');

    const date = normalizeDate(at(idxDate));
    if (!date) {
      skipped++;
      continue;
    }

    // Signed single column, or separate debit/credit columns.
    let signed = 0;
    if (idxAmount >= 0 && at(idxAmount)) {
      signed = parseAmount(at(idxAmount));
    } else {
      const debit = parseAmount(at(idxDebit));
      const credit = parseAmount(at(idxCredit));
      signed = credit ? Math.abs(credit) : -Math.abs(debit);
    }

    if (!signed) {
      skipped++;
      continue;
    }

    const explicitType = at(idxType).toLowerCase();
    const type: TransactionType =
      explicitType === 'income' || explicitType === 'expense' || explicitType === 'transfer'
        ? (explicitType as TransactionType)
        : signed > 0
        ? 'income'
        : 'expense';

    rows.push({
      date,
      accountName: at(idxAccount),
      type,
      categoryName: at(idxCategory),
      payee: at(idxPayee) || 'Imported transaction',
      amount: Math.abs(signed),
      notes: at(idxNotes),
      tags: at(idxTags) ? at(idxTags).split(/[\s,;]+/).filter(Boolean) : [],
    });
  }

  return { rows, skipped, detectedColumns };
}
