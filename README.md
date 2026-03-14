# 🎱 League Tracker

A local multiplayer league tracker with **ELO ratings**, player profiles, game history, and all-time records. Supports **multiple independent leagues** (Pool, Snooker, Chess, Backgammon — anything you like). Run it on your local network so anyone can record results from their phone or browser.

---

## Features

- **Multiple leagues** — each league has its own separate data file; switch between leagues from the home page or create new ones on the fly
- **ELO rating system** — ratings update automatically after every game
- **League table** — players ranked by current ELO rating, with 👑 crown marking the King of the Hill, **player avatars**, and a **form guide** showing the last 5 results as green/red squares
- **Player profiles** — detailed stats per player including:
  - Win/loss record & win percentage
  - Current streak, longest win streak, longest loss streak
  - Highest & lowest ELO ever reached
  - Full results history (scrollable)
  - ELO rating history chart
- **Badges & achievements** — players earn badges for milestones:
  - 🥇 First Win · 🎮 Veteran (10 games) · 🏅 Seasoned (50 games) · 💯 Centurion (100 games)
  - 🗡️ Giant Killer (beat the top rated player)
  - 📈 Record Holder (currently hold at least one all-time record — lost if you no longer hold any)
  - 🏆 Grand Slam (hold all six records simultaneously — sole holder, no ties)
  - 👑 King of the Hill (win the first game, or beat the reigning king)
- **King of the Hill** — a special title awarded to the winner of the first ever game; transfers to any player who beats the current holder
- **Records page** — all-time bests for the active league; when players are tied, all names are shown. **Players must have played at least one game to be eligible for any record.**
  - Longest winning streak
  - Longest active winning streak
  - Most games played
  - Most games won
  - Highest ever ELO rating
  - Biggest upset (largest rating deficit overcome by the winner)
  - Defend the Hill (longest consecutive run of wins while holding King of the Hill)
- **Game history** — full log of all recorded results
- **Network accessible** — accessible from any device on the same Wi-Fi

---

## Tech Stack

