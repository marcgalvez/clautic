// Copies the single-threaded "lite" Stockfish WASM build into public/engine so
// it can be loaded as a Web Worker without cross-origin isolation headers.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'engine');
let jsPath;
try {
  jsPath = require('stockfish').findEngine('lite-single');
} catch {
  console.warn('[copy-stockfish] stockfish package not installed, skipping.');
  process.exit(0);
}
const wasmPath = jsPath.replace(/\.js$/, '.wasm');
if (!existsSync(wasmPath)) {
  console.warn(`[copy-stockfish] missing ${wasmPath}, skipping.`);
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(jsPath, join(outDir, 'stockfish.js'));
copyFileSync(wasmPath, join(outDir, 'stockfish.wasm'));
console.log('[copy-stockfish] Stockfish lite (single-threaded) copied to public/engine/');
