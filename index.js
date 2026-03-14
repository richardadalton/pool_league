const express = require('express');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const multer  = require('multer');
const sharp   = require('sharp');

const app  = express();
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT) : 3000;
const DATA_DIR = process.env.TEST_DATA_DIR || path.join(__dirname, 'data');

// ── Append-only persistence ───────────────────────────────────────────────────
//
// Layout on disk (one sub-directory per league):
//   data/<league>/players.jsonl    — one JSON object per line, append-only
//   data/<league>/games.jsonl      — one JSON object per line, append-only
//   data/<league>/snapshots/       — periodic snapshots of derived state
//     <ISO-date>.json              — { snapshotAt, players: [{id,name,registeredAt,rating,wins,losses}] }
//
// In memory (leagueCache Map):
//   { players, games }             — fully derived state, invalidated only on
//                                    app restart; updated in-place on writes.

function leagueDir(league) {
  return path.join(DATA_DIR, league);
}
function playersPath(league) {
  return path.join(leagueDir(league), 'players.jsonl');
}
function gamesPath(league) {
  return path.join(leagueDir(league), 'games.jsonl');
}
function snapshotsDir(league) {
  return path.join(leagueDir(league), 'snapshots');
}

function ensureLeagueDir(league) {
  const dir = leagueDir(league);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sd = snapshotsDir(league);
  if (!fs.existsSync(sd)) fs.mkdirSync(sd, { recursive: true });
  if (!fs.existsSync(playersPath(league))) fs.writeFileSync(playersPath(league), '');
  if (!fs.existsSync(gamesPath(league)))   fs.writeFileSync(gamesPath(league),   '');
}

function avatarsDir(league) {
  return path.join(leagueDir(league), 'avatars');
}
function avatarPath(league, playerId) {
  return path.join(avatarsDir(league), `${playerId}.jpg`);
}

/** Read all JSON lines from a file, skipping blank lines. */
function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => JSON.parse(l));

  // Apply tombstones: collect deleted game ids, then filter them out
  const deleted = new Set(
    lines.filter(l => l._tombstone).map(l => l.gameId)
  );
  return lines.filter(l => !l._tombstone && !deleted.has(l.id));
}

/** Append a single object as a JSON line. */
function appendJsonl(filePath, obj) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n');
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

/** Return the most recent snapshot, or null. */
function loadLatestSnapshot(league) {
  const dir = snapshotsDir(league);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort(); // ISO date filenames sort chronologically
  if (!files.length) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'));
  } catch {
    return null;
  }
}

/** Write a snapshot of the current fully-derived player state. */
function writeSnapshot(league, players) {
  ensureLeagueDir(league);
  const snapshotAt = new Date().toISOString();
  const filename   = snapshotAt.slice(0, 10) + '.json'; // one per day max
  fs.writeFileSync(path.join(snapshotsDir(league), filename), JSON.stringify({ snapshotAt, players }, null, 2));
}

/** Days elapsed since an ISO date string. */
function daysSince(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Auto-snapshot: if no snapshot exists or the latest is >= 30 days old, write one.
 * Called after every cold-load replay.
 */
function maybeAutoSnapshot(league, players) {
  if (players.length === 0) return;   // never snapshot an empty league
  const snap = loadLatestSnapshot(league);
  if (!snap || daysSince(snap.snapshotAt) >= 30) writeSnapshot(league, players);
}

// ── ELO ───────────────────────────────────────────────────────────────────────

const K = 32;

function calcElo(winnerRating, loserRating) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser  = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
  const change = Math.round(K * (1 - expectedWinner));
  return {
    newWinnerRating: winnerRating + change,
    newLoserRating:  loserRating  + Math.round(K * (0 - expectedLoser)),
    change
  };
}

// ── Replay ────────────────────────────────────────────────────────────────────

/**
 * Given a base player list (from snapshot or raw registrations) and a list of
 * games to replay, return the fully-derived player state.
 */
