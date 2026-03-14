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
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Load & render ─────────────────────────────────────────────────────────────

async function load() {
  const params = new URLSearchParams(location.search);
  const id     = params.get('id');
  const league = params.get('league') || localStorage.getItem('currentLeague') || 'pool';
  if (!id) { render404(); return; }

  // Update back link to carry league context
  document.querySelector('.back-link').href = `/?league=${league}`;

  try {
    const r = await fetch(`/api/players/${id}/profile?league=${league}`);
    if (!r.ok) { render404(); return; }
    const p = await r.json();
    renderProfile(p, league);
  } catch (e) {
    document.getElementById('root').innerHTML =
      `<div class="center">Failed to load profile.</div>`;
  }
}

function render404() {
  document.getElementById('root').innerHTML =
    `<div class="center">Player not found.</div>`;
}

function renderProfile(p, league) {
  document.title = `${p.name} — Pool League`;

  const avatarUrl = `/api/players/${esc(p.id)}/avatar?league=${esc(league)}`;

  // Current streak label
  let streakLabel = '—';
  let streakClass = 'neutral';
  if (p.currentStreak.type) {
    const word = p.currentStreak.type === 'W' ? 'Win' : 'Loss';
    streakLabel = `${p.currentStreak.count} ${word}${p.currentStreak.count !== 1 ? 's' : ''}`;
    streakClass = p.currentStreak.type === 'W' ? 'win' : 'loss';
  }

  // Rivals — show head-to-head record and total games
  const rivalsHtml = p.rivals && p.rivals.length
    ? p.rivals.map(r => `
        <div class="h2h-row">
          <a class="h2h-name" href="/player.html?id=${esc(r.id)}&league=${esc(league)}">${esc(r.name)}</a>
          <div class="h2h-record">
            <span class="h2h-w">${r.wins}W</span>
            <span class="h2h-sep">–</span>
            <span class="h2h-l">${r.losses}L</span>
            <span class="h2h-played">(${r.played} game${r.played !== 1 ? 's' : ''})</span>
          </div>
        </div>`).join('')
    : '<span class="h2h-none">No games played yet</span>';

  // Nemeses — show defeats (times the nemesis beat the profile player) and total games
  const nemesesHtml = p.nemeses && p.nemeses.length
    ? p.nemeses.map(n => `
        <div class="h2h-row">
          <a class="h2h-name" href="/player.html?id=${esc(n.id)}&league=${esc(league)}">${esc(n.name)}</a>
          <div class="h2h-record">
            <span class="h2h-l">${n.losses} Loss${n.losses !== 1 ? 'es' : ''}</span>
            <span class="h2h-played">(${n.played} game${n.played !== 1 ? 's' : ''})</span>
          </div>
        </div>`).join('')
    : '<span class="h2h-none">No losses yet</span>';

  // All results
  const resultsHtml = p.results.length
    ? p.results.map(g => {
        const date = g.playedAt
          ? new Date(g.playedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
          : '';
        return `
        <div class="result-row">
          <span class="badge ${g.result}">${g.result}</span>
          <span class="opp">vs ${esc(g.opponent)}</span>
          <span class="result-date">${date}</span>
        </div>`;
      }).join('')
    : '<span style="color:var(--muted);font-size:0.85rem">No games yet</span>';

  // Badges
  const badgesHtml = p.badges.map(b => `
    <div class="badge-item${b.earned ? ' earned' : ' locked'}" title="${esc(b.desc)}">
      <span class="badge-icon">${b.earned ? b.icon : '🔒'}</span>
      <span class="badge-name">${esc(b.name)}</span>
    </div>`).join('');

  document.getElementById('root').innerHTML = `
    <!-- League banner -->
    <div class="league-banner">${esc(formatLeagueName(league))} League</div>

    <!-- Hero -->
    <div class="hero">
      <label class="hero-avatar-wrap" title="Click to upload photo">
        <img class="hero-avatar" src="${avatarUrl}" alt="${esc(p.name)}" />
        <div class="avatar-overlay">📷</div>
        <input type="file" accept="image/*" class="avatar-file-input" data-id="${esc(p.id)}" data-league="${esc(league)}" />
      </label>
      <div class="hero-info">
        <div class="hero-name-row">
          <div class="hero-name">${esc(p.name)}</div>
          ${p.claimable ? `<button class="btn btn-claim" onclick="claimPlayer('${esc(p.id)}', '${esc(league)}')">This is me</button>` : ''}
        </div>
        <div class="hero-rating">
          <span class="rating-value">${p.rating}</span>
          <span class="rating-label">ELO Rating</span>
        </div>
        <div class="hero-position">${ordinal(p.position)} of ${p.totalPlayers} players</div>
      </div>
    </div>

    <!-- Badges -->
    <div class="card" style="margin-bottom:20px">
      <h3>Badges</h3>
      <div class="badges-row">${badgesHtml}</div>
    </div>

    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value accent">${p.played}</div>
        <div class="stat-label">Games Played</div>
      </div>
      <div class="stat-card">
        <div class="stat-value green">${p.wins}</div>
        <div class="stat-label">Wins</div>
      </div>
      <div class="stat-card">
        <div class="stat-value red">${p.losses}</div>
        <div class="stat-label">Losses</div>
      </div>
      <div class="stat-card">
        <div class="stat-value accent">${p.played ? p.winPct + '%' : '—'}</div>
        <div class="stat-label">Win Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value green">${p.highestRating}</div>
        <div class="stat-label">Highest ELO</div>
      </div>
      <div class="stat-card">
        <div class="stat-value red">${p.lowestRating}</div>
        <div class="stat-label">Lowest ELO</div>
      </div>
    </div>


    <!-- Streaks -->
    <div class="card" style="margin-bottom:20px">
      <h3>Streaks</h3>
      <div class="streak-row">
        <div class="streak-item">
          <span class="s-label">Current streak</span>
          <span class="s-val ${streakClass}">${streakLabel}</span>
        </div>
        <div class="streak-item">
          <span class="s-label">Longest winning streak</span>
          <span class="s-val win">${p.longestWinStreak} Win${p.longestWinStreak !== 1 ? 's' : ''}</span>
        </div>
        <div class="streak-item">
          <span class="s-label">Longest losing streak</span>
          <span class="s-val loss">${p.longestLossStreak} Loss${p.longestLossStreak !== 1 ? 'es' : ''}</span>
        </div>
      </div>
    </div>

    <!-- Rival & Nemesis -->
    <div class="h2h-grid">
      <div class="card h2h-card rival-card" style="margin-bottom:20px">
        <h3>⚔️ Biggest Rival</h3>
        <p class="h2h-sub">Most games played against</p>
        ${rivalsHtml}
      </div>
      <div class="card h2h-card nemesis-card" style="margin-bottom:20px">
        <h3>💀 Nemesis</h3>
        <p class="h2h-sub">Most games lost against</p>
        ${nemesesHtml}
      </div>
    </div>

    <!-- Results History -->
    <div class="card" style="margin-bottom:20px">
      <h3>Results History</h3>
      <div class="results-scroll">${resultsHtml}</div>
    </div>
  `;


  // Wire up avatar upload
  document.querySelector('.avatar-file-input').addEventListener('change', async function () {
    if (!this.files[0]) return;
    const formData = new FormData();
    formData.append('avatar', this.files[0]);
    const wrap = document.querySelector('.hero-avatar-wrap');
    wrap.classList.add('uploading');
    try {
      const r = await fetch(`/api/players/${this.dataset.id}/avatar?league=${this.dataset.league}`, {
        method: 'POST', body: formData
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Upload failed');
      const { avatarUrl } = await r.json();
      document.querySelector('.hero-avatar').src = avatarUrl;
      // Also refresh league table avatars if any
      document.querySelectorAll(`.league-avatar[data-id="${this.dataset.id}"]`).forEach(img => {
        img.src = avatarUrl;
      });
    } catch (e) {
      alert('Upload failed: ' + e.message);
    } finally {
      wrap.classList.remove('uploading');
      this.value = '';
    }
  });
}


// ── Claim player ──────────────────────────────────────────────────────────────

async function claimPlayer(playerId, league) {
  const btn = document.querySelector('.btn-claim');
  if (btn) { btn.disabled = true; btn.textContent = 'Claiming…'; }
  try {
    const res = await fetch(`/api/players/${playerId}/claim?league=${league}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to claim player');
    // Reload the profile to reflect the claimed state (button disappears)
    window.location.reload();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'This is me'; }
    alert(e.message);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

load();

