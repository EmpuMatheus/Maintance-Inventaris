import type { TimelineEntry } from '../types';

/**
 * Appends incoming entries to an existing live list, dropping duplicates by
 * `id`. Used for realtime Socket.IO pushes so a repeated event (e.g. after a
 * reconnect) can never duplicate a timeline state.
 */
export function appendTimelineEntries(prev: TimelineEntry[], incoming: TimelineEntry[]): TimelineEntry[] {
  if (incoming.length === 0) return prev;
  const seen = new Set(prev.map((e) => e.id));
  const next = incoming.filter((e) => !seen.has(e.id));
  return next.length ? [...next, ...prev] : prev;
}

/** Drops live entries that the latest API history already contains. */
export function pruneLiveEntries(live: TimelineEntry[], history: TimelineEntry[]): TimelineEntry[] {
  if (live.length === 0) return live;
  const historyIds = new Set(history.map((e) => e.id));
  if (!live.some((e) => historyIds.has(e.id))) return live;
  return live.filter((e) => !historyIds.has(e.id));
}

/**
 * Merges API history with live socket entries, de-duplicated by `id` and sorted
 * newest-first. History wins on conflict because it is the source of truth.
 */
export function mergeTimelineEntries(history: TimelineEntry[], live: TimelineEntry[]): TimelineEntry[] {
  const byId = new Map<string, TimelineEntry>();
  for (const entry of history) byId.set(entry.id, entry);
  for (const entry of live) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
