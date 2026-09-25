/**
 * Database Migration Runner
 * Applies SQL migrations sequentially, tracking applied versions in schema_migrations.
 * Fully transactional and idempotent.
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export interface MigrationFile {
  version: string;
  name: string;
  upSql: string;
  downSql?: string;
}

/**
 * Embedded initial schema SQL so migrations can execute even if bundled with esbuild into dist/
 */
export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS player_profiles (
  player_id VARCHAR(64) PRIMARY KEY,
  anonymous_client_id VARCHAR(128) UNIQUE NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_profiles_anon_id ON player_profiles(anonymous_client_id);

CREATE TABLE IF NOT EXISTS matches (
  match_id VARCHAR(64) PRIMARY KEY,
  game_type VARCHAR(32) NOT NULL DEFAULT 'CALL_BREAK',
  room_code VARCHAR(32) NOT NULL,
  total_rounds INTEGER NOT NULL DEFAULT 5,
  status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_room_code ON matches(room_code);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

CREATE TABLE IF NOT EXISTS match_players (
  match_id VARCHAR(64) NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  player_id VARCHAR(64) REFERENCES player_profiles(player_id) ON DELETE SET NULL,
  seat VARCHAR(16) NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  final_score NUMERIC(6, 1),
  tricks_won INTEGER NOT NULL DEFAULT 0,
  final_rank INTEGER,
  PRIMARY KEY (match_id, seat)
);

CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);

CREATE TABLE IF NOT EXISTS match_rounds (
  match_id VARCHAR(64) NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  dealer_seat VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, round_number)
);

CREATE TABLE IF NOT EXISTS match_round_players (
  match_id VARCHAR(64) NOT NULL,
  round_number INTEGER NOT NULL,
  player_id VARCHAR(64) REFERENCES player_profiles(player_id) ON DELETE SET NULL,
  seat VARCHAR(16) NOT NULL,
  bid INTEGER,
  tricks_won INTEGER NOT NULL DEFAULT 0,
  round_score NUMERIC(5, 1),
  PRIMARY KEY (match_id, round_number, seat),
  FOREIGN KEY (match_id, round_number) REFERENCES match_rounds(match_id, round_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_match_round_players_player_id ON match_round_players(player_id);
`;

export const INITIAL_SCHEMA_DOWN_SQL = `
DROP TABLE IF EXISTS match_round_players;
DROP TABLE IF EXISTS match_rounds;
DROP TABLE IF EXISTS match_players;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS player_profiles;
`;

export const LEADERBOARD_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_matches_status_finished ON matches(status, finished_at);
CREATE INDEX IF NOT EXISTS idx_match_players_rank_score ON match_players(final_rank, final_score);
`;

export const LEADERBOARD_INDEXES_DOWN_SQL = `
DROP INDEX IF EXISTS idx_match_players_rank_score;
DROP INDEX IF EXISTS idx_matches_status_finished;
`;

export const MIGRATIONS: MigrationFile[] = [
  {
    version: '001',
    name: 'initial_schema',
    upSql: INITIAL_SCHEMA_SQL,
    downSql: INITIAL_SCHEMA_DOWN_SQL,
  },
  {
    version: '002',
    name: 'leaderboard_indexes',
    upSql: LEADERBOARD_INDEXES_SQL,
    downSql: LEADERBOARD_INDEXES_DOWN_SQL,
  },
];

export async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function getAppliedMigrations(pool: Pool): Promise<string[]> {
  await ensureMigrationsTable(pool);
  const result = await pool.query('SELECT version FROM schema_migrations ORDER BY version ASC');
  return result.rows.map((row) => row.version);
}

export async function runMigrations(pool: Pool): Promise<{ applied: string[]; skipped: string[] }> {
  await ensureMigrationsTable(pool);
  const appliedVersions = new Set(await getAppliedMigrations(pool));
  const newlyApplied: string[] = [];
  const skipped: string[] = [];

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      skipped.push(migration.version);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.upSql);
      await client.query(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW())',
        [migration.version, migration.name]
      );
      await client.query('COMMIT');
      newlyApplied.push(migration.version);
      console.log(`[Migrations] Successfully applied migration ${migration.version}_${migration.name}`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`[Migrations] Failed migration ${migration.version}_${migration.name}:`, err.message);
      throw new Error(`Migration ${migration.version} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return { applied: newlyApplied, skipped };
}

export async function rollbackLastMigration(pool: Pool): Promise<string | null> {
  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);
  if (applied.length === 0) {
    return null;
  }

  const lastVersion = applied[applied.length - 1];
  const migration = MIGRATIONS.find((m) => m.version === lastVersion);

  if (!migration || !migration.downSql) {
    throw new Error(`No rollback SQL available for migration version ${lastVersion}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migration.downSql);
    await client.query('DELETE FROM schema_migrations WHERE version = $1', [lastVersion]);
    await client.query('COMMIT');
    console.log(`[Migrations] Rolled back migration ${lastVersion}_${migration.name}`);
    return lastVersion;
  } catch (err: any) {
    await client.query('ROLLBACK');
    throw new Error(`Rollback of ${lastVersion} failed: ${err.message}`);
  } finally {
    client.release();
  }
}
