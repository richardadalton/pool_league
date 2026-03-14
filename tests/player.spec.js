/**
 * UI tests — Player Profile page (player.html)
 */

const { test, expect } = require('@playwright/test');
const { BASE, createTestLeague, addPlayer, recordGame, registerAndLogin } = require('./helpers');

let league, alice, bob;

test.beforeAll(async ({ request }) => {
  league = await createTestLeague(request, '_playerpage');
  alice  = await addPlayer(request, league, 'Alice');
  bob    = await addPlayer(request, league, 'Bob');

  // Alice wins 3, loses 1
  await recordGame(request, league, alice.id, bob.id);
  await recordGame(request, league, alice.id, bob.id);
  await recordGame(request, league, alice.id, bob.id);
  await recordGame(request, league, bob.id, alice.id);
});

async function gotoAliceProfile(page) {
  await page.goto(`${BASE}/player.html?id=${alice.id}&league=${league}`, { waitUntil: 'networkidle', timeout: 30_000 });
  // Wait for the profile to render (the hero section)
  await page.waitForSelector('.hero', { timeout: 20_000 });
}

test.describe('Player Profile — Hero section', () => {
  test('shows player name', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('.hero-name')).toContainText('Alice');
  });

  test('shows ELO rating', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('.hero-rating')).toBeVisible();
    await expect(page.locator('.rating-value')).toBeVisible();
  });

  test('shows league position', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('.hero-position')).toBeVisible();
  });

  test('back link returns to home page', async ({ page }) => {
    await gotoAliceProfile(page);
    const backLink = page.locator('.back-link');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', /\//);
  });
});

test.describe('Player Profile — Stats grid', () => {
  test('shows correct games played', async ({ page }) => {
    await gotoAliceProfile(page);
    // Games Played stat card should show 4
    const statCards = page.locator('.stat-card');
    const labels = await statCards.allTextContents();
    const gamesPlayedCard = labels.find(t => t.includes('Games Played'));
    expect(gamesPlayedCard).toContain('4');
  });

  test('shows correct wins and losses', async ({ page }) => {
    await gotoAliceProfile(page);
    const statCards = page.locator('.stat-card');
    const labels = await statCards.allTextContents();
    const winsCard   = labels.find(t => t.includes('Wins') && !t.includes('Games'));
    const lossesCard = labels.find(t => t.includes('Losses'));
    expect(winsCard).toContain('3');
    expect(lossesCard).toContain('1');
  });

  test('shows win rate', async ({ page }) => {
    await gotoAliceProfile(page);
    const statCards = page.locator('.stat-card');
    const labels = await statCards.allTextContents();
    const winRateCard = labels.find(t => t.includes('Win Rate'));
    expect(winRateCard).toContain('75%');
  });
});

test.describe('Player Profile — Badges', () => {
  test('badges section is visible', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('.badges-row')).toBeVisible();
  });

  test('first_win badge is shown as earned', async ({ page }) => {
    await gotoAliceProfile(page);
    const badges = page.locator('.badge-item.earned');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    // Find the First Win badge
    const badgeTexts = await page.locator('.badge-item.earned .badge-name').allTextContents();
    expect(badgeTexts).toContain('First Win');
  });

  test('unearned badges show lock icon', async ({ page }) => {
    await gotoAliceProfile(page);
    const locked = page.locator('.badge-item.locked .badge-icon');
    // 4 games played — games_50, games_100 should be locked
    const count = await locked.count();
    expect(count).toBeGreaterThan(0);
    // Check that at least one locked badge shows the lock emoji
    const firstLockedIcon = await locked.first().textContent();
    expect(firstLockedIcon).toContain('🔒');
  });
});

test.describe('Player Profile — Streaks', () => {
  test('streaks card is visible', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('text=Streaks')).toBeVisible();
  });

  test('shows longest winning streak', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('text=Longest winning streak')).toBeVisible();
    // Alice had a 3-win streak
    const streakRow = page.locator('.streak-item', { hasText: 'Longest winning streak' });
    await expect(streakRow).toContainText('3');
  });
});

test.describe('Player Profile — Results History', () => {
  test('results history card is visible', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('text=Results History')).toBeVisible();
  });

  test('results are shown in a scrollable list', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('.results-scroll')).toBeVisible();
    const rows = page.locator('.result-row');
    expect(await rows.count()).toBe(4);
  });

  test('each result row shows W or L badge', async ({ page }) => {
    await gotoAliceProfile(page);
    const badges = page.locator('.result-row .badge');
    const count = await badges.count();
    expect(count).toBe(4);

    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).textContent();
      expect(['W', 'L']).toContain(text.trim());
    }
  });

  test('most recent result is shown first', async ({ page }) => {
    await gotoAliceProfile(page);
    // Last game was a loss (Bob beat Alice)
    const firstRow = page.locator('.result-row').first();
    await expect(firstRow.locator('.badge')).toContainText('L');
  });
});


