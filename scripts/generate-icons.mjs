/**
 * Rasterizes the app's brand SVG into the PNG sizes a PWA manifest needs.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const standard = readFileSync(join(root, 'scripts', 'assets', 'app-icon.svg'));
const maskable = readFileSync(join(root, 'scripts', 'assets', 'app-icon-maskable.svg'));

const jobs = [
  { src: standard, size: 192, name: 'icon-192.png' },
  { src: standard, size: 512, name: 'icon-512.png' },
  { src: maskable, size: 512, name: 'icon-maskable-512.png' },
  { src: standard, size: 180, name: 'apple-touch-icon.png' },
];

for (const job of jobs) {
  const out = join(outDir, job.name);
  await sharp(job.src, { density: 384 })
    .resize(job.size, job.size)
    .png()
    .toFile(out);
  console.log(`Wrote ${out} (${job.size}x${job.size})`);
}
