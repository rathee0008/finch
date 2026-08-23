import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 500,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto animate-overlay"
      style={{ background: 'rgba(8, 10, 14, 0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="card w-full my-auto animate-dialog"
        style={{ maxWidth: width, boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition hover:opacity-70 shrink-0 focus-ring"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>

        {footer && (
          <div
            className="flex items-center gap-2 px-5 py-4 border-t"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
