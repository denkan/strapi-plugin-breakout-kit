import { test, expect } from '@playwright/test';

import { loginToAdmin } from './helpers/admin';

/**
 * Phase 2 contract test: every access-layer adapter resolves against the real,
 * running Strapi admin. The plugin's diagnostics page (admin/src/pages/HomePage.tsx)
 * renders one badge per adapter; this test asserts they all pass, which covers:
 * - public exports (unstable_ document hooks, DocumentRBAC, shell surface)
 * - deep imports through the Vite helper (InputRenderer, FormLayout, utils, ...)
 * - the useDocumentContext shim being active (alias applied)
 * - module identity (deep import === public export instance)
 * - a live RTK Query fetch (useContentTypeSchema) outside the CM routes
 */
test('access layer adapters all resolve in the running admin', async ({ page }) => {
  await loginToAdmin(page);

  await page.goto('/admin/plugins/headless-content-manager');

  const summary = page.getByTestId('access-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute('data-failures', '0');

  // Every static check badge reports pass.
  const badges = page.locator('[data-testid^="access-check-"]');
  const count = await badges.count();
  expect(count).toBeGreaterThanOrEqual(20);
  for (let i = 0; i < count; i += 1) {
    const badge = badges.nth(i);
    const id = await badge.getAttribute('data-testid');
    if (id === 'access-check-live-schema') continue; // asserted separately below
    await expect(badge, `${id} should pass`).toHaveAttribute('data-status', 'pass');
  }

  // The live schema fetch resolves (may briefly be pending).
  await expect(page.getByTestId('access-check-live-schema')).toHaveAttribute(
    'data-status',
    'pass'
  );
});
