import { test, expect, type Page } from '@playwright/test';

/**
 * Issue #10: repeatable-component entry customization on the repeatable-demo page.
 * Same EntryCustomization shape as dz-slots.spec.ts, applied via the `repeatable`
 * prop to the seeded Article's `quotes` field (2 shared.quote entries).
 */

const selectMode = async (page: Page, label: string) => {
  await page.getByTestId('rep-demo-mode').getByRole('combobox').click();
  await page.getByRole('option', { name: label, exact: false }).first().click();
};

const waitForForm = async (page: Page) => {
  await expect(
    page.getByTestId('rep-demo-root').getByRole('heading', { name: 'The Complete Article' })
  ).toBeVisible({ timeout: 45_000 });
};

// The repeatable list is the only Accordion.Root with drag & drop instructions
// (aria-describedby); DZ per-entry accordion roots don't carry one.
const repRoot = (page: Page) =>
  page.getByTestId('rep-demo-root').locator('div[data-orientation][aria-describedby]');

test('stock mode renders the untouched repeatable', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/repeatable-demo');
  await waitForForm(page);
  await selectMode(page, 'Stock');
  await waitForForm(page);

  const rep = repRoot(page);
  await expect(rep).toHaveCount(1);
  await expect(rep.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(2);
  await expect(rep.getByRole('button', { name: 'Drag' })).toHaveCount(2);
  await expect(rep.getByRole('button', { name: 'Add an entry' })).toBeVisible();
  await expect(page.getByTestId('rep-custom-icon')).toHaveCount(0);
  await expect(page.getByTestId('rep-custom-action')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test('sugars mode: added icon, fixed labels, extra action — defaults stay wired', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/repeatable-demo');
  await waitForForm(page);

  const rep = repRoot(page);
  // entryLabel decorates the mainField value with the position; entryIcon ADDS an
  // icon stock lacks. (Seeded quotes' mainField is `attribution`.)
  await expect(rep.getByRole('button', { name: '1. Alice Writer' })).toBeVisible();
  await expect(rep.getByRole('button', { name: '2. Bob Reporter' })).toBeVisible();
  await expect(rep.getByTestId('rep-custom-icon')).toHaveCount(2);
  await expect(rep.getByTestId('rep-custom-action')).toHaveCount(2);

  // The relocated stock delete still removes an entry; labels re-rank.
  await rep.getByRole('button', { name: 'Delete', exact: true }).first().click();
  await expect(rep.getByRole('button', { name: /Alice Writer/ })).toHaveCount(0);
  await expect(rep.getByRole('button', { name: '1. Bob Reporter' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('custom mode: cards replace the accordion; custom add button appends', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/repeatable-demo');
  await waitForForm(page);
  await selectMode(page, 'Custom');
  await waitForForm(page);

  const root = page.getByTestId('rep-demo-root');
  // Entries are cards with always-open fields; stock accordion chrome is gone.
  await expect(root.getByTestId('rep-box-entry')).toHaveCount(2);
  const firstCard = root.getByTestId('rep-box-entry').first();
  await expect(firstCard.getByLabel(/text/)).toBeVisible();
  await expect(repRoot(page).getByRole('button', { name: 'Drag' })).toHaveCount(0);

  // Custom add button replaces "Add an entry" and appends via ctx.add().
  await expect(root.getByRole('button', { name: 'Add an entry' })).toHaveCount(0);
  const addButton = root.getByTestId('rep-custom-add');
  await expect(addButton).toContainText('Add quote #3');
  await addButton.click();
  await expect(root.getByTestId('rep-box-entry')).toHaveCount(3);
  await expect(addButton).toContainText('Add quote #4');

  // Custom remove wired through entry.onRemove.
  await root.getByTestId('rep-box-entry').last().getByRole('button', { name: 'Remove' }).click();
  await expect(root.getByTestId('rep-box-entry')).toHaveCount(2);

  expect(pageErrors).toEqual([]);
});
