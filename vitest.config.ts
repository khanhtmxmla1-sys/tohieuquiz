/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    test: {
        globals: true,
        env: {
            VITE_FEATURE_GIFT_SHOP_V2: 'false',
        },
        environment: 'jsdom',
        maxWorkers: 2,
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['schemas/**/*.ts', 'utils/**/*.ts'],
            thresholds: {
                statements: 75,
                branches: 54,
                functions: 94,
                lines: 78,
            },
        },
    },
});
