const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT) : 3000;
const DATA_DIR = process.env.TEST_DATA_DIR || path.join(__dirname, 'data');

// ── Persistence ───────────────────────────────────────────────────────────────

function dbPath(league) {
  return path.join(DATA_DIR, `${league}.json`);
}

function getDb(league) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const p = dbPath(league);
  if (!fs.existsSync(p)) {
    const initial = { players: [], games: [] };
    fs.writeFileSync(p, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveDb(league, db) {
  fs.writeFileSync(dbPath(league), JSON.stringify(db, null, 2));
}

function getLeagues() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

function validLeague(league) {
  return typeof league === 'string' && /^[a-z0-9_-]+$/i.test(league) && league.length <= 40;
}

// ── ELO calculation ───────────────────────────────────────────────────────────

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

// ── Badges ────────────────────────────────────────────────────────────────────

const BADGE_DEFS = [
  {
    id: 'first_win',
    name: 'First Win',
    icon: '🥇',
    desc: 'Win your first game'
  },
  {
    id: 'games_10',
    name: 'Veteran',
    icon: '🎮',
    desc: 'Play 10 games'
  },
  {
    id: 'games_50',
    name: 'Seasoned',
    icon: '🏅',
    desc: 'Play 50 games'
  },
  {
    id: 'games_100',
    name: 'Centurion',
    icon: '💯',
    desc: 'Play 100 games'
  },
  {
    id: 'beat_top',
    name: 'Giant Killer',
    icon: '🗡️',
    desc: 'Beat the top rated player'
  },
  {
    id: 'achieve_record',
    name: 'Record Holder',
    icon: '📈',
    desc: 'Hold at least one all-time record'
  },
  {
    id: 'all_records',
    name: 'Grand Slam',
    icon: '🏆',
    desc: 'Hold all four records simultaneously'
  },
  {
    id: 'king_of_the_hill',
    name: 'King of the Hill',
    icon: '👑',
    desc: 'Win the first ever game or beat the reigning King of the Hill'
  }
];

// Walk the game history chronologically — the winner of the first game
// becomes king; the title transfers whenever the current king loses.
function computeKingOfTheHill(db) {
  if (!db.games.length) return null;
  const sorted = [...db.games].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  let kingId = sorted[0].winnerId;
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i];
    if (g.loserId === kingId) kingId = g.winnerId;
  }
  return kingId;
}

function computeBadges(player, games, db) {
  const earned = new Set();
  const played = player.wins + player.losses;

  if (player.wins >= 1)   earned.add('first_win');
  if (played >= 10)       earned.add('games_10');
  if (played >= 50)       earned.add('games_50');
  if (played >= 100)      earned.add('games_100');

  // Beat the top rated player — did this player ever beat whoever was rated
  // highest at the time of that game (winnerRatingBefore comparison)?
  games.forEach(g => {
    if (g.winnerId !== player.id) return;
    // The loser's rating before the game
    const loserBefore = g.loserRatingBefore;
    // Was the loser top-rated? Check if any other player had a higher rating
    // at that moment — approximate by checking if loserBefore was the highest
    // among all players' ratings before this game. We use the stored
    // winnerRatingBefore too.
    const allBefore = db.games
      .filter(og => og.playedAt < g.playedAt)
      .reduce((acc, og) => {
        acc[og.winnerId] = og.winnerRatingAfter;
        acc[og.loserId]  = og.loserRatingAfter;
        return acc;
      }, {});
    // Fill in starting ratings for anyone not yet seen
    db.players.forEach(p => { if (!(p.id in allBefore)) allBefore[p.id] = 1000; });
    const maxRating = Math.max(...Object.values(allBefore));
    if (loserBefore >= maxRating) earned.add('beat_top');
  });

  // Records — compute all four and check if player holds any / all
  const records = { longestWinStreak: 0, mostGamesPlayed: 0, mostGamesWon: 0, highestEloRating: 0 };
  const holders = { longestWinStreak: null, mostGamesPlayed: null, mostGamesWon: null, highestEloRating: null };

  for (const p of db.players) {
    const pg = db.games.filter(g => g.winnerId === p.id || g.loserId === p.id);
    const pp = p.wins + p.losses;
    if (pp > records.mostGamesPlayed) { records.mostGamesPlayed = pp; holders.mostGamesPlayed = p.id; }
    if (p.wins > records.mostGamesWon) { records.mostGamesWon = p.wins; holders.mostGamesWon = p.id; }

    let high = 1000;
    pg.forEach(g => {
      const r = g.winnerId === p.id ? g.winnerRatingAfter : g.loserRatingAfter;
      if (r > high) high = r;
    });
    if (high > records.highestEloRating) { records.highestEloRating = high; holders.highestEloRating = p.id; }

    let cw = 0, cl = 0, bw = 0, bl = 0;
    pg.forEach(g => {
      if (g.winnerId === p.id) { cw++; cl = 0; if (cw > bw) bw = cw; }
      else                     { cl++; cw = 0; if (cl > bl) bl = cl; }
    });
    if (bw > records.longestWinStreak)  { records.longestWinStreak  = bw; holders.longestWinStreak  = p.id; }
  }

  const holdsAny = Object.values(holders).some(id => id === player.id);
  const holdsAll = Object.values(holders).every(id => id === player.id);
  if (holdsAny) earned.add('achieve_record');
  if (holdsAll) earned.add('all_records');

  if (computeKingOfTheHill(db) === player.id) earned.add('king_of_the_hill');

  return BADGE_DEFS.map(b => ({ ...b, earned: earned.has(b.id) }));
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── League management ─────────────────────────────────────────────────────────

// GET /api/leagues — list all leagues
app.get('/api/leagues', (req, res) => {
  res.json(getLeagues());
});

// POST /api/leagues — create a new league { name }
app.post('/api/leagues', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const slug = name.trim().toLowerCase().replace(/\s+/g, '_');
  if (!validLeague(slug)) return res.status(400).json({ error: 'Invalid league name' });
  if (fs.existsSync(dbPath(slug))) return res.status(400).json({ error: 'League already exists' });
  getDb(slug); // creates the file
  res.status(201).json({ league: slug });
});

