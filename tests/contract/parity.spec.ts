import path from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import { dismissGuidedTour } from './helpers/admin';

/* eslint-disable @typescript-eslint/no-var-requires */
const Database = require('better-sqlite3');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default ?? pixelmatchModule;
const { PNG } = require('pngjs');
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * Phase 5 parity tests: for each seeded content type, the headless <EditPage> must match
 * the stock edit view — same form structure (label sequence), same visual rendering of
 * the form area (pixel diff with tolerance), and interchangeable edit/save/publish flows.
 *
 * Known, deliberate v0 deltas excluded from comparison (docs/decisions.md #3/#4 and
 * docs/usage/components.md "Known gaps"): header chrome (back link, Information menu,
 * plugin header actions like the i18n locale picker), third-party side panels,
 * history/preview actions, guided tour.
 */

const DB_PATH = path.resolve(__dirname, '../../apps/playground/.tmp/data.db');

interface SeededDoc {
  model: string;
  kind: 'collectionType' | 'singleType';
  table: string;
  where?: string;
  label: string;
}

const TYPES: SeededDoc[] = [
  {
    model: 'api::article.article',
    kind: 'collectionType',
    table: 'articles',
    where: "locale = 'en' AND title = 'The Complete Article'",
    label: 'Article',
  },
  {
    model: 'api::author.author',
    kind: 'collectionType',
    table: 'authors',
    where: "name = 'Alice Writer'",
    label: 'Author',
  },
  {
    model: 'api::category.category',
    kind: 'collectionType',
    table: 'categories',
    where: "name = 'Tech'",
    label: 'Category',
  },
  {
    model: 'api::global-setting.global-setting',
    kind: 'singleType',
    table: 'global_settings',
    label: 'Global Setting',
  },
];

const getDocumentId = (type: SeededDoc): string | undefined => {
  if (type.kind === 'singleType') return undefined;
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const row = db
      .prepare(`SELECT document_id FROM ${type.table} WHERE ${type.where} LIMIT 1`)
      .get() as { document_id: string } | undefined;
    return row?.document_id;
  } finally {
    db.close();
  }
};

const stockUrl = (type: SeededDoc, documentId?: string) =>
  type.kind === 'singleType'
    ? `/admin/content-manager/single-types/${type.model}`
    : `/admin/content-manager/collection-types/${type.model}/${documentId}${
        type.model === 'api::article.article' ? '?plugins[i18n][locale]=en' : ''
      }`;

/** Opens the EditPage demo and selects the given model (first document auto-selected). */
async function openEditPage(page: Page, type: SeededDoc) {
  await page.goto('/admin/plugins/headless-content-manager/edit-page');
  await page.getByTestId('editpage-model').getByRole('combobox').click();
  await page.getByRole('option', { name: type.label, exact: false }).first().click();
  await expect(page.getByTestId('editpage-root')).toBeVisible({ timeout: 30_000 });
  // Wait for the form to be populated (a label from the schema shows up).
  await expect(page.getByTestId('editpage-root').locator('label').first()).toBeVisible({
    timeout: 30_000,
  });
}

const formLabels = async (page: Page, scope: ReturnType<Page['locator']>) => {
  // The visible tab panel contains the form; grab label texts in DOM order.
  const panel = scope.locator('[role="tabpanel"]:not([hidden])').first();
  await expect(panel.locator('label').first()).toBeVisible({ timeout: 30_000 });
  const labels = await panel.locator('label').allInnerTexts();
  return labels.map((label) => label.trim());
};

for (const type of TYPES) {
  test(`form structure parity: ${type.label}`, async ({ page }) => {
    const documentId = getDocumentId(type);
    if (type.kind === 'collectionType') expect(documentId).toBeTruthy();

    await page.goto(stockUrl(type, documentId));
    await dismissGuidedTour(page);
    const stockLabels = await formLabels(page, page.locator('main'));

    await openEditPage(page, type);
    const headlessLabels = await formLabels(page, page.getByTestId('editpage-root'));

    expect(headlessLabels, 'label sequence must match the stock edit view').toEqual(
      stockLabels
    );
  });
}

