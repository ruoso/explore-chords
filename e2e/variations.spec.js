import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, goToView } from './helpers.js';

/**
 * Variations of a song's voicings (docs/DESIGN.md §2.13): an easy version and a
 * fuller one, or two runs of the wizard kept side by side.
 */
test.describe('variations of a song\'s voicings', () => {
  const amIn = (page) =>
    page.evaluate(() => {
      const item = [...document.querySelectorAll('.ec-voicings .ec-card')].find((n) =>
        n.textContent.trim().startsWith('Am')
      );
      return item.querySelector('.ec-shorthand').textContent;
    });

  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await goToView(page, 'sheets');
    await page.fill('#new-sheet-title', 'Sets');
    await page.getByRole('button', { name: 'New song' }).click();
    await page.fill('#sheet-body', '# A\nC | G | Am | F');
    await page.locator('#sheet-body').blur();
    // A chosen shape in the first set, so there is something to copy.
    await page.locator('.ec-voicing-choice').first().click();
    await page.locator('.ec-dialog-choice').nth(1).click();
  });

  test('offers no selector until there is more than one', async ({ page }) => {
    await expect(page.locator('#voicing-variation')).toHaveCount(0);
    await expect(page.locator('#variation-add')).toBeVisible();
  });

  test('adds one, copies the shapes, and keeps the two apart', async ({ page }) => {
    const before = await amIn(page);

    await page.locator('#variation-add').click();
    await page.fill('#variation-name', 'Up the neck');
    await page.locator('#variation-confirm').click();

    // The new variation is the one being worked in, starting from the old one.
    await expect(page.locator('#voicing-variation')).toHaveValue('Up the neck');
    await expect(page.locator('#voicing-variation option')).toHaveText(['Default', 'Up the neck']);
    expect(await amIn(page)).toBe(before);
    await expect(page.locator('#sheet-body')).toHaveValue(/# Up the neck: E2, A2/);

    // An edit here leaves the other alone. Keyed by tuning alone, this merged
    // the two blocks and overwrote the first variation's shapes.
    await page.locator('.ec-voicing-choice').first().click();
    await page.locator('.ec-dialog-choice').nth(3).click();
    const after = await amIn(page);
    expect(after).not.toBe(before);

    await page.selectOption('#voicing-variation', '');
    expect(await amIn(page)).toBe(before);
  });

  test('adds an empty one, where every chord is on its default', async ({ page }) => {
    await page.locator('#variation-add').click();
    await page.fill('#variation-name', 'Bare');
    await page.locator('#variation-copy').uncheck();
    await page.locator('#variation-confirm').click();

    await expect(page.locator('#voicing-variation')).toHaveValue('Bare');
    // The heading is written even with nothing under it: it exists to be
    // filled in.
    await expect(page.locator('#sheet-body')).toHaveValue(/# Bare: E2, A2/);
    await expect(page.locator('.ec-voicings .ec-card.is-default')).toHaveCount(4);
  });

  test('refuses a name already taken, rather than landing you in it', async ({ page }) => {
    await page.locator('#variation-add').click();
    await page.fill('#variation-name', 'Up the neck');
    await page.locator('#variation-confirm').click();
    await expect(page.locator('#voicing-variation')).toHaveValue('Up the neck');

    await page.locator('#variation-add').click();
    await page.fill('#variation-name', 'Up the neck');
    await page.locator('#variation-confirm').click();
    await expect(page.locator('#variation-error')).toBeVisible();
    await expect(page.locator('#variation-dialog')).toBeVisible();
  });

  test('asks for a name rather than adding an unnamed one', async ({ page }) => {
    await page.locator('#variation-add').click();
    await page.locator('#variation-confirm').click();
    await expect(page.locator('#variation-error')).toBeVisible();
  });

  test('can be switched on the reading page, where you read from', async ({ page }) => {
    await page.locator('#variation-add').click();
    await page.fill('#variation-name', 'Up the neck');
    await page.locator('#variation-confirm').click();
    await page.locator('.ec-voicing-choice').first().click();
    await page.locator('.ec-dialog-choice').nth(3).click();
    const changed = await amIn(page);

    const amOnPage = () =>
      page.evaluate(() => {
        const item = [...document.querySelectorAll('.ec-print-legend .ec-print-chord')].find((n) =>
          n.textContent.trim().startsWith('Am')
        );
        return item.querySelector('svg').getAttribute('aria-label');
      });

    await page.locator('#sheet-view').click();
    await expect(page.locator('#view-variation')).toHaveValue('Up the neck');
    expect(await amOnPage()).toContain(changed);

    // Switched here, without going back to the editor.
    await page.selectOption('#view-variation', '');
    await expect(page.locator('#view-variation')).toHaveValue('');
    expect(await amOnPage()).not.toContain(changed);
  });

  test('offers no selector on the reading page with only one', async ({ page }) => {
    await page.locator('#sheet-view').click();
    await expect(page.locator('.ec-print-legend').first()).toBeVisible();
    await expect(page.locator('#view-variation')).toHaveCount(0);
  });

  test('the reading page plays the variation in use', async ({ page }) => {
    await page.locator('#variation-add').click();
    await page.fill('#variation-name', 'Up the neck');
    await page.locator('#variation-confirm').click();
    await page.locator('.ec-voicing-choice').first().click();
    await page.locator('.ec-dialog-choice').nth(3).click();
    const changed = await amIn(page);

    const amOnPage = () =>
      page.evaluate(() => {
        const item = [...document.querySelectorAll('.ec-print-legend .ec-print-chord')].find((n) =>
          n.textContent.trim().startsWith('Am')
        );
        return item.querySelector('svg').getAttribute('aria-label');
      });

    await page.locator('#sheet-view').click();
    expect(await amOnPage()).toContain(changed);

    await page.locator('#sheet-edit').click();
    await page.selectOption('#voicing-variation', '');
    const original = await amIn(page);
    await page.locator('#sheet-view').click();
    expect(await amOnPage()).toContain(original);
  });

  test('falls back to the song when the remembered name is gone', async ({ page }) => {
    await page.locator('#variation-add').click();
    await page.fill('#variation-name', 'Up the neck');
    await page.locator('#variation-confirm').click();
    await expect(page.locator('#voicing-variation')).toHaveValue('Up the neck');

    // Renamed in the text, which the app's memory knows nothing about. The
    // song has the say, not the remembered name.
    const body = await page.locator('#sheet-body').inputValue();
    await page.fill('#sheet-body', body.replace('# Up the neck:', '# Renamed:'));
    await page.locator('#sheet-body').blur();
    await expect(page.locator('#voicing-variation')).toHaveValue('');
    await expect(page.locator('#voicing-variation option')).toHaveText(['Default', 'Renamed']);
  });
});