- **Backend:** Node.js with [Express](https://expressjs.com/), [multer](https://github.com/expressjs/multer) (file uploads), [sharp](https://sharp.pixelplumbing.com/) (image processing)
- **Frontend:** Vanilla HTML, CSS, and JavaScript
- **Data storage:** Append-only JSONL files per league in `data/<league>/`, with monthly snapshots, in-memory cache, and an `avatars/` directory per league
- **Testing:** [Playwright](https://playwright.dev/) (end-to-end API & UI tests)
- **Deployment:** [Docker](https://www.docker.com/) + Docker Compose

---

## Getting Started

There are two ways to run the app:

| | Local (development) | Docker (deployment) |
|---|---|---|
| **Requires** | Node.js v18+ | Docker Desktop |
| **Best for** | Developing & debugging | Sharing or running on a server |
| **Start command** | `npm start` | `docker compose up` |
| **Data location** | `./data/` | `./data/` (via volume mount) |

---

### Option 1 — Run locally (development)

#### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher

#### Install dependencies

```bash
npm install
```

#### Start the server

```bash
npm start
```

The server starts on port **3000**. Open your browser at:

- **Local:** [http://localhost:3000](http://localhost:3000)
- **Network:** `http://<your-local-ip>:3000` (printed in the terminal on startup)

---

### Option 2 — Run in Docker

#### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac, Windows, or Linux)

#### First run — build and start

```bash
docker compose up --build
```

This builds the image and starts the container. The app is available at [http://localhost:3000](http://localhost:3000).

#### Subsequent starts

```bash
docker compose up
```

#### Run in the background

```bash
docker compose up -d
```

#### Stop the container

```bash
docker compose down
```

#### View live logs

```bash
docker compose logs -f
```

#### Data persistence

League data is stored in the `./data/` directory on your machine (mounted into the container as a volume). It is **not** stored inside the container — your data survives container restarts, updates, and rebuilds automatically. Back up the `data/` folder regularly to preserve league history.

> **Note:** The Docker image excludes test files and dev dependencies, so `npm test` must be run locally, not inside the container.

---

## Managing Leagues

- A default **Pool** league is created automatically on first run (`data/pool/`)
- Use the **league switcher** in the header to switch between leagues
- Click **＋ New** to create a new league — this creates a new data directory automatically
- The active league is remembered in `localStorage` per browser

---

## Project Structure

```
pool_league/
├── index.js               # Express server & API routes
├── package.json
├── playwright.config.js   # Playwright test configuration
├── data/
│   ├── pool/
│   │   ├── players.jsonl  # Pool player registrations (append-only)
│   │   ├── games.jsonl    # Pool game results (append-only)
│   │   ├── avatars/       # Player avatar images (<playerId>.jpg)
│   │   └── snapshots/     # Monthly derived-state snapshots
│   └── chess/
│       ├── players.jsonl
│       └── games.jsonl
├── tests/
│   ├── helpers.js         # Shared test utilities
│   ├── api.spec.js        # API tests (leagues, players, games, records, badges, KOTH)
│   ├── home.spec.js       # UI tests — home page
│   ├── player.spec.js     # UI tests — player profile page
│   └── records.spec.js    # UI tests — records page
└── public/
    ├── index.html         # Main league table & record game page
    ├── player.html        # Individual player profile page
    ├── records.html       # All-time records page
    ├── css/
    │   ├── main.css
    │   ├── index.css
    │   ├── player.css
    │   └── records.css
    └── js/
        ├── index.js       # Frontend logic for main page
        ├── player.js      # Frontend logic for player profile
        └── records.js     # Frontend logic for records page
```

---

## Testing

The project has a full [Playwright](https://playwright.dev/) test suite covering both the API and the browser UI. Tests run against an isolated server on port **3001** using a temporary data directory, so they never affect real league data.

### Run all tests

```bash
npm test
```

### Open the interactive Playwright UI

```bash
npm run test:ui
```

### View the HTML report after a run

```bash
npm run test:report
```

### What's covered (149 tests)

| Suite | Tests | Covers |
|-------|-------|--------|
| `api.spec.js` | 75 | Leagues, Players (incl. currentStreak), Games, Delete Game, Profile, Records (incl. no-games eligibility), ELO maths, King of the Hill, Badges (incl. dynamic Record Holder, upset winner eligibility), Form guide, Biggest Upset, Active Streak, Avatars, Snapshot safety |
| `home.spec.js` | 34 | League table (incl. avatar column, streak column), Form guide, Add player, Record game, Game history, Delete game UI, League switcher |
| `player.spec.js` | 20 | Hero section (incl. avatar), Stats grid, Badges, Streaks, Results history, ELO chart, 404 |
| `records.spec.js` | 20 | Layout, All 7 record cards, Holder links, Biggest Upset, Active Streak, Empty state |

---

## API Reference

All game/player routes accept a `?league=` query parameter (defaults to `pool`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/leagues` | List all leagues |
| `POST` | `/api/leagues` | Create a new league `{ name }` |
| `GET` | `/api/players?league=pool` | Get all players sorted by rating |
| `POST` | `/api/players?league=pool` | Add a new player `{ name }` |
| `GET` | `/api/players/:id/profile?league=pool` | Get full stats for a player |
| `GET` | `/api/games?league=pool` | Get all games (most recent first) |
| `POST` | `/api/games?league=pool` | Record a game result `{ winnerId, loserId }` |
| `DELETE` | `/api/games/:id?league=pool` | Delete a game `{ winnerName }` — requires winner's name as confirmation |
| `GET` | `/api/records?league=pool` | Get all-time records for a league |
| `GET` | `/api/players/:id/avatar?league=pool` | Get player avatar (JPEG if uploaded, SVG initials otherwise) |
| `POST` | `/api/players/:id/avatar?league=pool` | Upload player avatar (multipart `avatar` field, max 5 MB) |
| `POST` | `/api/admin/snapshot?league=pool` | Force a snapshot of the current derived state |

---

## ELO Rating System

The league uses the standard **ELO formula** with a K-factor of **32**.

- Every new player starts at **1000**
- After each game, the winner gains points and the loser loses points
- The amount transferred depends on the rating difference — beating a higher-rated opponent earns more points than beating a lower-rated one
- Equal-rated players exchange exactly **16 points** per game

---

## Data Storage

Each league uses an **append-only log** stored in its own sub-directory under `data/`:

```
data/
  pool/
    players.jsonl      ← one player registration per line (append-only)
    games.jsonl        ← one game result per line (append-only)
    snapshots/
      2026-03-13.json  ← monthly snapshot of derived state
  chess/
    players.jsonl
    games.jsonl
```

- **Writes are atomic** — each new player or game is a single `appendFileSync` call, eliminating read-modify-write race conditions.
- **Ratings are never stored** — they are always derived by replaying the game log, so they can never become stale or corrupted.
- **Snapshots** are taken automatically on startup if the latest is ≥ 30 days old. On restart, only games logged *after* the snapshot are replayed, keeping cold-start time bounded.
- **Snapshot safety** — a snapshot is never written for a league with zero players, and a snapshot with an empty player list is ignored on load (falls back to full replay from `players.jsonl`). This prevents a newly-created league from poisoning future cold loads.
- **In-memory cache** — each league's derived state is cached in memory after the first request. Switching between leagues never triggers a re-replay. Cache entries are updated in-place on every write.
- A manual snapshot can be forced via `POST /api/admin/snapshot?league=pool`.
- Back up the entire `data/` folder regularly to preserve league history.