function replayGames(basePlayers, games) {
  const state = new Map();
  for (const p of basePlayers) {
    state.set(p.id, {
      id:           p.id,
      name:         p.name,
      registeredAt: p.registeredAt,
      rating:       typeof p.rating  === 'number' ? p.rating  : 1000,
      wins:         typeof p.wins    === 'number' ? p.wins    : 0,
      losses:       typeof p.losses  === 'number' ? p.losses  : 0,
    });
  }
  for (const g of games) {
    const w = state.get(g.winnerId);
    const l = state.get(g.loserId);
    if (!w || !l) continue; // orphaned game — skip
    const { newWinnerRating, newLoserRating } = calcElo(w.rating, l.rating);
    w.rating = newWinnerRating; w.wins++;
    l.rating = newLoserRating;  l.losses++;
  }
  return [...state.values()];
}

// ── Per-league in-memory cache ────────────────────────────────────────────────
//
// leagueCache: Map<slug, { players: Player[], games: Game[] }>
//
// • Populated lazily on first request (cold load = snapshot + replay)
// • Updated in-place on every write — no re-replay needed
// • Cleared on app restart

const leagueCache = new Map();

/**
 * Cold-load: find latest snapshot, load only games after its timestamp,
 * replay them, cache the result, and auto-snapshot if due.
 */
function coldLoad(league) {
  ensureLeagueDir(league);

  const snap     = loadLatestSnapshot(league);
  const allGames = readJsonl(gamesPath(league));

  let basePlayers, replaySubset;

  if (snap && snap.players && snap.players.length > 0) {
    basePlayers  = snap.players;
    replaySubset = allGames.filter(g => g.playedAt > snap.snapshotAt);
  } else {
    const rawPlayers = readJsonl(playersPath(league));
    basePlayers      = rawPlayers.map(p => ({ ...p, rating: 1000, wins: 0, losses: 0 }));
    replaySubset     = allGames;
  }

  const players = replayGames(basePlayers, replaySubset);
  maybeAutoSnapshot(league, players);

  const entry = { players, games: allGames };
  leagueCache.set(league, entry);
  return entry;
}

/** Get the cached state for a league, loading it if necessary. */
function getCache(league) {
  if (!leagueCache.has(league)) coldLoad(league);
  return leagueCache.get(league);
}

// ── League helpers ────────────────────────────────────────────────────────────

function getLeagues() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter(f => {
      const full = path.join(DATA_DIR, f);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'games.jsonl'));
    });
}

function validLeague(league) {
  return typeof league === 'string' && /^[a-z0-9_-]+$/i.test(league) && league.length <= 40;
}

function leagueExists(league) {
  return fs.existsSync(path.join(leagueDir(league), 'games.jsonl'));
}

// ── Badges ────────────────────────────────────────────────────────────────────

const BADGE_DEFS = [
  { id: 'first_win',        name: 'First Win',        icon: '🥇', desc: 'Win your first game' },
  { id: 'games_10',         name: 'Veteran',           icon: '🎮', desc: 'Play 10 games' },
  { id: 'games_50',         name: 'Seasoned',          icon: '🏅', desc: 'Play 50 games' },
  { id: 'games_100',        name: 'Centurion',         icon: '💯', desc: 'Play 100 games' },
  { id: 'beat_top',         name: 'Giant Killer',      icon: '🗡️', desc: 'Beat the top rated player' },
  { id: 'achieve_record',   name: 'Record Holder',     icon: '📈', desc: 'Hold at least one all-time record' },
  { id: 'all_records',      name: 'Grand Slam',        icon: '🏆', desc: 'Hold all six records simultaneously (sole holder, no ties)' },
  { id: 'king_of_the_hill', name: 'King of the Hill',  icon: '👑', desc: 'Win the first ever game or beat the reigning King of the Hill' }
];

// Walk the game history chronologically — the winner of the first game
// becomes king; the title transfers whenever the current king loses.
function computeKingOfTheHill(games) {
  if (!games.length) return null;
  const sorted = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  let kingId = sorted[0].winnerId;
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i];
    if (g.loserId === kingId) kingId = g.winnerId;
  }
  return kingId;
}

