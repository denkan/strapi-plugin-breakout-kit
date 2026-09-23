import { test, expect } from '@playwright/test';

import { dismissGuidedTour } from './helpers/admin';

/**
 * Edit-view replacement: the playground's app.tsx registers a resolver replacing the
 * STOCK CM edit view for api::category.category only (see CustomCategoryEditView).
 * The CM route stays — list-view navigation lands on the custom component — while
 * every other model keeps the stock view (also guarded by stock-cm-unaffected/parity,
 * which exercise the article).
 */

test('category edit route renders the registered replacement', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(
    '/admin/content-manager/collection-types/api::category.category?page=1&pageSize=10'
  );
  await dismissGuidedTour(page);
  const row = page.getByRole('row').filter({ hasText: 'Tech' }).first();
  await expect(row).toBeVisible();
  await row.dispatchEvent('click');
  await page.waitForURL(/collection-types\/api::category\.category\/[a-z0-9]+/i, {
    timeout: 30_000,
  });

  // The custom component renders on the stock URL, with a working <EditPage> inside.
  const custom = page.getByTestId('custom-edit-view');
  await expect(custom).toBeVisible();
  await expect(custom).toContainText('Custom category editor');
  await expect(custom.getByLabel(/name/i).first()).toHaveValue('Tech', {
    timeout: 30_000,
  });

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});

test('non-replaced models keep the stock edit view', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(
    '/admin/content-manager/collection-types/api::article.article?page=1&pageSize=10'
  );
  await dismissGuidedTour(page);
  const row = page.getByRole('row').filter({ hasText: 'The Complete Article' }).first();
  await expect(row).toBeVisible();
  await row.dispatchEvent('click');
  await page.waitForURL(/collection-types\/api::article\.article\/[a-z0-9]+/i, {
    timeout: 30_000,
  });

  await expect(page.getByRole('heading', { name: 'The Complete Article' })).toBeVisible();
  await expect(page.getByTestId('custom-edit-view')).toHaveCount(0);

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});

test('category create route renders the replacement in create mode', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/content-manager/collection-types/api::category.category/create');
  await dismissGuidedTour(page);

  const custom = page.getByTestId('custom-edit-view');
  await expect(custom).toBeVisible({ timeout: 30_000 });
  await expect(custom).toContainText('create');
  // The create form renders empty, ready for input.
  await expect(custom.getByLabel(/name/i).first()).toHaveValue('');

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});

test('saving in create mode reports the new documentId (onCreated) and lands on its edit route', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/content-manager/collection-types/api::category.category/create');
  await dismissGuidedTour(page);
  const custom = page.getByTestId('custom-edit-view');
  await expect(custom).toBeVisible({ timeout: 30_000 });

  const name = `Created via replacement ${Date.now()}`;
  await custom.getByLabel(/name/i).first().fill(name);
  await page.getByRole('button', { name: 'Save' }).click();

  // onCreated must receive the REAL documentId (the stock action resolves with the
  // response body, `{ data: { documentId } }`) — the playground's replacement view
  // navigates to it exactly like the stock create flow does.
  await page.waitForURL(/collection-types\/api::category\.category\/(?!create)[a-z0-9]+$/i, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('custom-edit-view')).toContainText(name, {
    timeout: 30_000,
  });
  await expect(custom.getByLabel(/name/i).first()).toHaveValue(name);

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});

test('document actions render formatted labels (delete label ICU select resolved)', async ({
  page,
}) => {
  await page.goto(
    '/admin/content-manager/collection-types/api::category.category?page=1&pageSize=10'
  );
  await dismissGuidedTour(page);
  const row = page.getByRole('row').filter({ hasText: 'Tech' }).first();
  await row.dispatchEvent('click');
  const custom = page.getByTestId('custom-edit-view');
  await expect(custom).toBeVisible({ timeout: 30_000 });

  // The catalog message for the delete action is an ICU select on `isLocalized`; the bar
  // must pass the value (like stock does) instead of leaking the raw pattern into the UI.
  await custom.getByRole('button', { name: /more document actions/i }).click();
  const deleteItem = page.getByRole('menuitem', { name: /delete entry/i });
  await expect(deleteItem).toBeVisible();
  await expect(deleteItem).not.toContainText('{');
  await expect(deleteItem).toHaveText(/^Delete entry$/);
  await page.keyboard.press('Escape');
});
