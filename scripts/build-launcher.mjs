import { build } from 'esbuild';
import { spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'release');
const launcherSource = path.join(root, 'tools', 'launcher', 'src', 'launcher.ts');
const template = path.join(root, 'tools', 'launcher', 'config.template.json');

const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const EXE_NAME = 'Office Inventory.exe';

mkdirSync(releaseDir, { recursive: true });

// 1. Bundle the launcher into a single CommonJS file (node built-ins only).
await build({
  entryPoints: [launcherSource],
  outfile: path.join(releaseDir, 'launcher.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  minify: true,
  sourcemap: false,
  external: ['node:sea'],
  logLevel: 'info',
});

// 2. Build the SEA blob.
const seaConfig = path.join(releaseDir, 'sea-config.json');
writeFileSync(seaConfig, JSON.stringify({ main: 'launcher.cjs', output: 'launcher.blob', disableExperimentalSEAWarning: true }));
const seaResult = spawnSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], { cwd: releaseDir, stdio: 'inherit' });
if (seaResult.status !== 0) {
  console.error('Failed to build SEA blob.');
  process.exit(seaResult.status ?? 1);
}

// 3. Copy node.exe and inject the blob.
const exePath = path.join(releaseDir, EXE_NAME);
copyFileSync(process.execPath, exePath);

const postjectCli = path.join(root, 'node_modules', 'postject', 'dist', 'cli.js');
if (!existsSync(postjectCli)) {
  console.error('postject is not installed. Run: npm install -D postject');
  process.exit(1);
}
const injectResult = spawnSync(process.execPath, [postjectCli, exePath, 'NODE_SEA_BLOB', path.join(releaseDir, 'launcher.blob'), '--sentinel-fuse', SEA_FUSE], { stdio: 'inherit' });
if (injectResult.status !== 0) {
  console.error('Failed to inject the SEA blob.');
  process.exit(injectResult.status ?? 1);
}

// 4. Ship the config template.
copyFileSync(template, path.join(releaseDir, 'config.template.json'));

// Cleanup intermediate SEA artifacts.
for (const f of ['sea-config.json', 'launcher.cjs', 'launcher.blob']) {
  rmSync(path.join(releaseDir, f), { force: true });
}

console.log(`Launcher built: ${path.join(releaseDir, EXE_NAME)}`);
console.log('Next: run "npm run package:release" to assemble the full release folder.');
