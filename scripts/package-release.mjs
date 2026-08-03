import { spawnSync } from 'child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const releaseDir = path.join(root, 'release');

function run(command) {
  const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, NODE_ENV: 'production' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\n=== 1/4 Production build ===');
run(`node scripts/build-prod.mjs`);

console.log('\n=== 2/4 Launcher (SEA) ===');
run(`node scripts/build-launcher.mjs`);

console.log('\n=== 3/4 Assemble release folder ===');
const webDist = path.join(root, 'apps', 'web', 'dist');
const apiDist = path.join(root, 'apps', 'api', 'dist');
const buildInfo = path.join(root, 'build-info.json');

mkdirSync(path.join(releaseDir, 'apps', 'web'), { recursive: true });
mkdirSync(path.join(releaseDir, 'apps', 'api', 'dist'), { recursive: true });
mkdirSync(path.join(releaseDir, 'storage', 'uploads'), { recursive: true });
mkdirSync(path.join(releaseDir, 'storage', 'logs'), { recursive: true });

if (existsSync(webDist)) cpSync(webDist, path.join(releaseDir, 'apps', 'web', 'dist'), { recursive: true });
else console.warn('WARNING: apps/web/dist not found — web UI will be missing.');
if (existsSync(path.join(apiDist, 'server.cjs'))) {
  copyFileSync(path.join(apiDist, 'server.cjs'), path.join(releaseDir, 'apps', 'api', 'dist', 'server.cjs'));
  if (existsSync(path.join(apiDist, 'server.cjs.map'))) {
    copyFileSync(path.join(apiDist, 'server.cjs.map'), path.join(releaseDir, 'apps', 'api', 'dist', 'server.cjs.map'));
  }
} else {
  console.warn('WARNING: apps/api/dist/server.cjs not found — backend bundle missing.');
}
if (existsSync(buildInfo)) copyFileSync(buildInfo, path.join(releaseDir, 'build-info.json'));

// Minimal runtime node_modules for the two externals the backend bundle needs.
writeFileSync(
  path.join(releaseDir, 'package.json'),
  JSON.stringify({ name: 'office-inventory-runtime', private: true, version: '1.0.0', dependencies: { argon2: '^0.41.0', exceljs: '^4.4.0' } }, null, 2) + '\n',
);

console.log('\n=== 4/4 Install runtime dependencies ===');
run(`${npm} install --omit=dev --no-audit --no-fund --prefix ${JSON.stringify(releaseDir)}`);

console.log('\nRelease folder assembled at:');
console.log(`  ${releaseDir}`);
console.log('  Office Inventory.exe  — double-click to launch');
console.log('  config.template.json  — copy to config.json and edit');
console.log('\nDone. Run "npm run build:installer" (requires Inno Setup) to build the installer.');
