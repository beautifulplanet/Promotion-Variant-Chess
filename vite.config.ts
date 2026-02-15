import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Vercel & local dev use '/', GitHub Pages needs the repo prefix
  base: process.env.GITHUB_PAGES && !process.env.VERCEL ? '/Promotion-Variant-Chess/' : '/',
  build: {
    // Three.js vendor chunk is ~553 kB — expected for a 3D rendering library
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        perft: resolve(__dirname, 'benchmarks/perft.html'),
        search: resolve(__dirname, 'benchmarks/search.html'),
        results: resolve(__dirname, 'benchmarks/results.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          'socket-io': ['socket.io-client'],
        },
      },
    },
  },
});
