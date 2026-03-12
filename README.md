# 🎱 League Tracker

A local multiplayer league tracker with **ELO ratings**, player profiles, game history, and all-time records. Supports **multiple independent leagues** (Pool, Snooker, Chess, Backgammon — anything you like). Run it on your local network so anyone can record results from their phone or browser.

---

## Features

- **Multiple leagues** — each league has its own separate data file; switch between leagues from the home page or create new ones on the fly
- **ELO rating system** — ratings update automatically after every game
- **League table** — players ranked by current ELO rating, with 👑 crown marking the King of the Hill
- **Player profiles** — detailed stats per player including:
  - Win/loss record & win percentage
  - Current streak, longest win streak, longest loss streak
  - Highest & lowest ELO ever reached
  - Full results history (scrollable)
  - ELO rating history chart
- **Badges & achievements** — players earn badges for milestones:
  - 🥇 First Win · 🎮 Veteran (10 games) · 🏅 Seasoned (50 games) · 💯 Centurion (100 games)
  - 🗡️ Giant Killer (beat the top rated player)
  - 📈 Record Holder (hold at least one all-time record)
  - 🏆 Grand Slam (hold all records simultaneously)
  - 👑 King of the Hill (win the first game, or beat the reigning king)
- **King of the Hill** — a special title awarded to the winner of the first ever game; transfers to any player who beats the current holder
- **Records page** — all-time bests for the active league; when players are tied, all names are shown:
  - Longest winning streak
  - Most games played
  - Most games won
  - Highest ever ELO rating
- **Game history** — full log of all recorded results
- **Network accessible** — accessible from any device on the same Wi-Fi

---

## Tech Stack

- **Backend:** Node.js with [Express](https://expressjs.com/)
- **Frontend:** Vanilla HTML, CSS, and JavaScript
- **Data storage:** One JSON file per league in `data/` (e.g. `data/pool.json`, `data/chess.json`)
- **Testing:** [Playwright](https://playwright.dev/) (end-to-end API & UI tests)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)

### Installation

```bash
npm install
```

### Running the Server

```bash
npm start
```

The server will start on port **3000**. Open your browser and go to:

- **Local:** [http://localhost:3000](http://localhost:3000)
- **Network:** `http://<your-local-ip>:3000` (displayed in the terminal on startup)

---

## Managing Leagues

- A default **Pool** league is created automatically on first run (`data/pool.json`)
- Use the **league switcher** in the header to switch between leagues
- Click **＋ New** to create a new league — this creates a new data file automatically
- The active league is remembered in `localStorage` per browser

---

## Project Structure

```
pool_league/
├── index.js               # Express server & API routes
├── package.json
├── playwright.config.js   # Playwright test configuration
├── data/
│   ├── pool.json          # Pool league data
│   └── chess.json         # Chess league data (example)
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

### What's covered (98 tests)

| Suite | Tests | Covers |
|-------|-------|--------|
| `api.spec.js` | 44 | Leagues, Players, Games, Profile, Records, ELO maths, King of the Hill, Badges |
| `home.spec.js` | 20 | League table, Add player, Record game, Game history, League switcher |
| `player.spec.js` | 20 | Hero section, Stats grid, Badges, Streaks, Results history, ELO chart, 404 |
| `records.spec.js` | 14 | Layout, All 4 record cards, Holder links, Empty state |

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
| `GET` | `/api/records?league=pool` | Get all-time records for a league |

---

## ELO Rating System

The league uses the standard **ELO formula** with a K-factor of **32**.

- Every new player starts at **1000**
- After each game, the winner gains points and the loser loses points
- The amount transferred depends on the rating difference — beating a higher-rated opponent earns more points than beating a lower-rated one
- Equal-rated players exchange exactly **16 points** per game

---

## Data Storage

Each league is stored as a separate JSON file in the `data/` directory. Files are created automatically when a new league is added. Back up the `data/` folder regularly to avoid losing league history.
