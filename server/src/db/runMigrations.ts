/**
 * CLI Migration Runner Script
 * Usage: npx tsx server/src/db/runMigrations.ts [--rollback]
 */

import dotenv from 'dotenv';
dotenv.config();

import { getDbPool, isDatabaseConfigured, closeDbPool } from './dbPool';
import { runMigrations, rollbackLastMigration } from './migrator';

async function main() {
  if (!isDatabaseConfigured()) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = getDbPool();
  if (!pool) {
    console.error('Error: Could not initialize database connection pool.');
    process.exit(1);
  }

  const isRollback = process.argv.includes('--rollback');

  try {
    if (isRollback) {
      console.log('[Migrations] Initiating rollback of last migration...');
      const rolledBack = await rollbackLastMigration(pool);
      if (rolledBack) {
        console.log(`[Migrations] Successfully rolled back version: ${rolledBack}`);
      } else {
        console.log('[Migrations] No applied migrations to roll back.');
      }
    } else {
      console.log('[Migrations] Running pending migrations...');
      const result = await runMigrations(pool);
      console.log(`[Migrations] Applied: ${result.applied.length}, Skipped: ${result.skipped.length}`);
    }
  } catch (err: any) {
    console.error('[Migrations] Execution failed:', err.message);
    process.exit(1);
  } finally {
    await closeDbPool();
  }
}

main().catch((err) => {
  console.error('[Migrations] Unhandled error:', err);
  process.exit(1);
});