// ── Helper — resolve & validate ?league= param ────────────────────────────────

function resolveLeague(req, res) {
  const league = (req.query.league || 'pool').toLowerCase();
  if (!validLeague(league)) { res.status(400).json({ error: 'Invalid league' }); return null; }
  if (!fs.existsSync(dbPath(league))) { res.status(404).json({ error: 'League not found' }); return null; }
  return league;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/players?league=pool
app.get('/api/players', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const db = getDb(league);
  const sorted = [...db.players].sort((a, b) => b.rating - a.rating);
  const kingId = computeKingOfTheHill(db);
  res.json({ players: sorted, kingId });
});

// POST /api/players?league=pool
app.post('/api/players', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const db = getDb(league);
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const duplicate = db.players.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
  if (duplicate) return res.status(400).json({ error: 'Player already exists' });

  const player = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), rating: 1000, wins: 0, losses: 0 };
  db.players.push(player);
  saveDb(league, db);
  res.status(201).json(player);
});

// GET /api/players/:id/profile?league=pool
app.get('/api/players/:id/profile', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const db = getDb(league);
  const player = db.players.find(p => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const games = db.games.filter(g => g.winnerId === player.id || g.loserId === player.id);
  const sorted = [...db.players].sort((a, b) => b.rating - a.rating);
  const position = sorted.findIndex(p => p.id === player.id) + 1;

  const allResults = [...games].reverse().map(g => ({
    result: g.winnerId === player.id ? 'W' : 'L',
    opponent: g.winnerId === player.id
      ? (db.players.find(p => p.id === g.loserId)  || { name: 'Unknown' }).name
      : (db.players.find(p => p.id === g.winnerId) || { name: 'Unknown' }).name,
    ratingChange: g.winnerId === player.id ? +g.ratingChange : -g.ratingChange,
    playedAt: g.playedAt
  }));

  let longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0;
  let currentStreak = { type: null, count: 0 };
  games.forEach(g => {
    const won = g.winnerId === player.id;
    if (won) { curWin++; curLoss = 0; if (curWin > longestWin) longestWin = curWin; }
    else     { curLoss++; curWin = 0; if (curLoss > longestLoss) longestLoss = curLoss; }
  });
  if (games.length) {
    const lastWon = games[games.length - 1].winnerId === player.id;
    currentStreak = lastWon ? { type: 'W', count: curWin } : { type: 'L', count: curLoss };
  }

  let high = player.rating, low = player.rating;
  games.forEach(g => {
    const r = g.winnerId === player.id ? g.winnerRatingAfter : g.loserRatingAfter;
    if (r > high) high = r;
    if (r < low)  low  = r;
  });
  if (1000 > high) high = 1000;
  if (1000 < low)  low  = 1000;

  const eloHistory = [{ rating: 1000, playedAt: null, label: 'Start' }];
  games.forEach(g => {
    const won = g.winnerId === player.id;
    eloHistory.push({ rating: won ? g.winnerRatingAfter : g.loserRatingAfter, playedAt: g.playedAt });
  });

  const total = player.wins + player.losses;
  res.json({
    id: player.id, name: player.name, rating: player.rating,
    position, totalPlayers: db.players.length,
    wins: player.wins, losses: player.losses, played: total,
    winPct: total ? Math.round((player.wins / total) * 100) : 0,
    results: allResults, longestWinStreak: longestWin, longestLossStreak: longestLoss,
    currentStreak, highestRating: high, lowestRating: low, eloHistory,
    badges: computeBadges(player, games, db)
  });
});

