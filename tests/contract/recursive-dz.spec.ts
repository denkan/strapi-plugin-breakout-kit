import { test, expect, type Page } from '@playwright/test';

import { dismissGuidedTour } from './helpers/admin';

/**
 * Recursive dynamic zones: the seeded `shared.wrapper` component's `content` dynamic
 * zone lists `shared.wrapper` itself. Stock Strapi crashes on such schemas in several
 * places (admin schema walk, server populate builders, i18n locale sync); the plugin
 * makes them cycle-safe — the admin via the useContentTypeSchema shim, the server via
 * the register-phase populate patches.
 *
 * This spec drives the STOCK content-manager edit view end to end on a fresh entry:
 * render (admin walk), nest wrapper → wrapper → quote, save (i18n sync + populate),
 * reload (deep populate fetch), publish + unpublish (validation populate, draft
 * counts, core document-service populate), then deletes the entry.
 */

const ARTICLE_CREATE_URL =
  '/admin/content-manager/collection-types/api::article.article/create?plugins[i18n][locale]=en';

const collectPageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
};

test('recursive dynamic zone: nest, save, reload, publish on the stock edit view', async ({
  page,
}) => {
  const pageErrors = collectPageErrors(page);

  await page.goto(ARTICLE_CREATE_URL);
  // The edit view rendering at all is the admin-side regression: the stock
  // extractContentTypeComponents overflows the stack on the cyclic schema.
  const title = page.getByLabel(/title/i).first();
  await expect(title).toBeVisible({ timeout: 45_000 });
  await dismissGuidedTour(page);
  await title.fill('Recursive DZ contract test');

  // sections → Wrapper
  await page.getByRole('button', { name: 'Add a component to sections' }).click();
  await page.getByRole('button', { name: 'Wrapper' }).click();

  const outerEntry = page.getByRole('listitem').filter({ hasText: 'backgroundColor' }).first();
  await outerEntry.getByLabel('backgroundColor').first().fill('outer-bg');

  // Wrapper → content → Wrapper (the recursive step)
  await page.getByRole('button', { name: 'Add a component to content' }).click();
  await page.getByRole('button', { name: 'Wrapper' }).last().click();
  const bgInputs = page.getByLabel('backgroundColor');
  await expect(bgInputs).toHaveCount(2);
  await bgInputs.nth(1).fill('inner-bg');

  // inner Wrapper → content → Quote
  await page.getByRole('button', { name: 'Add a component to content' }).last().click();
  await page.getByRole('button', { name: 'Quote' }).last().click();
  // The quote's `text` field is required, so its label renders as "text*" — scope to
  // the expanded Quote accordion region instead of matching the label.
  const quoteRegion = page.getByRole('region', { name: 'Quote' }).last();
  await quoteRegion.getByRole('textbox').first().fill('Quote nested two wrappers deep');

  // Save (exercises the i18n locale-sync populate and CM update populate).
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved document')).toBeVisible({ timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/create/, { timeout: 30_000 });

  // Reload: the document is fetched with the cycle-safe deep populate.
  await page.reload();
  await expect(page.getByLabel(/title/i).first()).toHaveValue('Recursive DZ contract test', {
    timeout: 45_000,
  });

  // Collapsed accordions label themselves with the wrapper's mainField value.
  await page.getByRole('button', { name: 'Wrapper - outer-bg' }).click();
  await page.getByRole('button', { name: 'Wrapper - inner-bg' }).click();
  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Quote' }).last().getByRole('textbox').first()
  ).toHaveValue('Quote nested two wrappers deep');

  // Publish + unpublish: validation populate, draft counts, core document-service populate.
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published document')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'More document actions' }).click();
  await page.getByRole('menuitem', { name: 'Unpublish', exact: true }).click();
  await expect(page.getByText('Unpublished document')).toBeVisible({ timeout: 30_000 });

  // Cleanup: delete the test entry through the admin API. The admin authenticates
  // API calls with a Bearer token that the SPA reads from the (non-httpOnly)
  // jwtToken cookie — cookies alone return 401.
  const documentId = page.url().match(/api::article\.article\/([^/?]+)/)?.[1];
  expect(documentId).toBeTruthy();
  const jwt = (await page.context().cookies()).find((c) => c.name === 'jwtToken')?.value;
  expect(jwt).toBeTruthy();
  const deleteResponse = await page.request.delete(
    `/content-manager/collection-types/api::article.article/${documentId}?locale=en`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
  expect(deleteResponse.ok()).toBe(true);

  expect(pageErrors).toEqual([]);
});
