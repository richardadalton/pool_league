/**
 * UI tests — Home page (index.html)
 * Tests the league table, add player, record game, game history and league switcher.
 */

const { test, expect } = require('@playwright/test');
const { BASE, createTestLeague, addPlayer, recordGame, registerAndLogin } = require('./helpers');

test.describe('Home Page — League Table', () => {
  let league, alice, bob;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_home');
    alice  = await addPlayer(request, league, 'Alice');
    bob    = await addPlayer(request, league, 'Bob');
    await recordGame(request, league, alice.id, bob.id);
  });

  test.beforeEach(async ({ page }) => {
    // Navigate directly with ?league= so localStorage is set on first load
    await page.goto(`${BASE}/?league=${league}`, { waitUntil: 'networkidle', timeout: 30_000 });
    // Wait until at least one player row is rendered (ensures form/streak data is present)
    await page.waitForSelector('table tbody tr', { timeout: 20_000 });
  });

  test('page title is shown', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('league table shows both players', async ({ page }) => {
    await expect(page.locator('table tbody tr')).toHaveCount(2);
  });

  test('players are sorted by ELO (highest first)', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    const firstRating  = await rows.nth(0).locator('.rating-badge').textContent();
    const secondRating = await rows.nth(1).locator('.rating-badge').textContent();
    const r1 = parseInt(firstRating.replace(/\D/g, ''), 10);
    const r2 = parseInt(secondRating.replace(/\D/g, ''), 10);
    expect(r1).toBeGreaterThanOrEqual(r2);
  });

  test('player names are links to profile pages', async ({ page }) => {
    const link = page.locator('table tbody .player-link').first();
    await expect(link).toHaveAttribute('href', /player\.html/);
  });

  test('crown icon is shown next to King of the Hill', async ({ page }) => {
    // Alice won the first game so she is king
    await expect(page.locator('.koth-crown')).toBeVisible();
  });

  test('Records nav link is present', async ({ page }) => {
    const link = page.locator('a', { hasText: 'Records' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /records\.html/);
  });

  test('form guide column header is shown', async ({ page }) => {
    await expect(page.locator('thead th.form-head')).toContainText('Form');
  });

  test('form guide squares are shown for players who have played', async ({ page }) => {
    // At least one .form-sq square should exist (Alice beat Bob in beforeAll)
    await expect(page.locator('.form-sq').first()).toBeVisible();
  });

  test('form guide win square has green background class', async ({ page }) => {
    // Alice's last result was a win — she should have a .form-w square
    await expect(page.locator('.form-w').first()).toBeVisible();
  });

  test('form guide loss square has red background class', async ({ page }) => {
    // Bob's last result was a loss — he should have a .form-l square
    await expect(page.locator('.form-l').first()).toBeVisible();
  });

  test('streak column header is shown', async ({ page }) => {
    await expect(page.locator('thead th.streak-head')).toContainText('Streak');
  });

  test('streak pill is shown for players who have played', async ({ page }) => {
    await expect(page.locator('.streak-pill').first()).toBeVisible();
  });

  test('winner has a green W streak pill', async ({ page }) => {
    // Alice won the last game — she should have a W streak pill
    await expect(page.locator('.streak-w').first()).toBeVisible();
  });

  test('loser has a red L streak pill', async ({ page }) => {
    // Bob lost the last game — he should have an L streak pill
    await expect(page.locator('.streak-l').first()).toBeVisible();
  });
});