test.describe('Player Profile — 404 handling', () => {
  test('shows not found message for invalid player id', async ({ page }) => {
    await page.goto(`${BASE}/player.html?id=nonexistent_id&league=${league}`);
    await page.waitForSelector('#root');
    await expect(page.locator('#root')).toContainText(/not found/i, { timeout: 5_000 });
  });

  test('shows not found message when no id is provided', async ({ page }) => {
    await page.goto(`${BASE}/player.html?league=${league}`);
    await page.waitForSelector('#root');
    await expect(page.locator('#root')).toContainText(/not found/i, { timeout: 5_000 });
  });
});

test.describe('Player Profile — Rival & Nemesis', () => {
  test('biggest rival card is visible', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('.rival-card')).toBeVisible();
  });

  test('nemesis card is visible', async ({ page }) => {
    await gotoAliceProfile(page);
    await expect(page.locator('.nemesis-card')).toBeVisible();
  });

  test('rival card shows most-played opponent', async ({ page }) => {
    await gotoAliceProfile(page);
    // Alice played Bob 3 times and Bob beat Alice once — Bob is rival and nemesis
    const rivalCard = page.locator('.rival-card');
    await expect(rivalCard.locator('.h2h-name')).toContainText('Bob');
  });

  test('rival card shows head-to-head record', async ({ page }) => {
    await gotoAliceProfile(page);
    const rivalCard = page.locator('.rival-card');
    await expect(rivalCard.locator('.h2h-record')).toBeVisible();
    // Should contain W and L indicators
    await expect(rivalCard.locator('.h2h-w')).toBeVisible();
    await expect(rivalCard.locator('.h2h-l')).toBeVisible();
  });

  test('nemesis card shows player who beat them most', async ({ page }) => {
    await gotoAliceProfile(page);
    const nemesisCard = page.locator('.nemesis-card');
    await expect(nemesisCard.locator('.h2h-name')).toContainText('Bob');
  });

  test('nemesis card shows loss count', async ({ page }) => {
    await gotoAliceProfile(page);
    const nemesisCard = page.locator('.nemesis-card');
    await expect(nemesisCard.locator('.h2h-l')).toContainText('Loss');
  });

  test('rival name links to opponent profile page', async ({ page }) => {
    await gotoAliceProfile(page);
    const rivalLink = page.locator('.rival-card .h2h-name');
    const href = await rivalLink.getAttribute('href');
    expect(href).toMatch(/player\.html\?id=/);
  });

  test('nemesis name links to opponent profile page', async ({ page }) => {
    await gotoAliceProfile(page);
    const nemesisLink = page.locator('.nemesis-card .h2h-name');
    const href = await nemesisLink.getAttribute('href');
    expect(href).toMatch(/player\.html\?id=/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim player — "This is me" button
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Player Profile — Claim Player', () => {
  let claimLeague, guestPlayer;

  test.beforeAll(async ({ request }) => {
    claimLeague = await createTestLeague(request, '_claim_ui');
    guestPlayer = await addPlayer(request, claimLeague, 'GuestClaim');
  });

  test('"This is me" button is visible for logged-in user viewing unclaimed player', async ({ request, page }) => {
    const creds = await registerAndLogin(request, '_claim_ui_view');
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { 'Content-Type': 'application/json' },
    });
    await page.goto(`${BASE}/player.html?id=${guestPlayer.id}&league=${claimLeague}`, {
      waitUntil: 'networkidle', timeout: 30_000,
    });
    await expect(page.locator('.btn-claim')).toBeVisible();
    await expect(page.locator('.btn-claim')).toContainText('This is me');
  });

  test('"This is me" button is not visible when not logged in', async ({ page }) => {
    await page.goto(`${BASE}/player.html?id=${guestPlayer.id}&league=${claimLeague}`, {
      waitUntil: 'networkidle', timeout: 30_000,
    });
    await expect(page.locator('.btn-claim')).toHaveCount(0);
  });

  test('clicking "This is me" claims the player and removes the button', async ({ request, page }) => {
    const creds = await registerAndLogin(request, '_claim_ui_click');
    const claimLeague2 = await createTestLeague(request, '_claim_ui_click');
    const guestP2 = await addPlayer(request, claimLeague2, 'ClaimClick');

    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { 'Content-Type': 'application/json' },
    });
    await page.goto(`${BASE}/player.html?id=${guestP2.id}&league=${claimLeague2}`, {
      waitUntil: 'networkidle', timeout: 30_000,
    });

    await page.locator('.btn-claim').click();
    // Page reloads — wait for hero to appear and button to be gone
    await page.waitForSelector('.hero', { timeout: 20_000 });
    await expect(page.locator('.btn-claim')).toHaveCount(0);
  });
});

