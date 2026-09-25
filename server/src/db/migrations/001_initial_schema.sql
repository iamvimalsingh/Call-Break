-- 001_initial_schema.sql
-- Call Break PostgreSQL Persistence Foundation
-- Stores persistent player profiles (mapped from anonymous cb_player_id),
-- matches, participants, rounds, and round scorecards.

-- 1. Player Profiles (persistent identity for anonymous client ID)
CREATE TABLE IF NOT EXISTS player_profiles (
  player_id VARCHAR(64) PRIMARY KEY,
  anonymous_client_id VARCHAR(128) UNIQUE NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_profiles_anon_id ON player_profiles(anonymous_client_id);

-- 2. Matches
CREATE TABLE IF NOT EXISTS matches (
  match_id VARCHAR(64) PRIMARY KEY,
  game_type VARCHAR(32) NOT NULL DEFAULT 'CALL_BREAK',
  room_code VARCHAR(32) NOT NULL,
  total_rounds INTEGER NOT NULL DEFAULT 5,
  status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'FINISHED', 'ABANDONED'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_room_code ON matches(room_code);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- 3. Match Players (participants seated in a match)
CREATE TABLE IF NOT EXISTS match_players (
  match_id VARCHAR(64) NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  player_id VARCHAR(64) REFERENCES player_profiles(player_id) ON DELETE SET NULL,
  seat VARCHAR(16) NOT NULL, -- 'SOUTH', 'WEST', 'NORTH', 'EAST'
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  final_score NUMERIC(6, 1),
  tricks_won INTEGER NOT NULL DEFAULT 0,
  final_rank INTEGER,
  PRIMARY KEY (match_id, seat)
);

CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);

-- 4. Match Rounds (completed rounds in a match)
CREATE TABLE IF NOT EXISTS match_rounds (
  match_id VARCHAR(64) NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  dealer_seat VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, round_number)
);

-- 5. Match Round Players (individual player scores and bids per round)
CREATE TABLE IF NOT EXISTS match_round_players (
  match_id VARCHAR(64) NOT NULL,
  round_number INTEGER NOT NULL,
  player_id VARCHAR(64) REFERENCES player_profiles(player_id) ON DELETE SET NULL,
  seat VARCHAR(16) NOT NULL, -- 'SOUTH', 'WEST', 'NORTH', 'EAST'
  bid INTEGER,
  tricks_won INTEGER NOT NULL DEFAULT 0,
  round_score NUMERIC(5, 1),
  PRIMARY KEY (match_id, round_number, seat),
  FOREIGN KEY (match_id, round_number) REFERENCES match_rounds(match_id, round_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_match_round_players_player_id ON match_round_players(player_id);
