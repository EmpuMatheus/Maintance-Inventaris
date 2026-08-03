import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const issPath = path.join(root, 'installer', 'installer.iss');

const candidates = [
  'ISCC.exe',
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Inno Setup 6', 'ISCC.exe'),
];

let iscc = candidates.find((c) => existsSync(c) || c === 'ISCC.exe');
if (iscc === 'ISCC.exe' && !existsSync('ISCC.exe')) iscc = undefined;

if (!iscc) {
  console.error('Inno Setup (ISCC.exe) was not found.');
  console.error('Install Inno Setup 6 from https://jrsoftware.org/isinfo.php, then run:');
  console.error('  npm run build:installer');
  process.exit(1);
}

console.log('Building installer with:', iscc);
const result = spawnSync(iscc, [issPath], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
