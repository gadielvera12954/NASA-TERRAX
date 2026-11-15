import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api goes to the live physics engine (python -m servidor). If it is not running the
// app falls back to the exported files, so the proxy error is harmless.
const motor = { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: 'index.html', team: 'team.html' } } },
  server: {
    port: 3000,
    open: true,
    proxy: motor
  },
  preview: { proxy: motor }
});
