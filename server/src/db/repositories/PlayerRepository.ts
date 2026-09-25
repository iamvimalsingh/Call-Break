/**
 * Player Repository
 * Handles persistent profile lookup and creation for anonymous players.
 * Maps existing cb_player_id (anonymous_client_id) to persistent player_profiles records.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { PlayerProfileRecord } from '../types';

export class PlayerRepository {
  constructor(private pool: Pool) {}

  /**
   * Finds or creates a persistent profile for an anonymous player ID.
   * If the player already exists, updates display_name and updated_at if changed.
   * Idempotent and concurrency-safe via PostgreSQL ON CONFLICT.
   */
  public async findOrCreateByAnonymousId(
    anonymousClientId: string,
    displayName: string
  ): Promise<PlayerProfileRecord> {
    const cleanAnonId = anonymousClientId.trim();
    const cleanName = displayName.trim() || 'Player';
    const newPlayerId = `p_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const query = `
      INSERT INTO player_profiles (player_id, anonymous_client_id, display_name, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (anonymous_client_id)
      DO UPDATE SET
        display_name = CASE
          WHEN EXCLUDED.display_name <> '' AND EXCLUDED.display_name <> player_profiles.display_name
          THEN EXCLUDED.display_name
          ELSE player_profiles.display_name
        END,
        updated_at = NOW()
      RETURNING player_id, anonymous_client_id, display_name, created_at, updated_at;
    `;

    const result = await this.pool.query(query, [newPlayerId, cleanAnonId, cleanName]);
    return result.rows[0];
  }

  public async findByAnonymousId(anonymousClientId: string): Promise<PlayerProfileRecord | null> {
    const query = `
      SELECT player_id, anonymous_client_id, display_name, created_at, updated_at
      FROM player_profiles
      WHERE anonymous_client_id = $1;
    `;
    const result = await this.pool.query(query, [anonymousClientId.trim()]);
    return result.rows[0] || null;
  }

  public async findById(playerId: string): Promise<PlayerProfileRecord | null> {
    const query = `
      SELECT player_id, anonymous_client_id, display_name, created_at, updated_at
      FROM player_profiles
      WHERE player_id = $1;
    `;
    const result = await this.pool.query(query, [playerId]);
    return result.rows[0] || null;
  }
}
