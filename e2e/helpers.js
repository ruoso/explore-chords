import { expect } from '@playwright/test';

/**
 * Land on the app with a clean profile: no instruments, no preferences.
 *
 * Playwright gives every test its own browser context, so localStorage starts
 * empty already. Deliberately no addInitScript clearing storage: that runs on
 * *every* navigation, so it would wipe the app's saved state on each reload and
 * make persistence impossible to test.
 */
export async function freshVisit(page, query = '') {
  await page.goto(`./${query}`);
}

/** Complete first-run setup with a named instrument and tuning. */
export async function completeSetup(page, { instrument = '6guitar', tuning } = {}) {
  await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
  await page.selectOption('#setup-instrument', instrument);
  if (tuning) await page.selectOption('#setup-tuning', tuning);
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.locator('#chord-input')).toBeVisible();
}

export async function searchChord(page, symbol) {
  await page.fill('#chord-input', symbol);
  await page.getByRole('button', { name: 'Show' }).click();
}

/** Read the app's own state, so tests can reason about more than pixels. */
export function appState(page) {
  return page.evaluate(() => {
    const s = window.__ec.store;
    return {
      instrumentCount: s.state.instruments.length,
      activeLabel: s.activeInstrument?.label ?? null,
      effectiveLabel: s.effectiveInstrument?.label ?? null,
      viewAs: s.state.viewAs ? s.state.viewAs.instance.label : null,
      chordText: s.state.chordText,
      resultCount: s.state.results?.count ?? 0,
    };
  });
}
