/**
 * PostgreSQL Connection Pool Manager
 * Manages lazy connection pooling via node-postgres (pg.Pool).
 * When DATABASE_URL is absent, degrades gracefully into RAM-only mode.
 */

import { Pool, PoolConfig } from 'pg';

let globalPool: Pool | null = null;
let lastDbError: string | null = null;

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && url.trim().length > 0);
}

export function getLastDbError(): string | null {
  return lastDbError;
}

export function setLastDbError(error: string | null): void {
  lastDbError = error;
}

export function getDbPool(): Pool | null {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!globalPool) {
    const connectionString = process.env.DATABASE_URL!.trim();

    const config: PoolConfig = {
      connectionString,
      max: Number(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    // Auto-enable SSL for remote/cloud PostgreSQL URLs (Render, Supabase, Cloud SQL, Neon)
    if (
      process.env.NODE_ENV === 'production' ||
      connectionString.includes('sslmode=require') ||
      connectionString.includes('.render.com') ||
      connectionString.includes('.supabase.co') ||
      connectionString.includes('.neon.tech')
    ) {
      config.ssl = {
        rejectUnauthorized: false,
      };
    }

    try {
      globalPool = new Pool(config);

      // Handle background idle client errors without crashing the server process
      globalPool.on('error', (err) => {
        const msg = `Unexpected idle PostgreSQL client error: ${err.message}`;
        lastDbError = msg;
        console.error(`[PostgreSQL Pool] ${msg}`);
      });

      console.log('[PostgreSQL Pool] Initialized lazy connection pool');
    } catch (err: any) {
      lastDbError = err.message || 'Failed to initialize pool';
      console.error('[PostgreSQL Pool] Failed to create pool:', lastDbError);
      return null;
    }
  }

  return globalPool;
}

/**
 * Checks connectivity to the database by issuing a lightweight query.
 * Does NOT throw; returns status object.
 */
export async function checkDbHealth(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const pool = getDbPool();
  if (!pool) {
    return { connected: false, error: 'DATABASE_URL not configured' };
  }

  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const latencyMs = Date.now() - start;
      lastDbError = null;
      return { connected: true, latencyMs };
    } finally {
      client.release();
    }
  } catch (err: any) {
    const msg = err.message || 'Connection test query failed';
    lastDbError = msg;
    return { connected: false, error: msg };
  }
}

/**
 * Closes the connection pool gracefully (for shutdown or tests)
 */
export async function closeDbPool(): Promise<void> {
  if (globalPool) {
    try {
      await globalPool.end();
    } catch {}
    globalPool = null;
  }
}
