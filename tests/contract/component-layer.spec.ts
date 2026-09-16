import { test, expect } from '@playwright/test';

/**
 * Phase 4 checkpoint: every field type from the playground seed renders through
 * <EditForm>/<FieldRenderer> on the components-demo page, and the document saves
 * through the stock action bar backed by headless operations.
 */

// One label per attribute of the seeded Article (default labels = field names; rendered
// labels may carry a required star or relation/entry counts, e.g. "title*", "categories (2)").
const FIELD_LABELS = [
  'title', // string
  'slug', // uid
  'body', // blocks rich text
  'legacyBody', // markdown wysiwyg
  'wordCount', // integer
  'price', // decimal
  'rating', // float
  'viewCount', // biginteger
  'featured', // boolean
  'publishDate', // date
  'publishTime', // time
  'exactMoment', // datetime
  'tone', // enumeration
  'contactEmail', // email
  'cover', // media single
  'gallery', // media multiple
  'metadata', // json
  'author', // manyToOne relation
  'categories', // manyToMany relation
  'heroCategory', // oneWay relation
  'contributors', // manyWay relation
  'spotlightAuthor', // oneToOne relation
  'seo', // component (single) — nested metaTitle/metaDescription assert separately
  'quotes', // component (repeatable)
];

// Nested component fields prove the component input renders its children.
const NESTED_LABELS = ['metaTitle', 'metaDescription', 'shareImage'];

test('component layer renders every field type and saves through the action bar', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/components-demo');

  const form = page.getByTestId('components-form');
  await expect(form).toBeVisible({ timeout: 45_000 });

  // Header renders the document title + status badge.
  await expect(
    page.getByRole('heading', { name: 'The Complete Article' })
  ).toBeVisible();

  // Every seeded field type renders an input/label in the form.
  for (const label of [...FIELD_LABELS, ...NESTED_LABELS]) {
    const pattern = new RegExp(`^${label}\\b`);
    await expect(
      form.locator('label').filter({ hasText: pattern }).first(),
      `field "${label}" should render`
    ).toBeVisible();
  }

  // The dynamic zone renders its own (non-<label>) heading.
  await expect(form.getByText(/^sections/).first(), 'dynamic zone should render').toBeVisible();

  // The actions panel renders stock-style buttons from headless descriptions.
  const panels = page.getByTestId('components-panels');
  await expect(panels.getByRole('button', { name: 'Publish' })).toBeVisible();
  const saveButton = panels.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeDisabled(); // nothing modified yet

  // Edit a number field and save through the bar.
  const wordCount = form.getByLabel('wordCount').first();
  await expect(wordCount).toHaveValue('1,200'); // number inputs render locale-formatted
  await wordCount.fill('1300');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(saveButton).toBeDisabled({ timeout: 15_000 }); // form clean again after save

  // Persisted across reload.
  await page.reload();
  await expect(form.getByLabel('wordCount').first()).toHaveValue('1,300', {
    timeout: 45_000,
  });

  // Revert to keep the seed state.
  await form.getByLabel('wordCount').first().fill('1200');
  await panels.getByRole('button', { name: 'Save' }).click();
  await expect(panels.getByRole('button', { name: 'Save' })).toBeDisabled({
    timeout: 15_000,
  });

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
});
