import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import * as schema from './schema';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    const queryClient = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    db = drizzle(queryClient, { schema });
    logger.info('Database connection established');
  }
  return db;
}

export async function testConnection(): Promise<boolean> {
  try {
    const client = postgres(env.DATABASE_URL, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
    });
    await client`SELECT 1`;
    await client.end();
    return true;
  } catch {
    return false;
  }
}
