/**
 * Downloads the streaming runtime binaries for the current platform into
 * `apps/api/gateway/`:
 *   - MediaMTX  (the streaming gateway: RTSP -> WebRTC/HLS)
 *   - FFmpeg    (the ingest normalizer for devices MediaMTX cannot repackage)
 *
 * The bundled binaries are copied into the release and used by the API
 * (`CCTV_GATEWAY_BINARY`, `CCTV_FFMPEG_BINARY`).
 *
 * Usage:
 *   node scripts/fetch-streaming-gateway.mjs                 # latest MediaMTX
 *   node scripts/fetch-streaming-gateway.mjs v1.21.1         # pinned MediaMTX
 *   node scripts/fetch-streaming-gateway.mjs --force         # re-download
 *   node scripts/fetch-streaming-gateway.mjs --skip-ffmpeg   # MediaMTX only
 *
 * The script is idempotent: an existing binary is left untouched unless
 * `--force` is passed.
 */
import { createWriteStream, existsSync, mkdirSync, rmSync, chmodSync, readdirSync, copyFileSync } from 'fs';
import { pipeline } from 'stream/promises';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'apps', 'api', 'gateway');
const force = process.argv.includes('--force');
const skipFfmpeg = process.argv.includes('--skip-ffmpeg');
const versionArg = process.argv.find((a) => /^v?\d+\.\d+\.\d+$/.test(a));
const version = versionArg ? (versionArg.startsWith('v') ? versionArg : `v${versionArg}`) : 'latest';

const BINARY_NAME = process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx';
const targetPath = path.join(outDir, BINARY_NAME);
const FFMPEG_NAME = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegTarget = path.join(outDir, FFMPEG_NAME);

/**
 * Resolves the concrete release tag (e.g. `v1.21.1`). MediaMTX asset names
 * embed the version, so the `/releases/latest/download/...` shortcut cannot be
 * used directly; the tag is looked up from the GitHub API.
 */
async function resolveVersion() {
  if (version !== 'latest') return version;
  const res = await fetch('https://api.github.com/repos/bluenviron/mediamtx/releases/latest', {
    headers: { 'User-Agent': 'office-inventory-build', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Could not resolve latest MediaMTX release (HTTP ${res.status}).`);
  const data = await res.json();
  if (!data.tag_name) throw new Error('Latest MediaMTX release has no tag name.');
  return data.tag_name;
}

function assetName(resolvedVersion) {
  const arch = process.arch === 'x64' ? 'amd64' : process.arch === 'arm64' ? 'arm64v8' : null;
  if (!arch) throw new Error(`Unsupported architecture: ${process.arch}`);
  switch (process.platform) {
    case 'win32':
      return `mediamtx_${resolvedVersion}_windows_${arch}.zip`;
    case 'linux':
      return `mediamtx_${resolvedVersion}_linux_${arch}.tar.gz`;
    case 'darwin':
      return `mediamtx_${resolvedVersion}_darwin_${arch}.tar.gz`;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

/**
 * FFmpeg release assets. Uses the gyan.dev (Windows) and johnvansickle
 * (Linux) static builds that expose the `libx264` encoder the normalizer needs.
 */
function ffmpegAsset() {
  if (process.platform === 'win32') {
    return { url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip', archive: 'ffmpeg.zip', kind: 'zip' };
  }
  if (process.platform === 'linux') {
    return { url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz', archive: 'ffmpeg.tar.xz', kind: 'tarxz' };
  }
  // macOS: rely on the system/Homebrew ffmpeg (CCTV_FFMPEG_BINARY or PATH).
  return null;
}

async function fetchFfmpeg() {
  if (existsSync(ffmpegTarget) && !force) {
    console.log(`FFmpeg already present: ${path.relative(root, ffmpegTarget)}`);
    return;
  }
  const asset = ffmpegAsset();
  if (!asset) {
    console.log('No prebuilt FFmpeg for this platform; set CCTV_FFMPEG_BINARY or install ffmpeg on PATH.');
    return;
  }
  const archivePath = path.join(outDir, asset.archive);
  const extractDir = path.join(outDir, '.ffmpeg-extract');
  console.log(`Downloading ${asset.archive}...`);
  await download(asset.url, archivePath);

  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  console.log('Extracting FFmpeg...');
  if (asset.kind === 'zip') {
    execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath "${archivePath}" -DestinationPath "${extractDir}" -Force`], { stdio: 'inherit' });
  } else {
    execFileSync('tar', ['-xJf', archivePath, '-C', extractDir], { stdio: 'inherit' });
  }
  rmSync(archivePath, { force: true });

  // Locate the binary anywhere in the extracted tree.
  const findBinary = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findBinary(p);
        if (found) return found;
      } else if (entry.name === FFMPEG_NAME) {
        return p;
      }
    }
    return null;
  };
  const found = findBinary(extractDir);
  if (!found) {
    rmSync(extractDir, { recursive: true, force: true });
    throw new Error('FFmpeg binary not found in the downloaded archive.');
  }
  copyFileSync(found, ffmpegTarget);
  rmSync(extractDir, { recursive: true, force: true });
  if (process.platform !== 'win32') chmodSync(ffmpegTarget, 0o755);
  console.log(`FFmpeg ready: ${path.relative(root, ffmpegTarget)}`);
}

async function fetchMediaMtx() {
  if (existsSync(targetPath) && !force) {
    console.log(`Streaming gateway already present: ${path.relative(root, targetPath)}`);
    return;
  }

  const resolvedVersion = await resolveVersion();
  const asset = assetName(resolvedVersion);
  const base = `https://github.com/bluenviron/mediamtx/releases/download/${resolvedVersion}`;
  const url = `${base}/${asset}`;
  const archivePath = path.join(outDir, asset);

  console.log(`Downloading ${asset}...`);
  await download(url, archivePath);

  console.log('Extracting...');
  if (asset.endsWith('.zip')) {
    execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath "${archivePath}" -DestinationPath "${outDir}" -Force`], { stdio: 'inherit' });
  } else {
    execFileSync('tar', ['-xzf', archivePath, '-C', outDir], { stdio: 'inherit' });
  }

  rmSync(archivePath, { force: true });
  if (!existsSync(targetPath)) {
    throw new Error(`Expected binary not found after extraction: ${targetPath}`);
  }
  if (process.platform !== 'win32') chmodSync(targetPath, 0o755);
  console.log(`Streaming gateway ready: ${path.relative(root, targetPath)}`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  await fetchMediaMtx();
  if (!skipFfmpeg) await fetchFfmpeg();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
