# 09. Persistence, History & Settings

## Local Storage Persistence (`src/core/persistence/persistenceManager.ts`)

### Storage Keys
- `callbreak_active_match`: Serialized active match state (round number, player hands, trick history, scores).
- `callbreak_match_history`: Array of past completed 5-round match summaries.
- `callbreak_player_stats`: Lifetime career statistics (matches won/lost, win percentage, total tricks, bid accuracy, highest round score).
- `callbreak_settings`: User configuration preferences.

---

## 1. Resume / Save Engine
- State is automatically saved to `localStorage` on every trick completion and round transition.
- When reopening the app or refreshing the browser, the player is presented with the option to **Resume In-Progress Match** or **Start Fresh Match**.
- Corrupted or outdated schemas are safely detected, reset, and regenerated with zero crash risk.

---

## 2. Match History & Statistics (`src/core/history/`, `src/core/statistics/`)
- **Round-by-Round Breakdown**: Full table breakdown showing bids, tricks won, and points earned per player for every round.
- **Career Analytics**:
  - Total Matches Played, Won, Lost, and Win Rate (%).
  - Total Tricks Won across all games.
  - Bid Accuracy Ratio ($\frac{\text{Successful Bids}}{\text{Total Bids}}$).
  - Highest Match Score & Highest Single Round Score.

---

## 3. Settings Engine (`src/core/settings/settingsManager.ts`)
- **Master Audio Volume** (0% to 100%) and Mute Toggle.
- **Sound Effects (SFX)**: Procedural Web Audio card flips, dealing clicks, trick winner chimes, and warning sounds.
- **Animation Speed**: Fast (300ms), Normal (600ms), Slow (1000ms).
- **AI Difficulty**: Easy, Medium, Hard.
- **Rule Coach Assistance**: Real-time legal move tips and bidding advice toggle.
- **Reduced Motion**: Respects system OS `prefers-reduced-motion` and allows manual in-app override.
