const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5173',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        viewport: { width: 1280, height: 720 },
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
})
