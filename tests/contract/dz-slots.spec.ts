import { test, expect, type Page } from '@playwright/test';

/**
 * Issue #4: dynamic-zone entry customization slots on the dz-demo playground page.
 * The page renders <EditPage form={{ dynamicZone }}> over the seeded Article's
 * `sections` zone (Quote, Link, Media block) in three modes; "stock" (no config)
 * doubles as the regression baseline (full pixel parity is covered by parity.spec.ts).
 */

const selectMode = async (page: Page, label: string) => {
  await page.getByTestId('dz-demo-mode').getByRole('combobox').click();
  await page.getByRole('option', { name: label, exact: false }).first().click();
};

const waitForForm = async (page: Page) => {
  await expect(
    page.getByTestId('dz-demo-root').getByRole('heading', { name: 'The Complete Article' })
  ).toBeVisible({ timeout: 45_000 });
};

test('stock mode renders the untouched dynamic zone', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/dz-demo');
  await waitForForm(page);
  await selectMode(page, 'Stock');
  await waitForForm(page);

  const root = page.getByTestId('dz-demo-root');
  // The DZ renders as an <ol aria-describedby> (drag & drop instructions); the article's
  // repeatable `quotes` field has its own Delete/Drag buttons, so scope counts to it.
  const dzList = root.locator('ol[aria-describedby]');
  // Stock chrome: three entries with stock action buttons, none of our custom markers.
  await expect(dzList.getByRole('button', { name: /^Delete/ })).toHaveCount(3);
  await expect(dzList.getByRole('button', { name: 'Drag' })).toHaveCount(3);
  await expect(dzList.getByRole('button', { name: 'More actions' })).toHaveCount(3);
  await expect(root.getByTestId('dz-custom-action')).toHaveCount(0);
  await expect(root.getByTestId('dz-custom-icon')).toHaveCount(0);
  await expect(root.getByRole('button', { name: '1. Quote' })).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test('sugars mode: entryIcon, entryLabel and entryActions with mixed defaults', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/dz-demo');
  await waitForForm(page);

  const root = page.getByTestId('dz-demo-root');

  // entryLabel decorates the stock label with the position.
  const quoteEntry = root.getByRole('listitem').filter({ hasText: '1. Quote' });
  const linkEntry = root.getByRole('listitem').filter({ hasText: '2. Link' });
  const mediaEntry = root.getByRole('listitem').filter({ hasText: '3. Media block' });
  await expect(quoteEntry).toHaveCount(1);
  await expect(linkEntry).toHaveCount(1);
  await expect(mediaEntry).toHaveCount(1);

  // entryIcon: custom icons for quote + link only; media-block falls back to stock.
  await expect(quoteEntry.getByTestId('dz-custom-icon')).toHaveCount(1);
  await expect(linkEntry.getByTestId('dz-custom-icon')).toHaveCount(1);
  await expect(mediaEntry.getByTestId('dz-custom-icon')).toHaveCount(0);

  // entryActions: every entry gains the custom info button ahead of the defaults…
  await expect(root.getByTestId('dz-custom-action')).toHaveCount(3);
  // …quotes surgically lose the "more actions" menu but keep delete + drag…
  await expect(quoteEntry.getByRole('button', { name: 'More actions' })).toHaveCount(0);
  await expect(quoteEntry.getByRole('button', { name: /^Delete/ })).toHaveCount(1);
  await expect(quoteEntry.getByRole('button', { name: 'Drag' })).toHaveCount(1);
  // …while the others keep the full stock set (d.all).
  await expect(linkEntry.getByRole('button', { name: 'More actions' })).toHaveCount(1);
  await expect(mediaEntry.getByRole('button', { name: 'More actions' })).toHaveCount(1);

  // The relocated defaults stay wired: stock delete still removes the entry.
  await quoteEntry.getByRole('button', { name: /^Delete/ }).click();
  await expect(root.getByRole('listitem').filter({ hasText: 'Quote' })).toHaveCount(0);
  // Labels re-rank after removal (entryLabel receives fresh meta).
  await expect(root.getByRole('listitem').filter({ hasText: '1. Link' })).toHaveCount(1);

  expect(pageErrors).toEqual([]);
});

test('renderEntry mode: DefaultEntry overrides and fully custom chrome', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/dz-demo');
  await waitForForm(page);
  await selectMode(page, 'renderEntry');
  await waitForForm(page);

  const root = page.getByTestId('dz-demo-root');

  // shared.link: custom chrome instead of the accordion, stock fields inside.
  const chrome = root.getByTestId('dz-custom-chrome');
  await expect(chrome).toHaveCount(1);
  await expect(chrome).toContainText('Link #2');
  await expect(chrome.getByLabel(/label/)).toBeVisible();
  await expect(chrome.getByLabel(/url/)).toBeVisible();

  // shared.media-block: <DefaultEntry icon label> keeps the accordion, swaps chrome bits.
  await expect(root.getByRole('button', { name: 'Media — Media block' })).toBeVisible();

  // shared.quote: plain <DefaultEntry /> stays stock (scope to the DZ <ol> — other
  // buttons on the page can also carry a "Quote…" accessible name).
  const dzList = root.locator('ol[aria-describedby]');
  await expect(dzList.getByRole('button', { name: /^Quote/ })).toBeVisible();

  // Custom reorder controls are wired through entry.onMove.
  await chrome.getByRole('button', { name: 'Move up' }).click();
  await expect(root.getByTestId('dz-custom-chrome')).toContainText('Link #1');

  expect(pageErrors).toEqual([]);
});

test('boxes mode: accordion fully replaced by styled cards', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/dz-demo');
  await waitForForm(page);
  await selectMode(page, 'Boxes');
  await waitForForm(page);

  const root = page.getByTestId('dz-demo-root');
  const dzList = root.locator('ol[aria-describedby]');

  // Every entry is a card; no stock accordion chrome remains in the zone.
  await expect(root.getByTestId('dz-box-entry')).toHaveCount(3);
  await expect(dzList.getByRole('button', { name: 'Drag' })).toHaveCount(0);
  await expect(dzList.getByRole('button', { name: 'More actions' })).toHaveCount(0);

  // Fields render always-open (no collapse to click through).
  const quoteCard = root.getByTestId('dz-box-entry').filter({ hasText: '1. Quote' });
  await expect(quoteCard.getByLabel(/text/)).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('addButton mode: custom button + popup picker replace the stock flow', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/dz-demo');
  await waitForForm(page);
  await selectMode(page, 'renderAddButton');
  await waitForForm(page);

  const root = page.getByTestId('dz-demo-root');
  const dzList = root.locator('ol[aria-describedby]');

  // Stock button gone, custom button in its place.
  await expect(root.getByRole('button', { name: /Add a component to/ })).toHaveCount(0);
  const addButton = root.getByTestId('dz-custom-add');
  await expect(addButton).toBeVisible();
  await expect(addButton).toContainText('3 added');

  // The popup lists allowed components grouped by category — plain buttons.
  await addButton.click();
  const picker = page.getByTestId('dz-custom-picker'); // portaled outside the root
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('heading', { name: 'shared' })).toBeVisible();
  for (const name of ['Quote', 'Link', 'Media block']) {
    await expect(picker.getByRole('button', { name, exact: true })).toBeVisible();
  }

  // Picking one inserts via ctx.add and closes the popup; stock picker never opened.
  await picker.getByRole('button', { name: 'Quote', exact: true }).click();
  await expect(picker).not.toBeVisible();
  await expect(dzList.getByRole('listitem')).toHaveCount(4);
  await expect(addButton).toContainText('4 added');

  expect(pageErrors).toEqual([]);
});
