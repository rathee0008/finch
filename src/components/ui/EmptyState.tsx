import React from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center text-center py-14 px-6">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
      >
        <Icon size={22} />
      </div>
      <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text)' }}>
        {title}
      </h3>
      <p className="text-sm max-w-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
        {description}
      </p>
      {action}
    </div>
  );
}
