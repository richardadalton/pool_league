# 🎱 League Tracker

A local multiplayer league tracker with **ELO ratings**, player profiles, game history, and all-time records. Supports **multiple independent leagues** (Pool, Snooker, Chess, Backgammon — anything you like). Run it on your local network so anyone can record results from their phone or browser.

---

## Features

- **Multiple leagues** — each league has its own separate data file; switch between leagues from the home page or create new ones on the fly
- **ELO rating system** — ratings update automatically after every game
- **League table** — players ranked by current ELO rating
- **Player profiles** — detailed stats per player including:
  - Win/loss record & win percentage
  - Current streak, longest win streak, longest loss streak
  - Highest & lowest ELO ever reached
  - Full results history (scrollable)
  - ELO rating history chart
- **Records page** — all-time bests for the active league:
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
├── index.js           # Express server & API routes
├── package.json
├── data/
│   ├── pool.json      # Pool league data
│   └── chess.json     # Chess league data (example)
└── public/
    ├── index.html     # Main league table & record game page
    ├── player.html    # Individual player profile page
    ├── records.html   # All-time records page
    ├── css/
    │   ├── main.css
    │   ├── index.css
    │   ├── player.css
    │   └── records.css
    └── js/
        ├── index.js   # Frontend logic for main page
        ├── player.js  # Frontend logic for player profile
        └── records.js # Frontend logic for records page
```

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

---

## Data Storage

Each league is stored as a separate JSON file in the `data/` directory. Files are created automatically when a new league is added. Back up the `data/` folder regularly to avoid losing league history.
