-- 001_initial_schema_down.sql
-- Rollback migration for initial Call Break schema

DROP TABLE IF EXISTS match_round_players;
DROP TABLE IF EXISTS match_rounds;
DROP TABLE IF EXISTS match_players;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS player_profiles;
