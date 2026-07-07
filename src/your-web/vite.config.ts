import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Build timestamp injected at build time (ISO 8601 UTC) — required by the
// attribution bar (frontend-dev skill §7.11). Never computed in the browser.
const BUILD_TIMESTAMP = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/ — override with VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        landscape: resolve(__dirname, 'landscape.html'),
        people: resolve(__dirname, 'people.html'),
        health: resolve(__dirname, 'health.html'),
        impact: resolve(__dirname, 'impact.html'),
        coverage: resolve(__dirname, 'coverage.html'),
      },
    },
  },
});