function computeRecordMaps(players, games) {
  const recVals = {
    longestWinStreak: 0, mostGamesPlayed: 0, mostGamesWon: 0,
    highestEloRating: 0, longestActiveWinStreak: 0, defendTheHill: 0,
  };
  const recHolders = {
    longestWinStreak: new Set(), mostGamesPlayed: new Set(), mostGamesWon: new Set(),
    highestEloRating: new Set(), longestActiveWinStreak: new Set(), defendTheHill: new Set(),
  };

  function track(key, value, pid) {
    if (value > recVals[key])                     { recVals[key] = value; recHolders[key] = new Set([pid]); }
    else if (value === recVals[key] && value > 0) { recHolders[key].add(pid); }
  }

  for (const p of players) {
    const pg = games.filter(g => g.winnerId === p.id || g.loserId === p.id);
    if (pg.length === 0) continue;   // must have played at least one game to hold a record

    track('mostGamesPlayed', p.wins + p.losses, p.id);
    track('mostGamesWon',    p.wins,             p.id);

    let high = 0;
    pg.forEach(g => {
      const r = g.winnerId === p.id ? g.winnerRatingAfter : g.loserRatingAfter;
      if (r > high) high = r;
    });
    track('highestEloRating', high, p.id);

    let cw = 0, bw = 0;
    pg.forEach(g => {
      if (g.winnerId === p.id) { cw++; if (cw > bw) bw = cw; }
      else                     { cw = 0; }
    });
    track('longestWinStreak', bw, p.id);

    const lastGame     = pg[pg.length - 1];
    const activeStreak = (lastGame && lastGame.winnerId === p.id) ? cw : 0;
    track('longestActiveWinStreak', activeStreak, p.id);
  }

  // Defend the Hill
  {
    const sorted = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
    const defendBest = {};
    if (sorted.length) {
      let kingId = sorted[0].winnerId;
      let curDefend = 1;
      defendBest[kingId] = Math.max(defendBest[kingId] || 0, curDefend);
      for (let i = 1; i < sorted.length; i++) {
        const g = sorted[i];
        if (g.winnerId === kingId) {
          curDefend++;
          defendBest[kingId] = Math.max(defendBest[kingId] || 0, curDefend);
        } else {
          kingId    = g.winnerId;
          curDefend = 1;
          defendBest[kingId] = Math.max(defendBest[kingId] || 0, curDefend);
        }
      }
    }
    for (const p of players) track('defendTheHill', defendBest[p.id] || 0, p.id);
  }

  return { recVals, recHolders };
}

// Return the player ID who holds the current biggest upset, or null if none.
function computeBiggestUpsetHolder(games) {
  let best = 0, holderId = null;
  for (const g of games) {
    const diff = g.loserRatingBefore - g.winnerRatingBefore;
    if (diff > best) { best = diff; holderId = g.winnerId; }
  }
  return holderId;
}

function computeBadges(player, playerGames, allPlayers, allGames) {
  const earned = new Set();
  const played = player.wins + player.losses;

  if (player.wins >= 1)   earned.add('first_win');
  if (played >= 10)       earned.add('games_10');
  if (played >= 50)       earned.add('games_50');
  if (played >= 100)      earned.add('games_100');

  // Beat the top-rated player
  playerGames.forEach(g => {
    if (g.winnerId !== player.id) return;
    const loserBefore = g.loserRatingBefore;
    const allBefore = allGames
      .filter(og => og.playedAt < g.playedAt)
      .reduce((acc, og) => {
        acc[og.winnerId] = og.winnerRatingAfter;
        acc[og.loserId]  = og.loserRatingAfter;
        return acc;
      }, {});
    allPlayers.forEach(p => { if (!(p.id in allBefore)) allBefore[p.id] = 1000; });
    const maxRating = Math.max(...Object.values(allBefore));
    if (loserBefore >= maxRating) earned.add('beat_top');
  });

  const { recHolders } = computeRecordMaps(allPlayers, allGames);
  const holdsAny = Object.values(recHolders).some(s => s.has(player.id))
                || computeBiggestUpsetHolder(allGames) === player.id;
  const holdsAll = Object.values(recHolders).every(s => s.size === 1 && s.has(player.id));
  if (holdsAny) earned.add('achieve_record');
  if (holdsAll) earned.add('all_records');

  if (computeKingOfTheHill(allGames) === player.id) earned.add('king_of_the_hill');

  return BADGE_DEFS.map(b => ({ ...b, earned: earned.has(b.id) }));
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── League routes ─────────────────────────────────────────────────────────────

app.get('/api/leagues', (_req, res) => {
  res.json(getLeagues());
});

app.post('/api/leagues', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const slug = name.trim().toLowerCase().replace(/\s+/g, '_');
  if (!validLeague(slug)) return res.status(400).json({ error: 'Invalid league name' });
  if (leagueExists(slug)) return res.status(400).json({ error: 'League already exists' });
  ensureLeagueDir(slug);
  res.status(201).json({ league: slug });
});

