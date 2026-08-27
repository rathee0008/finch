import { normalizeState } from './storage';
import type { FinanceState } from '../types';

const STATE_KEY = 'finance-app-state-v1';
const RESTORE_FLAG_KEY = 'finance-app-restore-flag';

/**
 * Restores app state from a `#restore=<gzip+base64url>` URL fragment, as
 * produced by scripts/make-restore-link.mjs — a one-tap alternative to
 * "Settings → Restore backup" for contexts where a file picker is
 * unreliable (mobile in-app browsers, cramped file-manager UIs).
 *
 * Deliberately uses the *fragment*, not a query param: fragments are never
 * sent in the HTTP request, so this payload never reaches GitHub Pages'
 * server, never appears in a server log, and is never attached to a
 * Referer header — it exists only in this tab's memory and, briefly, in
 * browser history until stripped below.
 *
 * Runs once at boot, before React mounts, so the freshly-written
 * localStorage is exactly what the app's normal loadState() then reads.
 */
export async function restoreFromUrlIfPresent(): Promise<void> {
  const match = window.location.hash.match(/#restore=([^&]+)/);
  if (!match) return;

  try {
    const bytes = base64UrlToBytes(match[1]);
    const json =
      typeof DecompressionStream !== 'undefined'
        ? await gunzip(bytes)
        : new TextDecoder('utf-8').decode(bytes);

    const parsed = JSON.parse(json) as Partial<FinanceState>;
    if (!parsed.accounts || !parsed.transactions) {
      throw new Error('Payload is missing accounts/transactions — not a valid backup');
    }

    localStorage.setItem(STATE_KEY, JSON.stringify(normalizeState(parsed)));
    localStorage.setItem(RESTORE_FLAG_KEY, String(Date.now()));
  } catch {
    // Something in the payload or this browser's support didn't work out.
    // Leave whatever was already in storage untouched and boot normally —
    // failing to restore should never be able to crash the app on load.
  } finally {
    // Always strip the fragment, success or failure, so the payload never
    // lingers in the visible address bar and a refresh can't re-run this.
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }
}

/** True (once) right after a URL-fragment restore just landed, for the UI to confirm. */
export function consumeRestoreFlag(): boolean {
  try {
    const flag = localStorage.getItem(RESTORE_FLAG_KEY);
    if (!flag) return false;
    localStorage.removeItem(RESTORE_FLAG_KEY);
    return true;
  } catch {
    return false;
  }
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  // .slice() guarantees a plain (non-shared) ArrayBuffer backing, which is
  // what Blob's type signature requires.
  const stream = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder('utf-8').decode(buf);
}
