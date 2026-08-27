/**
 * Receipt/photo storage for transactions, via IndexedDB.
 *
 * Photos don't belong in localStorage — its ~5-10MB quota (shared with all
 * of the app's actual financial data) would fill up after a handful of
 * images. IndexedDB has no such practical ceiling and is built for exactly
 * this: storing binary blobs. Everything here stays on-device, same as
 * everything else in the app.
 */

const DB_NAME = 'finance-app-attachments';
const STORE = 'files';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function attachmentsSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Stores a file (already size/type-checked by the caller) and returns its id. */
export async function saveAttachment(id: string, file: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAttachment(id: string): Promise<Blob | null> {
  const db = await openDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Object URLs must be revoked or they leak memory for the life of the tab.
 * Callers get a URL plus the cleanup function together so it's hard to forget.
 */
export async function getAttachmentUrl(id: string): Promise<{ url: string; revoke: () => void } | null> {
  const blob = await getAttachment(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB — generous for a phone photo, bounds storage growth

export function validateAttachmentFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Only image files can be attached.';
  if (file.size > MAX_ATTACHMENT_BYTES) return 'That image is over 5MB — try a smaller photo.';
  return null;
}
