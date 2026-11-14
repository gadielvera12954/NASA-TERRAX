import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: 'index.html', team: 'team.html' } } },
  server: {
    port: 3000,
    open: true
  }
});
