import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    outDir: mode === 'single' ? 'dist-single' : 'dist',
  },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  server: { host: true },
}));
