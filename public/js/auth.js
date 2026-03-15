/**
 * Shared auth utilities used by records.html and player.html.
 * index.html has its own inline implementation that also handles joinLeague().
 */

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function renderAuthNav() {
  const nav = document.getElementById('auth-nav');
  if (!nav) return;
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const user = await res.json();
      nav.innerHTML = `
        <a class="auth-user auth-user-link" href="/user.html?id=${esc(user.id)}">👤 ${esc(user.name)}</a>
        <button class="btn btn-sm btn-ghost" onclick="authLogout()">Sign Out</button>`;
    } else {
      nav.innerHTML = `
        <a class="btn btn-sm btn-ghost" href="/login.html">Sign In</a>
        <a class="btn btn-sm" href="/register.html">Register</a>`;
    }
  } catch {
    nav.innerHTML = `
      <a class="btn btn-sm btn-ghost" href="/login.html">Sign In</a>
      <a class="btn btn-sm" href="/register.html">Register</a>`;
  }
}

async function authLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.reload();
}

renderAuthNav();

