import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/contract',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:1337',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'contract',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: {
        baseURL: 'http://localhost:1337',
        storageState: 'test-results/.auth/admin.json',
        trace: 'retain-on-failure',
      },
    },
  ],
  webServer: {
    command: 'npm run develop --workspace apps/playground',
    url: 'http://localhost:1337/_health',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
