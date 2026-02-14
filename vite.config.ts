import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/Promotion-Variant-Chess/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        perft: resolve(__dirname, 'benchmarks/perft.html'),
        search: resolve(__dirname, 'benchmarks/search.html'),
        results: resolve(__dirname, 'benchmarks/results.html'),
      },
    },
  },
});
