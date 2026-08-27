import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, Plus, Moon, Sun, Undo2, Redo2, Download, Keyboard, Search } from 'lucide-react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Accounts } from './components/Accounts';
import { Budgets } from './components/Budgets';
import { Categories } from './components/Categories';
import { Recurring } from './components/Recurring';
import { Goals } from './components/Goals';
import { Reports } from './components/Reports';
import { Forecast } from './components/Forecast';
import { Debt } from './components/Debt';
import { Rules } from './components/Rules';
import { SettingsPage } from './components/SettingsPage';
import { TransactionModal } from './components/TransactionModal';
import { CommandPalette, type Command } from './components/CommandPalette';
import { ShortcutsModal } from './components/ShortcutsModal';
import { StorageWarningBanner } from './components/StorageWarningBanner';
import { consumeRestoreFlag } from './lib/urlRestore';
import { checkAndNotifyDueBills } from './lib/notifications';
import { ALL_NAV_ITEMS, type Page } from './nav';
import { exportFullBackup } from './lib/csv';
import { formatCurrency, formatDate } from './lib/format';

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // An explicit in-app choice wins, then any theme stamped on the document
    // by an embedding host, then the OS preference. localStorage can throw in
    // sandboxed frames, so never let it take the app down on startup.
    try {
      const stored = localStorage.getItem('finance-app-theme');
      if (stored) return stored === 'dark';
    } catch {
      /* storage unavailable — fall through to the host and OS preference */
    }
    const hostTheme = document.documentElement.dataset.theme;
    if (hostTheme === 'dark' || hostTheme === 'light') return hostTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('finance-app-theme', isDark ? 'dark' : 'light');
    } catch {
      /* preference simply won't persist */
    }
  }, [isDark]);

  return { isDark, toggle: useCallback(() => setIsDark((d) => !d), []) };
}

