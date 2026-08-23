import { Moon, Sun, PanelLeftClose, PanelLeft, Search, Undo2, Redo2 } from 'lucide-react';
import { NAV_GROUPS, type Page } from '../nav';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../lib/format';
import { netWorth } from '../lib/calculations';

export function Sidebar({
  page,
  setPage,
  isDark,
  toggleDark,
  collapsed,
  toggleCollapsed,
  mobileOpen,
  onNavigate,
  onOpenPalette,
}: {
  page: Page;
  setPage: (p: Page) => void;
  isDark: boolean;
  toggleDark: () => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  onNavigate: () => void;
  onOpenPalette: () => void;
}) {
  const { state, canUndo, canRedo, undo, redo } = useFinance();
  const width = collapsed ? 72 : 248;

  return (
    <aside
      className={`fixed md:sticky top-0 h-screen z-40 shrink-0 border-r flex flex-col transition-transform md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{
        width,
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        transition: 'width 180ms ease, transform 200ms ease',
      }}
    >
      {/* Brand */}
      <div className={`flex items-center gap-2.5 px-4 h-16 shrink-0 ${collapsed ? 'justify-center px-0' : ''}`}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: 'var(--color-accent)' }}
        >
          $
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-semibold text-[15px] leading-tight" style={{ color: 'var(--color-text)' }}>
              Finch
            </div>
            <div className="text-[11px] tnum leading-tight" style={{ color: 'var(--color-text-muted)' }}>
              {formatCurrency(netWorth(state.accounts), state.settings.currency)}
            </div>
          </div>
        )}
      </div>

      {/* Search trigger */}
      <div className={`px-3 pb-3 ${collapsed ? 'px-2' : ''}`}>
        <button
          onClick={onOpenPalette}
          className={`w-full flex items-center gap-2 rounded-lg text-sm transition hover:opacity-80 ${
            collapsed ? 'justify-center py-2' : 'px-2.5 py-2'
          }`}
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
          title="Search (⌘K)"
        >
          <Search size={15} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-[13px]">Search…</span>
              <kbd>⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed && (
              <div
                className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-subtle)' }}
              >
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = page === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setPage(item.id);
                      onNavigate();
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition relative ${
                      collapsed ? 'justify-center py-2.5' : 'px-2.5 py-2'
                    }`}
                    style={{
                      background: active ? 'var(--color-accent-soft)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}
                  >
                    {active && !collapsed && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                        style={{ background: 'var(--color-accent)' }}
                      />
                    )}
                    <Icon size={17} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer controls */}
      <div
        className={`border-t p-2 flex items-center gap-1 shrink-0 ${collapsed ? 'flex-col' : ''}`}
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          className="p-2 rounded-lg transition hover:opacity-70 disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          className="p-2 rounded-lg transition hover:opacity-70 disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Redo2 size={16} />
        </button>
        <button
          onClick={toggleDark}
          title={isDark ? 'Light mode' : 'Dark mode'}
          className="p-2 rounded-lg transition hover:opacity-70"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={toggleCollapsed}
          title="Collapse sidebar (⌘B)"
          className="p-2 rounded-lg transition hover:opacity-70 hidden md:block md:ml-auto"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </aside>
  );
}
