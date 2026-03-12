/**
 * UI tests — Records page (records.html)
 */

const { test, expect } = require('@playwright/test');
const { BASE, createTestLeague, addPlayer, recordGame } = require('./helpers');

let league, alice, bob;

test.beforeAll(async ({ request }) => {
  league = await createTestLeague(request, '_recordspage');
  alice  = await addPlayer(request, league, 'Alice');
  bob    = await addPlayer(request, league, 'Bob');

  // Alice wins 3 in a row → holds longest win streak, most wins, highest ELO
  await recordGame(request, league, alice.id, bob.id);
  await recordGame(request, league, alice.id, bob.id);
  await recordGame(request, league, alice.id, bob.id);
});

async function gotoRecords(page) {
  await page.goto(`${BASE}/`);
  await page.evaluate(l => localStorage.setItem('currentLeague', l), league);
  await page.goto(`${BASE}/records.html`);
  await page.waitForSelector('.records-grid', { timeout: 10_000 });
}

test.describe('Records Page — Layout', () => {
  test('page heading is visible', async ({ page }) => {
    await gotoRecords(page);
    await expect(page.locator('h1')).toContainText('Records');
  });

  test('back link navigates to home', async ({ page }) => {
    await gotoRecords(page);
    const backLink = page.locator('.back-link');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', /\//);
  });

  test('shows four record cards', async ({ page }) => {
    await gotoRecords(page);
    await expect(page.locator('.record-card')).toHaveCount(4);
  });
});

test.describe('Records Page — Content', () => {
  test('Longest Winning Streak card is shown', async ({ page }) => {
    await gotoRecords(page);
    await expect(page.locator('.record-card', { hasText: 'Longest Winning Streak' })).toBeVisible();
  });

  test('Most Games Played card is shown', async ({ page }) => {
    await gotoRecords(page);
    await expect(page.locator('.record-card', { hasText: 'Most Games Played' })).toBeVisible();
  });

  test('Most Games Won card is shown', async ({ page }) => {
    await gotoRecords(page);
    await expect(page.locator('.record-card', { hasText: 'Most Games Won' })).toBeVisible();
  });

  test('Highest Ever ELO card is shown', async ({ page }) => {
    await gotoRecords(page);
    await expect(page.locator('.record-card', { hasText: 'Highest Ever ELO' })).toBeVisible();
  });

  test('Alice is shown as record holder for longest win streak', async ({ page }) => {
    await gotoRecords(page);
    const card = page.locator('.record-card', { hasText: 'Longest Winning Streak' });
    await expect(card).toContainText('Alice');
    await expect(card).toContainText('3');
  });

  test('Alice is shown as record holder for most wins', async ({ page }) => {
    await gotoRecords(page);
    const card = page.locator('.record-card', { hasText: 'Most Games Won' });
    await expect(card).toContainText('Alice');
  });

  test('Alice is shown as record holder for highest ELO', async ({ page }) => {
    await gotoRecords(page);
    const card = page.locator('.record-card', { hasText: 'Highest Ever ELO' });
    await expect(card).toContainText('Alice');
  });

  test('record holder name is a link to their profile page', async ({ page }) => {
    await gotoRecords(page);
    const link = page.locator('.record-card .player-link').first();
    await expect(link).toHaveAttribute('href', /player\.html/);
  });

  test('clicking record holder link navigates to player profile', async ({ page }) => {
    await gotoRecords(page);
    // Alice is the sole holder of Longest Winning Streak — click her link there
    const card = page.locator('.record-card', { hasText: 'Longest Winning Streak' });
    const link = card.locator('.player-link', { hasText: 'Alice' });
    await link.click();
    await page.waitForSelector('.hero', { timeout: 10_000 });
    await expect(page.locator('.hero-name')).toContainText('Alice');
  });
});

test.describe('Records Page — Empty state', () => {
  test('shows dashes for streak/wins when no games have been played', async ({ request, page }) => {
    const emptyLeague = await createTestLeague(request, '_emptyrecords');
    await addPlayer(request, emptyLeague, 'Solo');

    await page.goto(`${BASE}/`);
    await page.evaluate(l => localStorage.setItem('currentLeague', l), emptyLeague);
    await page.goto(`${BASE}/records.html`);
    await page.waitForSelector('.records-grid', { timeout: 10_000 });

    // Longest Win Streak — no games, should show '—'
    const streakCard = page.locator('.record-card', { hasText: 'Longest Winning Streak' });
    await expect(streakCard.locator('.record-value')).toContainText('—');

    // Most Games Won — 0 wins, should show '—'
    const winsCard = page.locator('.record-card', { hasText: 'Most Games Won' });
    await expect(winsCard.locator('.record-value')).toContainText('—');
  });

  test('shows no-record placeholder when no player holds a record', async ({ request, page }) => {
    const emptyLeague = await createTestLeague(request, '_emptyrecords2');

    await page.goto(`${BASE}/`);
    await page.evaluate(l => localStorage.setItem('currentLeague', l), emptyLeague);
    await page.goto(`${BASE}/records.html`);
    await page.waitForSelector('.records-grid', { timeout: 10_000 });

    // No players at all — all values should be '—'
    const values = await page.locator('.record-value').allTextContents();
    expect(values.every(v => v.trim() === '—')).toBe(true);
  });
});