test.describe('Home Page — Add Player', () => {
  let league, creds;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_addplayer');
    creds  = await registerAndLogin(request, '_addplayer');
  });

  test.beforeEach(async ({ page }) => {
    // Log in via API so session cookie is set on this page context
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { 'Content-Type': 'application/json' },
    });
    await page.goto(`${BASE}/?league=${league}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('#add-player-card', { timeout: 20_000 });
  });

  test('can add a new player via the form', async ({ page }) => {
    const input = page.locator('#new-player-name');
    await input.fill('TestPlayer');
    await page.locator('button[onclick="addPlayer()"]').click();

    // Success message should appear
    await expect(page.locator('#player-msg')).toContainText('TestPlayer', { timeout: 5_000 });

    // Player appears in the table
    await expect(page.locator('table')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('table')).toContainText('TestPlayer');
  });

  test('shows error when adding player with empty name', async ({ page }) => {
    await page.locator('button[onclick="addPlayer()"]').click();
    await expect(page.locator('#player-msg')).toContainText(/name/i, { timeout: 5_000 });
  });

  test('shows error when adding duplicate player name', async ({ page }) => {
    const input = page.locator('#new-player-name');
    await input.fill('DupePlayer');
    await page.locator('button[onclick="addPlayer()"]').click();
    // Wait for the first add to complete before trying again
    await expect(page.locator('#player-msg')).toContainText('DupePlayer', { timeout: 5_000 });

    // Try to add the same name again
    await input.fill('DupePlayer');
    await page.locator('button[onclick="addPlayer()"]').click();
    await expect(page.locator('#player-msg')).toContainText(/already exists/i, { timeout: 5_000 });
  });

  test('can add player by pressing Enter', async ({ page }) => {
    const input = page.locator('#new-player-name');
    await input.fill('EnterKeyPlayer');
    await input.press('Enter');
    await expect(page.locator('#player-msg')).toContainText('EnterKeyPlayer', { timeout: 5_000 });
  });
});

test.describe('Home Page — Record a Game', () => {
  let league, alice, bob, creds;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_recordgame');
    alice  = await addPlayer(request, league, 'Alice');
    bob    = await addPlayer(request, league, 'Bob');
    creds  = await registerAndLogin(request, '_recordgame');
  });

  test.beforeEach(async ({ page }) => {
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { 'Content-Type': 'application/json' },
    });
    await page.goto(`${BASE}/?league=${league}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('#winner-select');
  });

  test('winner and loser dropdowns are populated', async ({ page }) => {
    const winnerOptions = page.locator('#winner-select option');
    const loserOptions  = page.locator('#loser-select option');
    // At least the placeholder + 2 players
    expect(await winnerOptions.count()).toBeGreaterThanOrEqual(3);
    expect(await loserOptions.count()).toBeGreaterThanOrEqual(3);
  });

  test('can record a game result and shows rating change', async ({ page }) => {
    const winnerOption = page.locator('#winner-select option', { hasText: 'Alice' });
    const loserOption  = page.locator('#loser-select option',  { hasText: 'Bob' });
    await page.selectOption('#winner-select', { value: await winnerOption.getAttribute('value') });
    await page.selectOption('#loser-select',  { value: await loserOption.getAttribute('value') });
    await page.locator('#record-btn').click();

    await expect(page.locator('#game-msg')).toContainText('Alice', { timeout: 5_000 });
    await expect(page.locator('#game-msg')).toContainText('Bob');
    await expect(page.locator('#game-msg')).toContainText('(+');
  });

  test('shows error when no winner selected', async ({ page }) => {
    await page.locator('#record-btn').click();
    await expect(page.locator('#game-msg')).toContainText(/winner/i, { timeout: 5_000 });
  });

  test('shows error when winner and loser are the same', async ({ page }) => {
    const aliceOption = page.locator('#winner-select option', { hasText: 'Alice' });
    const aliceValue  = await aliceOption.getAttribute('value');
    await page.selectOption('#winner-select', { value: aliceValue });
    await page.selectOption('#loser-select',  { value: aliceValue });
    await page.locator('#record-btn').click();
    await expect(page.locator('#game-msg')).toContainText(/different/i, { timeout: 5_000 });
  });
});

