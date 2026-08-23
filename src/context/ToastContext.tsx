import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { uid } from '../lib/id';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (message: string, options?: { tone?: ToastTone; action?: Toast['action']; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_META: Record<ToastTone, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle2, color: 'var(--color-positive)' },
  error: { icon: XCircle, color: 'var(--color-negative)' },
  warning: { icon: AlertTriangle, color: 'var(--color-warning)' },
  info: { icon: Info, color: 'var(--color-accent)' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue['toast']>(
    (message, options) => {
      const id = uid();
      const entry: Toast = {
        id,
        message,
        tone: options?.tone ?? 'success',
        action: options?.action,
      };
      setToasts((list) => [...list.slice(-3), entry]);
      const duration = options?.duration ?? (options?.action ? 6000 : 3200);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const { icon: Icon, color } = TONE_META[t.tone];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg animate-[toastIn_180ms_ease-out]"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-md)',
                minWidth: 260,
                maxWidth: 380,
              }}
            >
              <Icon size={17} style={{ color, flexShrink: 0 }} />
              <span className="flex-1" style={{ color: 'var(--color-text)' }}>
                {t.message}
              </span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="text-xs font-semibold px-2 py-1 rounded-md transition hover:opacity-80"
                  style={{ color: 'var(--color-accent)', background: 'var(--color-accent-soft)' }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="transition hover:opacity-70"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
