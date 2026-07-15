import { expect, test } from '@playwright/test';

const appStorageKeys = [
  'tractatus-tree-reader-annotations-v1',
  'tractatus-tree-reader-language-order-v1',
  'tractatus-tree-reader-selected-languages-v1',
  'tractatus-tree-reader-zoom-v1',
  'tractatus-tree-reader-expanded-nodes-v1',
  'tractatus-tree-reader-expanded-translations-v1',
  'tractatus-tree-reader-center-card-v1',
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(keys => keys.forEach(key => localStorage.removeItem(key)), appStorageKeys);
  await page.reload();
});

test('persists selected translation versions and keeps one selected', async ({ page }) => {
  await page.locator('input[name="lang"][value="de"]').uncheck();
  await page.locator('input[name="lang"][value="zh_huang"]').uncheck();
  await page.reload();

  await expect(page.locator('input[name="lang"][value="de"]')).not.toBeChecked();
  await expect(page.locator('input[name="lang"][value="zh_huang"]')).not.toBeChecked();
  await expect(page.locator('input[name="lang"][value="zh"]')).toBeChecked();

  for (const code of ['en', 'zh_wang']) {
    await page.locator(`input[name="lang"][value="${code}"]`).uncheck();
  }
  await page.locator('input[name="lang"][value="zh"]').click();
  await expect(page.locator('input[name="lang"][value="zh"]')).toBeChecked();
  await page.reload();
  await expect(page.locator('input[name="lang"][value="zh"]')).toBeChecked();
});

test('persists translation order', async ({ page }) => {
  const german = page.locator('.lang-option[data-lang="de"]');
  const chinese = page.locator('.lang-option[data-lang="zh"]');
  await german.dragTo(chinese);
  const orderBeforeReload = await page.locator('.lang-option').evaluateAll(options => {
    return options.map(option => option.dataset.lang);
  });

  await page.reload();
  const orderAfterReload = await page.locator('.lang-option').evaluateAll(options => {
    return options.map(option => option.dataset.lang);
  });
  expect(orderAfterReload).toEqual(orderBeforeReload);
  expect(orderAfterReload[0]).toBe('de');
});

test('persists branch and detail expansion', async ({ page }) => {
  await page.locator('details[data-number="2.01"] > summary .expand-btn').click();
  await page.locator('details[data-number="2.04"] .detail-toggle').click();
  await page.locator('details[data-number="2"] > summary .expand-btn').click();
  await page.reload();

  await expect(page.locator('details[data-number="2"]')).not.toHaveAttribute('open', '');
  await expect(page.locator('details[data-number="2.01"]')).toHaveAttribute('open', '');
  await expect(page.locator('details[data-number="2.04"] .detail-toggle')).toHaveAttribute('aria-expanded', 'true');
});

test('persists zoom level', async ({ page }) => {
  await page.locator('#zoomOut').click();
  await page.locator('#zoomOut').click();
  await page.locator('#zoomOut').click();
  await expect(page.locator('#zoomValue')).toHaveText('70%');
  await page.reload();
  await expect(page.locator('#zoomValue')).toHaveText('70%');
});

test('restores the card at the viewport center', async ({ page }) => {
  await page.locator('#toggle').click();
  const targetNumber = '4.211';
  await page.evaluate(number => {
    const canvas = document.querySelector('.canvas');
    const bubble = document.querySelector(`details[data-number="${number}"] > summary .bubble`);
    const canvasRect = canvas.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const centerX = canvasRect.left + canvas.clientLeft + canvas.clientWidth / 2;
    const centerY = canvasRect.top + canvas.clientTop + canvas.clientHeight / 2;
    canvas.scrollLeft += bubbleRect.left + bubbleRect.width / 2 - centerX;
    canvas.scrollTop += bubbleRect.top + bubbleRect.height / 2 - centerY;
  }, targetNumber);
  await expect.poll(async () => page.evaluate(() => {
    return localStorage.getItem('tractatus-tree-reader-center-card-v1');
  })).toBe(targetNumber);

  await page.reload();
  await expect.poll(async () => page.evaluate(number => {
    const canvas = document.querySelector('.canvas');
    const centerX = canvas.getBoundingClientRect().left + canvas.clientLeft + canvas.clientWidth / 2;
    const centerY = canvas.getBoundingClientRect().top + canvas.clientTop + canvas.clientHeight / 2;
    let nearest = null;
    let distance = Number.POSITIVE_INFINITY;
    document.querySelectorAll('details.node > summary .bubble').forEach(bubble => {
      const rect = bubble.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nextDistance = Math.hypot(
        rect.left + rect.width / 2 - centerX,
        rect.top + rect.height / 2 - centerY,
      );
      if (nextDistance >= distance) return;
      distance = nextDistance;
      nearest = bubble.closest('details.node')?.dataset.number || null;
    });
    return nearest;
  }, targetNumber)).toBe(targetNumber);
});

test('persists annotations', async ({ page }) => {
  const node = page.locator('details[data-number="2.04"]');
  await node.locator('.detail-toggle').click();
  await node.locator('.annotation-preview').dblclick();
  await node.locator('.annotation-editor').fill('状态保存测试');
  await page.reload();

  await expect(page.locator('details[data-number="2.04"] .detail-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('details[data-number="2.04"] .annotation-preview')).toContainText('状态保存测试');
});

test('does not persist temporary search expansion', async ({ page }) => {
  await page.getByRole('searchbox').fill('4.211');
  await expect(page.locator('details[data-number="4"]')).toHaveAttribute('open', '');
  await expect.poll(async () => page.evaluate(() => {
    return localStorage.getItem('tractatus-tree-reader-expanded-nodes-v1');
  })).toBeNull();

  await page.getByRole('searchbox').fill('');
  await expect(page.locator('details[data-number="4"]')).not.toHaveAttribute('open', '');
});