// ── Helper: resolve & validate ?league= param ─────────────────────────────────

function resolveLeague(req, res) {
  const league = (req.query.league || 'pool').toLowerCase();
  if (!validLeague(league))  { res.status(400).json({ error: 'Invalid league' });    return null; }
  if (!leagueExists(league)) { res.status(404).json({ error: 'League not found' }); return null; }
  return league;
}

// ── Admin: manual snapshot ────────────────────────────────────────────────────

app.post('/api/admin/snapshot', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { players } = getCache(league);
  writeSnapshot(league, players);
  res.json({ ok: true, snapshotAt: new Date().toISOString(), players: players.length });
});

// ── Players ───────────────────────────────────────────────────────────────────

app.get('/api/players', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { players, games } = getCache(league);
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const kingId = computeKingOfTheHill(games);

  const result = sorted.map(p => {
    const playerGames = games.filter(g => g.winnerId === p.id || g.loserId === p.id);

    const form = playerGames
      .slice(-5)
      .map(g => g.winnerId === p.id ? 'W' : 'L');

    let curW = 0, curL = 0;
    playerGames.forEach(g => {
      if (g.winnerId === p.id) { curW++; curL = 0; }
      else                     { curL++; curW = 0; }
    });
    const currentStreak = playerGames.length === 0
      ? { type: null, count: 0 }
      : playerGames[playerGames.length - 1].winnerId === p.id
        ? { type: 'W', count: curW }
        : { type: 'L', count: curL };

    return { ...p, form, currentStreak };
  });

  res.json({ players: result, kingId });
});

