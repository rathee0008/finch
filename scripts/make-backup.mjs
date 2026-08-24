/**
 * Generates a Finch backup file from a plain spec, so real data can be handed
 * over as a single "Restore backup" instead of being typed in screen by screen.
 *
 * Edit ACCOUNTS / TRANSACTIONS below and re-run: node scripts/make-backup.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CURRENCY = 'INR';

// --- Real accounts -------------------------------------------------------
const ACCOUNTS = [
  {
    name: 'Papa HDFC',
    type: 'savings',
    balance: 1000000,
    institution: 'HDFC Bank',
    color: '#059669',
  },
];

// --- Real transactions (none yet) ---------------------------------------
const TRANSACTIONS = [];

// A practical starting category set. These are just defaults — rename, recolor
// or delete any of them in the app.
const CATEGORIES = [
  { name: 'Salary', icon: '💼', color: '#059669', type: 'income' },
  { name: 'Freelance', icon: '🧑‍💻', color: '#0891b2', type: 'income' },
  { name: 'Interest', icon: '🏦', color: '#65a30d', type: 'income' },
  { name: 'Other Income', icon: '➕', color: '#16a34a', type: 'income' },
  { name: 'Groceries', icon: '🛒', color: '#16a34a', type: 'expense' },
  { name: 'Rent', icon: '🏠', color: '#7c3aed', type: 'expense' },
  { name: 'Utilities', icon: '💡', color: '#ca8a04', type: 'expense' },
  { name: 'Dining Out', icon: '🍽️', color: '#ea580c', type: 'expense' },
  { name: 'Transport', icon: '🚗', color: '#0284c7', type: 'expense' },
  { name: 'Fuel', icon: '⛽', color: '#dc2626', type: 'expense' },
  { name: 'Health', icon: '💊', color: '#e11d48', type: 'expense' },
  { name: 'Shopping', icon: '🛍️', color: '#9333ea', type: 'expense' },
  { name: 'Entertainment', icon: '🎬', color: '#db2777', type: 'expense' },
  { name: 'Subscriptions', icon: '📱', color: '#4338ca', type: 'expense' },
  { name: 'Education', icon: '🎓', color: '#0d9488', type: 'expense' },
  { name: 'Family', icon: '👪', color: '#f59e0b', type: 'expense' },
  { name: 'Investments', icon: '📈', color: '#2563eb', type: 'expense' },
  { name: 'Other', icon: '🧾', color: '#6b7280', type: 'expense' },
];

const categories = CATEGORIES.map((c) => ({ ...c, id: randomUUID() }));
const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

const accounts = ACCOUNTS.map((a) => ({
  id: randomUUID(),
  name: a.name,
  type: a.type,
  balance: a.balance,
  currency: CURRENCY,
  color: a.color,
  ...(a.institution ? { institution: a.institution } : {}),
  ...(a.apr != null ? { apr: a.apr } : {}),
  ...(a.minPayment != null ? { minPayment: a.minPayment } : {}),
}));
const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a.id]));

const transactions = TRANSACTIONS.map((t) => ({
  id: randomUUID(),
  date: t.date,
  accountId: accountByName.get(t.account.toLowerCase()),
  categoryId: t.category ? categoryByName.get(t.category.toLowerCase()) : undefined,
  type: t.type,
  amount: t.amount,
  payee: t.payee,
  cleared: true,
  ...(t.notes ? { notes: t.notes } : {}),
}));

const missing = transactions.filter((t) => !t.accountId);
if (missing.length) {
  throw new Error(`These transactions reference an unknown account: ${JSON.stringify(missing)}`);
}

const state = {
  accounts,
  transactions,
  categories,
  budgets: [],
  recurring: [],
  goals: [],
  rules: [],
  settings: {
    currency: CURRENCY,
    theme: 'system',
    monthStartDay: 1,
    accent: '#4f46e5',
    density: 'comfortable',
    forecastDays: 90,
  },
};

mkdirSync(join(root, 'artifact'), { recursive: true });
const out = join(root, 'artifact', 'finch-my-data.json');
writeFileSync(out, JSON.stringify(state, null, 2), 'utf8');

const total = accounts.reduce((s, a) => s + a.balance, 0);
console.log(`Wrote ${out}`);
console.log(`  ${accounts.length} account(s), ${transactions.length} transaction(s), ${categories.length} categories`);
console.log(`  net worth: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: CURRENCY }).format(total)}`);
