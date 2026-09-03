import { expect, test } from '@playwright/test';
import { capRow, openPortfolio } from './helpers.js';

test.describe('Plan workflow', () => {
  test('opens a plan and walks the analysis steps', async ({ page }) => {
    await openPortfolio(page);

    await capRow(page, 'CAP00010').getByRole('button', { name: 'Open →' }).click();

    await expect(page.getByRole('button', { name: '← All plans' })).toBeVisible();
    await expect(page.locator('#backbar').getByText('CAP00010')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plan overview' })).toBeVisible();
    await expect(page.getByText('Step 1 · Overview')).toBeVisible();

    await page.getByRole('button', { name: 'Start review →' }).click();
    await expect(page.getByRole('heading', { name: 'Headcount snapshot' })).toBeVisible();
    await expect(page.getByText('Step 2 · Headcount')).toBeVisible();

    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(page.getByRole('heading', { name: 'New-hire & onboarding' })).toBeVisible();

    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(page.getByRole('heading', { name: 'Shrinkage trend' })).toBeVisible();

    await page.getByRole('button', { name: '← All plans' }).click();
    await expect(page.getByRole('heading', { name: 'Planning Co-Pilot' })).toBeVisible();
    await expect(page.getByText('Showing 11 of 11')).toBeVisible();
  });
});
