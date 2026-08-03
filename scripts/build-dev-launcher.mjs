// Builds the developer launcher SEA executable: OfficeInventoryDev.exe at the repo root.
import { build } from 'esbuild';
import { spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const workDir = path.join(root, '.sea-build');
const source = path.join(root, 'tools', 'dev-launcher', 'src', 'dev-launcher.ts');
const exeName = 'OfficeInventoryDev.exe';

const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

mkdirSync(workDir, { recursive: true });

await build({
  entryPoints: [source],
  outfile: path.join(workDir, 'launcher.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  minify: true,
  sourcemap: false,
  external: ['node:sea'],
  logLevel: 'info',
});

writeFileSync(
  path.join(workDir, 'sea-config.json'),
  JSON.stringify({ main: 'launcher.cjs', output: 'launcher.blob', disableExperimentalSEAWarning: true }),
);
const seaResult = spawnSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], { cwd: workDir, stdio: 'inherit' });
if (seaResult.status !== 0) {
  console.error('Failed to build the developer launcher SEA blob.');
  process.exit(seaResult.status ?? 1);
}

const exePath = path.join(root, exeName);
copyFileSync(process.execPath, exePath);

const postjectCli = path.join(root, 'node_modules', 'postject', 'dist', 'cli.js');
if (!existsSync(postjectCli)) {
  console.error('postject is not installed. Run: npm install -D postject');
  process.exit(1);
}
const injectResult = spawnSync(process.execPath, [postjectCli, exePath, 'NODE_SEA_BLOB', path.join(workDir, 'launcher.blob'), '--sentinel-fuse', SEA_FUSE], { stdio: 'inherit' });
if (injectResult.status !== 0) {
  console.error('Failed to inject the developer launcher SEA blob.');
  process.exit(injectResult.status ?? 1);
}

rmSync(workDir, { recursive: true, force: true });

console.log(`Developer launcher built: ${exePath}`);
