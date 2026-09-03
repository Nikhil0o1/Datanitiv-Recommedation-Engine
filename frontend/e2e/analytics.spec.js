import { expect, test } from '@playwright/test';

test.describe('Analytics', () => {
  test('loads the cost dashboard', async ({ page }) => {
    await page.goto('/cost');

    await expect(page).toHaveTitle(/Analytics/);
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Total Requests')).toBeVisible();
    await expect(page.getByText('Total Cost')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Usage' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30D' })).toBeVisible();

    await page.getByRole('button', { name: 'Cost', exact: true }).click();
    await expect(page.getByText(/Cost Over Time|No data yet/)).toBeVisible();
  });
});
