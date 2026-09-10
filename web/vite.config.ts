import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 開発時: vite(5173) が /api を Backend(3001) にプロキシする。
// 本番: `npm run build` の成果物(dist/)を Backend が静的配信する。
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
