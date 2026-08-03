import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function readVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    return pkg.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const steps = [
  ['write build info', 'node scripts/write-build-info.mjs'],
  ['build shared', `${npm} run build -w packages/shared`],
  ['build web', `${npm} run build -w apps/web`],
  ['build api', `${npm} run build -w apps/api`],
];

for (const [label, command] of steps) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'production', APP_ENV: 'production', VITE_APP_VERSION: readVersion() },
  });
  if (result.status !== 0) {
    console.error(`\nProduction build failed at step: ${label}${result.error ? ` (${result.error.message})` : ''}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nProduction build completed successfully.');
