import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outfile = path.join(root, 'dist', 'server.cjs');

// Native/CJS packages that must stay external so the runtime can load them
// from node_modules (native bindings or dynamic requires).
const external = ['argon2', 'exceljs'];

await build({
  entryPoints: [path.join(root, 'src', 'server.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  alias: { '@': path.join(root, 'src') },
  external,
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
  logLevel: 'info',
});

const size = fs.statSync(outfile).size;
console.log(`Bundled API -> ${path.relative(root, outfile)} (${(size / 1024).toFixed(0)} kB)`);
