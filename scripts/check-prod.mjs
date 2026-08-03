import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [
  ['API build', 'apps/api/dist/server.cjs'],
  ['Web build', 'apps/web/dist/index.html'],
  ['Shared build', 'packages/shared/dist/index.js'],
  ['Build metadata', 'build-info.json'],
  ['API migrations', 'apps/api/src/database/migrations'],
];

let ok = true;
for (const [label, rel] of checks) {
  const exists = existsSync(path.join(root, rel));
  console.log(`${exists ? '[OK]' : '[MISSING]'} ${label}: ${rel}`);
  if (!exists) ok = false;
}

if (!ok) {
  console.error('\nPre-release validation FAILED. Run `npm run build:prod` first.');
  process.exit(1);
}

console.log('\nPre-release validation passed. Ready to release.');