test('visual parity of the article form area (tolerance)', async ({ page }) => {
  const type = TYPES[0];
  const documentId = getDocumentId(type);

  // Scroll through so lazy editors (codemirror JSON, media thumbs) actually render,
  // then capture the FORM ROOT (last child of the visible tabpanel — the stock panel
  // also contains an empty guided-tour box as its first child).
  const settle = async () => {
    await page.mouse.wheel(0, 10_000);
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, -20_000);
    await page.waitForTimeout(1500);
  };
  const formRoot = (scope: ReturnType<Page['locator']>) =>
    scope.locator('[role="tabpanel"]:not([hidden]) > div:last-child').first();

  await page.setViewportSize({ width: 1600, height: 2400 });
  await page.goto(stockUrl(type, documentId));
  await dismissGuidedTour(page);
  // Element screenshots mis-offset for elements taller than the viewport, so take a
  // full-page shot and crop to the element's bounding box ourselves.
  const captureElement = async (locator: ReturnType<Page['locator']>) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error('element has no bounding box');
    const full = PNG.sync.read(await page.screenshot({ fullPage: true }));
    const x = Math.max(0, Math.round(box.x));
    const y = Math.max(0, Math.round(box.y));
    const w = Math.min(Math.round(box.width), full.width - x);
    const h = Math.min(Math.round(box.height), full.height - y);
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(full, out, x, y, w, h, 0, 0);
    return out;
  };

  const stockPanel = formRoot(page.locator('main'));
  await expect(stockPanel.locator('label').first()).toBeVisible({ timeout: 30_000 });
  await settle();
  const stockShot = await captureElement(stockPanel);

  // The stock CM page has its own sub-navigation column that the demo page lacks, so the
  // same viewport yields a wider form column headless. Normalize by shrinking the
  // headless viewport until the form columns are the same width (layout is ~linear in
  // available width; a few iterations converge).
  await openEditPage(page, type);
  const headlessPanel = formRoot(page.getByTestId('editpage-root'));
  let viewportWidth = 1600;
  let headlessShot = null as InstanceType<typeof PNG> | null;
  for (let i = 0; i < 4; i += 1) {
    await page.setViewportSize({ width: viewportWidth, height: 2400 });
    await settle();
    headlessShot = await captureElement(headlessPanel);
    const delta = headlessShot.width - stockShot.width;
    if (Math.abs(delta) <= 4) break;
    viewportWidth -= Math.round(delta * 1.2);
  }
  if (!headlessShot) throw new Error('no headless screenshot');

  const width = Math.min(stockShot.width, headlessShot.width);
  const height = Math.min(stockShot.height, headlessShot.height);
  expect(
    Math.abs(stockShot.width - headlessShot.width),
    `form column widths should converge (stock ${stockShot.width}px vs headless ${headlessShot.width}px)`
  ).toBeLessThanOrEqual(4);

  const crop = (png: InstanceType<typeof PNG>) => {
    const out = new PNG({ width, height });
    PNG.bitblt(png, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const a = crop(stockShot);
  const b = crop(headlessShot);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: 0.2,
  });
  const ratio = mismatched / (width * height);
  // Always persist the images — invaluable when the tolerance is exceeded.
  const fs = require('node:fs');
  fs.mkdirSync('test-results/visual-parity', { recursive: true });
  fs.writeFileSync('test-results/visual-parity/stock.png', PNG.sync.write(a));
  fs.writeFileSync('test-results/visual-parity/headless.png', PNG.sync.write(b));
  fs.writeFileSync('test-results/visual-parity/diff.png', PNG.sync.write(diff));
  console.log(
    `visual parity: ${mismatched}/${width * height} pixels differ (${(ratio * 100).toFixed(2)}%)`
  );
  expect(ratio, 'form area pixel difference within tolerance').toBeLessThan(0.05);
});

test('edit/save flows are interchangeable between stock and EditPage', async ({ page }) => {
  const type = TYPES[0];
  const documentId = getDocumentId(type);

  // 1. Edit + save through the headless EditPage.
  await openEditPage(page, type);
  const root = page.getByTestId('editpage-root');
  const wordCount = root.getByLabel('wordCount').first();
  await expect(wordCount).toHaveValue('1,200');
  await wordCount.fill('1300');
  const save = root.getByRole('button', { name: 'Save' });
  await save.click();
  await expect(save).toBeDisabled({ timeout: 15_000 });

  // 2. The stock edit view sees the change and saves it back.
  await page.goto(stockUrl(type, documentId));
  await dismissGuidedTour(page);
  const stockWordCount = page.locator('main').getByLabel('wordCount').first();
  await expect(stockWordCount).toHaveValue('1,300', { timeout: 30_000 });
  await stockWordCount.fill('1200');
  await page.locator('main').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main').getByRole('button', { name: 'Save' })).toBeDisabled({
    timeout: 15_000,
  });

  // 3. EditPage sees the stock edit.
  await openEditPage(page, type);
  await expect(page.getByTestId('editpage-root').getByLabel('wordCount').first()).toHaveValue(
    '1,200',
    { timeout: 30_000 }
  );

  // 4. Publish through EditPage (seed article is already published; republishing the
  //    same data keeps the seed state) and verify the stock view agrees on the status.
  await page.getByTestId('editpage-root').getByRole('button', { name: 'Publish' }).click();
  await expect(
    page.getByTestId('editpage-root').getByText(/^Published$/).first()
  ).toBeVisible({ timeout: 20_000 });

  await page.goto(stockUrl(type, documentId));
  await dismissGuidedTour(page);
  await expect(page.locator('main').getByText(/^Published$/).first()).toBeVisible({
    timeout: 30_000,
  });
});
