import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  exitFullscreenSafely,
  getFullscreenElement,
  isFullscreenSupported,
  requestFullscreenSafely,
} from '../utils/fullscreen';

export interface UseFullscreen {
  ref: RefObject<HTMLDivElement | null>;
  /** True when the element is fullscreen via the API, or via the CSS fallback. */
  isFullscreen: boolean;
  /** True when the browser refused/does not support the API and we fall back. */
  fallback: boolean;
  supported: boolean;
  enter: () => Promise<boolean>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

/**
 * Fullscreen state for a container element, synchronised with the real browser
 * state.
 *
 * - `fullscreenchange` keeps `isFullscreen` in sync (so Escape, the browser's
 *   own exit button, or a routed navigation all update the UI).
 * - When the API is unavailable or the request is denied, `fallback` becomes
 *   true and the caller renders a CSS `fixed inset-0` overlay instead; Escape
 *   still exits it.
 * - `onChange` fires on every transition so the caller can leave its fullscreen
 *   view when the browser exits.
 */
export function useFullscreen(onChange?: (isFullscreen: boolean) => void): UseFullscreen {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallback, setFallback] = useState(false);
  const supported = useRef(isFullscreenSupported()).current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => {
      const active = ref.current != null && getFullscreenElement() === ref.current;
      setIsFullscreen(active);
      onChangeRef.current?.(active);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as EventListener);
    };
  }, []);

  const enter = useCallback(async (): Promise<boolean> => {
    const ok = await requestFullscreenSafely(ref.current);
    if (!ok) {
      // Denied/unsupported: maximise with CSS and tell the caller it is active.
      setFallback(true);
      setIsFullscreen(true);
      onChangeRef.current?.(true);
      return false;
    }
    setFallback(false);
    return true;
  }, []);

  const exit = useCallback(async (): Promise<void> => {
    if (getFullscreenElement()) await exitFullscreenSafely();
    setFallback(false);
    setIsFullscreen(false);
    onChangeRef.current?.(false);
  }, []);

  // Escape exits the CSS fallback (the browser handles Escape for real
  // fullscreen itself and emits `fullscreenchange`).
  useEffect(() => {
    if (!fallback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fallback, exit]);

  const toggle = useCallback(async (): Promise<void> => {
    if (isFullscreen) await exit();
    else await enter();
  }, [isFullscreen, enter, exit]);

  return { ref, isFullscreen, fallback, supported, enter, exit, toggle };
}
