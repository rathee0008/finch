import { uid } from './id';
import type { FinanceState, Transaction } from '../types';
import { toLocalISODate, toLocalYM } from './format';
import { DEFAULT_SETTINGS } from './defaults';

const today = new Date();

function daysAgo(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return toLocalISODate(d);
}
function inDays(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}
const thisMonth = toLocalYM(today);

export function buildSampleState(): FinanceState {
  const checking = uid();
  const savings = uid();
  const credit = uid();
  const investment = uid();
  const carLoan = uid();

  const catSalary = uid();
  const catFreelance = uid();
  const catOtherIncome = uid();
  const catGroceries = uid();
  const catRent = uid();
  const catDining = uid();
  const catTransport = uid();
  const catUtilities = uid();
  const catEntertainment = uid();
  const catHealth = uid();
  const catShopping = uid();
  const catSubscriptions = uid();

  const accounts = [
    { id: checking, name: 'Everyday Checking', type: 'checking' as const, balance: 4250.32, currency: 'USD', color: '#4f46e5', institution: 'First National' },
    { id: savings, name: 'Emergency Savings', type: 'savings' as const, balance: 12800, currency: 'USD', color: '#059669', institution: 'First National' },
    { id: credit, name: 'Rewards Credit Card', type: 'credit' as const, balance: -2862.14, currency: 'USD', color: '#dc2626', apr: 22.99, minPayment: 75, institution: 'Chase' },
    { id: investment, name: 'Brokerage', type: 'investment' as const, balance: 21430.5, currency: 'USD', color: '#d97706', institution: 'Vanguard' },
    { id: carLoan, name: 'Car Loan', type: 'loan' as const, balance: -8400, currency: 'USD', color: '#7c3aed', apr: 6.4, minPayment: 320, institution: 'Auto Credit' },
  ];

  const categories = [
    { id: catSalary, name: 'Salary', icon: '💼', color: '#059669', type: 'income' as const },
    { id: catFreelance, name: 'Freelance', icon: '🧑‍💻', color: '#0891b2', type: 'income' as const },
    { id: catOtherIncome, name: 'Other Income', icon: '➕', color: '#65a30d', type: 'income' as const },
    { id: catGroceries, name: 'Groceries', icon: '🛒', color: '#16a34a', type: 'expense' as const },
    { id: catRent, name: 'Rent', icon: '🏠', color: '#7c3aed', type: 'expense' as const },
    { id: catDining, name: 'Dining Out', icon: '🍽️', color: '#ea580c', type: 'expense' as const },
    { id: catTransport, name: 'Transport', icon: '🚗', color: '#0284c7', type: 'expense' as const },
    { id: catUtilities, name: 'Utilities', icon: '💡', color: '#ca8a04', type: 'expense' as const },
    { id: catEntertainment, name: 'Entertainment', icon: '🎬', color: '#db2777', type: 'expense' as const },
    { id: catHealth, name: 'Health', icon: '💊', color: '#dc2626', type: 'expense' as const },
    { id: catShopping, name: 'Shopping', icon: '🛍️', color: '#9333ea', type: 'expense' as const },
    { id: catSubscriptions, name: 'Subscriptions', icon: '📱', color: '#4338ca', type: 'expense' as const },
  ];

  const transactions: Transaction[] = [
    { id: uid(), date: daysAgo(1), accountId: checking, categoryId: catGroceries, type: 'expense', amount: 84.23, payee: 'Whole Foods', cleared: true, tags: ['essentials'] },
    { id: uid(), date: daysAgo(2), accountId: credit, categoryId: catDining, type: 'expense', amount: 42.5, payee: 'Local Bistro', cleared: true },
    { id: uid(), date: daysAgo(2), accountId: credit, type: 'expense', amount: 213.4, payee: 'Costco', cleared: true, notes: 'Monthly stock-up',
      splits: [
        { id: uid(), categoryId: catGroceries, amount: 150.4 },
        { id: uid(), categoryId: catHealth, amount: 38 },
        { id: uid(), categoryId: catShopping, amount: 25 },
      ] },
    { id: uid(), date: daysAgo(3), accountId: checking, categoryId: catTransport, type: 'expense', amount: 35, payee: 'Shell Gas Station', cleared: true },
    { id: uid(), date: daysAgo(4), accountId: checking, categoryId: catUtilities, type: 'expense', amount: 128.4, payee: 'Pacific Power', cleared: true },
    { id: uid(), date: daysAgo(5), accountId: checking, categoryId: catSalary, type: 'income', amount: 3200, payee: 'Acme Corp Payroll', cleared: true },
    { id: uid(), date: daysAgo(6), accountId: credit, categoryId: catShopping, type: 'expense', amount: 96.75, payee: 'Amazon', cleared: true },
    { id: uid(), date: daysAgo(7), accountId: checking, categoryId: catRent, type: 'expense', amount: 1450, payee: 'Sunset Apartments', cleared: true, tags: ['fixed'] },
    { id: uid(), date: daysAgo(8), accountId: checking, categoryId: catEntertainment, type: 'expense', amount: 28, payee: 'Cinema City', cleared: true },
    { id: uid(), date: daysAgo(9), accountId: checking, categoryId: catFreelance, type: 'income', amount: 650, payee: 'Design Client', cleared: true },
    { id: uid(), date: daysAgo(10), accountId: credit, categoryId: catSubscriptions, type: 'expense', amount: 15.99, payee: 'Streamly', cleared: true, tags: ['subscription'] },
    { id: uid(), date: daysAgo(11), accountId: checking, categoryId: catHealth, type: 'expense', amount: 60, payee: 'City Pharmacy', cleared: false },
    { id: uid(), date: daysAgo(12), accountId: checking, categoryId: catGroceries, type: 'expense', amount: 71.1, payee: 'Trader Joes', cleared: true },
    { id: uid(), date: daysAgo(14), accountId: checking, categoryId: catTransport, type: 'expense', amount: 18.5, payee: 'Metro Transit', cleared: true },
    { id: uid(), date: daysAgo(16), accountId: checking, type: 'transfer', amount: 500, payee: 'Transfer to Savings', toAccountId: savings, cleared: true },
    { id: uid(), date: daysAgo(20), accountId: checking, categoryId: catDining, type: 'expense', amount: 54.3, payee: 'Sushi House', cleared: true },
    { id: uid(), date: daysAgo(22), accountId: checking, categoryId: catShopping, type: 'expense', amount: 140, payee: 'Target', cleared: true },
    { id: uid(), date: daysAgo(24), accountId: credit, categoryId: catSubscriptions, type: 'expense', amount: 12.99, payee: 'CloudTunes', cleared: true, tags: ['subscription'] },

    // Previous month
    { id: uid(), date: daysAgo(28), accountId: checking, categoryId: catSalary, type: 'income', amount: 3200, payee: 'Acme Corp Payroll', cleared: true },
    { id: uid(), date: daysAgo(33), accountId: checking, categoryId: catRent, type: 'expense', amount: 1450, payee: 'Sunset Apartments', cleared: true, tags: ['fixed'] },
    { id: uid(), date: daysAgo(35), accountId: checking, categoryId: catUtilities, type: 'expense', amount: 110, payee: 'Pacific Power', cleared: true },
    { id: uid(), date: daysAgo(38), accountId: credit, categoryId: catSubscriptions, type: 'expense', amount: 15.99, payee: 'Streamly', cleared: true, tags: ['subscription'] },
    { id: uid(), date: daysAgo(40), accountId: checking, categoryId: catGroceries, type: 'expense', amount: 92.4, payee: 'Whole Foods', cleared: true },
    { id: uid(), date: daysAgo(41), accountId: checking, categoryId: catDining, type: 'expense', amount: 66.2, payee: 'Local Bistro', cleared: true },
    { id: uid(), date: daysAgo(43), accountId: checking, categoryId: catTransport, type: 'expense', amount: 42, payee: 'Shell Gas Station', cleared: true },

    // Two months back
    { id: uid(), date: daysAgo(45), accountId: checking, categoryId: catSalary, type: 'income', amount: 3200, payee: 'Acme Corp Payroll', cleared: true },
    { id: uid(), date: daysAgo(50), accountId: checking, categoryId: catEntertainment, type: 'expense', amount: 45, payee: 'Concert Tickets', cleared: true },
    { id: uid(), date: daysAgo(54), accountId: checking, categoryId: catGroceries, type: 'expense', amount: 88.15, payee: 'Whole Foods', cleared: true },
    { id: uid(), date: daysAgo(58), accountId: credit, categoryId: catSubscriptions, type: 'expense', amount: 15.99, payee: 'Streamly', cleared: true, tags: ['subscription'] },
    { id: uid(), date: daysAgo(60), accountId: checking, categoryId: catOtherIncome, type: 'income', amount: 200, payee: 'Refund', cleared: true },
    { id: uid(), date: daysAgo(63), accountId: checking, categoryId: catRent, type: 'expense', amount: 1450, payee: 'Sunset Apartments', cleared: true, tags: ['fixed'] },
    { id: uid(), date: daysAgo(66), accountId: checking, categoryId: catDining, type: 'expense', amount: 38.9, payee: 'Sushi House', cleared: true },
    { id: uid(), date: daysAgo(70), accountId: checking, categoryId: catTransport, type: 'expense', amount: 39.5, payee: 'Shell Gas Station', cleared: true },
    { id: uid(), date: daysAgo(75), accountId: checking, categoryId: catSalary, type: 'income', amount: 3200, payee: 'Acme Corp Payroll', cleared: true },
    { id: uid(), date: daysAgo(88), accountId: credit, categoryId: catSubscriptions, type: 'expense', amount: 15.99, payee: 'Streamly', cleared: true, tags: ['subscription'] },
    { id: uid(), date: daysAgo(93), accountId: checking, categoryId: catRent, type: 'expense', amount: 1450, payee: 'Sunset Apartments', cleared: true, tags: ['fixed'] },
  ];

  const budgets = [
    { id: uid(), categoryId: catGroceries, amount: 400, month: thisMonth, rollover: true },
    { id: uid(), categoryId: catDining, amount: 200, month: thisMonth },
    { id: uid(), categoryId: catTransport, amount: 120, month: thisMonth },
    { id: uid(), categoryId: catEntertainment, amount: 100, month: thisMonth },
    { id: uid(), categoryId: catShopping, amount: 250, month: thisMonth },
    { id: uid(), categoryId: catUtilities, amount: 180, month: thisMonth },
  ];

  const recurring = [
    { id: uid(), name: 'Rent', accountId: checking, categoryId: catRent, type: 'expense' as const, amount: 1450, payee: 'Sunset Apartments', freq: 'monthly' as const, nextDate: inDays(3), active: true },
    { id: uid(), name: 'Payroll', accountId: checking, categoryId: catSalary, type: 'income' as const, amount: 3200, payee: 'Acme Corp Payroll', freq: 'biweekly' as const, nextDate: inDays(9), active: true },
    { id: uid(), name: 'Gym Membership', accountId: credit, categoryId: catHealth, type: 'expense' as const, amount: 39.99, payee: 'FitZone', freq: 'monthly' as const, nextDate: inDays(12), active: true },
    { id: uid(), name: 'Car Payment', accountId: checking, categoryId: catTransport, type: 'expense' as const, amount: 320, payee: 'Auto Credit', freq: 'monthly' as const, nextDate: inDays(6), active: true },
    { id: uid(), name: 'Internet', accountId: checking, categoryId: catUtilities, type: 'expense' as const, amount: 65, payee: 'Fiber One', freq: 'monthly' as const, nextDate: inDays(15), active: true },
  ];

  const goals = [
    { id: uid(), name: 'Emergency Fund', targetAmount: 20000, currentAmount: 12800, color: '#059669', icon: '🛟', monthlyContribution: 500 },
    { id: uid(), name: 'Japan Trip', targetAmount: 4000, currentAmount: 1350, targetDate: inDays(200), color: '#0891b2', icon: '✈️', monthlyContribution: 350 },
    { id: uid(), name: 'New Laptop', targetAmount: 2200, currentAmount: 900, targetDate: inDays(90), color: '#7c3aed', icon: '💻', monthlyContribution: 200 },
  ];

  const rules = [
    { id: uid(), pattern: 'Whole Foods', matchType: 'contains' as const, categoryId: catGroceries, enabled: true },
    { id: uid(), pattern: 'Shell', matchType: 'contains' as const, categoryId: catTransport, enabled: true },
    { id: uid(), pattern: 'Streamly', matchType: 'contains' as const, categoryId: catSubscriptions, addTags: ['subscription'], enabled: true },
  ];

  return {
    accounts,
    transactions,
    categories,
    budgets,
    recurring,
    goals,
    rules,
    settings: { ...DEFAULT_SETTINGS },
  };
}
