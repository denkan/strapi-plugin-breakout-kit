import { type Page, expect } from '@playwright/test';

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@playground.local';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Playground123!';

/** Logs into the Strapi admin (seeded credentials) and waits for the home page. */
export async function loginToAdmin(page: Page) {
  await page.goto('/admin');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  // The main navigation renders only for an authenticated session.
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30_000 });
  await dismissGuidedTour(page);
}

/** Closes the guided-tour overlay if it is showing (it intercepts pointer events). */
export async function dismissGuidedTour(page: Page) {
  const skip = page.getByRole('button', { name: /skip/i }).first();
  if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skip.click();
  }
}
