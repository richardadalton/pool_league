// ── League state ──────────────────────────────────────────────────────────────

// Allow ?league= URL param to override localStorage (useful for direct links and tests)
const _urlLeague = new URLSearchParams(window.location.search).get('league');
if (_urlLeague) localStorage.setItem('currentLeague', _urlLeague);
let currentLeague = localStorage.getItem('currentLeague') || 'pool';

function setLeague(league) {
  currentLeague = league;
  localStorage.setItem('currentLeague', league);
  const name = formatLeagueName(league);
  document.getElementById('league-title').textContent = name;
  document.getElementById('league-table-title').textContent = name;
  renderLeagueSwitcher(window._leagues || []);
  updateJoinBanner();
  refresh();
}

function formatLeagueName(slug) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setMsg(id, text, isErr) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + (isErr ? 'err' : 'ok');
  if (text) setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 3500);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ── Fetch wrappers ────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── XSS safety ───────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── League Switcher ───────────────────────────────────────────────────────────

async function loadLeagueSwitcher() {
  const leagues = await api('GET', '/api/leagues');
  window._leagues = leagues;
  // If saved league no longer exists, fall back to first available
  if (!leagues.includes(currentLeague)) {
    currentLeague = leagues[0] || 'pool';
    localStorage.setItem('currentLeague', currentLeague);
  }
  const name = formatLeagueName(currentLeague);
  document.getElementById('league-title').textContent = name;
  document.getElementById('league-table-title').textContent = name;
  renderLeagueSwitcher(leagues);
}

function renderLeagueSwitcher(leagues) {
  const wrap = document.getElementById('league-switcher');
  const addBtn = currentUser
    ? `<button class="league-pill add-league" onclick="toggleNewLeagueForm()">＋ New</button>`
    : '';
  wrap.innerHTML = leagues.map(l => `
    <button class="league-pill${l === currentLeague ? ' active' : ''}" onclick="setLeague('${esc(l)}')">${esc(formatLeagueName(l))}</button>
  `).join('') + addBtn;
}

function toggleNewLeagueForm() {
  const form = document.getElementById('new-league-form');
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  if (form.style.display === 'flex') document.getElementById('new-league-name').focus();
}

async function addLeague() {
  const input = document.getElementById('new-league-name');
  const name = input.value.trim();
  if (!name) return setMsg('league-msg', 'Please enter a league name.', true);
  try {
    const result = await api('POST', '/api/leagues', { name });
    input.value = '';
    document.getElementById('new-league-form').style.display = 'none';
    window._leagues = await api('GET', '/api/leagues');
    setLeague(result.league);
  } catch (e) {
    setMsg('league-msg', e.message, true);
  }
}

// ── Render League Table ───────────────────────────────────────────────────────

