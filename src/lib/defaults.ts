import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  currency: 'USD',
  theme: 'system',
  monthStartDay: 1,
  accent: '#4f46e5',
  density: 'comfortable',
  forecastDays: 90,
};

export interface AccentPreset {
  name: string;
  hex: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Slate', hex: '#475569' },
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD', 'AED'];
