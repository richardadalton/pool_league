# 🎱 League Tracker — Development Log

A summary of design and implementation decisions made during the development of the League Tracker application.

---

## Project Origin

The project started as a **Pool league tracker** (`pool_league`) — a simple local web app to track player ELO ratings and game results. It was built with Node.js/Express on the backend and vanilla HTML/CSS/JS on the frontend, with data stored in a JSON file.

---

## Development Decisions

### 1. Project Naming & Configuration
- **Issue:** The project appeared in JetBrains WebStorm as `elorateai` in square brackets beside the project name `pool_league`. This was because the `name` field in `package.json` was set to `elorateai`.
- **Decision:** Updated the `name` field in `package.json` to `pool_league` to match the actual project folder name.

---

### 2. ELO Rating System
- **Decision:** Used the standard **ELO formula** with a **K-factor of 32**.
- Every new player starts at a rating of **1000**.
- After each game, the winner gains points and the loser loses an equal number of points.
- The amount transferred depends on the rating difference — beating a higher-rated opponent earns more points than beating a lower-rated one.
- Equal-rated players exchange exactly **16 points** per game.

#### Longest Winning Streak Calculation
- The streak is calculated by iterating through a player's full game history in chronological order.
- A counter is incremented for each win and reset to zero on any loss.
- The maximum value the counter ever reaches is stored as the longest winning streak.

---

### 3. Source Control — GitHub Setup
- The project was pushed to a new GitHub repository.
- **Issue 1:** The initial push failed because the repository already existed on GitHub.
- **Issue 2:** Authentication failed — GitHub no longer supports password authentication for Git operations over HTTPS.
- **Resolution:** Used a **Personal Access Token (PAT)** in place of a password for HTTPS authentication.

---

### 4. Records Page
- **Decision:** Created a dedicated `records.html` page linked from the home page.
- **Records tracked (initial set):**
  - Longest ever winning streak
  - Longest ever losing streak
  - Most games played
  - Highest ever ELO rating
- Each record displays the name of the player who holds it, with a link to their profile page.
- **Later change:** The **longest losing streak** record was removed as it was deemed undesirable to highlight.
- **Later addition:** A **most games won** record was added.

---

### 5. Multi-Game / Multi-League Support
- **Context:** The question arose — if we wanted to track leagues for multiple games (Chess, Snooker, Pool, Backgammon), how should that be structured?
- **Options considered:**
  - Option 1: Separate apps for each game.
  - Option 2: A single app with a hardcoded game type.
  - **Option 3 (chosen):** A single app that supports multiple leagues, each backed by its own data file, with a UI switcher to move between them.
- **Implementation:**
  - Each league is stored as a separate JSON file in the `data/` directory (e.g. `data/pool.json`, `data/chess.json`).
  - A league switcher UI element was added to the header on all pages.
  - A **＋ New** button allows creating a new league on the fly, which automatically creates a new data file.
  - The active league is persisted per-browser using `localStorage`.
  - All API routes accept a `?league=` query parameter (defaulting to `pool`).
  - Example data files were created for `chess.json`, `darts.json`, `backgammon.json`, and `doh.json`.

---

### 6. Player Profile Page Improvements

#### Results History
- **Initial state:** A "Last 5 Results" card showed results as pills (coloured badges), with one pill rendering larger than the others.
- **Change 1:** Switched from pills to rows so results are displayed as a vertical list for visual consistency.
- **Change 2:** Renamed "Last 5 Results" to **"Results History"** and made the list show **all results** in a scrollable container.

#### Layout — ELO Chart Position
- **Decision:** Moved the **ELO rating chart** above the streaks card on the profile page to give it more visual prominence.

#### Hero Section — Player Name Display
- **Issue:** Long player names were being cut off with ellipses in the hero section.
- **Fix attempt 1:** Changed the layout so the name is always shown in full.
- **Issue persisted:** The name was wrapping onto multiple lines.
- **Final fix:** Forced the name onto a single line (`white-space: nowrap`) and displayed the **ELO rating in smaller text underneath** the name, giving the name full horizontal space.

---

### 7. Badges Feature

A badges/achievements system was designed and implemented to reward player milestones.

#### Badges Defined

| Badge | Criteria |
|-------|----------|
| **First Win** | Win your first game |
| **Veteran** (10 Games Played) | Play 10 games |
| **Seasoned** (50 Games Played) | Play 50 games |
| **Centurion** (100 Games Played) | Play 100 games |
| **Record Holder** | Hold at least one all-time record *(originally named "Record Breaker")* |
| **Grand Slam** | Hold **all five** records simultaneously *(originally named "Legend")* |
| **Giant Killer** | Win a game against the current highest-rated player |
| **King of the Hill** | Win the first ever game or beat the reigning King of the Hill |

#### Badge Naming Changes
- `Record Breaker` → renamed to **Record Holder**
- `Legend` → renamed to **Grand Slam**

#### Grand Slam Icon
- Changed to a **trophy** 🏆 icon.

---

### 8. King of the Hill Feature

