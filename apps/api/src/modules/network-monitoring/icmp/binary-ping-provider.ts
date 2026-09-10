import { execFile } from 'node:child_process';
import { isIP } from 'node:net';
import { logger } from '@/lib/logger';
import type { ICMPProvider, PingResult } from './ping-provider';

/**
 * Error thrown when the ICMP provider itself cannot operate (e.g. the system
 * `ping` binary is missing, or the target IP is malformed). The monitoring
 * engine treats these as per-device isolation errors and leaves the device
 * state untouched, so tooling failures never mass-mark devices OFFLINE.
 */
export class IcmpProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IcmpProviderError';
  }
}

export interface BinaryPingProviderOptions {
  /** Per-probe timeout in seconds (default 2). */
  timeoutSeconds?: number;
  /** Number of ICMP echo requests per probe (default 1). */
  count?: number;
  /** Override the ping binary path/name (default "ping"). */
  binary?: string;
}

interface PingCommand {
  binary: string;
  /** Count flag: Linux/macOS `-c`, Windows `-n`. */
  countFlag: string;
  /** Timeout flag: Linux `-W` (s), Windows `-w` (ms), macOS `-t` (s). */
  timeoutFlag: string;
}

function commandForPlatform(): PingCommand {
  if (process.platform === 'win32') {
    return { binary: 'ping', countFlag: '-n', timeoutFlag: '-w' };
  }
  if (process.platform === 'darwin') {
    return { binary: 'ping', countFlag: '-c', timeoutFlag: '-t' };
  }
  return { binary: 'ping', countFlag: '-c', timeoutFlag: '-W' };
}

interface ExecError extends Error {
  code?: string | number;
  killed?: boolean;
  signal?: string;
  stdout?: string;
  stderr?: string;
}

/**
 * ICMP provider backed by the operating system `ping` binary.
 *
 * Deliberately avoids native/raw-socket npm dependencies so the API bundle
 * stays pure-JS and portable across Linux (production) and Windows (dev).
 * A non-zero exit code means "no reply" (a normal failed probe); spawn errors
 * such as a missing binary are surfaced as {@link IcmpProviderError}.
 */
export class BinaryPingProvider implements ICMPProvider {
  private readonly timeoutSeconds: number;
  private readonly count: number;
  private readonly command: PingCommand;

  constructor(options: BinaryPingProviderOptions = {}) {
    this.timeoutSeconds = options.timeoutSeconds ?? 2;
    this.count = options.count ?? 1;
    const base = commandForPlatform();
    this.command = { ...base, binary: options.binary ?? base.binary };
  }

  async ping(ipAddress: string): Promise<PingResult> {
    const family = isIP(ipAddress);
    if (family === 0) {
      throw new IcmpProviderError(`Malformed IP address: ${ipAddress}`);
    }

    const checkedAt = new Date();
    const args: string[] = [this.command.countFlag, String(this.count)];

    if (family === 6) args.push('-6');

    if (process.platform === 'win32') {
      args.push(this.command.timeoutFlag, String(this.timeoutSeconds * 1000));
    } else {
      args.push(this.command.timeoutFlag, String(this.timeoutSeconds));
    }
    args.push(ipAddress);

    try {
      const { stdout } = await this.exec(args);
      return { success: true, checkedAt, roundTripMs: parseRoundTripMs(stdout) };
    } catch (err) {
      const e = err as ExecError;

      // Spawn failure (binary not found / not executable) is a provider error,
      // not evidence that the device is down.
      if (e.code === 'ENOENT') {
        throw new IcmpProviderError(`ping binary not found: ${this.command.binary}`);
      }
      if (e.code === 'EACCES') {
        throw new IcmpProviderError(`ping binary not executable: ${this.command.binary}`);
      }

      // Timeout (killed by us) or non-zero exit => no reply; a normal failure.
      if (e.killed || typeof e.code === 'number') {
        return { success: false, checkedAt };
      }

      logger.warn({ err: e, ipAddress }, 'Unexpected ICMP provider error');
      throw new IcmpProviderError(`ICMP probe failed for ${ipAddress}: ${e.message}`);
    }
  }

  private exec(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(
        this.command.binary,
        args,
        { timeout: (this.timeoutSeconds + 2) * 1000, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            (error as ExecError).stdout = stdout;
            (error as ExecError).stderr = stderr;
            reject(error);
            return;
          }
          resolve({ stdout, stderr });
        },
      );
    });
  }
}

function parseRoundTripMs(stdout: string): number | undefined {
  const match = /time[=<]\s*([\d.]+)\s*ms/i.exec(stdout);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}