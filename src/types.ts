export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'loan';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  archived?: boolean;
  /** Annual percentage rate — used by the debt payoff planner. */
  apr?: number;
  /** Monthly minimum payment for credit/loan accounts. */
  minPayment?: number;
  institution?: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Split {
  id: string;
  categoryId: string;
  amount: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO date (local)
  accountId: string;
  toAccountId?: string; // for transfers
  categoryId?: string;
  type: TransactionType;
  amount: number; // always positive
  payee: string;
  notes?: string;
  tags?: string[];
  cleared?: boolean;
  /** When present, this transaction is split across several categories. */
  splits?: Split[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  archived?: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: string; // YYYY-MM
  /** Carry unspent amount from the previous month into this one. */
  rollover?: boolean;
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  name: string;
  accountId: string;
  categoryId?: string;
  type: TransactionType;
  amount: number;
  payee: string;
  freq: RecurrenceFreq;
  nextDate: string;
  active: boolean;
  autoAdd?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  color: string;
  icon: string;
  archived?: boolean;
  /** Optional monthly contribution used for goal projections. */
  monthlyContribution?: number;
}

export type RuleMatchType = 'contains' | 'startsWith' | 'exact' | 'regex';

export interface Rule {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  categoryId?: string;
  addTags?: string[];
  renameTo?: string;
  enabled: boolean;
}

export type Density = 'comfortable' | 'compact';

export interface Settings {
  currency: string;
  theme: 'light' | 'dark' | 'system';
  monthStartDay: number;
  accent: string;
  density: Density;
  /** Days ahead the cash-flow forecast projects. */
  forecastDays: number;
}

export interface FinanceState {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  goals: Goal[];
  rules: Rule[];
  settings: Settings;
}
