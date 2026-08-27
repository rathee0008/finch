/**
 * Turns artifact/finch-my-data.json into a one-tap restore link:
 *
 *   https://rathee0008.github.io/finch/#restore=<gzip+base64url>
 *
 * Tapping it writes the data straight into localStorage before the app even
 * mounts — no Settings menu, no file picker, nothing that can go wrong in a
 * mobile in-app browser. See src/lib/urlRestore.ts for the client side.
 *
 * The payload lives in the URL *fragment* (after #), which browsers never
 * send to the server — GitHub Pages never sees it, it's not in any server
 * log, and it's not attached to a Referer header. It exists only in this
 * link and, briefly, in the recipient's browser history.
 *
 * Run: node scripts/make-restore-link.mjs
 */
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://rathee0008.github.io/finch/';

const inputPath = join(root, 'artifact', 'finch-my-data.json');
const raw = readFileSync(inputPath, 'utf8');
const minified = JSON.stringify(JSON.parse(raw)); // drop the pretty-printing whitespace

const gzipped = gzipSync(Buffer.from(minified, 'utf8'));
const b64url = gzipped.toString('base64url');

const link = `${SITE_URL}#restore=${b64url}`;

console.log(`Source: ${inputPath}`);
console.log(`  minified: ${minified.length} bytes`);
console.log(`  gzipped:  ${gzipped.length} bytes`);
console.log(`  link length: ${link.length} characters`);
console.log('');
console.log(link);
