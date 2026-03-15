// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatLeagueName(slug) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ── Load & render ─────────────────────────────────────────────────────────────

async function load() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { render404(); return; }
  try {
    const r = await fetch('/api/users/' + id + '/profile');
    if (!r.ok) { render404(); return; }
    const user = await r.json();
    renderProfile(user);
  } catch (e) {
    document.getElementById('root').innerHTML = '<div class="center">Failed to load profile.</div>';
  }
}

function render404() {
  document.getElementById('root').innerHTML = '<div class="center">User not found.</div>';
}

function renderProfile(user) {
  document.title = user.name + ' \u2014 Pool League';
  const avatarUrl = '/api/users/' + esc(user.id) + '/avatar';
  const leaguesHtml = user.leagues.length
    ? user.leagues.map(l => renderLeagueCard(l)).join('')
    : '<div class="no-leagues">Not a member of any league yet.</div>';

  document.getElementById('root').innerHTML = `
    <div class="user-hero">
      <div class="user-avatar-wrap">
        <img class="user-avatar" src="${avatarUrl}" alt="${esc(user.name)}" />
      </div>
      <div class="user-info">
        <div class="user-name">${esc(user.name)}</div>
        <div class="user-joined">Member since ${formatDate(user.createdAt)}</div>
        <div class="user-leagues-count">${user.leagues.length} league${user.leagues.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
    <div class="leagues-section">
      <h2 class="section-title">Leagues</h2>
      <div class="leagues-list">${leaguesHtml}</div>
    </div>`;
}

function renderLeagueCard(l) {
  const formHtml = (l.form && l.form.length)
    ? l.form.map(r =>
        `<span class="form-sq ${r === 'W' ? 'form-w' : 'form-l'}" title="${r === 'W' ? 'Win' : 'Loss'}"></span>`
      ).join('')
    : '<span class="form-none">\u2014</span>';

  const earnedBadges = l.badges.filter(b => b.earned);
  const badgesHtml = earnedBadges.length
    ? earnedBadges.map(b =>
        `<span class="mini-badge" title="${esc(b.name)}: ${esc(b.desc)}">${b.icon}</span>`
      ).join('')
    : '<span class="no-badges">No badges yet</span>';

  const streakLabel = (l.currentStreak && l.currentStreak.type)
    ? `<span class="streak-pill streak-${l.currentStreak.type.toLowerCase()}">${l.currentStreak.type}${l.currentStreak.count}</span>`
    : '<span class="streak-none">\u2014</span>';

  return `
    <a class="league-card" href="/?league=${esc(l.league)}">
      <div class="league-card-header">
        <span class="league-card-name">${esc(formatLeagueName(l.league))}</span>
        <span class="league-card-rank">${ordinal(l.position)} of ${l.totalPlayers}</span>
      </div>
      <div class="league-stats-row">
        <div class="league-stat">
          <span class="ls-value accent">${l.rating}</span>
          <span class="ls-label">ELO</span>
        </div>
        <div class="league-stat">
          <span class="ls-value green">${l.wins}</span>
          <span class="ls-label">W</span>
        </div>
        <div class="league-stat">
          <span class="ls-value red">${l.losses}</span>
          <span class="ls-label">L</span>
        </div>
        <div class="league-stat">
          <span class="ls-value accent">${l.played ? l.winPct + '%' : '\u2014'}</span>
          <span class="ls-label">Win%</span>
        </div>
        <div class="league-stat">
          <span class="ls-value">${streakLabel}</span>
          <span class="ls-label">Streak</span>
        </div>
        <div class="league-stat form-stat">
          <span class="ls-form">${formHtml}</span>
          <span class="ls-label">Form</span>
        </div>
      </div>
      <div class="league-badges-row">${badgesHtml}</div>
    </a>`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

load();
