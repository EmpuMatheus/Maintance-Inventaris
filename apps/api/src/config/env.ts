import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const cwd = process.cwd();
dotenv.config({ path: path.resolve(cwd, '.env') });
dotenv.config({ path: path.resolve(cwd, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  REQUEST_BODY_LIMIT: z.string().default('2mb'),
  SCHEDULE_PROCESS_INTERVAL_MINUTES: z.coerce.number().default(60),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment validation failed:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const corsOrigins = parsed.data.CORS_ORIGIN
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const env = { ...parsed.data, corsOrigins };
