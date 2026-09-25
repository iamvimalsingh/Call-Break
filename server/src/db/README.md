# PostgreSQL Persistence Foundation

## Overview
The Call Break game engine is **server-authoritative and in-memory first**.
Live game states, turn progression, trick evaluations, and WebSocket messages operate 100% in RAM with zero database latency dependency.

PostgreSQL is used exclusively for **asynchronous, non-blocking persistence** of:
1. **Player Profiles** (`player_profiles`): Persistent identity mapped from anonymous `cb_player_id`.
2. **Match Records** (`matches`, `match_players`): Match history, participating seats, and final scores.
3. **Round Scorecards** (`match_rounds`, `match_round_players`): Round-by-round bids, tricks won, and scores.

---

## Configuration

Set the `DATABASE_URL` environment variable:
```bash
DATABASE_URL="postgres://user:password@localhost:5432/callbreak"
```

### Degraded / RAM-Only Mode
If `DATABASE_URL` is absent or the database server is unreachable:
- The game engine continues to function in RAM-only mode without interruption.
- No gameplay crashes or match aborts occur.
- Health status is visible via `GET /api/admin/stats`.

---

## Migrations

### Run Pending Migrations
```bash
npx tsx server/src/db/runMigrations.ts
```
Or with npm script:
```bash
npm run migrate
```

### Rollback Last Migration
```bash
npx tsx server/src/db/runMigrations.ts --rollback
```

### Migration History
Applied migrations are recorded in the `schema_migrations` table with version and timestamp.
All migrations are transactional (`BEGIN` ... `COMMIT`) and idempotent.
