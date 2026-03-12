function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatLeagueName(slug) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function load() {
  const league = localStorage.getItem('currentLeague') || 'pool';
  document.querySelector('header p').textContent =
    `All-time bests — ${formatLeagueName(league)}`;

  try {
    const r = await fetch(`/api/records?league=${league}`);
    if (!r.ok) throw new Error();
    const data = await r.json();
    render(data, league);
  } catch (e) {
    document.getElementById('root').innerHTML =
      '<div class="empty-state">Failed to load records.</div>';
  }
}

function playerLink(id, name, league) {
  if (!id) return '<span class="no-record">No games yet</span>';
  return `<a class="player-link" href="/player.html?id=${esc(id)}&league=${esc(league)}">${esc(name)}</a>`;
}

function render(d, league) {
  const records = [
    {
      icon: '🔥',
      title: 'Longest Winning Streak',
      value: d.longestWinStreak.value
        ? `${d.longestWinStreak.value} Win${d.longestWinStreak.value !== 1 ? 's' : ''}`
        : '—',
      valueClass: 'green',
      holder: playerLink(d.longestWinStreak.playerId, d.longestWinStreak.playerName, league)
    },
    {
      icon: '🎱',
      title: 'Most Games Played',
      value: d.mostGamesPlayed.value ? `${d.mostGamesPlayed.value} Games` : '—',
      valueClass: 'accent',
      holder: playerLink(d.mostGamesPlayed.playerId, d.mostGamesPlayed.playerName, league)
    },
    {
      icon: '🏆',
      title: 'Most Games Won',
      value: d.mostGamesWon.value ? `${d.mostGamesWon.value} Wins` : '—',
      valueClass: 'green',
      holder: playerLink(d.mostGamesWon.playerId, d.mostGamesWon.playerName, league)
    },
    {
      icon: '⭐',
      title: 'Highest Ever ELO',
      value: d.highestEloRating.value ? d.highestEloRating.value : '—',
      valueClass: 'accent',
      holder: playerLink(d.highestEloRating.playerId, d.highestEloRating.playerName, league)
    }
  ];

  document.getElementById('root').innerHTML = `
    <div class="records-grid">
      ${records.map(rec => `
        <div class="record-card">
          <div class="record-icon">${rec.icon}</div>
          <div class="record-title">${rec.title}</div>
          <div class="record-value ${rec.valueClass}">${rec.value}</div>
          <div class="record-holder">${rec.holder}</div>
        </div>
      `).join('')}
    </div>
  `;
}

load();
