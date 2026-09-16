import { test as setup } from '@playwright/test';

import { loginToAdmin } from './helpers/admin';

/**
 * Logs in once and persists the session (httpOnly cookies) for all contract tests.
 * Individual tests must NOT log in themselves: Strapi rate-limits admin logins
 * (5 attempts / 5 min), which fails suites that authenticate per-test.
 */
setup('authenticate', async ({ page }) => {
  await loginToAdmin(page);
  await page.context().storageState({ path: 'test-results/.auth/admin.json' });
});
