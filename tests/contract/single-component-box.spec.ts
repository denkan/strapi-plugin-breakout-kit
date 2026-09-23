import { test, expect, type Page } from '@playwright/test';

/**
 * Single-component renderBox seam on the component-demo page: the seeded Article's
 * `seo` field (shared.seo, non-repeatable, seeded non-null). The custom mode covers
 * the full state roundtrip: custom box → onClear → custom initializer → onInitialize
 * → custom box again. All form-state only; nothing is saved.
 */

const selectMode = async (page: Page, label: string) => {
  await page.getByTestId('sc-demo-mode').getByRole('combobox').click();
  await page.getByRole('option', { name: label, exact: false }).first().click();
};

const waitForForm = async (page: Page) => {
  await expect(
    page.getByTestId('sc-demo-root').getByRole('heading', { name: 'The Complete Article' })
  ).toBeVisible({ timeout: 45_000 });
};

test('stock mode renders the untouched single-component box', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/component-demo');
  await waitForForm(page);
  await selectMode(page, 'Stock');
  await waitForForm(page);

  const root = page.getByTestId('sc-demo-root');
  // Seeded non-null: stock boxed fields, no custom markers.
  await expect(root.getByLabel(/metaTitle/)).toBeVisible();
  await expect(root.getByTestId('sc-custom-box')).toHaveCount(0);
  await expect(root.getByTestId('sc-custom-init')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test('custom mode: renderBox covers both states with a full roundtrip', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/component-demo');
  await waitForForm(page);

  const root = page.getByTestId('sc-demo-root');

  // Value state: custom card with the stock fields inside.
  const box = root.getByTestId('sc-custom-box');
  await expect(box).toBeVisible();
  await expect(box).toContainText('SEO — custom box');
  await expect(box.getByLabel(/metaTitle/)).toBeVisible();

  // onClear -> null state: custom initializer replaces the card (and the stock
  // "No entry yet" box never appears).
  await box.getByTestId('sc-custom-clear').click();
  await expect(root.getByTestId('sc-custom-box')).toHaveCount(0);
  const init = root.getByTestId('sc-custom-init');
  await expect(init).toBeVisible();
  await expect(init).toContainText('Set up SEO — custom initializer');
  await expect(root.getByText('No entry yet')).toHaveCount(0);

  // onInitialize -> back to the custom card with default form values.
  await init.click();
  await expect(root.getByTestId('sc-custom-box')).toBeVisible();
  await expect(root.getByTestId('sc-custom-box').getByLabel(/metaTitle/)).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('subset mode: renderFields({ fields }) renders only the listed fields', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/component-demo');
  await waitForForm(page);
  await selectMode(page, 'Subset');
  await waitForForm(page);

  const box = page.getByTestId('sc-demo-root').getByTestId('sc-subset-box');
  await expect(box).toBeVisible();
  await expect(box.getByLabel(/metaTitle/)).toBeVisible();
  await expect(box.getByLabel(/metaDescription/)).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
