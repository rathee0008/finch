import { AlertTriangle, Download } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useToast } from '../context/ToastContext';
import { exportFullBackup } from '../lib/csv';

/**
 * A permanent, undismissable banner shown whenever the browser is not
 * actually able to save to localStorage — Private Browsing being the most
 * common cause. Without this, the app looks like it's working (React state
 * updates fine) right up until the tab reloads and everything reverts,
 * which is confusing and easy to mistake for data loss rather than a
 * browser setting.
 */
export function StorageWarningBanner() {
  const { state, persistenceOk } = useFinance();
  const { toast } = useToast();

  if (persistenceOk) return null;

  return (
    // Deliberately not `sticky` — the mobile header below it is also
    // sticky at top:0, and two stacked sticky siblings fight over the same
    // offset once scrolled. Showing this at the top of the page on load is
    // what matters; it doesn't need to follow the scroll too.
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-sm flex-wrap"
      style={{ background: 'var(--color-negative)', color: '#fff' }}
      role="alert"
    >
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1 min-w-[240px]">
        <strong>This browser isn't saving your changes.</strong> They'll be lost when you close or
        reload this tab. This usually means Private/Incognito browsing, or a "block cookies &amp;
        site data" setting — try opening this page in a normal browser tab instead.
      </span>
      <button
        onClick={async () => {
          const outcome = await exportFullBackup(state);
          if (outcome === 'saved') toast('Backup downloaded — keep it safe until storage is fixed');
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 transition hover:opacity-90"
        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
      >
        <Download size={13} /> Export what I have now
      </button>
    </div>
  );
}
