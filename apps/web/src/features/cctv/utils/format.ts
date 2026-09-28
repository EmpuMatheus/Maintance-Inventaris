import { format } from 'date-fns';

/** Formats an ISO timestamp for display, falling back to '-' for null/invalid. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, 'dd MMM yyyy, HH:mm');
}
