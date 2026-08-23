import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ElementType | string;
  keywords?: string;
  run: () => void;
}

/** Substring match scores highest; subsequence match still qualifies. */
function score(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  const idx = t.indexOf(q);
  if (idx === 0) return 1000;
  if (idx > 0) return 700 - idx;

  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 200 - (t.length - q.length) : -1;
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after the dialog paints so the caret lands in the field.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const scored = commands
      .map((c) => ({ cmd: c, s: Math.max(score(query, c.label), score(query, c.keywords ?? '') - 50) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40);
    return scored.map((r) => r.cmd);
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const grouped: { group: string; items: { cmd: Command; index: number }[] }[] = [];
  results.forEach((cmd, index) => {
    const last = grouped[grouped.length - 1];
    if (last && last.group === cmd.group) last.items.push({ cmd, index });
    else grouped.push({ group: cmd.group, items: [{ cmd, index }] });
  });

  const runAt = (i: number) => {
    const cmd = results[i];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh] animate-overlay"
      style={{ background: 'rgba(8, 10, 14, 0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-xl overflow-hidden animate-dialog"
        style={{ boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Search size={17} style={{ color: 'var(--color-text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions, transactions…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-text)' }}
          />
          <kbd>ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No matches for “{query}”
            </p>
          )}

          {grouped.map((section) => (
            <div key={section.group} className="mb-1">
              <div
                className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-subtle)' }}
              >
                {section.group}
              </div>
              {section.items.map(({ cmd, index }) => {
                const isActive = index === active;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    data-index={index}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => runAt(index)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition"
                    style={{ background: isActive ? 'var(--color-accent-soft)' : 'transparent' }}
                  >
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0"
                      style={{
                        background: isActive ? 'var(--color-surface)' : 'var(--color-surface-2)',
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      }}
                    >
                      {typeof Icon === 'string' ? Icon : <Icon size={15} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className="block text-sm font-medium truncate"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {cmd.label}
                      </span>
                      {cmd.hint && (
                        <span
                          className="block text-xs truncate"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {cmd.hint}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <CornerDownLeft size={14} style={{ color: 'var(--color-text-subtle)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div
          className="flex items-center gap-4 px-4 py-2.5 border-t text-[11px]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-subtle)', background: 'var(--color-surface-2)' }}
        >
          <span className="flex items-center gap-1.5">
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>↵</kbd> select
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <kbd>?</kbd> shortcuts
          </span>
        </div>
      </div>
    </div>
  );
}
