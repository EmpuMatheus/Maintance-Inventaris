/**
 * Presentation-only formatting helpers.
 *
 * The API and Socket.IO deliver canonical UTC timestamps (ISO 8601). These
 * helpers convert to the user's local timezone for display ONLY; they never
 * change or persist the canonical timestamp, and downtime always comes from the
 * backend-computed `durationSeconds` (never from the browser clock).
 */

/** Local time, e.g. "10:04". */
export function formatEventTime(utcIso: string): string {
  const d = new Date(utcIso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Local date + time, e.g. "09 Sep 2026 · 10:04". */
export function formatEventDateTime(utcIso: string): string {
  const d = new Date(utcIso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Short day label used to group the timeline, e.g. "Today" / "Yesterday" / "09 Sep 2026". */
export function formatDayLabel(utcIso: string): string {
  const d = new Date(utcIso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Human downtime from the backend-computed seconds. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return '-';
  const seconds = Math.floor(totalSeconds);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days} day${days === 1 ? '' : 's'}${remainingHours ? ` ${remainingHours} hour${remainingHours === 1 ? '' : 's'}` : ''}`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours} hour${hours === 1 ? '' : 's'}${remainingMinutes ? ` ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}` : ''}`;
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