app.post('/api/players', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const { players } = getCache(league);
  const duplicate = players.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
  if (duplicate) return res.status(400).json({ error: 'Player already exists' });

  const player = {
    id:           `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name:         name.trim(),
    registeredAt: new Date().toISOString(),
    rating:       1000,
    wins:         0,
    losses:       0,
  };

  // Append only the immutable identity fields to the log
  appendJsonl(playersPath(league), { id: player.id, name: player.name, registeredAt: player.registeredAt });

  // Update cache in-place
  players.push(player);

  res.status(201).json(player);
});

// ── Player profile ────────────────────────────────────────────────────────────

app.get('/api/players/:id/profile', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { players, games } = getCache(league);

  const player = players.find(p => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const playerGames = games.filter(g => g.winnerId === player.id || g.loserId === player.id);
  const sorted      = [...players].sort((a, b) => b.rating - a.rating);
  const position    = sorted.findIndex(p => p.id === player.id) + 1;

  const allResults = [...playerGames].reverse().map(g => ({
    result:       g.winnerId === player.id ? 'W' : 'L',
    opponent:     g.winnerId === player.id
      ? (players.find(p => p.id === g.loserId)  || { name: 'Unknown' }).name
      : (players.find(p => p.id === g.winnerId) || { name: 'Unknown' }).name,
    ratingChange: g.winnerId === player.id ? +g.ratingChange : -g.ratingChange,
    playedAt:     g.playedAt,
  }));

  let longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0;
  let currentStreak = { type: null, count: 0 };
  playerGames.forEach(g => {
    const won = g.winnerId === player.id;
    if (won) { curWin++; curLoss = 0; if (curWin  > longestWin)  longestWin  = curWin; }
    else     { curLoss++; curWin = 0; if (curLoss > longestLoss) longestLoss = curLoss; }
  });
  if (playerGames.length) {
    const lastWon = playerGames[playerGames.length - 1].winnerId === player.id;
    currentStreak = lastWon ? { type: 'W', count: curWin } : { type: 'L', count: curLoss };
  }

  let high = player.rating, low = player.rating;
  playerGames.forEach(g => {
    const r = g.winnerId === player.id ? g.winnerRatingAfter : g.loserRatingAfter;
    if (r > high) high = r;
    if (r < low)  low  = r;
  });
  if (1000 > high) high = 1000;
  if (1000 < low)  low  = 1000;

  const eloHistory = [{ rating: 1000, playedAt: null, label: 'Start' }];
  playerGames.forEach(g => {
    const won = g.winnerId === player.id;
    eloHistory.push({ rating: won ? g.winnerRatingAfter : g.loserRatingAfter, playedAt: g.playedAt });
  });

  const total = player.wins + player.losses;

  res.json({
    id: player.id, name: player.name, rating: player.rating,
    position, totalPlayers: players.length,
    wins: player.wins, losses: player.losses, played: total,
    winPct: total ? Math.round((player.wins / total) * 100) : 0,
    results: allResults, longestWinStreak: longestWin, longestLossStreak: longestLoss,
    currentStreak, highestRating: high, lowestRating: low, eloHistory,
    badges: computeBadges(player, playerGames, players, games),
  });
});

// ── Records ───────────────────────────────────────────────────────────────────

app.get('/api/records', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { players, games } = getCache(league);

  const records = {
    longestWinStreak:       { value: 0, holders: [] },
    longestActiveWinStreak: { value: 0, holders: [] },
    mostGamesPlayed:        { value: 0, holders: [] },
    mostGamesWon:           { value: 0, holders: [] },
    highestEloRating:       { value: 0, holders: [] },
    defendTheHill:          { value: 0, holders: [] },
    biggestUpset: { ratingDiff: 0, winnerId: null, winnerName: null, loserId: null, loserName: null },
  };

  function addHolder(record, value, player) {
    if (value > record.value) {
      record.value   = value;
      record.holders = [{ id: player.id, name: player.name }];
    } else if (value === record.value && value > 0) {
      record.holders.push({ id: player.id, name: player.name });
    }
  }

  for (const player of players) {
    const pg     = games.filter(g => g.winnerId === player.id || g.loserId === player.id);
    if (pg.length === 0) continue;   // must have played at least one game to hold a record

    const played = player.wins + player.losses;

    addHolder(records.mostGamesPlayed, played,       player);
    addHolder(records.mostGamesWon,    player.wins,  player);

    let high = 0;
    pg.forEach(g => {
      const r = g.winnerId === player.id ? g.winnerRatingAfter : g.loserRatingAfter;
      if (r > high) high = r;
    });
    addHolder(records.highestEloRating, high, player);

    let cw = 0, bw = 0;
    pg.forEach(g => {
      if (g.winnerId === player.id) { cw++; if (cw > bw) bw = cw; }
      else                          { cw = 0; }
    });
    addHolder(records.longestWinStreak, bw, player);

    const lastGame     = pg[pg.length - 1];
    const activeStreak = (lastGame && lastGame.winnerId === player.id) ? cw : 0;
    addHolder(records.longestActiveWinStreak, activeStreak, player);
  }

  // Defend the Hill
  {
    const sorted = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
    const defendBest = {};
    if (sorted.length) {
      let kingId = sorted[0].winnerId;
      let curDefend = 1;
      defendBest[kingId] = Math.max(defendBest[kingId] || 0, curDefend);
      for (let i = 1; i < sorted.length; i++) {
        const g = sorted[i];
        if (g.winnerId === kingId) {
          curDefend++;
          defendBest[kingId] = Math.max(defendBest[kingId] || 0, curDefend);
        } else {
          kingId    = g.winnerId;
          curDefend = 1;
          defendBest[kingId] = Math.max(defendBest[kingId] || 0, curDefend);
        }
      }
    }
    for (const player of players) addHolder(records.defendTheHill, defendBest[player.id] || 0, player);
  }

  // Biggest upset
  for (const g of games) {
    const diff = g.loserRatingBefore - g.winnerRatingBefore;
    if (diff > records.biggestUpset.ratingDiff) {
      const winner = players.find(p => p.id === g.winnerId);
      const loser  = players.find(p => p.id === g.loserId);
      records.biggestUpset = {
        ratingDiff: diff,
        winnerId:   g.winnerId,
        winnerName: winner ? winner.name : 'Unknown',
        loserId:    g.loserId,
        loserName:  loser  ? loser.name  : 'Unknown',
      };
    }
  }

  res.json(records);
});

// ── Games ─────────────────────────────────────────────────────────────────────

app.get('/api/games', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { players, games } = getCache(league);
  const enriched = [...games].reverse().map(g => {
    const winner = players.find(p => p.id === g.winnerId);
    const loser  = players.find(p => p.id === g.loserId);
    return { ...g, winnerName: winner ? winner.name : 'Unknown', loserName: loser ? loser.name : 'Unknown' };
  });
  res.json(enriched);
});

app.post('/api/games', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { winnerId, loserId } = req.body;
  if (!winnerId || !loserId)  return res.status(400).json({ error: 'winnerId and loserId required' });
  if (winnerId === loserId)   return res.status(400).json({ error: 'Winner and loser must be different players' });

  const { players, games } = getCache(league);

  const winner = players.find(p => p.id === winnerId);
  const loser  = players.find(p => p.id === loserId);
  if (!winner) return res.status(404).json({ error: 'Winner not found' });
  if (!loser)  return res.status(404).json({ error: 'Loser not found' });

  const { newWinnerRating, newLoserRating, change } = calcElo(winner.rating, loser.rating);

  const game = {
    id:                 `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    winnerId:           winner.id,
    loserId:            loser.id,
    winnerRatingBefore: winner.rating,
    loserRatingBefore:  loser.rating,
    winnerRatingAfter:  newWinnerRating,
    loserRatingAfter:   newLoserRating,
    ratingChange:       change,
    playedAt:           new Date().toISOString(),
  };

  // Append to log (single atomic write)
  appendJsonl(gamesPath(league), game);

  // Update cache in-place — no re-replay needed
  winner.rating = newWinnerRating; winner.wins++;
  loser.rating  = newLoserRating;  loser.losses++;
  games.push(game);

  res.status(201).json({ ...game, winnerName: winner.name, loserName: loser.name });
});

