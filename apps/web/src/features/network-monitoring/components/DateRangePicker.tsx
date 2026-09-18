import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const POPOVER_WIDTH_DESKTOP = 560;
const POPOVER_WIDTH_MOBILE = 300;
const VIEWPORT_MARGIN = 8;

interface DateRangePickerProps {
  /** ISO timestamp/date string, or empty when unset. */
  from: string;
  /** ISO timestamp/date string, or empty when unset. */
  to: string;
  onChange: (patch: { from: string; to: string }) => void;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplay(value: string): string {
  const date = parseDate(value);
  return date ? format(date, 'MMM dd, yyyy') : '';
}

/**
 * A single-field date range picker with a two-month calendar popover.
 *
 * The popover is rendered in a portal with fixed positioning so it is never
 * clipped by the surrounding filter card and always stays inside the viewport.
 * A start date alone is not committed - the API only receives `from`/`to` once
 * a complete range has been chosen, mirroring the previous two-input behavior.
 */
export default function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date | null>(null);
  const [draftTo, setDraftTo] = useState<Date | null>(null);
  const [baseMonth, setBaseMonth] = useState(() => startOfMonth(parseDate(from) ?? new Date()));
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handle = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const rect = trigger.getBoundingClientRect();
    const width = isDesktop ? POPOVER_WIDTH_DESKTOP : POPOVER_WIDTH_MOBILE;
    const height = popover.offsetHeight;

    let left = rect.left;
    if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - width - VIEWPORT_MARGIN;
    }
    left = Math.max(VIEWPORT_MARGIN, left);

    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - VIEWPORT_MARGIN) {
      const above = rect.top - height - 6;
      top = above >= VIEWPORT_MARGIN ? above : Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
    }

    setCoords({ top, left, width });
  }, [isDesktop]);

  // Measure the popover after render (height is unknown before paint) and keep
  // it anchored on scroll/resize while open.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const openPicker = () => {
    setDraftFrom(parseDate(from));
    setDraftTo(parseDate(to));
    setBaseMonth(startOfMonth(parseDate(from) ?? new Date()));
    setOpen(true);
  };

  const handleTrigger = () => {
    if (open) {
      setOpen(false);
      return;
    }
    openPicker();
  };

  const handleDayClick = (day: Date) => {
    const picked = startOfDay(day);
    if (!draftFrom || draftTo) {
      setDraftFrom(picked);
      setDraftTo(null);
      return;
    }
    let start = draftFrom;
    let end = picked;
    if (isBefore(picked, draftFrom)) {
      start = picked;
      end = draftFrom;
    }
    setDraftFrom(start);
    setDraftTo(end);
    onChange({ from: start.toISOString(), to: endOfDay(end).toISOString() });
  };

  const clear = () => {
    setDraftFrom(null);
    setDraftTo(null);
    onChange({ from: '', to: '' });
    setOpen(false);
    triggerRef.current?.focus();
  };

  const label = useMemo(() => {
    const fromLabel = formatDisplay(from);
    const toLabel = formatDisplay(to);
    if (fromLabel && toLabel) return `${fromLabel} - ${toLabel}`;
    if (fromLabel) return `${fromLabel} - ...`;
    return 'Select date range';
  }, [from, to]);

  const months = useMemo(
    () => (isDesktop ? [baseMonth, addMonths(baseMonth, 1)] : [baseMonth]),
    [baseMonth, isDesktop],
  );

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={handleTrigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Date Range"
        className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={`truncate ${from || to ? '' : 'text-slate-400'}`}>{label}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Date Range"
            style={{
              position: 'fixed',
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              width: coords?.width ?? (isDesktop ? POPOVER_WIDTH_DESKTOP : POPOVER_WIDTH_MOBILE),
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setBaseMonth((m) => subMonths(m, 1))}
                aria-label="Previous month"
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-slate-800">
                {format(baseMonth, 'MMMM yyyy')}
                {isDesktop ? ` - ${format(addMonths(baseMonth, 1), 'MMMM yyyy')}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setBaseMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-4">
              {months.map((month) => (
                <CalendarMonth
                  key={month.toISOString()}
                  month={month}
                  draftFrom={draftFrom}
                  draftTo={draftTo}
                  onSelect={handleDayClick}
                />
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-xs text-slate-400">
                {draftFrom && !draftTo
                  ? 'Select end date'
                  : draftFrom && draftTo
                    ? 'Range selected'
                    : 'Select start date'}
              </span>
              <button
                type="button"
                onClick={clear}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

interface CalendarMonthProps {
  month: Date;
  draftFrom: Date | null;
  draftTo: Date | null;
  onSelect: (day: Date) => void;
}

function CalendarMonth({ month, draftFrom, draftTo, onSelect }: CalendarMonthProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const rangeStart = draftFrom && draftTo ? (isAfter(draftFrom, draftTo) ? draftTo : draftFrom) : draftFrom;
  const rangeEnd = draftFrom && draftTo ? (isAfter(draftFrom, draftTo) ? draftFrom : draftTo) : null;

  return (
    <div className="flex-1">
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-center text-[11px] font-medium uppercase text-slate-400">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isStart = rangeStart ? isSameDay(day, rangeStart) : false;
          const isEnd = rangeEnd ? isSameDay(day, rangeEnd) : false;
          const inRange =
            rangeStart && rangeEnd
              ? isWithinInterval(day, { start: rangeStart, end: rangeEnd })
              : false;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={format(day, 'PPPP')}
              aria-pressed={isStart || isEnd}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors ${
                isStart || isEnd
                  ? 'bg-indigo-600 font-semibold text-white'
                  : inRange
                    ? 'bg-indigo-50 text-indigo-700'
                    : inMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50'
              }`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
