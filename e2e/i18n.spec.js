import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshVisit, completeSetup, searchChord } from './helpers.js';

/**
 * Languages (docs/DESIGN.md §2.9).
 *
 * The app follows the browser until a language is chosen, and then remembers
 * the choice. These tests cover the wiring: that the choice reaches every
 * screen and survives a reload. Whether each string is translated well is a
 * unit test's business (src/i18n).
 */

test.describe('a Portuguese browser', () => {
  test.use({ locale: 'pt-BR' });

  test('is greeted in Portuguese, tutorial included, and the page says so', async ({ page }) => {
    await freshVisit(page);
    await expect(page.getByRole('heading', { name: 'Escolha seu instrumento' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('#instrument-catalog')).toContainText('Violão (6 cordas)');

    await page.getByRole('button', { name: 'Começar a tocar' }).click();
    const dialog = page.locator('#announcement-dialog');
    await expect(dialog).toContainText('Bem-vindo ao Explore Chords');
    await page.locator('#announcement-close').click();

    await expect(page.locator('#nav-sheets')).toHaveText('Músicas');
    await searchChord(page, 'C');
    await expect(page.locator('.ec-group-title').first()).toContainText('Posição aberta');
    // Diagram descriptions are translated too, not only the visible text.
    const label = await page.locator('.ec-diagram').first().getAttribute('aria-label');
    expect(label).toMatch(/posição aberta|a partir da casa/);
  });

  test('can switch to English, and the choice is remembered', async ({ page }) => {
    await freshVisit(page);
    await page.selectOption('#locale-select', 'en');
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
  });
});

test.describe('a Spanish browser', () => {
  test.use({ locale: 'es-MX' });

  test('gets Latin American Spanish', async ({ page }) => {
    await freshVisit(page);
    await expect(page.getByRole('heading', { name: 'Elige tu instrumento' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-419');
  });
});

test.describe('an unsupported browser language', () => {
  test.use({ locale: 'fr-FR' });

  test('falls back to English', async ({ page }) => {
    await freshVisit(page);
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('switching language while using the app', () => {
  test('redraws the screen in place, header and all', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await searchChord(page, 'Am7');
    await page.locator('#nav-sheets').click();
    await expect(page.getByRole('heading', { name: 'Song sheets' })).toBeVisible();

    await page.selectOption('#locale-select', 'es-419');
    await expect(page.getByRole('heading', { name: 'Cifrados' })).toBeVisible();
    await expect(page.locator('#help-open')).toHaveText('Ayuda');
    await expect(page.locator('#nav-explore')).toHaveText('Acordes');
    await expect(page.locator('.ec-chip-summary')).toHaveAttribute('aria-label', /Instrumento:/);

    // Back on the chord screen, the results the search left are described in Spanish.
    await page.locator('#nav-explore').click();
    await expect(page.locator('.ec-group-title').first()).toContainText(/Posición abierta|Traste/);
    await expect(page.locator('#locale-select')).toHaveValue('es-419');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('a saved choice beats the browser on the next visit', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await page.selectOption('#locale-select', 'pt-BR');
    await expect(page.locator('#nav-library')).toHaveText('Salvos');
    await page.reload();
    await expect(page.locator('#nav-library')).toHaveText('Salvos');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });
});
