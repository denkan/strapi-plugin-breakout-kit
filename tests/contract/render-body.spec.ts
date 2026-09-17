import { test, expect, type Page } from '@playwright/test';

/**
 * renderBody seam on the layout-demo page: rearranges the Article form's PANELS
 * (panel 1 = all regular fields incl. title, panel 2 = the `sections` dynamic zone)
 * into a "General" accordion or tabs. Stock mode is the baseline.
 */

const selectMode = async (page: Page, label: string) => {
  await page.getByTestId('layout-demo-mode').getByRole('combobox').click();
  await page.getByRole('option', { name: label, exact: false }).first().click();
};

const waitForForm = async (page: Page) => {
  await expect(
    page.getByTestId('layout-demo-root').getByRole('heading', { name: 'The Complete Article' })
  ).toBeVisible({ timeout: 45_000 });
};

test('stock mode renders the untouched panel stack', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/layout-demo');
  await waitForForm(page);
  await selectMode(page, 'Stock');
  await waitForForm(page);

  const root = page.getByTestId('layout-demo-root');
  await expect(root.getByLabel(/title/)).toBeVisible();
  await expect(root.getByTestId('body-general-accordion')).toHaveCount(0);
  await expect(root.getByTestId('body-tabs')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test('accordion mode: non-DZ panels grouped into a collapsible General accordion', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/layout-demo');
  await waitForForm(page);

  const root = page.getByTestId('layout-demo-root');
  const accordion = root.getByTestId('body-general-accordion');
  await expect(accordion).toBeVisible();

  // Regular fields live INSIDE the accordion; the dynamic zone stays outside it.
  await expect(accordion.getByLabel(/title/)).toBeVisible();
  await expect(accordion.getByRole('button', { name: /Add a component to/ })).toHaveCount(0);
  await expect(root.getByRole('button', { name: /Add a component to sections/ })).toBeVisible();

  // The accordion actually collapses.
  await accordion.getByRole('button', { name: 'General' }).click();
  await expect(accordion.getByLabel(/title/)).toHaveCount(0);
  await accordion.getByRole('button', { name: 'General' }).click();
  await expect(accordion.getByLabel(/title/)).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('tabs mode: one tab per panel, switching swaps the visible panel', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/layout-demo');
  await waitForForm(page);
  await selectMode(page, 'one tab per panel');
  await waitForForm(page);

  const root = page.getByTestId('layout-demo-root');
  const tabs = root.getByTestId('body-tabs');
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  await expect(tabs.getByRole('tab', { name: 'General' })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'sections' })).toBeVisible();

  // First tab: regular fields, no DZ add button.
  await expect(tabs.getByLabel(/title/)).toBeVisible();
  await expect(tabs.getByRole('button', { name: /Add a component to/ })).toHaveCount(0);

  // Switch to the zone tab: DZ visible, regular fields gone.
  await tabs.getByRole('tab', { name: 'sections' }).click();
  await expect(tabs.getByRole('button', { name: /Add a component to/ })).toBeVisible();
  await expect(tabs.getByLabel(/title/)).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
