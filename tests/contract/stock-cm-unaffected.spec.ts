import { test, expect } from '@playwright/test';

import { dismissGuidedTour, loginToAdmin } from './helpers/admin';

/**
 * Decision #2 guard (docs/decisions.md): the useDocumentContext shim is aliased globally,
 * so the STOCK content manager edit view must behave exactly as without the plugin.
 * Smoke-level here; full parity tests come in Phase 5.
 */
test('stock content manager edit view still works with the shim active', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await loginToAdmin(page);

  // Open the seeded article in the stock edit view.
  await page.goto(
    '/admin/content-manager/collection-types/api::article.article?page=1&pageSize=10'
  );
  await dismissGuidedTour(page);
  // An empty decorative div overlays the table and intercepts pointer events, so
  // dispatch the click on the row element directly (row onClick navigates to edit).
  const row = page.getByRole('row').filter({ hasText: 'The Complete Article' }).first();
  await expect(row).toBeVisible();
  await row.dispatchEvent('click');
  await page.waitForURL(/collection-types\/api::article\.article\/[a-z0-9]+/i, {
    timeout: 30_000,
  });

  // The edit form renders with the document's data and status.
  await expect(page.getByRole('heading', { name: 'The Complete Article' })).toBeVisible();
  await expect(page.getByLabel(/title/i).first()).toHaveValue('The Complete Article');

  // Field inputs from the whole tree render (uid, enumeration, relation widget).
  await expect(page.getByLabel(/slug/i).first()).toHaveValue('the-complete-article');

  // No client-side crashes anywhere on the route.
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});
