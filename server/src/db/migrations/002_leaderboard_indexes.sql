-- 002_leaderboard_indexes.sql
-- Optimizes leaderboard filtering, time-range queries, and top victory rankings.

CREATE INDEX IF NOT EXISTS idx_matches_status_finished ON matches(status, finished_at);
CREATE INDEX IF NOT EXISTS idx_match_players_rank_score ON match_players(final_rank, final_score);
