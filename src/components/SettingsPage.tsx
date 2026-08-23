import { useRef } from 'react';
import { Download, Upload, RotateCcw, Trash2, Check } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import { exportFullBackup, transactionsToCSV, downloadCSV } from '../lib/csv';
import { ACCENT_PRESETS, CURRENCIES } from '../lib/defaults';
import { Button, Field, Select, Segmented } from './ui/Field';
import type { Density } from '../types';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        {title}
      </h2>
      {description && (
        <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {description}
        </p>
      )}
      {!description && <div className="mb-4" />}
      {children}
    </div>
  );
}

export function SettingsPage() {
  const { state, updateSettings, resetToSample, wipeAll, importState } = useFinance();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const { settings } = state;

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.accounts && parsed.transactions) {
          importState(parsed);
          toast('Backup restored');
        } else {
          toast('That file is not a Finch backup', { tone: 'error' });
        }
      } catch {
        toast('Could not read that file as JSON', { tone: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const stats = [
    { label: 'Accounts', value: state.accounts.length },
    { label: 'Transactions', value: state.transactions.length },
    { label: 'Categories', value: state.categories.length },
    { label: 'Rules', value: state.rules.length },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
        Settings
      </h1>

      <Section title="Appearance" description="Personalize how Finch looks.">
        <Field label="Accent color">
          <div className="flex gap-2 flex-wrap">
            {ACCENT_PRESETS.map((preset) => {
              const selected = settings.accent === preset.hex;
              return (
                <button
                  key={preset.hex}
                  onClick={() => updateSettings({ accent: preset.hex })}
                  title={preset.name}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition hover:scale-105"
                  style={{
                    background: preset.hex,
                    outline: selected ? `2px solid ${preset.hex}` : 'none',
                    outlineOffset: 2,
                  }}
                >
                  {selected && <Check size={16} color="#fff" />}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="mt-4">
          <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Density
          </span>
          <Segmented
            value={settings.density}
            onChange={(v: Density) => updateSettings({ density: v })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
      </Section>

      <Section title="Preferences">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Display currency">
            <Select
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Forecast horizon" hint="Used by insights and the forecast page">
            <Select
              value={String(settings.forecastDays)}
              onChange={(e) => updateSettings({ forecastDays: Number(e.target.value) })}
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        title="Your data"
        description="Everything lives in this browser only — nothing is uploaded anywhere. Export a backup regularly."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg p-3"
              style={{ background: 'var(--color-surface-2)' }}
            >
              <div className="text-lg font-semibold tnum" style={{ color: 'var(--color-text)' }}>
                {s.value}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              exportFullBackup(state);
              toast('Backup downloaded');
            }}
          >
            <Download size={15} /> Export backup
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              downloadCSV(
                transactionsToCSV(state.transactions, state.accounts, state.categories),
                `all-transactions-${new Date().toISOString().slice(0, 10)}.csv`
              );
              toast('Transactions exported');
            }}
          >
            <Download size={15} /> Export all as CSV
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Restore backup
          </Button>
        </div>
      </Section>

      <Section title="Danger zone" description="These actions cannot be undone from here.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm('Replace all current data with the sample dataset?')) {
                resetToSample();
                toast('Sample data loaded');
              }
            }}
          >
            <RotateCcw size={15} /> Load sample data
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Permanently delete every account, transaction and budget?')) {
                wipeAll();
                toast('All data deleted', { tone: 'warning' });
              }
            }}
          >
            <Trash2 size={15} /> Delete everything
          </Button>
        </div>
      </Section>

      <p className="text-xs text-center pb-4" style={{ color: 'var(--color-text-subtle)' }}>
        Finch · local-first personal finance · press <kbd>?</kbd> for keyboard shortcuts
      </p>
    </div>
  );
}
