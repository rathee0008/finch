import type { RecurringTransaction } from '../types';
import { formatCurrency, toLocalISODate } from './format';

/**
 * Local due-bill reminders via the browser Notification API.
 *
 * Honest limitation: this can only fire while the app is actually open in a
 * tab (or, once installed as a PWA, while the OS has it running). A true
 * background reminder — one that fires even when the app isn't open — needs
 * a push server, which this app deliberately doesn't have: that's the same
 * trade-off that keeps your data from ever leaving your device. This is the
 * honest version of "reminders" available without breaking that promise.
 */

const NOTIFIED_KEY = 'finance-app-notified-recurring';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  return Notification.requestPermission();
}

function readNotifiedLog(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeNotifiedLog(log: Record<string, string>): void {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(log));
  } catch {
    /* best-effort — a missed dedupe just means a possible repeat notification */
  }
}

/**
 * Notifies once per recurring item per day it's due or overdue. Call this
 * on app load (and optionally on an interval while the tab stays open).
 */
export function checkAndNotifyDueBills(recurring: RecurringTransaction[], currency: string): number {
  if (notificationPermission() !== 'granted') return 0;

  const today = toLocalISODate(new Date());
  const log = readNotifiedLog();
  let fired = 0;

  for (const r of recurring) {
    if (!r.active || r.nextDate > today) continue;
    if (log[r.id] === today) continue; // already notified today

    const verb = r.type === 'income' ? 'expected' : 'due';
    new Notification(`${r.name} ${verb}`, {
      body: `${formatCurrency(r.amount, currency)} — ${r.nextDate === today ? 'today' : 'overdue since ' + r.nextDate}`,
      tag: `recurring-${r.id}`, // replaces any earlier notification for the same bill
      icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    });

    log[r.id] = today;
    fired++;
  }

  if (fired > 0) writeNotifiedLog(log);
  return fired;
}
