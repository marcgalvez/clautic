import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// mode "demo": base relativa (GitHub Pages en una subcarpeta) i BD al navegador (PGlite)
export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? './' : '/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: { outDir: mode === 'demo' ? '../clautic-quest-demo' : 'dist', emptyOutDir: true, target: 'es2022' },
  server: { host: '::', port: 8080 },
}));
