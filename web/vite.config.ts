import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// node_modules may be a link to a sibling checkout's install (see CARPETAS_DE_TRABAJO.md): the dev
// server must be allowed to serve the fonts from where the link really points.
const modulos = (() => {
  try {
    return realpathSync(resolve('node_modules'));
  } catch {
    return resolve('node_modules');
  }
})();

// /api goes to the live physics engine (python -m servidor). If it is not running the
// app falls back to the exported files, so the proxy error is harmless.
const motor = { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', team: 'team.html' },
      output: {
        // three.js only loads with the 3D views; keeping it in its own chunk makes the first
        // paint of the home page independent of it and lets the browser cache it separately.
        manualChunks: { three: ['three'] }
      }
    },
    chunkSizeWarningLimit: 900
  },
  server: {
    port: 3000,
    open: true,
    proxy: motor,
    fs: { allow: ['.', modulos] }
  },
  preview: { proxy: motor }
});
