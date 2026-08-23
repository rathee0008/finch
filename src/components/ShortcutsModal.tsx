import { Modal } from './ui/Modal';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'General',
    items: [
      { keys: [MOD, 'K'], label: 'Open command palette' },
      { keys: [MOD, 'Z'], label: 'Undo last change' },
      { keys: [MOD, '⇧', 'Z'], label: 'Redo' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['Esc'], label: 'Close dialog' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { keys: ['N'], label: 'New transaction' },
      { keys: ['/'], label: 'Focus search on Transactions' },
      { keys: [MOD, 'B'], label: 'Collapse or expand sidebar' },
      { keys: [MOD, 'D'], label: 'Toggle dark mode' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: ['G', 'D'], label: 'Go to Dashboard' },
      { keys: ['G', 'T'], label: 'Go to Transactions' },
      { keys: ['G', 'A'], label: 'Go to Accounts' },
      { keys: ['G', 'B'], label: 'Go to Budgets' },
      { keys: ['G', 'R'], label: 'Go to Reports' },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" width={560}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h4
              className="text-[10px] font-semibold uppercase tracking-wider mb-2.5"
              style={{ color: 'var(--color-text-subtle)' }}
            >
              {g.title}
            </h4>
            <div className="space-y-2">
              {g.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {item.label}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k, i) => (
                      <kbd key={i}>{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