- **Concept:** A special status that starts with the winner of the very first game recorded, and transfers to any player who beats the current holder.
- **Display:** A **crown icon** (👑) is shown next to the King of the Hill's name in the league table on the home page.
- **Icon change:** The icon was changed from a custom/emoji icon to a plain **crown** (using a suitable icon/symbol).
- The King of the Hill badge on the profile page also reflects this status.

---

### 9. Playwright Test Suite

- **Decision:** Added a full end-to-end test suite using [Playwright](https://playwright.dev/).
- **Approach:** Tests spin up a separate server instance on **port 3001** using a **temporary data directory** (`/tmp/pool_league_test_data`), completely isolated from real league data.
- The server supports `TEST_PORT` and `TEST_DATA_DIR` environment variables to enable this isolation without any code branching.
- Player and game IDs were changed from `Date.now()` alone to `Date.now() + random suffix` to prevent ID collisions when multiple records are created in quick succession during tests.

#### Test Files

| File | Tests | What it covers |
|------|-------|----------------|
| `tests/helpers.js` | — | Shared utilities: `createTestLeague`, `addPlayer`, `recordGame` |
| `tests/api.spec.js` | 56 | All API endpoints — Leagues, Players, Games, Profile, Records, ELO maths, King of the Hill, Badges, Form guide, Biggest Upset, Active Streak |
| `tests/home.spec.js` | 24 | Home page UI — league table, form guide, add player form, record game form, game history, league switcher |
| `tests/player.spec.js` | 20 | Player profile UI — hero section, stats grid, badges, streaks, results history, ELO chart, 404 handling |
| `tests/records.spec.js` | 20 | Records page UI — layout, all 6 record cards, player links, biggest upset, active streak, empty state |

**Total: 120 tests, all passing.**

#### npm scripts added

```bash
npm test            # run all tests headless
npm run test:ui     # open Playwright interactive UI
npm run test:report # view HTML report after a run
```

---

### 10. Records Page — Tied Record Holders

- **Change:** The records API previously tracked only a single holder per record (`playerId` / `playerName`). Updated to return a `holders` array (`[{ id, name }]`) so that all players who share a record value are listed.
- **Backend:** A shared `addHolder()` helper resets the array when a new high value is found, and appends to it on an exact tie.
- **Frontend:** `playerLink()` replaced with `playerLinks()`, which maps the array to comma-separated profile links rendered inside the record card.
- **CSS:** `.record-holder` updated to `flex-wrap` so multiple names wrap neatly; `.holder-sep` styles the comma separators.
- **Tests:** API test suite updated to assert the `holders` array shape and added a test confirming both tied players appear when they share the `mostGamesPlayed` record.

---

### 11. Records Page — Comma Spacing Between Tied Names

- **Issue:** When multiple holders were listed, names were separated by `,` with no space, making them hard to read.
- **Fix:** Changed the separator from `', '` to `',&nbsp;'` (non-breaking space) so names are clearly spaced regardless of how the browser collapses whitespace inside inline HTML.

---

### 12. README Updates

The `README.md` was updated multiple times throughout development to reflect:
- The multi-league architecture
- New pages (records, player profiles)
- Badges and King of the Hill features
- Full API reference
- ELO system explanation
- Data storage approach
- Project structure (including test files)
- Testing section with commands and coverage table
- Tied record holders feature
- Comma spacing between tied names
- Form guide in the league table
- Biggest upset record
- Longest active winning streak record
- Grand Slam badge tie-consistency fix

---

### 13. Form Guide in the League Table

- **Decision:** Added a form guide column to the home page league table showing each player's last 5 results as small coloured squares — green for a win, red for a loss.
- **Backend:** `GET /api/players` now includes a `form` array on each player object — up to 5 entries of `'W'` or `'L'`, taken from the tail of the player's chronological game history.
- **Frontend:** Each table row renders up to 5 `<span class="form-sq form-w/form-l">` elements with a "Win"/"Loss" tooltip. Players with no games show a `—` placeholder. A **Form** column header was added.
- **CSS:** `.form-sq` is a 10×10px rounded square with `2px` margin between squares. `.form-w` uses `var(--green)` and `.form-l` uses `var(--red)`.
- **Tests:** 4 new API tests (form array present, only W/L values, capped at 5, reflects correct results) and 5 new UI tests (column header, squares visible, correct colour classes).

---

### 14. Biggest Upset Record

- **Decision:** Added a record card to the records page — the game where the winner had the largest ELO deficit going in (i.e. `loserRatingBefore - winnerRatingBefore` was greatest).
- **Backend:** The records API scans all games for the largest rating gap and returns a `biggestUpset` object: `{ ratingDiff, winnerId, winnerName, loserId, loserName }`. This has a different shape from the other records (which use a `holders` array) since it is a single game, not a per-player aggregate.
- **Frontend:** A new `upsetHolder()` helper renders "winner beat loser" with both names as profile links, separated by a `<span class="upset-sep">beat</span>` so the word and spacing render correctly inside the flexbox holder div. The value is displayed as `+N pts` in red.
- **CSS:** `.upset-sep` adds `margin: 0 5px` either side of the word "beat". When the card sits alone on the last row of the grid it spans both columns and is centred at max-width 420px.
- **Tests:** 5 new API tests and 4 new UI tests.

---

### 15. Longest Active Winning Streak Record

- **Decision:** Added a `⚡ Longest Active Streak` record card — the player currently on the longest *active* winning streak. This is distinct from the all-time longest streak which may have ended long ago. Positioned immediately after the all-time streak card on the records page.
- **Backend:** After iterating each player's games, the active streak is set to the current `curWin` counter only if the player's most recent game was a win, otherwise 0. Uses the standard `holders` array so tied players are all listed.
- **`computeBadges`:** Updated to include `longestActiveWinStreak` in the records checked for the **Record Holder** and **Grand Slam** badges. The Grand Slam badge description updated from "all four records" to "all five records simultaneously".
- **Frontend:** New card added to `records.js` with the `playerLinks()` helper (same as other streak/stats records).
- **Layout:** With 6 cards total the 2×3 grid is even — no orphan card CSS needed.
- **Tests:** 4 new API tests (field present, correct holder when on active streak, zeroed when last game was a loss, tied when both players have matching streaks) and 3 new UI tests (card visible, Alice shown as holder, empty state `—`). Total: 118 tests.

---

### 16. Grand Slam Badge — Tie-Consistency Bug Fix

- **Bug:** `computeBadges` tracked a single `playerId` per record using a plain object and strict `>` comparison. This meant:
  - The **first** player to reach a tied value was stored as the holder and kept
  - The **second** player who matched that value never overwrote it
  - The first player could therefore earn Grand Slam even with a tied record
  - The second player could never earn Grand Slam for the same tied record
  - Behaviour was inconsistent depending purely on iteration order through the players array
- **Fix:** Replaced the `holders` plain-object with `recHolders` — a `Set` of player IDs per record, using the same pattern as the records API endpoint:
  - A new high resets the set to just that player
  - A tie appends to the set
  - **`achieve_record` (Record Holder):** player appears in *any* record's set — ties still qualify ✓
  - **`all_records` (Grand Slam):** player is the **sole** holder (`set.size === 1`) of **every** record — ties disqualify ✗
- **Tests:** 2 new badge tests — Grand Slam NOT awarded when any record is tied; Record Holder IS awarded when a record is tied. Total: 120 tests.

---

### 17. Append-Only Storage with In-Memory Cache and Snapshots

#### Motivation
The original design used a single `data/<league>.json` file that was read and completely rewritten on every change. This created a read-modify-write race condition — if two requests arrived simultaneously, one write could silently overwrite the other.

#### Design discussions
Three questions were explored before implementation:
1. **Format** — CSV vs JSONL. JSONL chosen because it maps directly to existing JS objects with near-zero migration cost and handles special characters in names without quoting rules.
2. **Snapshots** — to bound cold-start replay time, monthly snapshots are written so restarts only replay the last 30 days of games.
3. **Multi-league caching** — to avoid replaying a league's log on every UI switch, each league is cached in memory after the first load and updated in-place on writes.

#### New disk layout
```
data/<league>/
  players.jsonl      ← one player registration per line (id, name, registeredAt)
  games.jsonl        ← one game result per line (all rating fields preserved)
  snapshots/
    <ISO-date>.json  ← { snapshotAt, players: [{id, name, registeredAt, rating, wins, losses}] }
```

#### Key implementation decisions

| Concern | Decision |
|---------|----------|
| Player writes | `appendFileSync` of a single JSONL line — atomic at OS level |
| Game writes | Same — append one line |
| Ratings stored? | **No** — always derived by replaying the game log |
| Cold start | Load latest snapshot → filter games after snapshot timestamp → replay only those |
| Auto-snapshot | Triggered on cold load if latest snapshot is ≥ 30 days old |
| Manual snapshot | `POST /api/admin/snapshot?league=<league>` |
| Per-league cache | `Map<slug, { players, games }>` — lazy-loaded, updated in-place on writes |
| League switching | Zero replays — second visit to a cached league served entirely from memory |
| Deleting a game | Not yet implemented; tombstone pattern noted as the correct approach if needed |

#### Test changes
- All ELO, badge, King of the Hill, and records logic — **unchanged**
- All API routes — **unchanged** (same URLs and response shapes)
- All frontend code — **unchanged**
- `saveDb()` and `getDb()` replaced by `appendJsonl()`, `readJsonl()`, `coldLoad()`, and `getCache()`
- `replayGames()` added — rebuilds `rating`, `wins`, `losses` from a base player list and a list of games

#### Test changes
- `playwright.config.js` — test server command now cleans the test data directory before each run (`rm -rf /tmp/...`) to prevent stale league directories from previous runs causing 400 errors
- `tests/helpers.js` — `createTestLeague` now generates shorter names (`tl_<8-digit-ts>_<4-char-rand><suffix>`) guaranteed to stay under the 40-character `validLeague` limit
- `tests/records.spec.js` — card count updated from 6 to 7 (6 Grand Slam + 1 Biggest Upset)

---

### 18. Delete Game Feature

#### Design decision — tombstone approach
Because the storage model is append-only, games cannot be physically removed. Instead, a **tombstone record** is appended to `games.jsonl`:

```json
{ "_tombstone": true, "gameId": "abc123", "deletedAt": "2026-03-13T..." }
```

When `readJsonl` loads the file it does a two-pass read:
1. Parse every line
2. Collect all `_tombstone` entries into a `Set` of deleted IDs
3. Filter out tombstone lines and any games whose `id` is in the set

Order doesn't matter — the tombstone can appear anywhere in the file and is always applied correctly.

#### Snapshot invalidation on delete
A subtle bug was caught and fixed: after a game deletion, if an auto-snapshot existed (snapped *before* the deletion), cold-reloading would use that snapshot as the base — meaning it already had ratings that included the deleted game. Deleting it from the log wouldn't change the snapshot-based ratings.

**Fix:** the DELETE route clears all snapshot files for the league before cold-reloading, forcing a full replay from raw events. This guarantees correct derived state after any deletion.

#### API — `DELETE /api/games/:id`
- Requires `{ winnerName }` in the request body as a confirmation step
- Comparison is **case-insensitive**
- Returns `403` if the name doesn't match — guards against accidental deletion
- Returns `404` if the game ID is not found
- On success: appends tombstone → clears snapshots → evicts cache → cold-reloads

#### UI — trash icon with inline confirmation
- Each game row in Recent Games shows a 🗑 trash icon button
- The icon is hidden until the row is hovered (low visual noise when not needed)
- Clicking the icon opens an **inline confirmation row** beneath that game; any other open confirmation closes automatically
- The confirmation row shows: label → text input (placeholder = winner's name) → **Delete** button → **Cancel** button
- Pressing Enter in the input triggers delete
- If the typed name doesn't match, the input border turns red and the error message replaces the placeholder — no page navigation
- On success, the entire page refreshes via `refresh()`

#### Tests added
- **API** (`api.spec.js`): 6 new tests — game removed from list, ratings recalculated after delete, 403 on wrong name, 403 on missing name, 404 on unknown ID, case-insensitive name check
- **UI** (`home.spec.js`): 7 new tests — delete button present, confirmation hidden by default, trash click reveals panel, cancel hides panel, wrong name shows error state, correct name deletes game and refreshes history

**Total: 132 tests, all passing.**

---

### 19. Player Avatars / Photos

#### Design decisions

| Concern | Decision |
|---|---|
| **Storage location** | `data/<league>/avatars/<playerId>.jpg` — filesystem, not JSONL. Avatars are mutable binary files, not events |
| **Format** | Always converted to JPEG on upload via `sharp` — consistent, small, universally supported |
| **Size** | Cropped to square then resized to 200×200px on upload — caps storage, ensures consistent display |
| **Overwrite** | Re-uploading simply overwrites the previous file — no versioning needed |
| **File size limit** | 5 MB max enforced by `multer` before any processing |
| **Cache busting** | Upload response includes `?v=<timestamp>` query param — forces browser to reload the new image immediately |
| **Default avatar** | When no file exists, the `GET` route returns a generated SVG circle with the player's initials in a colour derived from the player ID — app always looks good before anyone uploads |

#### New npm dependencies

```bash
npm install multer sharp
```

- **multer** — parses `multipart/form-data` uploads in Express; configured with `memoryStorage()` so the buffer goes straight to `sharp` without touching disk as a temp file
- **sharp** — resizes, centre-crops to square, converts to JPEG

#### Backend — two new routes

**`GET /api/players/:id/avatar?league=pool`**
- Streams `avatars/<playerId>.jpg` with `Cache-Control: max-age=86400` if it exists
- Falls back to a generated SVG with the player's initials if not — colour chosen deterministically from the player ID character code
- Returns SVG (not 404) for unknown player IDs so broken image icons never appear

**`POST /api/players/:id/avatar?league=pool`**
- Accepts `multipart/form-data` with field name `avatar`
- Returns 404 if player ID not found in the league cache
- Returns 400 if no file is present
- Processes via `sharp`: resize to 200×200, fit `cover`, position `centre`, quality 85 JPEG
- Saves to `data/<league>/avatars/<playerId>.jpg`
- Returns `{ avatarUrl }` with a cache-busting timestamp

#### Frontend changes

**League table (`public/js/index.js`, `public/css/index.css`)**
- New `avatar-cell` column added between rank and player name
- Each cell contains a 28×28px `<img class="league-avatar">` pointing at the avatar endpoint
- After a successful upload on the profile page, any matching `league-avatar` images on the same page are updated immediately via `data-id` attribute

**Player profile hero (`public/js/player.js`, `public/css/player.css`)**
- `hero-avatar` changed from a letter `<div>` to an `<img>` inside a `<label>` wrapper
- Clicking the avatar opens a hidden `<input type="file">` — no separate button needed
- A camera emoji overlay (`avatar-overlay`) fades in on hover to signal it's clickable
- On file selection the upload fires immediately, the `src` updates on success, and the label gets an `uploading` class while the request is in flight

#### Tests added (4 new API tests, 136 total)

| Test | What it checks |
|---|---|
| GET returns SVG initials when no avatar uploaded | Content-Type is SVG, body contains player's initial |
| GET returns SVG fallback for unknown player | No 404 — always returns something renderable |
| POST returns 404 for unknown player | Player validation before processing |
| POST returns 400 when no file sent | File presence validation |

---

### 20. Current Streak in the League Table

- **Decision:** Added a **Streak** column to the home page league table showing each player's current active streak as a coloured pill — e.g. `W3` (three consecutive wins) or `L2` (two consecutive losses). Players with no games show `—`.
- **Rationale:** The streak was already computed per-player on the profile page; exposing it in the league table gives an immediate "hot/cold" read on all players at a glance without navigating away.

#### Backend
- `GET /api/players` now computes `currentStreak: { type, count }` alongside the existing `form` array.
- Logic: iterate the player's games in chronological order, maintaining separate win/loss counters that reset on a result change. On completion, emit whichever counter was last active (`type: 'W'` or `'L'`). Players with no games return `{ type: null, count: 0 }`.

#### Frontend (`public/js/index.js`, `public/css/index.css`)
- New `streak-cell` column added between Win% and Form columns.
- Green `.streak-w` pill for win streaks, red `.streak-l` pill for loss streaks, muted `.streak-none` dash for no games.
- Table header updated with `streak-head` "Streak" column.

#### Tests added (7 new, 136 → 143 total)

| Test | Type |
|---|---|
| GET /api/players includes currentStreak for each player | API |
| currentStreak reflects last result (W for winner, L for loser) | API |
| currentStreak type is null for player with no games | API |
| streak column header is shown | UI |
| streak pill is shown for players who have played | UI |
| winner has a green W streak pill | UI |
| loser has a red L streak pill | UI |

---

### 21. Docker Support

#### Motivation
The app runs fine locally with `node index.js`, but sharing it with others or deploying it to a server requires them to install the correct Node version and run `npm install` — including compiling `sharp`'s native binaries, which can fail across platforms. Docker packages everything into a single, reproducible Linux container that runs identically anywhere.

#### Design decisions

| Concern | Decision |
|---|---|
| **Base image** | `node:22-alpine` — minimal Linux image (~50 MB vs ~900 MB for full Node image) |
| **sharp on Alpine** | No native build tools needed — sharp 0.34+ ships pre-built binaries for Alpine |
| **Dev dependencies** | Excluded via `npm ci --omit=dev` — Playwright and its browsers are not bundled |
| **Data persistence** | `DATA_DIR` environment variable already existed for tests; Docker Compose sets it to `/data` which is volume-mounted to `./data` on the host |
| **Code changes needed** | **None** — the `DATA_DIR` env var hook was already in place |
| **Separate dev/prod modes** | Local `node index.js` for development; `docker compose up` for deployment — clearly documented in README |

#### Files added

**`Dockerfile`**
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
# DATA_DIR is injected at runtime via fly.toml or docker-compose.yml
CMD ["node", "index.js"]
```

**`docker-compose.yml`**
- Sets `DATA_DIR=/data` so the app writes to the volume mount path
- Mounts `./data` on the host to `/data` in the container — data survives container restarts and rebuilds
- `restart: unless-stopped` for automatic recovery from crashes

**`.dockerignore`**
- Excludes `node_modules`, `data/`, `tests/`, `playwright-report/`, `.git` — keeps the image lean and avoids bundling the host's `node_modules` or test artefacts

#### Why Docker Swarm / Kubernetes are not relevant
The append-only file storage and in-memory cache are both per-process. Running multiple container instances would result in diverging datasets and stale caches. Horizontal scaling requires moving to a shared database first. Docker Compose (single container) is the appropriate tool at this scale.

---

### 22. Records Eligibility — Players Must Have Played at Least One Game

- **Bug:** New players start with a rating of 1000. When the first players were added to a league and no games had been recorded yet, they were incorrectly awarded the **Highest Ever ELO** record (because their starting rating of 1000 was the highest value seen). They also shared `mostGamesPlayed` at zero and `longestWinStreak` at zero.
- **Root cause 1 — no-games guard missing:** The records loop and `computeRecordMaps` iterated over all players regardless of whether they had played.
- **Root cause 2 — `highestEloRating` defaulted to 1000:** The local `high` variable was initialised to `1000` before scanning a player's games, meaning even a player with zero games scored 1000 and could hold the record.

#### Fix
- Added `if (pg.length === 0) continue;` at the top of both the `GET /api/records` player loop and the `computeRecordMaps` player loop. Players with no games are completely skipped for all records.
- Changed the `high` variable initialisation from `1000` to `0`. Only actual `winnerRatingAfter` / `loserRatingAfter` values are considered. The existing `value > 0` guard in `addHolder`/`track` then prevents a `0` from being recorded.

#### Tests added (146 → 149 at this point, combined with section 24)

| Test | What it verifies |
|---|---|
| Player with no games is not awarded `highestEloRating` | New players excluded from ELO record |
| Player with no games is not awarded `mostGamesPlayed` | New players excluded from games played record |
| Records show no holders when all players have played zero games | All holder arrays empty for a brand-new league |

---

### 23. Record Holder Badge Made Dynamic

- **Previous behaviour:** The `achieve_record` (Record Holder) badge was awarded based on whether a player had *ever* set a record — it was never removed once earned.
- **New behaviour:** The badge reflects *current* state only. It is awarded if the player currently holds or shares at least one all-time record. If they are later overtaken on every record, the badge is lost.
- **Implementation:** `computeBadges` already recalculates from scratch on every profile request — so the badge was already technically current. The existing `holdsAny` check was correct for the streak/stats records. The only gaps were:
  1. The **Biggest Upset** record was not included in `holdsAny`
  2. The old code path didn't need changing for "loses the badge" — it was already dynamic

#### Biggest Upset winner now eligible for Record Holder badge
- Added `computeBiggestUpsetHolder(games)` helper — scans all games for the largest `loserRatingBefore - winnerRatingBefore` diff and returns the winner's ID.
- `holdsAny` now also checks: `|| computeBiggestUpsetHolder(allGames) === player.id`
- The **Grand Slam** badge deliberately excludes Biggest Upset — it is a single-winner record that cannot be tied, unlike the six stats records that Grand Slam is defined around.

#### Tests added (3 new)

| Test | What it verifies |
|---|---|
| `achieve_record` badge is awarded to biggest upset winner | Upset winner eligible for Record Holder |
| `achieve_record` badge is lost when player no longer holds any record | Badge is dynamic, not permanent |
| `achieve_record IS` awarded when player ties a record | Ties still qualify (existing, confirmed still passing) |

---

### 24. Empty Snapshot Bug — Chess League Showing No Players

#### Symptoms
- The Chess league showed an empty league table, no records, and "Unknown" for all player names in game history after the app was restarted.
- Pool and Backgammon leagues were unaffected.

#### Root cause
When the Chess league was first created, `coldLoad` called `maybeAutoSnapshot` at the end of initialisation. At that moment the league directory existed but no players had been added yet, so a snapshot was written with `"players": []`. On every subsequent server start, `coldLoad` found this snapshot (less than 30 days old, so it was used as the base), then replayed all games against an empty player list. Every game referenced player IDs that weren't in the base state and were silently skipped as orphaned. Result: empty players array, games with "Unknown" names.

#### Fixes

**1. `maybeAutoSnapshot` — never snapshot an empty league**
```js
function maybeAutoSnapshot(league, players) {
  if (players.length === 0) return;  // never snapshot an empty league
  ...
}
```

**2. `coldLoad` — treat a snapshot with zero players as missing**
```js
if (snap && snap.players && snap.players.length > 0) {
  // use snapshot as base
} else {
  // fall back to players.jsonl + full replay
}
```
If a bad snapshot already exists on disk (e.g. the Fly.io volume, or another machine), the app now falls back to the raw `players.jsonl` file and replays all games from the beginning rather than silently serving an empty league.

**3. Deleted the bad snapshot** — `data/chess/snapshots/2026-03-13.json` was removed so the chess league loaded correctly immediately without needing a server restart cycle.

#### Test added (1 new)

| Test | What it verifies |
|---|---|
| Players are visible even if a league snapshot has zero players | Snapshot fallback to `players.jsonl` works correctly |

---

### 25. Fly.io Volume Mount Bug — DATA_DIR Not Honoured

#### Symptoms
Deploying an update to Fly.io appeared to wipe all data. The live app showed an empty league table after each `fly deploy`.

#### Investigation
- The Fly.io volume (`league_data`, mounted at `/data`) existed and was correctly attached to the machine.
- `fly ssh console` confirmed `DATA_DIR=/data` was set in the machine environment (from `fly.toml [env]`).
- However, inspecting `/data` on the machine showed only `lost+found` — no league data was ever written there.

#### Root cause
`index.js` resolved the data directory as:

```js
const DATA_DIR = process.env.TEST_DATA_DIR || path.join(__dirname, 'data');
```

It only checked `TEST_DATA_DIR` (the test isolation variable). The `DATA_DIR` environment variable set by `fly.toml` and `docker-compose.yml` was **never read**. The app always fell back to `path.join(__dirname, 'data')` — i.e. `/app/data` inside the container's ephemeral filesystem — which is wiped on every deploy.

The Fly.io volume at `/data` was mounted correctly but completely unused.

#### Fix

```js
const DATA_DIR = process.env.TEST_DATA_DIR
              || process.env.DATA_DIR
              || path.join(__dirname, 'data');
```

Priority order:
1. `TEST_DATA_DIR` — used by Playwright tests (isolated temp directory)
2. `DATA_DIR` — used by Fly.io and Docker Compose (persistent volume)
3. `./data` relative to `index.js` — local development default

#### Dockerfile cleanup
Removed the `ENV DATA_DIR=/app/data` line from the Dockerfile. Having a hardcoded default in the image that pointed to the wrong path was misleading. The correct path is always injected at runtime via `fly.toml` or `docker-compose.yml`. A comment now documents all three runtime environments.

#### Note on initial data loss
The first successful deploy started with an empty volume because the original failed deploy (blocked on billing) had already created the volume but never written to it. No data was actually lost — the app simply started fresh on Fly.io. Future deploys will preserve data correctly now that `DATA_DIR` is read.

---

### 26. Rival & Nemesis on Player Profile Page

#### Feature description
Two new cards were added to each player's profile page, displayed side-by-side in a two-column grid between the Streaks card and the Results History card.

**Biggest Rival** — the opponent this player has played the most games against.
**Nemesis** — the opponent who has beaten this player the most times.

#### Selection logic (backend — `GET /api/players/:id/profile`)

Head-to-head stats are computed for every opponent the player has faced, producing `{ id, name, played, wins, losses }` per opponent, where `wins`/`losses` are from the **profile player's** perspective.

**Rival selection:**
- Find the maximum `played` value across all opponents
- Return all opponents tied at that maximum (there may be more than one)

**Nemesis selection:**
- Find the maximum `losses` value (times the opponent beat the profile player)
- If only one opponent has that maximum — they are the nemesis
- **Tie-break 1:** if multiple opponents have beaten the player the same number of times, prefer the one with fewest total games played together — a more "efficient" tormentor
- **Tie-break 2:** if still tied after tie-break 1, all remaining opponents are shown

Both `rivals` and `nemeses` are returned as arrays so the frontend naturally handles any number of tied entries.

#### Display choices (frontend — `player.js`)

**Rival card** (amber heading ⚔️):
- Subtitle: *"Most games played against"*
- Each row: `[Player Name link]  [XW – YL (Z games)]`
- Record shown from the **profile player's perspective** — their wins in green, their losses in red

**Nemesis card** (red heading 💀):
- Subtitle: *"Most games lost against"*
- Each row: `[Player Name link]  [X Losses (Y games)]`
- Only the defeat count is shown — unambiguous, no confusion about whose wins are whose
- Wording evolution: "Defeats" → settled on "Losses" for natural language consistency

#### Layout (CSS — `player.css`)
- `.h2h-grid` — two-column CSS grid; collapses to one column on screens ≤ 540 px
- `.rival-card h3` — amber (`#f59e0b`)
- `.nemesis-card h3` — red (`var(--red)`)
- Player name links styled to match the rest of the profile page; hover underline in accent colour
- Empty states: *"No games played yet"* (rival) and *"No losses yet"* (nemesis)

#### Tests added (18 new)

| Test | File | What it verifies |
|---|---|---|
| Profile includes `rivals` array | `api.spec.js` | Field present and is an array |
| Rival is the most-played opponent | `api.spec.js` | Bob (3 games) beats Charlie (1 game) |
| Rival has correct W/L counts | `api.spec.js` | wins/losses from profile player perspective |
| Profile includes `nemeses` array | `api.spec.js` | Field present and is an array |
| Nemesis is the player who beat them most | `api.spec.js` | Bob (1 loss) is Alice's nemesis |
| Nemesis correct for another player | `api.spec.js` | Charlie's nemesis is Alice |
| Tied rivals — both shown | `api.spec.js` | Equal play counts → both returned |
| Nemesis tie-break: fewest games wins | `api.spec.js` | P3 (1 game, 1 loss) beats P2 (2 games, 1 loss) |
| Rival card visible | `player.spec.js` | `.rival-card` in DOM |
| Nemesis card visible | `player.spec.js` | `.nemesis-card` in DOM |
| Rival card shows most-played opponent | `player.spec.js` | Bob's name in rival card |
| Rival card shows head-to-head record | `player.spec.js` | W and L elements visible |
| Nemesis card shows who beat them most | `player.spec.js` | Bob's name in nemesis card |
| Nemesis card shows loss count | `player.spec.js` | "Loss" text visible |
| Rival name links to profile | `player.spec.js` | href matches `player.html?id=` |
| Nemesis name links to profile | `player.spec.js` | href matches `player.html?id=` |

**Total tests: 149 → 167.**

---

### 27. Code Smell Fixes — Duplicated Logic & Double Computation

Two high-severity code smells identified during a code review were fixed.

#### Smell 1 — Streak & ELO Calculation Duplicated in Three Places

The logic for computing per-player derived stats (win/loss streaks, highest/lowest ELO, ELO history) was written out inline in three separate places:

- `GET /api/players` (league table — current streak)
- `GET /api/players/:id/profile` (profile page — all streak/ELO stats)
- `computeRecordMaps()` (badge & records computation — streaks and highest ELO)

**Fix:** Extracted a shared `computePlayerGameStats(playerId, playerGames, startingRating)` helper function that performs a single chronological pass over a player's games and returns:

```js
{ longestWinStreak, longestLossStreak, currentStreak,
  highestRating, lowestRating, activeWinStreak, eloHistory }
```

All three call sites were updated to call this helper. The inline loops were deleted. The logic now lives in exactly one place — any future changes (e.g. adding a new stat) only need to be made once.

Also fixed as part of this: the opponent name lookup in the h2h (rival/nemesis) loop was simplified using the same `(players.find(...) || { name: 'Unknown' }).name` pattern, and the redundant `loserBefore` alias in `computeBadges` was removed (now uses `g.loserRatingBefore` directly).

#### Smell 2 — `computeRecordMaps` Called Twice Per Profile Request

`computeBadges` called `computeRecordMaps(allPlayers, allGames)` internally. The profile route handler also needed the record holders to pass to `computeBadges` — but since `computeBadges` computed them itself, the profile route was triggering a full scan of all players and all games **twice** on every profile page load.

**Fix:** `computeBadges` signature changed to accept `recHolders` as a parameter:

```js
// Before
function computeBadges(player, playerGames, allPlayers, allGames)

// After
function computeBadges(player, playerGames, allPlayers, allGames, recHolders)
```

The profile route now calls `computeRecordMaps` once, then passes the result into `computeBadges`:

```js
const { recHolders } = computeRecordMaps(players, games);
// ...
badges: computeBadges(player, playerGames, players, games, recHolders)
```

`computeRecordMaps` is now called exactly once per profile request instead of twice.

#### No behaviour changes

All 167 tests pass unchanged. The API response shapes and all computed values are identical — this was a pure internal refactor.

---

### 28. Code Smell Fixes — Low Severity

Two low-severity code smells identified in the same review were fixed.

#### Smell 7 — Snapshot path duplicated inline in DELETE route

The `DELETE /api/games/:id` route built the snapshot directory path manually:

```js
const snapDir = path.join(leagueDir(league), 'snapshots');
if (fs.existsSync(snapDir)) {
  fs.readdirSync(snapDir).forEach(f => fs.unlinkSync(path.join(snapDir, f)));
}
```

This duplicated the path construction that the existing `snapshotsDir(league)` helper already encapsulates, and the inline logic had no name.

**Fix:** Extracted a `clearSnapshots(league)` helper function next to the other snapshot helpers:

```js
function clearSnapshots(league) {
  const dir = snapshotsDir(league);
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
  }
}
```

The DELETE route now calls `clearSnapshots(league)` — one line, self-documenting.

#### Smell 9 — Inconsistent guard style (single-line if)

All 10 route handlers had their `resolveLeague` guard written as a single line:

```js
const league = resolveLeague(req, res); if (!league) return;
```

This is unusual style — two statements on one line separated by `;`. Standard JS convention (and most linter rules) expects each statement on its own line.

**Fix:** Split all 10 occurrences onto two lines:

```js
const league = resolveLeague(req, res);
if (!league) return;
```

No behaviour change — purely a readability improvement that will avoid linter warnings if ESLint is added in the future.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| File uploads | multer (multipart parsing) + sharp (image resize/crop/convert) |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Data storage | Append-only JSONL files (one directory per league), monthly snapshots, in-memory cache |
| Avatar storage | JPEG files in `data/<league>/avatars/`, SVG initials fallback generated server-side |
| Charts | Chart.js (ELO history chart on profile page) |
| Testing | Playwright (API + UI, 167 tests, retries: 1) |
| Deployment | Docker + Docker Compose |
| Version control | Git + GitHub |

---

## File Structure

```
pool_league/
├── index.js               # Express server & all API routes
├── package.json
├── Dockerfile             # Production container image (node:22-alpine)
├── docker-compose.yml     # Single-container deployment with data volume
├── .dockerignore          # Excludes node_modules, data/, tests/, .git from image
├── playwright.config.js   # Playwright configuration (port 3001, isolated data dir)
├── README.md
├── DEVELOPMENT_LOG.md     # This file
├── data/
│   ├── pool/
│   │   ├── players.jsonl  # Pool player registrations (append-only)
│   │   ├── games.jsonl    # Pool game results (append-only)
│   │   ├── avatars/       # Player avatar JPEGs (<playerId>.jpg)
│   │   └── snapshots/     # Monthly derived-state snapshots
│   ├── chess/
│   │   ├── players.jsonl
│   │   └── games.jsonl
│   └── backgammon/
│       ├── players.jsonl
│       └── games.jsonl
├── tests/
│   ├── helpers.js         # Shared test utilities
│   ├── api.spec.js        # API tests
│   ├── home.spec.js       # Home page UI tests
│   ├── player.spec.js     # Player profile UI tests
│   └── records.spec.js    # Records page UI tests
└── public/
    ├── index.html         # League table, record game, league switcher
    ├── player.html        # Individual player profile
    ├── records.html       # All-time records page
    ├── css/
    │   ├── main.css       # Shared styles
    │   ├── index.css
    │   ├── player.css
    │   └── records.css
    └── js/
        ├── index.js       # Home page logic
        ├── player.js      # Profile page logic
        └── records.js     # Records page logic
```

---

## API Reference

All routes accept a `?league=` query parameter (defaults to `pool`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/leagues` | List all leagues |
| `POST` | `/api/leagues` | Create a new league `{ name }` |
| `GET` | `/api/players?league=pool` | Get all players sorted by ELO |
| `POST` | `/api/players?league=pool` | Add a new player `{ name }` |
| `GET` | `/api/players/:id/profile?league=pool` | Get full stats for a player |
| `GET` | `/api/players/:id/avatar?league=pool` | Get player avatar (JPEG or SVG initials fallback) |
| `POST` | `/api/players/:id/avatar?league=pool` | Upload player avatar (multipart `avatar` field, max 5 MB) |
| `GET` | `/api/games?league=pool` | Get all games (most recent first) |
| `POST` | `/api/games?league=pool` | Record a game result `{ winnerId, loserId }` |
| `DELETE` | `/api/games/:id?league=pool` | Delete a game `{ winnerName }` — requires winner's name as confirmation |
| `GET` | `/api/records?league=pool` | Get all-time records |
| `POST` | `/api/admin/snapshot?league=pool` | Force a snapshot of derived state |

