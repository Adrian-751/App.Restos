import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        testTimeout: 30000,
        hookTimeout: 30000,
        // Run each file serially to avoid MongoDB port conflicts
        pool: 'forks',
        poolOptions: {
            forks: { singleFork: false },
        },
        include: ['tests/**/*.test.js'],
        reporters: ['verbose'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: [
                'controllers/**/*.js',
                'middleware/**/*.js',
                'utils/**/*.js',
                'tenancy/tenant.js',
            ],
            exclude: ['tests/**', 'scripts/**', 'data/**'],
        },
    },
})
