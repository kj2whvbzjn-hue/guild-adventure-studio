import { test, expect } from '@playwright/test';

test('iPhone WebKit: Studio起動から開発管理を開ける', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/studio/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/GK Studio GKS-B676/);

  const launcherButton = page.getByRole('button', { name: '開発管理', exact: true }).first();
  await expect(launcherButton).toBeVisible();
  await launcherButton.click();

  await expect(page.getByRole('heading', { name: '開発管理', exact: true })).toBeVisible();
  await expect(page.getByText('Development Projects / Workflow / Confirmation / Navigation')).toBeVisible();
  expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([]);
});
