import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/join': 'http://localhost:3000',
      '/check': 'http://localhost:3000',
      '/viewport': 'http://localhost:3000',
      '/leaderboard': 'http://localhost:3000',
      '/activity': 'http://localhost:3000',
      '/endurance': 'http://localhost:3000',
      '/og-image': 'http://localhost:3000',
      '/ws': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
