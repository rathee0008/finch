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
  {
    name: 'Saurabh HDFC',
    type: 'savings',
    balance: 12615,
    institution: 'HDFC Bank',
    color: '#4f46e5',
  },
  {
    // Current value of 26 HDFC Bank + 50 ITC shares, per the Groww app.
    name: 'Groww Stocks',
    type: 'investment',
    balance: 32439.0,
    institution: 'Groww',
    color: '#0891b2',
  },
  {
    // Current value of all 6 SIP/mutual fund holdings (only 3 were visible
    // in the screenshot, but the ₹34,599 total already covers all 6).
    name: 'Groww Mutual Funds',
    type: 'investment',
    balance: 34599.0,
    institution: 'Groww',
    color: '#2563eb',
  },
  {
    // Current value of the fractional US stock portfolio (Alphabet, TSM, etc).
    name: 'US Stocks',
    type: 'investment',
    balance: 84252.93,
    color: '#f59e0b',
  },
];

// --- Real transactions (none yet) ---------------------------------------
const TRANSACTIONS = [];

// --- Recurring bills / income ---------------------------------------------
// `day` = day-of-month; the script computes the next occurrence from today.
const RECURRING = [
  {
    name: 'Home Loan EMI',
    account: 'Papa HDFC',
    category: 'Home Loan EMI',
    type: 'expense',
    amount: 13500,
    freq: 'monthly',
    day: 7,
  },
  {
    name: 'Home Loan EMI',
    account: 'Papa HDFC',
    category: 'Home Loan EMI',
    type: 'expense',
    amount: 17500,
    freq: 'monthly',
    day: 22,
  },
];

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
  { name: 'Home Loan EMI', icon: '🏡', color: '#a21caf', type: 'expense' },
  { name: 'Other', icon: '🧾', color: '#6b7280', type: 'expense' },
];

// Local Y-M-D formatting — mirrors src/lib/format.ts's toLocalISODate.
// Never route day-of-month math through toISOString(): that converts to UTC
// and silently shifts the date for timezones ahead of UTC.
function pad2(n) {
  return String(n).padStart(2, '0');
}
function toLocalISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Next calendar date (today or later) that falls on the given day-of-month. */
function nextOccurrence(day) {
  const today = new Date();
  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return toLocalISODate(candidate);
}

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

const recurring = RECURRING.map((r) => ({
  id: randomUUID(),
  name: r.name,
  accountId: accountByName.get(r.account.toLowerCase()),
  categoryId: r.category ? categoryByName.get(r.category.toLowerCase()) : undefined,
  type: r.type,
  amount: r.amount,
  payee: r.payee ?? r.name,
  freq: r.freq,
  nextDate: nextOccurrence(r.day),
  active: true,
}));

const missingRecurring = recurring.filter((r) => !r.accountId);
if (missingRecurring.length) {
  throw new Error(`These recurring items reference an unknown account: ${JSON.stringify(missingRecurring)}`);
}

const state = {
  accounts,
  transactions,
  categories,
  budgets: [],
  recurring,
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
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: CURRENCY }).format(n);
console.log(`Wrote ${out}`);
console.log(`  ${accounts.length} account(s), ${transactions.length} transaction(s), ${categories.length} categories, ${recurring.length} recurring item(s)`);
console.log(`  net worth: ${fmt(total)}`);
for (const r of recurring) {
  console.log(`  recurring: ${r.name} ${fmt(r.amount)} ${r.freq}, next ${r.nextDate}`);
}
