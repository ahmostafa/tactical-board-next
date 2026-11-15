import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = resolve(__dirname, '..');
const distBrowserDir = resolve(rootDir, 'dist/tactical-board-next/browser');
const indexPath = resolve(distBrowserDir, 'index.html');
const fallbackPath = resolve(distBrowserDir, '404.html');

if (existsSync(indexPath)) {
  copyFileSync(indexPath, fallbackPath);
  console.log(`[copy-404] Successfully duplicated index.html -> 404.html for GitHub Pages SPA routing.`);
} else {
  console.warn(`[copy-404] Warning: ${indexPath} not found. Skipping 404.html copy.`);
}
