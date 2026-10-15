import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * YouTube-style auto-hiding controls.
 *
 * Controls start visible and hide after `idleMs` without interaction. Any mouse
 * movement, pointer press, or key press reveals them again and restarts the
 * timer. All listeners and the timer are cleaned up on unmount.
 */
export function useIdleControls(idleMs = 3000): { visible: boolean; reveal: () => void } {
  const [visible, setVisible] = useState(true);
  const timer = useRef<number | null>(null);

  const reveal = useCallback(() => {
    setVisible(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), idleMs);
  }, [idleMs]);

  useEffect(() => {
    reveal();
    const onActivity = () => reveal();
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [reveal]);

  return { visible, reveal };
}
