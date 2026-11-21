import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// mode "demo": base relativa (GitHub Pages en una subcarpeta) i BD al navegador (PGlite)
// Fora del mode demo, el motor PGlite (≈18 MB) se substitueix per un mòdul buit.
const stubDemo = (mode: string) => ({
  name: 'stub-demo-backend',
  enforce: 'pre' as const,
  resolveId(id: string, importer?: string) {
    const hit = /demo\/backend$/.test(id) || (id === './backend' && !!importer && /lib[\\/]demo[\\/]/.test(importer));
    return mode !== 'demo' && hit ? '\0demo-stub' : null;
  },
  load(id: string) {
    if (id !== '\0demo-stub') return null;
    return 'const no = () => { throw new Error("Mode demo no disponible"); };\n' +
      'export const getDb = no, demoRpc = no, demoLogin = no, demoSignUp = no, resetDemo = no;\n' +
      'export const onDemoStatus = () => () => {};';
  },
});

export default defineConfig(({ mode }) => ({
  base: mode === 'demo' || mode === 'pages' ? './' : '/',
  plugins: [react(), stubDemo(mode)],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: { outDir: mode === 'demo' ? '../clautic-quest-demo' : mode === 'pages' ? '../clautic-quest-app' : 'dist', emptyOutDir: true, target: 'es2022' },
  server: { host: '::', port: 8080 },
}));
