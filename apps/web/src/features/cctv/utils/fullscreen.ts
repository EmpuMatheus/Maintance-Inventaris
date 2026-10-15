/**
 * Browser Fullscreen API helpers, written defensively.
 *
 * Fullscreen is not available everywhere (some embedded browsers and iframes
 * deny it, Safari uses the `webkit` prefix, and `requestFullscreen()` rejects
 * without user activation). Every helper here degrades to a boolean instead of
 * throwing, and the JSDoc on the caller (`useFullscreen`) explains the CSS
 * fallback used when the API is denied. Kept framework-free for unit testing
 * with a fake document.
 */

/** The subsets of Element/Document this module touches (all optional). */
export interface FullscreenCapableElement {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export interface FullscreenCapableDocument {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void> | void;
}

function defaultDocument(): FullscreenCapableDocument | undefined {
  return typeof document === 'undefined' ? undefined : (document as unknown as FullscreenCapableDocument);
}

/** True when the document can enter/exit fullscreen. */
export function isFullscreenSupported(doc: FullscreenCapableDocument | undefined = defaultDocument()): boolean {
  return !!doc && (typeof doc.exitFullscreen === 'function' || typeof doc.webkitExitFullscreen === 'function');
}

/** The currently fullscreen element, if any. */
export function getFullscreenElement(
  doc: FullscreenCapableDocument | undefined = defaultDocument(),
): Element | null {
  if (!doc) return null;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Requests fullscreen on `el`. Resolves `true` on success and `false` when the
 * element is missing, the API is unsupported, or the browser rejects the request
 * (e.g. no user gesture, iframe permission policy).
 */
export async function requestFullscreenSafely(
  el: FullscreenCapableElement | null | undefined,
  doc: FullscreenCapableDocument | undefined = defaultDocument(),
): Promise<boolean> {
  if (!el || !isFullscreenSupported(doc)) return false;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (typeof request !== 'function') return false;
  try {
    await request.call(el);
    return true;
  } catch {
    return false;
  }
}

/** Exits fullscreen. Resolves `true` when the API accepted the call. */
export async function exitFullscreenSafely(
  doc: FullscreenCapableDocument | undefined = defaultDocument(),
): Promise<boolean> {
  if (!doc || !getFullscreenElement(doc)) return false;
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  if (typeof exit !== 'function') return false;
  try {
    await exit.call(doc);
    return true;
  } catch {
    return false;
  }
}

/** A double click (`detail >= 2`) toggles fullscreen; a single click does not. */
export function isDoubleClick(event: { detail?: number } | null | undefined): boolean {
  return (event?.detail ?? 0) >= 2;
}
