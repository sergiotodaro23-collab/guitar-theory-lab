import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // The NAM engine finds its worklet and wasm with `new URL(..., import.meta.url)`: pre-bundling would move the module away from them.
  optimizeDeps: { exclude: ['neural-amp-modeler-wasm'] },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
