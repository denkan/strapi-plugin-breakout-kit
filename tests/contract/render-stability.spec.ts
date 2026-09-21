import { test, expect, type Page } from '@playwright/test';

/**
 * Render/remount stability of the seam `Default*` components and the form body.
 *
 * Regression guard for the dogfooding report: any onChange re-rendered the whole edit
 * view, remounting subtrees (inputs lost focus every keystroke, accordions collapsed,
 * mount-time fetches re-fired in loops). Root cause: component types created during
 * render (`DefaultBody`, `DefaultEntry`, `DefaultBox`, `DefaultAddButton`) — a new type
 * per render makes React unmount/remount the subtree. These tests type multiple
 * characters into inputs whose surrounding tree re-renders on every keystroke; a
 * remount would drop focus after the first character, so the full string landing +
 * retained focus proves the identity is stable.
 */

const TYPED = 'stability';

const selectMode = async (page: Page, testId: string, label: string) => {
  await page.getByTestId(testId).getByRole('combobox').click();
  await page.getByRole('option', { name: label, exact: false }).first().click();
};

test('values-subscribed controller: stock EditForm body survives per-keystroke re-renders', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/layout-demo');
  await expect(
    page.getByTestId('layout-demo-root').getByLabel(/title/).first()
  ).toBeVisible({ timeout: 45_000 });
  await selectMode(page, 'layout-demo-mode', 'controller');

  const root = page.getByTestId('layout-demo-root');
  // Controller mode = DocumentProvider > values-subscribed wrapper > stock <EditForm />.
  const counter = root.getByTestId('controller-values-size');
  await expect(counter).toBeVisible({ timeout: 45_000 });
  const sizeBefore = await counter.textContent();

  const title = root.getByLabel(/title/).first();
  await title.click();
  await title.pressSequentially(TYPED);

  // The wrapper really re-rendered while typing (the whole point of the stress)…
  await expect(counter).not.toHaveText(sizeBefore ?? '');
  // …yet the input was never remounted: full string landed and focus survived.
  await expect(title).toHaveValue(new RegExp(TYPED));
  await expect(title).toBeFocused();

  expect(pageErrors).toEqual([]);
});

test('renderEntry <DefaultEntry />: typing inside an expanded entry keeps focus and expansion', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/dz-demo');
  await expect(
    page.getByTestId('dz-demo-root').getByRole('heading', { name: 'The Complete Article' })
  ).toBeVisible({ timeout: 45_000 });
  await selectMode(page, 'dz-demo-mode', 'renderEntry');

  const root = page.getByTestId('dz-demo-root');
  // shared.quote renders as a plain <DefaultEntry /> in this mode — expand it.
  const dzList = root.locator('ol[aria-describedby]');
  await dzList.getByRole('button', { name: /^Quote/ }).click();
  const attribution = dzList.getByLabel(/attribution/).first();
  await expect(attribution).toBeVisible();

  // Every keystroke changes the zone's array value and re-renders the DZ Field —
  // DefaultEntry identity must survive or the entry remounts mid-word.
  await attribution.click();
  await attribution.pressSequentially(TYPED);
  await expect(attribution).toHaveValue(new RegExp(TYPED));
  await expect(attribution).toBeFocused();

  expect(pageErrors).toEqual([]);
});

test('renderBox <DefaultBox />: typing inside the wrapped stock box keeps focus', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/admin/breakout-playground/component-demo');
  await expect(
    page.getByTestId('sc-demo-root').getByRole('heading', { name: 'The Complete Article' })
  ).toBeVisible({ timeout: 45_000 });
  await selectMode(page, 'sc-demo-mode', 'DefaultBox');

  const box = page.getByTestId('sc-demo-root').getByTestId('sc-wrapped-box');
  await expect(box).toBeVisible();

  // ComponentInput re-renders on every change inside the component (useField) —
  // DefaultBox identity must survive or the whole box remounts per keystroke.
  const metaTitle = box.getByLabel(/metaTitle/).first();
  await metaTitle.click();
  await metaTitle.pressSequentially(TYPED);
  await expect(metaTitle).toHaveValue(new RegExp(TYPED));
  await expect(metaTitle).toBeFocused();

  expect(pageErrors).toEqual([]);
});