function PageContent({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  switch (page) {
    case 'dashboard':
      return <Dashboard setPage={setPage} />;
    case 'transactions':
      return <Transactions />;
    case 'accounts':
      return <Accounts />;
    case 'budgets':
      return <Budgets />;
    case 'categories':
      return <Categories />;
    case 'recurring':
      return <Recurring />;
    case 'goals':
      return <Goals />;
    case 'reports':
      return <Reports />;
    case 'forecast':
      return <Forecast />;
    case 'debt':
      return <Debt />;
    case 'rules':
      return <Rules />;
    case 'settings':
      return <SettingsPage />;
    default:
      return null;
  }
}

function AppShell() {
  const { state, undo, redo, canUndo, canRedo } = useFinance();
  const { toast } = useToast();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const [page, setPage] = useState<Page>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('finance-app-sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // If this load just restored data from a #restore=... link, say so —
  // otherwise a one-tap restore is invisible and easy to doubt happened.
  useEffect(() => {
    if (consumeRestoreFlag()) {
      toast(`Your data was loaded — ${state.accounts.length} accounts restored`, { duration: 5000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Due-bill reminders: checked on load, then every 30 minutes for as long
  // as the tab stays open. checkAndNotifyDueBills dedupes per bill per day
  // on its own, so a re-render here never re-fires the same notification.
  useEffect(() => {
    if (!state.settings.remindersEnabled) return;
    const run = () => checkAndNotifyDueBills(state.recurring, state.settings.currency);
    run();
    const interval = window.setInterval(run, 30 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [state.settings.remindersEnabled, state.recurring, state.settings.currency]);

  // Accent + density are driven by settings, applied to the document root.
  useEffect(() => {
    document.documentElement.style.setProperty('--color-accent', state.settings.accent);
  }, [state.settings.accent]);

  useEffect(() => {
    document.documentElement.classList.toggle('compact', state.settings.density === 'compact');
  }, [state.settings.density]);

  useEffect(() => {
    try {
      localStorage.setItem('finance-app-sidebar', collapsed ? 'collapsed' : 'expanded');
    } catch {
      /* preference simply won't persist */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = ALL_NAV_ITEMS.map((item) => ({
      id: `nav-${item.id}`,
      label: item.label,
      group: 'Go to',
      icon: item.icon,
      keywords: `navigate open ${item.label}`,
      run: () => setPage(item.id),
    }));

    const actions: Command[] = [
      {
        id: 'action-add-tx',
        label: 'Add transaction',
        hint: 'Record income, an expense or a transfer',
        group: 'Actions',
        icon: Plus,
        keywords: 'new create expense income transfer',
        run: () => setQuickAddOpen(true),
      },
      {
        id: 'action-theme',
        label: isDark ? 'Switch to light mode' : 'Switch to dark mode',
        group: 'Actions',
        icon: isDark ? Sun : Moon,
        keywords: 'theme dark light appearance',
        run: toggleDark,
      },
      {
        id: 'action-undo',
        label: 'Undo last change',
        group: 'Actions',
        icon: Undo2,
        keywords: 'revert back',
        run: () => (canUndo ? undo() : toast('Nothing to undo', { tone: 'info' })),
      },
      {
        id: 'action-redo',
        label: 'Redo',
        group: 'Actions',
        icon: Redo2,
        keywords: 'forward again',
        run: () => (canRedo ? redo() : toast('Nothing to redo', { tone: 'info' })),
      },
      {
        id: 'action-backup',
        label: 'Export backup',
        hint: 'Download all data as JSON',
        group: 'Actions',
        icon: Download,
        keywords: 'save download json export',
        run: () => {
          exportFullBackup(state);
          toast('Backup downloaded');
        },
      },
      {
        id: 'action-shortcuts',
        label: 'Keyboard shortcuts',
        group: 'Actions',
        icon: Keyboard,
        keywords: 'help keys hotkeys',
        run: () => setShortcutsOpen(true),
      },
    ];

    const accounts: Command[] = state.accounts.map((a) => ({
      id: `acct-${a.id}`,
      label: a.name,
      hint: formatCurrency(a.balance, state.settings.currency),
      group: 'Accounts',
      icon: '🏦',
      keywords: `account balance ${a.type}`,
      run: () => setPage('accounts'),
    }));

    // Recent transactions are searchable so ⌘K doubles as a jump-to-record.
    const txs: Command[] = state.transactions.slice(0, 120).map((t) => ({
      id: `tx-${t.id}`,
      label: t.payee,
      hint: `${formatDate(t.date)} · ${formatCurrency(t.amount, state.settings.currency)}`,
      group: 'Transactions',
      icon: '🧾',
      keywords: t.notes ?? '',
      run: () => setPage('transactions'),
    }));

    return [...nav, ...actions, ...accounts, ...txs];
  }, [state, isDark, toggleDark, undo, redo, canUndo, canRedo, toast]);

  // Global keyboard shortcuts.
  useEffect(() => {
    let gPressed = false;
    let gTimer: number | undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else if (canUndo) {
          undo();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleDark();
        return;
      }

      if (typing || mod) return;

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (e.key === 'n') {
        e.preventDefault();
        setQuickAddOpen(true);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        if (page === 'transactions') {
          document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
        } else {
          setPaletteOpen(true);
        }
        return;
      }

      // "g" then a letter jumps between pages.
      if (e.key === 'g') {
        gPressed = true;
        window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => (gPressed = false), 900);
        return;
      }
      if (gPressed) {
        const map: Record<string, Page> = {
          d: 'dashboard',
          t: 'transactions',
          a: 'accounts',
          b: 'budgets',
          r: 'reports',
          f: 'forecast',
          g: 'goals',
          s: 'settings',
        };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          setPage(dest);
        }
        gPressed = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(gTimer);
    };
  }, [canUndo, canRedo, undo, redo, toggleCollapsed, toggleDark, page]);

  const currentLabel = ALL_NAV_ITEMS.find((i) => i.id === page)?.label ?? 'Finch';

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <Sidebar
        page={page}
        setPage={setPage}
        isDark={isDark}
        toggleDark={toggleDark}
        collapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 min-w-0">
        <StorageWarningBanner />
        <header
          className="md:hidden flex items-center gap-3 px-4 h-14 border-b sticky top-0 z-20"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--color-text)' }}>
            <Menu size={20} />
          </button>
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {currentLabel}
          </span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto p-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Search size={18} />
          </button>
          <button onClick={() => setQuickAddOpen(true)} className="p-2" style={{ color: 'var(--color-accent)' }}>
            <Plus size={20} />
          </button>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
          <PageContent page={page} setPage={setPage} />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <TransactionModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <FinanceProvider>
        <AppShell />
      </FinanceProvider>
    </ToastProvider>
  );
}
