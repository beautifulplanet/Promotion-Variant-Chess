import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Use happy-dom for DOM simulation (faster than jsdom)
        environment: 'happy-dom',

        // Test file patterns
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/legacy/**'],
        },

        // Global test timeout (10 seconds for performance tests)
        testTimeout: 10000,

        // Run tests in parallel
        pool: 'threads',

        // Reporter
        reporters: ['default', 'hanging-process'],

        // Setup files
        setupFiles: ['./tests/setup.ts'],
    },

    // Resolve TypeScript paths
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});