// GET /api/records?league=pool
app.get('/api/records', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const db = getDb(league);

  const records = {
    longestWinStreak: { value: 0, holders: [] },
    mostGamesPlayed:  { value: 0, holders: [] },
    mostGamesWon:     { value: 0, holders: [] },
    highestEloRating: { value: 0, holders: [] }
  };

  function addHolder(record, value, player) {
    if (value > record.value) {
      record.value   = value;
      record.holders = [{ id: player.id, name: player.name }];
    } else if (value === record.value && value > 0) {
      record.holders.push({ id: player.id, name: player.name });
    }
  }

  for (const player of db.players) {
    const games = db.games.filter(g => g.winnerId === player.id || g.loserId === player.id);
    const played = player.wins + player.losses;

    addHolder(records.mostGamesPlayed, played, player);
    addHolder(records.mostGamesWon, player.wins, player);

    let high = 1000;
    games.forEach(g => {
      const r = g.winnerId === player.id ? g.winnerRatingAfter : g.loserRatingAfter;
      if (r > high) high = r;
    });
    addHolder(records.highestEloRating, high, player);

    let curWin = 0, bestWin = 0;
    games.forEach(g => {
      if (g.winnerId === player.id) { curWin++; if (curWin > bestWin) bestWin = curWin; }
      else                          { curWin = 0; }
    });
    addHolder(records.longestWinStreak, bestWin, player);
  }

  res.json(records);
});

// GET /api/games?league=pool
app.get('/api/games', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const db = getDb(league);
  const enriched = [...db.games].reverse().map(g => {
    const winner = db.players.find(p => p.id === g.winnerId);
    const loser  = db.players.find(p => p.id === g.loserId);
    return { ...g, winnerName: winner ? winner.name : 'Unknown', loserName: loser ? loser.name : 'Unknown' };
  });
  res.json(enriched);
});

// POST /api/games?league=pool
app.post('/api/games', (req, res) => {
  const league = resolveLeague(req, res); if (!league) return;
  const db = getDb(league);
  const { winnerId, loserId } = req.body;
  if (!winnerId || !loserId) return res.status(400).json({ error: 'winnerId and loserId required' });
  if (winnerId === loserId)  return res.status(400).json({ error: 'Winner and loser must be different players' });

  const winner = db.players.find(p => p.id === winnerId);
  const loser  = db.players.find(p => p.id === loserId);
  if (!winner) return res.status(404).json({ error: 'Winner not found' });
  if (!loser)  return res.status(404).json({ error: 'Loser not found' });

  const { newWinnerRating, newLoserRating, change } = calcElo(winner.rating, loser.rating);
  const game = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    winnerId: winner.id, loserId: loser.id,
    winnerRatingBefore: winner.rating, loserRatingBefore: loser.rating,
    winnerRatingAfter: newWinnerRating, loserRatingAfter: newLoserRating,
    ratingChange: change, playedAt: new Date().toISOString()
  };

  winner.rating = newWinnerRating; winner.wins   += 1;
  loser.rating  = newLoserRating;  loser.losses  += 1;
  db.games.push(game);
  saveDb(league, db);

  res.status(201).json({ ...game, winnerName: winner.name, loserName: loser.name });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const os = require('os');

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

