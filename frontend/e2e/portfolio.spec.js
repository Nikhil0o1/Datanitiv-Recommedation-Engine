import { expect, test } from '@playwright/test';
import { capRow, openPortfolio } from './helpers.js';

test.describe('Portfolio landing', () => {
  test('loads live plans from the API', async ({ page }) => {
    await openPortfolio(page);

    await expect(page).toHaveTitle(/CAP-ABILITY/);
    await expect(page.getByText('Showing 11 of 11')).toBeVisible();
    await expect(page.getByText('ACE Retail')).toBeVisible();
    await expect(page.getByText('CAP00010')).toBeVisible();
    await expect(capRow(page, 'CAP00010').getByRole('button', { name: 'Open →' })).toBeVisible();
  });

  test('search narrows the table and empty search shows a hint', async ({ page }) => {
    await openPortfolio(page);

    const search = page.getByPlaceholder('Search plan / planner / site…');
    await search.fill('CAP00010');
    await expect(page.getByText('Showing 1 of 11')).toBeVisible();
    await expect(page.getByText('CAP00010')).toBeVisible();
    await expect(page.getByText('CAP03863')).toHaveCount(0);

    await search.fill('zzzz-no-such-plan');
    await expect(page.getByText('No plans match')).toBeVisible();
  });

  test('status filter keeps understaffed plans', async ({ page }) => {
    await openPortfolio(page);

    await page.getByRole('combobox').nth(2).selectOption('under');
    await expect(page.getByText(/Showing \d+ of 11/)).toBeVisible();
    await expect(page.getByText('CAP00010')).toBeVisible();
    await expect(capRow(page, 'CAP00010').getByText('Understaffed')).toBeVisible();
  });
});
