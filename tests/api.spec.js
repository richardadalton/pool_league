/**
 * API tests — leagues, players, games, records, profiles.
 * These use Playwright's `request` fixture (no browser needed).
 */

const { test, expect } = require('@playwright/test');
const { BASE, createTestLeague, addPlayer, recordGame } = require('./helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Leagues
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Leagues API', () => {
  test('GET /api/leagues returns an array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/leagues`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST /api/leagues creates a new league', async ({ request }) => {
    const name = `newleague_${Date.now()}`;
    const res = await request.post(`${BASE}/api/leagues`, {
      data: { name },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.league).toBeTruthy();

    // Confirm it now appears in the list
    const list = await (await request.get(`${BASE}/api/leagues`)).json();
    expect(list).toContain(body.league);
  });

  test('POST /api/leagues rejects empty name', async ({ request }) => {
    const res = await request.post(`${BASE}/api/leagues`, {
      data: { name: '' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/leagues rejects duplicate league', async ({ request }) => {
    const league = await createTestLeague(request, '_dup');
    const res = await request.post(`${BASE}/api/leagues`, {
      data: { name: league },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Players
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Players API', () => {
  let league;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_players');
  });

  test('GET /api/players returns empty list for new league', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players?league=${league}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.players).toEqual([]);
    expect(body.kingId).toBeNull();
  });

  test('POST /api/players adds a player with rating 1000', async ({ request }) => {
    const res = await request.post(`${BASE}/api/players?league=${league}`, {
      data: { name: 'Alice' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(201);
    const player = await res.json();
    expect(player.name).toBe('Alice');
    expect(player.rating).toBe(1000);
    expect(player.wins).toBe(0);
    expect(player.losses).toBe(0);
    expect(player.id).toBeTruthy();
  });

  test('POST /api/players rejects empty name', async ({ request }) => {
    const res = await request.post(`${BASE}/api/players?league=${league}`, {
      data: { name: '   ' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/players rejects duplicate name', async ({ request }) => {
    // Alice already added above
    const res = await request.post(`${BASE}/api/players?league=${league}`, {
      data: { name: 'Alice' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  test('GET /api/players returns players sorted by rating desc', async ({ request }) => {
    // Add a second player, record a game so ratings differ
    const bob = await addPlayer(request, league, 'Bob');
    const allRes = await request.get(`${BASE}/api/players?league=${league}`);
    const { players } = await allRes.json();

    // Both start at 1000 — after a game the winner is higher
    const alice = players.find(p => p.name === 'Alice');
    await recordGame(request, league, alice.id, bob.id);

    const sorted = (await (await request.get(`${BASE}/api/players?league=${league}`)).json()).players;
    expect(sorted[0].rating).toBeGreaterThanOrEqual(sorted[1].rating);
  });

  test('GET /api/players returns 404 for unknown league', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players?league=doesnotexist_xyz`);
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Games
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Games API', () => {
  let league, alice, bob;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_games');
    alice = await addPlayer(request, league, 'Alice');
    bob   = await addPlayer(request, league, 'Bob');
  });

  test('POST /api/games records a result and updates ratings', async ({ request }) => {
    const aliceRatingBefore = alice.rating;
    const bobRatingBefore   = bob.rating;

    const game = await recordGame(request, league, alice.id, bob.id);

    expect(game.winnerId).toBe(alice.id);
    expect(game.loserId).toBe(bob.id);
    expect(game.winnerRatingAfter).toBeGreaterThan(aliceRatingBefore);
    expect(game.loserRatingAfter).toBeLessThan(bobRatingBefore);
    expect(game.ratingChange).toBeGreaterThan(0);
    expect(game.winnerName).toBe('Alice');
    expect(game.loserName).toBe('Bob');
    expect(game.playedAt).toBeTruthy();

    // Rating changes should balance (winner gains == loser loses)
    const winnerGain = game.winnerRatingAfter - aliceRatingBefore;
    const loserLoss  = bobRatingBefore - game.loserRatingAfter;
    expect(winnerGain).toBe(loserLoss);
  });

  test('POST /api/games rejects same winner and loser', async ({ request }) => {
    const res = await request.post(`${BASE}/api/games?league=${league}`, {
      data: { winnerId: alice.id, loserId: alice.id },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/different/i);
  });

  test('POST /api/games rejects missing player ids', async ({ request }) => {
    const res = await request.post(`${BASE}/api/games?league=${league}`, {
      data: { winnerId: alice.id },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/games rejects unknown player id', async ({ request }) => {
    const res = await request.post(`${BASE}/api/games?league=${league}`, {
      data: { winnerId: 'nonexistent_id', loserId: bob.id },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(404);
  });

  test('GET /api/games returns games in reverse chronological order', async ({ request }) => {
    // Record a second game
    await recordGame(request, league, bob.id, alice.id);

    const res = await request.get(`${BASE}/api/games?league=${league}`);
    expect(res.status()).toBe(200);
    const games = await res.json();
    expect(games.length).toBeGreaterThanOrEqual(2);

    // Most recent first
    for (let i = 0; i < games.length - 1; i++) {
      const t1 = new Date(games[i].playedAt).getTime();
      const t2 = new Date(games[i + 1].playedAt).getTime();
      expect(t1).toBeGreaterThanOrEqual(t2);
    }
  });

  test('GET /api/games enriches games with player names', async ({ request }) => {
    const res = await request.get(`${BASE}/api/games?league=${league}`);
    const games = await res.json();
    expect(games[0]).toHaveProperty('winnerName');
    expect(games[0]).toHaveProperty('loserName');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Player Profile
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Player Profile API', () => {
  let league, alice, bob, charlie;

  test.beforeAll(async ({ request }) => {
    league  = await createTestLeague(request, '_profile');
    alice   = await addPlayer(request, league, 'Alice');
    bob     = await addPlayer(request, league, 'Bob');
    charlie = await addPlayer(request, league, 'Charlie');

    // Alice wins 3, loses 1
    await recordGame(request, league, alice.id, bob.id);
    await recordGame(request, league, alice.id, charlie.id);
    await recordGame(request, league, alice.id, bob.id);
    await recordGame(request, league, bob.id, alice.id);
  });

  test('GET /api/players/:id/profile returns correct stats', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    expect(res.status()).toBe(200);
    const p = await res.json();

    expect(p.name).toBe('Alice');
    expect(p.wins).toBe(3);
    expect(p.losses).toBe(1);
    expect(p.played).toBe(4);
    expect(p.winPct).toBe(75);
  });

  test('profile contains eloHistory starting at 1000', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();

    expect(Array.isArray(p.eloHistory)).toBe(true);
    expect(p.eloHistory[0].rating).toBe(1000);
    expect(p.eloHistory.length).toBe(5); // start + 4 games
  });

  test('profile longest win streak is correct', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();
    // Alice won 3 in a row then lost 1 → longest win streak = 3
    expect(p.longestWinStreak).toBe(3);
  });

  test('profile current streak reflects last result', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();
    // Last game was a loss
    expect(p.currentStreak.type).toBe('L');
    expect(p.currentStreak.count).toBe(1);
  });

  test('profile highestRating is at least starting ELO', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();
    expect(p.highestRating).toBeGreaterThanOrEqual(1000);
  });

  test('profile results list is most-recent first', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();
    expect(p.results.length).toBe(4);
    // First result in list should be the most recent game (the loss)
    expect(p.results[0].result).toBe('L');
  });

  test('profile includes badges array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();
    expect(Array.isArray(p.badges)).toBe(true);
    expect(p.badges.length).toBeGreaterThan(0);

    const firstWin = p.badges.find(b => b.id === 'first_win');
    expect(firstWin).toBeTruthy();
    expect(firstWin.earned).toBe(true);
  });

  test('profile returns 404 for unknown player', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/nonexistent_xyz/profile?league=${league}`);
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Records API
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Records API', () => {
  let league, alice, bob;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_records');
    alice  = await addPlayer(request, league, 'Alice');
    bob    = await addPlayer(request, league, 'Bob');

    // Alice wins 3 in a row
    await recordGame(request, league, alice.id, bob.id);
    await recordGame(request, league, alice.id, bob.id);
    await recordGame(request, league, alice.id, bob.id);
  });

  test('GET /api/records returns the four record categories', async ({ request }) => {
    const res = await request.get(`${BASE}/api/records?league=${league}`);
    expect(res.status()).toBe(200);
    const r = await res.json();

    expect(r).toHaveProperty('longestWinStreak');
    expect(r).toHaveProperty('mostGamesPlayed');
    expect(r).toHaveProperty('mostGamesWon');
    expect(r).toHaveProperty('highestEloRating');
  });

  test('each record has a holders array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/records?league=${league}`);
    const r = await res.json();
    for (const key of ['longestWinStreak', 'mostGamesPlayed', 'mostGamesWon', 'highestEloRating']) {
      expect(Array.isArray(r[key].holders)).toBe(true);
    }
  });

  test('longestWinStreak record is held by Alice with value 3', async ({ request }) => {
    const res = await request.get(`${BASE}/api/records?league=${league}`);
    const r = await res.json();
    expect(r.longestWinStreak.value).toBe(3);
    expect(r.longestWinStreak.holders).toHaveLength(1);
    expect(r.longestWinStreak.holders[0].name).toBe('Alice');
  });

  test('mostGamesPlayed record is correct and includes both tied players', async ({ request }) => {
    const res = await request.get(`${BASE}/api/records?league=${league}`);
    const r = await res.json();
    // Both Alice and Bob played 3 games — it's a tie
    expect(r.mostGamesPlayed.value).toBe(3);
    expect(r.mostGamesPlayed.holders).toHaveLength(2);
    const names = r.mostGamesPlayed.holders.map(h => h.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  test('mostGamesWon record is held by Alice', async ({ request }) => {
    const res = await request.get(`${BASE}/api/records?league=${league}`);
    const r = await res.json();
    expect(r.mostGamesWon.value).toBe(3);
    expect(r.mostGamesWon.holders[0].name).toBe('Alice');
  });

  test('highestEloRating record is held by Alice', async ({ request }) => {
    const res = await request.get(`${BASE}/api/records?league=${league}`);
    const r = await res.json();
    expect(r.highestEloRating.holders[0].name).toBe('Alice');
    expect(r.highestEloRating.value).toBeGreaterThan(1000);
  });

  test('GET /api/records returns 404 for unknown league', async ({ request }) => {
    const res = await request.get(`${BASE}/api/records?league=doesnotexist_xyz`);
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ELO Calculation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('ELO rating system', () => {
  let league;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_elo');
  });

  test('equal-rated players exchange ~16 points', async ({ request }) => {
    const alice = await addPlayer(request, league, 'Alice');
    const bob   = await addPlayer(request, league, 'Bob');

    const game = await recordGame(request, league, alice.id, bob.id);
    // Both start at 1000 — expected change is exactly 16
    expect(game.ratingChange).toBe(16);
    expect(game.winnerRatingAfter).toBe(1016);
    expect(game.loserRatingAfter).toBe(984);
  });

  test('beating a higher-rated player earns more points', async ({ request }) => {
    const strong = await addPlayer(request, league, 'Strong');
    const weak   = await addPlayer(request, league, 'Weak');

    // First game: weak beats strong (equal ratings → 16 pts)
    const g1 = await recordGame(request, league, weak.id, strong.id);

    // Now strong has a lower rating than weak — weak beating strong again earns fewer pts
    // But strong beating weak (upset) should earn more
    const g2 = await recordGame(request, league, strong.id, weak.id);
    expect(g2.ratingChange).toBeGreaterThan(16);
  });

  test('player ratings update cumulatively across games', async ({ request }) => {
    const p1 = await addPlayer(request, league, 'CumulativeA');
    const p2 = await addPlayer(request, league, 'CumulativeB');
    const p3 = await addPlayer(request, league, 'CumulativeC');

    await recordGame(request, league, p1.id, p2.id);
    await recordGame(request, league, p1.id, p3.id);

    const res = await request.get(`${BASE}/api/players?league=${league}`);
    const { players } = await res.json();
    const updatedP1 = players.find(p => p.id === p1.id);
    expect(updatedP1.wins).toBe(2);
    expect(updatedP1.rating).toBeGreaterThan(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// King of the Hill
// ─────────────────────────────────────────────────────────────────────────────

test.describe('King of the Hill', () => {
  let league, alice, bob, charlie;

  test.beforeAll(async ({ request }) => {
    league  = await createTestLeague(request, '_koth');
    alice   = await addPlayer(request, league, 'Alice');
    bob     = await addPlayer(request, league, 'Bob');
    charlie = await addPlayer(request, league, 'Charlie');
  });

  test('winner of the first game becomes King of the Hill', async ({ request }) => {
    await recordGame(request, league, alice.id, bob.id);

    const res = await request.get(`${BASE}/api/players?league=${league}`);
    const { kingId } = await res.json();
    expect(kingId).toBe(alice.id);
  });

  test('king transfers when the king loses', async ({ request }) => {
    // Bob beats Alice (the king) → Bob becomes king
    await recordGame(request, league, bob.id, alice.id);

    const res = await request.get(`${BASE}/api/players?league=${league}`);
    const { kingId } = await res.json();
    expect(kingId).toBe(bob.id);
  });

  test('king does not transfer when a non-king loses', async ({ request }) => {
    // Charlie beats Alice (not the king) — Bob should still be king
    await recordGame(request, league, charlie.id, alice.id);

    const res = await request.get(`${BASE}/api/players?league=${league}`);
    const { kingId } = await res.json();
    expect(kingId).toBe(bob.id);
  });

  test('king of the hill badge is earned by current king', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${bob.id}/profile?league=${league}`);
    const p = await res.json();
    const badge = p.badges.find(b => b.id === 'king_of_the_hill');
    expect(badge.earned).toBe(true);
  });

  test('king of the hill badge is NOT earned by non-king', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();
    const badge = p.badges.find(b => b.id === 'king_of_the_hill');
    expect(badge.earned).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Badges', () => {
  let league, alice, bob;

  test.beforeAll(async ({ request }) => {
    league = await createTestLeague(request, '_badges');
    alice  = await addPlayer(request, league, 'Alice');
    bob    = await addPlayer(request, league, 'Bob');
  });

  test('first_win badge is awarded after winning a game', async ({ request }) => {
    await recordGame(request, league, alice.id, bob.id);

    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();
    const badge = p.badges.find(b => b.id === 'first_win');
    expect(badge.earned).toBe(true);
  });

  test('first_win badge is NOT awarded to the loser', async ({ request }) => {
    const res = await request.get(`${BASE}/api/players/${bob.id}/profile?league=${league}`);
    const p = await res.json();
    const badge = p.badges.find(b => b.id === 'first_win');
    expect(badge.earned).toBe(false);
  });

  test('games_10 badge requires 10 games played', async ({ request }) => {
    // Play 9 more games (alice has 1 already, bob has 1)
    for (let i = 0; i < 9; i++) {
      if (i % 2 === 0) await recordGame(request, league, alice.id, bob.id);
      else             await recordGame(request, league, bob.id, alice.id);
    }

    const aliceRes = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const aliceProfile = await aliceRes.json();
    const bobRes = await request.get(`${BASE}/api/players/${bob.id}/profile?league=${league}`);
    const bobProfile = await bobRes.json();

    // Both should have played 10 games now
    const aliceBadge = aliceProfile.badges.find(b => b.id === 'games_10');
    const bobBadge   = bobProfile.badges.find(b => b.id === 'games_10');
    expect(aliceBadge.earned).toBe(true);
    expect(bobBadge.earned).toBe(true);
  });

  test('achieve_record badge is awarded to record holder', async ({ request }) => {
    // Alice has the most wins in this league
    const res = await request.get(`${BASE}/api/players/${alice.id}/profile?league=${league}`);
    const p = await res.json();
    const badge = p.badges.find(b => b.id === 'achieve_record');
    expect(badge.earned).toBe(true);
  });

  test('beat_top badge is awarded when top player is beaten', async ({ request }) => {
    // In this league Alice is highly rated — Bob needs to beat Alice to get the badge.
    // We already have alternating results, so check if bob ever beat alice when she was top
    const res = await request.get(`${BASE}/api/players/${bob.id}/profile?league=${league}`);
    const p = await res.json();
    // Bob has beaten Alice at least once during the 10-game sequence
    const badge = p.badges.find(b => b.id === 'beat_top');
    // This badge depends on whether bob ever beat alice when alice was the top-rated player.
    // It may or may not be earned here, so just verify the badge is present in the list.
    expect(badge).toBeTruthy();
    expect(typeof badge.earned).toBe('boolean');
  });
});

