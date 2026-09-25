/**
 * Player API Router
 * Secure REST endpoints for player profile, match history, detailed scorecards,
 * global leaderboards, top wins, and player achievements.
 * Public endpoints expose only aggregated public statistics.
 * Private endpoints enforce server-signed HMAC anonymous identity verification.
 */

import { Router } from 'express';
import { PersistenceService } from './db/PersistenceService';
import { signPlayerId, verifyPlayerToken } from './identityAuth';
import { LeaderboardCategory, LeaderboardTimeframe } from './db/types';

export function createPlayerRouter(): Router {
  const router = Router();

  // 1. Identity Resolution & Verification Middleware
  router.use(async (req, res, next) => {
    const playerId = req.headers['x-player-id'] || req.headers['x-client-id'];
    const playerToken = req.headers['x-player-token'];

    if (playerId && typeof playerId === 'string' && playerId.trim()) {
      const cleanId = playerId.trim();
      const tokenStr = typeof playerToken === 'string' ? playerToken.trim() : '';

      const isValid = verifyPlayerToken(cleanId, tokenStr);

      if (isValid) {
        (req as any).anonymousClientId = cleanId;
      } else {
        const persistence = PersistenceService.getInstance();
        let profileExists = false;
        if (persistence.isAvailable()) {
          try {
            const profile = await persistence.getPlayerProfileDashboard(cleanId, 1, 0);
            if (profile && profile.profile && profile.profile.player_id) {
              profileExists = true;
            }
          } catch {
            // ignore database query errors during auth check
          }
        }

        if (!profileExists) {
          // New player or DB unavailable: issue a cryptographic token proof for this ID
          const newToken = signPlayerId(cleanId);
          res.setHeader('X-Issued-Token', newToken);
          (req as any).anonymousClientId = cleanId;
        }
      }
    }

    next();
  });

  // 2. PUBLIC ENDPOINTS (No strict authentication required; enriched if identity provided)

  // GET /api/player/leaderboard
  router.get('/leaderboard', async (req, res) => {
    try {
      const category = (req.query.category as LeaderboardCategory) || 'overall';
      const timeframe = (req.query.timeframe as LeaderboardTimeframe) || 'all';
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const callerId = (req as any).anonymousClientId || null;

      const data = await PersistenceService.getInstance().getGlobalLeaderboard(
        category,
        timeframe,
        limit,
        offset,
        callerId
      );
      res.json(data);
    } catch (err: any) {
      console.error('[PlayerAPI] GET /leaderboard error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/player/top-wins
  router.get('/top-wins', async (req, res) => {
    try {
      const timeframe = (req.query.timeframe as LeaderboardTimeframe) || 'all';
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);

      const data = await PersistenceService.getInstance().getTopWins(timeframe, limit, offset);
      res.json({ timeframe, topWins: data });
    } catch (err: any) {
      console.error('[PlayerAPI] GET /top-wins error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 3. STRICT AUTHENTICATION GUARD FOR PRIVATE ENDPOINTS
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.anonymousClientId) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing anonymous identity proof token' });
      return;
    }
    next();
  };

  // GET /api/player/profile
  router.get('/profile', requireAuth, async (req, res) => {
    try {
      const anonId = (req as any).anonymousClientId;
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const data = await PersistenceService.getInstance().getPlayerProfileDashboard(anonId, limit, offset);
      res.json(data);
    } catch (err: any) {
      console.error('[PlayerAPI] GET /profile error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/player/matches
  router.get('/matches', requireAuth, async (req, res) => {
    try {
      const anonId = (req as any).anonymousClientId;
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const data = await PersistenceService.getInstance().getPlayerProfileDashboard(anonId, limit, offset);
      res.json({ matches: data?.matches || [], stats: data?.stats || {} });
    } catch (err: any) {
      console.error('[PlayerAPI] GET /matches error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/player/scorecard/:matchId
  router.get('/scorecard/:matchId', requireAuth, async (req, res) => {
    try {
      const anonId = (req as any).anonymousClientId;
      const matchId = req.params.matchId;
      const details = await PersistenceService.getInstance().getMatchScorecardDetails(anonId, matchId);
      if (!details) {
        res.status(404).json({ error: 'Match not found or unauthorized' });
        return;
      }
      res.json(details);
    } catch (err: any) {
      console.error('[PlayerAPI] GET /scorecard error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/player/achievements
  router.get('/achievements', requireAuth, async (req, res) => {
    try {
      const anonId = (req as any).anonymousClientId;
      const data = await PersistenceService.getInstance().getPlayerAchievements(anonId);
      res.json({ achievements: data });
    } catch (err: any) {
      console.error('[PlayerAPI] GET /achievements error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
