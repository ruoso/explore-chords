import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, goToView, addInstrument } from './helpers.js';

/**
 * Choosing every voicing in a song at once (docs/DESIGN.md §2.10).
 *
 * Thirty shapes is too many to pick one at a time, and what a player wants is a
 * policy rather than thirty decisions. The wizard applies one across the chart
 * — and shows what it would do first, because a wizard you have to undo is not
 * one you would use twice.
 */
const SONG = [
  '# A',
  'Gm | A7 | Dm | % | E7 | Dm | % | Gm',
  'F | Dm | G7 | % | Gm | C7 | F | D7/F#',
].join('\n');

async function songWith(page, body) {
  await goToView(page, 'sheets');
  const back = page.locator('.ec-back');
  if (await back.count()) await back.click();
  await page.fill('#new-sheet-title', 'Dominante');
  await page.getByRole('button', { name: 'New song' }).click();
  await page.fill('#sheet-body', body);
  await page.locator('#sheet-body').blur();
}

test.describe('the voicing wizard', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await songWith(page, SONG);
  });

  test('sits above the chart, since it decides the whole song', async ({ page }) => {
    const wizard = page.locator('#voicing-wizard');
    await expect(wizard).toBeVisible();
    const wizardBox = await wizard.boundingBox();
    const chartBox = await page.locator('#sheet-chart').boundingBox();
    expect(wizardBox.y).toBeLessThan(chartBox.y);
  });

  test('offers a policy, shows what it would do, then does it', async ({ page }) => {
    await page.locator('#voicing-wizard').click();

    // Step one: the ways it can choose, each with the reason to want it.
    await expect(page.locator('.ec-wizard-planner')).toHaveCount(3);
    await expect(page.locator('#wizard-choroCentro')).toContainText('seven-string');
    await expect(page.locator('#wizard-apply')).toHaveCount(0);

    // Step two: what it would do, before anything changes.
    await page.locator('#wizard-choroCentro').click();
    await expect(page.locator('#wizard-summary')).toContainText('would change');
    await expect(page.locator('.ec-wizard-shape').first()).toBeVisible();
    // The song is untouched until it is accepted.
    await expect(page.locator('#sheet-body')).not.toHaveValue(/# Voicings/);

    // Each preview shape carries the label the song will carry, so the preview
    // is the thing itself rather than a description of it.
    await expect(
      page.locator('.ec-wizard-shape', { hasText: 'Gm' }).first().locator('.ec-voiced-as')
    ).toHaveText('Gm/Bb');

    await page.locator('#wizard-apply').click();
    await expect(page.locator('#sheet-body')).toHaveValue(/# Voicings: E2, A2, D3, G3, B3, E4/);
    await expect(page.locator('#sheet-body')).toHaveValue(/Gm = x1003x/);
  });

  test('explains itself, and cites its own sources', async ({ page }) => {
    await page.locator('#voicing-wizard').click();
    await page.locator('#wizard-choroCentro').click();

    const how = page.locator('.ec-wizard-how');
    await expect(how.locator('summary')).toHaveText('How it works');
    await how.locator('summary').click();
    // The rules it actually applies, not a paraphrase of them.
    await expect(how.locator('.ec-wizard-rules li').first()).toContainText('enumerated');
    const sources = how.locator('.ec-wizard-sources li');
    await expect(sources).toHaveCount(5);
    await expect(sources.first()).toContainText('Universidade de Brasília');
    await expect(sources.first().locator('a')).toHaveAttribute('href', /\.pdf$/);

    // The sources belong to the algorithm, not to the wizard: a rule of thumb
    // about hands claims no authority it does not have.
    await page.locator('#wizard-back').click();
    await page.locator('#wizard-smoothest').click();
    await page.locator('.ec-wizard-how > summary').click();
    await expect(page.locator('.ec-wizard-sources')).toHaveCount(0);
    await expect(page.locator('.ec-wizard-how')).toContainText('rule of thumb');
  });

  test('says so rather than doing nothing when there is nothing to do', async ({ page }) => {
    await page.locator('#voicing-wizard').click();
    await page.locator('#wizard-choroCentro').click();
    await page.locator('#wizard-apply').click();
    await expect(page.locator('#sheet-body')).toHaveValue(/# Voicings/);

    await page.locator('#voicing-wizard').click();
    await page.locator('#wizard-choroCentro').click();
    await expect(page.locator('#wizard-summary')).toContainText('already');
    await expect(page.locator('#wizard-apply')).toBeDisabled();
  });

  test('keeps a policy off an instrument it makes no sense on', async ({ page }) => {
    await addInstrument(page, { instrument: 'ukulele', name: 'Uke' });
    await songWith(page, SONG);
    await page.locator('#voicing-wizard').click();
    await expect(page.locator('#wizard-smoothest')).toBeVisible();
    await expect(page.locator('#wizard-choroCentro')).toHaveCount(0);
  });
});