async function loadLeague() {
  const data = await api('GET', `/api/players?league=${currentLeague}`);
  const players = data.players;
  const kingId  = data.kingId;
  const wrap = document.getElementById('league-table-wrap');

  if (!players.length) {
    wrap.innerHTML = '<div class="empty-state">No players yet — add some below!</div>';
    return players;
  }

  const rows = players.map((p, i) => {
    const rank = i + 1;
    const posClass = rank <= 3 ? `pos-${rank}` : '';
    const total = p.wins + p.losses;
    const pct = total ? Math.round((p.wins / total) * 100) : 0;
    const crown = p.id === kingId ? ' <span class="koth-crown" title="King of the Hill">👑</span>' : '';
    const formHtml = (p.form && p.form.length)
      ? p.form.map(r => `<span class="form-sq ${r === 'W' ? 'form-w' : 'form-l'}" title="${r === 'W' ? 'Win' : 'Loss'}"></span>`).join('')
      : '<span class="form-none">—</span>';
    const avatarUrl = `/api/players/${p.id}/avatar?league=${currentLeague}`;
    const streak = p.currentStreak && p.currentStreak.type
      ? `<span class="streak-pill streak-${p.currentStreak.type.toLowerCase()}">${p.currentStreak.type}${p.currentStreak.count}</span>`
      : '<span class="streak-none">—</span>';
    return `
      <tr>
        <td class="pos ${posClass}">${rank}</td>
        <td class="avatar-cell"><img class="league-avatar" data-id="${p.id}" src="${avatarUrl}" alt="" /></td>
        <td class="player-name"><a href="/player.html?id=${p.id}&league=${currentLeague}" class="player-link">${esc(p.name)}</a>${crown}</td>
        <td class="num"><span class="rating-badge">${p.rating}</span></td>
        <td class="num">${p.wins}</td>
        <td class="num">${p.losses}</td>
        <td class="num win-pct">${total ? pct + '%' : '—'}</td>
        <td class="streak-cell">${streak}</td>
        <td class="form-cell">${formHtml}</td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th><th class="avatar-head"></th><th>Player</th>
          <th class="num">ELO</th><th class="num">W</th><th class="num">L</th><th class="num">Win%</th><th class="streak-head">Streak</th><th class="form-head">Form</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  return players;
}

// ── Render History ────────────────────────────────────────────────────────────

async function loadHistory() {
  const games = await api('GET', `/api/games?league=${currentLeague}`);
  const list = document.getElementById('history-list');

  if (!games.length) {
    list.innerHTML = '<div class="empty-state">No games recorded yet.</div>';
    return;
  }

  list.innerHTML = games.slice(0, 50).map(g => {
    const date = g.playedAt
      ? new Date(g.playedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    return `
    <div class="game-item" id="game-item-${esc(g.id)}">
      <div class="vs">
        <span class="game-winner">${esc(g.winnerName)}</span>
        <span class="vs-sep">beat</span>
        <span class="game-loser">${esc(g.loserName)}</span>
      </div>
      <span class="game-date">${date}</span>
      <button class="delete-btn" title="Delete game" onclick="showDeleteConfirm('${esc(g.id)}')">🗑</button>
      <div class="delete-confirm" id="delete-confirm-${esc(g.id)}" style="display:none">
        <span class="delete-label">Type winner's name to confirm:</span>
        <input type="text" class="delete-input" id="delete-input-${esc(g.id)}"
               placeholder="${esc(g.winnerName)}"
               onkeydown="if(event.key==='Enter')deleteGame('${esc(g.id)}')"/>
        <button class="btn btn-danger" onclick="deleteGame('${esc(g.id)}')">Delete</button>
        <button class="btn btn-cancel" onclick="hideDeleteConfirm('${esc(g.id)}')">Cancel</button>
      </div>
    </div>`;
  }).join('');
}

function showDeleteConfirm(gameId) {
  // Hide any other open confirmations first
  document.querySelectorAll('.delete-confirm').forEach(el => el.style.display = 'none');
  const confirm = document.getElementById(`delete-confirm-${gameId}`);
  confirm.style.display = 'flex';
  document.getElementById(`delete-input-${gameId}`).focus();
}

function hideDeleteConfirm(gameId) {
  const confirm = document.getElementById(`delete-confirm-${gameId}`);
  confirm.style.display = 'none';
  document.getElementById(`delete-input-${gameId}`).value = '';
}

async function deleteGame(gameId) {
  const input = document.getElementById(`delete-input-${gameId}`);
  const typed = input.value.trim();
  if (!typed) { input.classList.add('input-err'); input.focus(); return; }
  input.classList.remove('input-err');

  try {
    await api('DELETE', `/api/games/${gameId}?league=${currentLeague}`, { winnerName: typed });
    await refresh();
  } catch (e) {
    input.classList.add('input-err');
    input.placeholder = e.message;
    input.value = '';
    input.focus();
  }
}

// ── Populate selects ──────────────────────────────────────────────────────────

function populateSelects(players) {
  const ws = document.getElementById('winner-select');
  const ls = document.getElementById('loser-select');
  const wVal = ws.value, lVal = ls.value;

  const opts = players.map(p =>
    `<option value="${p.id}">${esc(p.name)} (${p.rating})</option>`
  ).join('');

  ws.innerHTML = '<option value="">🏆 Winner…</option>' + opts;
  ls.innerHTML = '<option value="">💀 Loser…</option>' + opts;

  if (wVal) ws.value = wVal;
  if (lVal) ls.value = lVal;
}

// ── Full refresh ───────────────────────────────────────��──────────────────────

async function refresh() {
  try {
    const players = await loadLeague();
    populateSelects(players);
    await loadHistory();
  } catch (e) {
    console.error(e);
  }
}

// ── Add player ────────────────────────────────────────────────────────────────

async function addPlayer() {
  const input = document.getElementById('new-player-name');
  const name = input.value.trim();
  if (!name) return setMsg('player-msg', 'Please enter a name.', true);
  try {
    await api('POST', `/api/players?league=${currentLeague}`, { name });
    input.value = '';
    setMsg('player-msg', `${name} added!`, false);
    await refresh();
  } catch (e) {
    setMsg('player-msg', e.message, true);
  }
}

// ── Record game ───────────────────────────────────────────────────────────────

async function recordGame() {
  const winnerId = document.getElementById('winner-select').value;
  const loserId  = document.getElementById('loser-select').value;

  if (!winnerId) return setMsg('game-msg', 'Select a winner.', true);
  if (!loserId)  return setMsg('game-msg', 'Select a loser.', true);
  if (winnerId === loserId) return setMsg('game-msg', 'Winner and loser must be different.', true);

  const btn = document.getElementById('record-btn');
  btn.disabled = true;
  try {
    const g = await api('POST', `/api/games?league=${currentLeague}`, { winnerId, loserId });
    setMsg('game-msg', `✅ ${g.winnerName} beat ${g.loserName} (+${g.ratingChange})`, false);
    document.getElementById('winner-select').value = '';
    document.getElementById('loser-select').value  = '';
    await refresh();
  } catch (e) {
    setMsg('game-msg', e.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ── Auth state ────────────────────────────────────────────────────────────────

let currentUser = null;        // { id, name, email } or null
let memberships = {};          // { leagueSlug: playerId }

function renderAuthNav(user) {
  const nav = document.getElementById('auth-nav');
  if (user) {
    nav.innerHTML = `
      <span class="auth-user">👤 ${esc(user.name)}</span>
      <button class="btn btn-sm btn-ghost" onclick="logout()">Sign Out</button>`;
  } else {
    nav.innerHTML = `
      <a class="btn btn-sm btn-ghost" href="/login.html">Sign In</a>
      <a class="btn btn-sm" href="/register.html">Register</a>`;
  }
  const show = user ? '' : 'none';
  document.getElementById('record-card').style.display     = show;
  document.getElementById('add-player-card').style.display = show;
}

function updateJoinBanner() {
  const banner = document.getElementById('join-banner');
  if (!currentUser) { banner.style.display = 'none'; return; }
  const alreadyJoined = memberships[currentLeague];
  banner.style.display = alreadyJoined ? 'none' : 'flex';
}

async function joinLeague() {
  const btn = document.getElementById('join-btn');
  btn.disabled = true;
  try {
    await api('POST', `/api/leagues/${currentLeague}/join`, {});
    memberships = await api('GET', '/api/auth/memberships');
    updateJoinBanner();
    await refresh();
  } catch (e) {
    setMsg('join-msg', e.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function logout() {
  await api('POST', '/api/auth/logout', {});
  currentUser = null;
  memberships = {};
  renderAuthNav(null);
  updateJoinBanner();
}

async function loadAuthState() {
  try {
    currentUser = await api('GET', '/api/auth/me');
  } catch {
    currentUser = null;
  }
  try {
    memberships = currentUser ? await api('GET', '/api/auth/memberships') : {};
  } catch {
    memberships = {};
  }
  renderAuthNav(currentUser);
  updateJoinBanner();
}

// ── Boot ──────────────────────────────────────────────────────────────────────

// Auth must resolve first so currentUser is set before renderLeagueSwitcher runs
loadAuthState().then(() => loadLeagueSwitcher()).then(() => refresh());
