import { test, expect } from '@playwright/test';

test('iPhone WebKit: Studio起動から開発管理を開ける', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/studio/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/GK Studio GKS-B677/);

  // iPhone layout hides the feature launcher until the bottom "機能一覧" tab is opened.
  // Follow the same path as the real device instead of targeting a hidden desktop/sidebar button.
  const featureListButton = page.getByRole('button', { name: '機能一覧', exact: true });
  await expect(featureListButton).toBeVisible();
  await featureListButton.click();

  const mobileLauncher = page.locator('#sidebar.mobile-open');
  await expect(mobileLauncher).toBeVisible();
  const launcherButton = mobileLauncher.getByRole('button', { name: '開発管理', exact: true });
  await expect(launcherButton).toBeVisible();
  await launcherButton.click();

  await expect(page.getByRole('heading', { name: '開発管理', exact: true })).toBeVisible();
  await expect(page.getByText('Development Projects / Workflow / Confirmation / Navigation')).toBeVisible();
  expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([]);
});
