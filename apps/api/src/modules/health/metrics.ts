import os from 'os';
import fs from 'fs';
import { env } from '@/config/env';
import { appVersion, buildTimestamp } from '@/config/version';

export interface RuntimeMetrics {
  status: string;
  uptimeSeconds: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
    loadAvg1: number;
    loadAvg5: number;
    loadAvg15: number;
  };
  disk: { total: number; free: number; available: number } | null;
  version: string;
  buildTimestamp: string;
  environment: string;
  nodeVersion: string;
  pid: number;
  timestamp: string;
}

function readDiskUsage(): RuntimeMetrics['disk'] {
  try {
    const statfs = fs.statfsSync(env.storageRoot);
    return {
      total: Number(statfs.blocks) * Number(statfs.bsize),
      free: Number(statfs.bfree) * Number(statfs.bsize),
      available: Number(statfs.bavail) * Number(statfs.bsize),
    };
  } catch {
    return null;
  }
}

export function buildRuntimeMetrics(): RuntimeMetrics {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const [loadAvg1, loadAvg5, loadAvg15] = os.loadavg();

  return {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    cpu: {
      user: cpu.user,
      system: cpu.system,
      loadAvg1,
      loadAvg5,
      loadAvg15,
    },
    disk: readDiskUsage(),
    version: appVersion,
    buildTimestamp,
    environment: env.appEnv,
    nodeVersion: process.version,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  };
}
