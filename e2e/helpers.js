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

/**
 * Close the tutorial if it is showing.
 *
 * It opens the first time the app proper renders, which for a fresh profile is
 * right after setup. It is modal, so a test that wants to click anything else
 * has to put it away first — exactly as a person would.
 */
export async function dismissTutorial(page) {
  const dialog = page.locator('#announcement-dialog');
  if ((await dialog.count()) > 0) {
    await page.locator('#announcement-close').click();
    await expect(dialog).toHaveCount(0);
  }
}

/** Complete first-run setup with an instrument and tuning. */
export async function completeSetup(page, { instrument = '6guitar', tuning, name, style } = {}) {
  await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
  await page.selectOption('#instrument-catalog', instrument);
  if (tuning) await page.selectOption('#instrument-tuning-preset', tuning);
  if (style) await page.selectOption('#instrument-style', style);
  if (name) await page.fill('#instrument-name', name);
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.locator('#chord-input')).toBeVisible();
  await dismissTutorial(page);
}

/** Add another instrument through the header switcher. */
export async function addInstrument(page, { instrument, tuning, strings, name, style } = {}) {
  await page.locator('.ec-chip-summary').click();
  await page.getByRole('button', { name: '+ Add instrument' }).click();
  if (instrument) await page.selectOption('#instrument-catalog', instrument);
  if (tuning) await page.selectOption('#instrument-tuning-preset', tuning);
  if (strings) await page.fill('#instrument-tuning', strings);
  if (style) await page.selectOption('#instrument-style', style);
  if (name) await page.fill('#instrument-name', name);
  await page.getByRole('button', { name: 'Add instrument', exact: true }).click();
}

/**
 * Submit the chord form.
 *
 * `exact` matters: the result groups also carry "Show all 34" buttons, so a
 * substring match on "Show" is ambiguous.
 */
export async function submitChord(page) {
  await page.getByRole('button', { name: 'Show', exact: true }).click();
}

export async function searchChord(page, symbol) {
  await page.fill('#chord-input', symbol);
  await submitChord(page);
}

/** Open the editor for the instrument currently in use. */
export async function editActiveInstrument(page) {
  await page.locator('#nav-instrument').click();
  await page.locator('.ec-instrument-row.is-active').getByRole('button', { name: /^Edit/ }).click();
  await expect(page.locator('#heuristics-preset')).toBeVisible();
}

/** Move to one of the app's screens. */
export async function goToView(page, view) {
  await page.locator(`#nav-${view}`).click();
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
      view: s.state.view,
      sheetCount: s.state.sheets.length,
      body: s.activeSheet?.body ?? null,
    };
  });
}
