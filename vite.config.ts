import { defineConfig } from 'vite';
import path from 'node:path';

const lite = process.env.QINGYUE_EDITION === 'lite';

export default defineConfig({
  base: './',
  define: { __LITE__: JSON.stringify(lite) },
  resolve: { alias: lite ? [{ find: /^monaco-editor$/, replacement: path.resolve(__dirname, 'src/lite-editor.ts') }] : [] },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    outDir: lite ? 'dist-lite' : 'dist',
    emptyOutDir: true,
  },
});
