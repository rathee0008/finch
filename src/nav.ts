import type { ElementType } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PieChart,
  Repeat,
  Target,
  BarChart3,
  Settings as SettingsIcon,
  Tags,
  TrendingUp,
  Landmark,
  Wand2,
} from 'lucide-react';

export type Page =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'categories'
  | 'recurring'
  | 'goals'
  | 'reports'
  | 'forecast'
  | 'debt'
  | 'rules'
  | 'settings';

export interface NavItem {
  id: Page;
  label: string;
  icon: ElementType;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'forecast', label: 'Forecast', icon: TrendingUp },
    ],
  },
  {
    title: 'Money',
    items: [
      { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
      { id: 'accounts', label: 'Accounts', icon: Wallet },
      { id: 'debt', label: 'Debt Payoff', icon: Landmark },
    ],
  },
  {
    title: 'Planning',
    items: [
      { id: 'budgets', label: 'Budgets', icon: PieChart },
      { id: 'goals', label: 'Goals', icon: Target },
      { id: 'recurring', label: 'Recurring', icon: Repeat },
    ],
  },
  {
    title: 'Setup',
    items: [
      { id: 'categories', label: 'Categories', icon: Tags },
      { id: 'rules', label: 'Rules', icon: Wand2 },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
