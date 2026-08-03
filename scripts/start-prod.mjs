import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('Starting production server (NODE_ENV=production)...');
const result = spawnSync(`${npm} run start -w apps/api`, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'production', APP_ENV: 'production' },
});
process.exit(result.status ?? 1);
