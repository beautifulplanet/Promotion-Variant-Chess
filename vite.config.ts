import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/Promotion-Variant-Chess/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        perft: resolve(__dirname, 'benchmarks/perft.html'),
        search: resolve(__dirname, 'benchmarks/search.html'),
      },
    },
  },
});
