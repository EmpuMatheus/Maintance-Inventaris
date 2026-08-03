import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('Running production seed (APP_ENV=production)...');
const result = spawnSync(`${npm} run db:seed -w apps/api`, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'production', APP_ENV: 'production' },
});
process.exit(result.status ?? 1);