app.delete('/api/games/:id', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { id } = req.params;
  const { winnerName } = req.body; // confirmation: caller must supply the winner's name

  const { games, players } = getCache(league);
  const game = games.find(g => g.id === id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  // Confirm the caller knows who won — guards against accidental deletion
  const winner = players.find(p => p.id === game.winnerId);
  const expectedName = winner ? winner.name.trim().toLowerCase() : '';
  if (!winnerName || winnerName.trim().toLowerCase() !== expectedName) {
    return res.status(403).json({ error: 'Winner name does not match' });
  }

  // Append tombstone to the log
  appendJsonl(gamesPath(league), { _tombstone: true, gameId: id, deletedAt: new Date().toISOString() });

  // Clear snapshots so the cold reload replays from scratch (snapshots predate the deletion)
  const snapDir = path.join(leagueDir(league), 'snapshots');
  if (fs.existsSync(snapDir)) {
    fs.readdirSync(snapDir).forEach(f => fs.unlinkSync(path.join(snapDir, f)));
  }

  // Rebuild cache from scratch so all derived state (ratings, wins, losses) is correct
  leagueCache.delete(league);
  coldLoad(league);

  res.json({ ok: true });
});

// ── Avatar routes ─────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// GET /api/players/:id/avatar?league=pool — serve avatar or redirect to initials fallback
app.get('/api/players/:id/avatar', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { id } = req.params;
  const file = avatarPath(league, id);

  if (fs.existsSync(file)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(file).pipe(res);
  }

  // No avatar — send a generated SVG with the player's initials
  const { players } = getCache(league);
  const player = players.find(p => p.id === id);
  const initials = player
    ? player.name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('')
    : '?';

  const colours = ['#16a34a','#0d9488','#2563eb','#7c3aed','#c2410c','#b45309'];
  const colour  = colours[id.charCodeAt(0) % colours.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <circle cx="100" cy="100" r="100" fill="${colour}"/>
    <text x="100" y="100" font-family="system-ui,sans-serif" font-size="80"
          font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-store');
  res.send(svg);
});

// POST /api/players/:id/avatar?league=pool — upload, resize to 200×200, save as JPEG
app.post('/api/players/:id/avatar', upload.single('avatar'), async (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const { id } = req.params;

  const { players } = getCache(league);
  if (!players.find(p => p.id === id)) return res.status(404).json({ error: 'Player not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const dir = avatarsDir(league);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await sharp(req.file.buffer)
      .resize(200, 200, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toFile(avatarPath(league, id));

    res.json({ avatarUrl: `/api/players/${id}/avatar?league=${league}&v=${Date.now()}` });
  } catch (e) {
    console.error('Avatar upload error:', e);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets))
    for (const net of nets[name])
      if (net.family === 'IPv4' && !net.internal) return net.address;
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`Pool League running at:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
});

module.exports = app; // for testing
