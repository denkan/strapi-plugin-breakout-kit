import { test, expect } from '@playwright/test';

const ORIGINAL_TITLE = 'The Complete Article';
const EDITED_TITLE = 'The Complete Article (hooks-edited)';

/**
 * Phase 3 checkpoint: a playground page uses ONLY the data-layer hooks to display and
 * edit documents, with no router params involved. Also verifies two <DocumentProvider>s
 * coexist with independent form state (collection type + single type side by side).
 */
test('hooks-only page edits and saves documents through the data layer', async ({ page }) => {
  await page.goto('/admin/breakout-playground/hooks-demo');

  const articleInput = page.getByTestId('hooks-article-input');
  const singleInput = page.getByTestId('hooks-single-input');

  // Both providers render their documents simultaneously.
  await expect(articleInput).toHaveValue(ORIGINAL_TITLE, { timeout: 30_000 });
  await expect(singleInput).toHaveValue('Headless CM Playground');
  await expect(page.getByTestId('hooks-article-docid')).not.toHaveText(/single type/);

  // Editing one form doesn't touch the other provider's state.
  await expect(page.getByTestId('hooks-article-modified')).toHaveText('clean');
  await articleInput.fill(EDITED_TITLE);
  await expect(page.getByTestId('hooks-article-modified')).toHaveText('modified');
  await expect(page.getByTestId('hooks-single-modified')).toHaveText('clean');

  // Save persists through the document service and resets the dirty state.
  await page.getByTestId('hooks-article-save').click();
  await expect(page.getByTestId('hooks-article-result')).toHaveText('saved');
  await expect(page.getByTestId('hooks-article-modified')).toHaveText('clean');

  // Reload: the edit survived.
  await page.reload();
  await expect(articleInput).toHaveValue(EDITED_TITLE, { timeout: 30_000 });

  // Single-type save works too.
  await singleInput.fill('Headless CM Playground!');
  await page.getByTestId('hooks-single-save').click();
  await expect(page.getByTestId('hooks-single-result')).toHaveText('saved');
  await page.reload();
  await expect(singleInput).toHaveValue('Headless CM Playground!', { timeout: 30_000 });

  // Revert both edits to keep the seed state (and prove save again).
  await articleInput.fill(ORIGINAL_TITLE);
  await page.getByTestId('hooks-article-save').click();
  await expect(page.getByTestId('hooks-article-result')).toHaveText('saved');
  await singleInput.fill('Headless CM Playground');
  await page.getByTestId('hooks-single-save').click();
  await expect(page.getByTestId('hooks-single-result')).toHaveText('saved');
});
