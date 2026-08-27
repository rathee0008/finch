import React from 'react';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3.5">
      <span
        className="block text-xs font-medium mb-1.5 tracking-wide"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px] mt-1" style={{ color: 'var(--color-text-subtle)' }}>
          {hint}
        </span>
      )}
    </label>
  );
}

// React 19 passes `ref` through as a normal prop for function components.
export function TextInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  // type="number" alone still surfaces a full QWERTY keyboard (with a
  // numeric row bolted on) on plenty of Android keyboards. inputMode
  // "decimal" is what actually requests the calculator-style numeric pad —
  // set it here once so every amount field in the app gets it for free,
  // this one included, unless a caller explicitly asks for something else.
  const inputMode = props.inputMode ?? (props.type === 'number' ? 'decimal' : undefined);
  return <input {...props} inputMode={inputMode} className={`input ${className}`} />;
}

export function TextArea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input resize-none ${className}`} />;
}

export function Select({
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`input ${className}`}>
      {children}
    </select>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'subtle';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}) {
  const styles: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: 'var(--color-accent)', color: '#fff' },
    secondary: {
      background: 'var(--color-surface-2)',
      color: 'var(--color-text)',
      border: '1px solid var(--color-border)',
    },
    danger: { background: 'var(--color-negative)', color: '#fff' },
    ghost: { background: 'transparent', color: 'var(--color-text-muted)' },
    subtle: { background: 'var(--color-accent-soft)', color: 'var(--color-accent)' },
  };
  const sizing = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      {...props}
      style={styles[variant]}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition hover:opacity-90 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100 focus-ring ${sizing} ${className}`}
    />
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={`inline-flex p-0.5 rounded-lg gap-0.5 ${className}`}
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap"
            style={{
              background: active ? 'var(--color-surface)' : 'transparent',
              color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';
}) {
  const tones = {
    neutral: { bg: 'var(--color-surface-3)', fg: 'var(--color-text-muted)' },
    positive: { bg: 'var(--color-positive-soft)', fg: 'var(--color-positive)' },
    negative: { bg: 'var(--color-negative-soft)', fg: 'var(--color-negative)' },
    warning: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
    accent: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
      style={{ background: tones.bg, color: tones.fg }}
    >
      {children}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 focus-ring rounded"
    >
      <span
        className="relative w-9 h-5 rounded-full transition"
        style={{ background: checked ? 'var(--color-accent)' : 'var(--color-surface-3)' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm"
          style={{ left: checked ? 18 : 2 }}
        />
      </span>
      {label && (
        <span className="text-sm" style={{ color: 'var(--color-text)' }}>
          {label}
        </span>
      )}
    </button>
  );
}

export function ProgressBar({
  percent,
  color,
  height = 8,
}: {
  percent: number;
  color: string;
  height?: number;
}) {
  return (
    <div
      className="rounded-full overflow-hidden w-full"
      style={{ background: 'var(--color-surface-3)', height }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color }}
      />
    </div>
  );
}
