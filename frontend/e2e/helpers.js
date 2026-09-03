import { expect } from '@playwright/test';

export async function openPortfolio(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Planning Co-Pilot' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText('CAP00010')).toBeVisible({ timeout: 30_000 });
}

export function capRow(page, capId) {
  return page.getByRole('row').filter({ hasText: capId });
}