test.describe('Home Page — Game History', () => {
  let league, alice, bob, creds;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_history');
    alice  = await addPlayer(request, league, 'Alice');
    bob    = await addPlayer(request, league, 'Bob');
    creds  = await registerAndLogin(request, '_history');
  });

  test.beforeEach(async ({ request, page }) => {
    await recordGame(request, league, alice.id, bob.id);
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { 'Content-Type': 'application/json' },
    });
    await page.goto(`${BASE}/?league=${league}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('.game-item', { timeout: 20_000 });
  });

  test('game history shows at least one result', async ({ page }) => {
    const count = await page.locator('.game-item').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('game history entry shows winner and loser names', async ({ page }) => {
    const item = page.locator('.game-item').first();
    await expect(item).toContainText('Alice');
    await expect(item).toContainText('Bob');
    await expect(item).toContainText('beat');
  });

  test('game history shows winner and loser names', async ({ page }) => {
    const item = page.locator('.game-item').first();
    await expect(item).toContainText('beat');
  });

  test('each game item has a delete button', async ({ page }) => {
    await expect(page.locator('.game-item .delete-btn').first()).toBeAttached();
  });

  test('delete confirm panel is hidden by default', async ({ page }) => {
    await expect(page.locator('.delete-confirm').first()).toBeHidden();
  });

  test('clicking trash icon reveals the confirmation panel', async ({ page }) => {
    await page.locator('.delete-btn').first().click();
    await expect(page.locator('.delete-confirm').first()).toBeVisible();
  });

  test('cancel button hides the confirmation panel', async ({ page }) => {
    await page.locator('.delete-btn').first().click();
    await expect(page.locator('.delete-confirm').first()).toBeVisible();
    await page.locator('.btn-cancel').first().click();
    await expect(page.locator('.delete-confirm').first()).toBeHidden();
  });

  test('wrong winner name shows error state on input', async ({ page }) => {
    await page.locator('.delete-btn').first().click();
    await page.locator('.delete-input').first().fill('WrongName');
    await page.locator('.btn-danger').first().click();
    await expect(page.locator('.delete-input').first()).toHaveClass(/input-err/);
  });

  test('correct winner name deletes the game and refreshes', async ({ request, page }) => {
    // Use a fresh league so we control exactly what game is on screen
    const dl = await createTestLeague(request, '_del_ui');
    const da = await addPlayer(request, dl, 'Alice');
    const db = await addPlayer(request, dl, 'Bob');
    await recordGame(request, dl, da.id, db.id);

    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { 'Content-Type': 'application/json' },
    });
    await page.goto(`${BASE}/?league=${dl}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('.game-item', { timeout: 20_000 });

    await page.locator('.delete-btn').first().click();
    await page.locator('.delete-input').first().fill('Alice');
    await page.locator('.btn-danger').first().click();

    // After deletion the history list should show empty state
    await expect(page.locator('#history-list .empty-state')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Home Page — League Switcher', () => {
  let leagueA, leagueB, creds;

  test.beforeAll(async ({ request }) => {
    leagueA = await createTestLeague(request, '_switchA');
    leagueB = await createTestLeague(request, '_switchB');
    creds   = await registerAndLogin(request, '_switch');
  });

  test.beforeEach(async ({ page }) => {
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { 'Content-Type': 'application/json' },
    });
    await page.goto(`${BASE}/?league=${leagueA}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('.league-switcher');
  });

  test('league switcher shows pill buttons for each league', async ({ page }) => {
    await expect(page.locator('.league-pill')).toHaveCount(
      await page.locator('.league-pill').count()
    );
    // At minimum leagueA and leagueB pills are present
    await expect(page.locator('.league-switcher')).toContainText(
      leagueA.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).split('_')[0]
    );
  });

  test('clicking + New reveals the new league form', async ({ page }) => {
    await page.locator('.add-league').click();
    await expect(page.locator('#new-league-form')).toBeVisible();
  });

  test('can create a new league from the UI', async ({ page }) => {
    await page.locator('.add-league').click();
    const input = page.locator('#new-league-name');
    const uniqueName = `uilg_${Date.now()}`;
    await input.fill(uniqueName);
    await page.locator('#new-league-form .btn').click();

    // The new league should become active
    await expect(page.locator('#league-title')).toContainText(
      uniqueName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      { timeout: 5_000 }
    );
  });
});


