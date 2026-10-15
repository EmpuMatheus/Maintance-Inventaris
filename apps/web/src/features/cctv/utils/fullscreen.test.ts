import { describe, it, expect } from 'vitest';
import {
  isFullscreenSupported,
  getFullscreenElement,
  requestFullscreenSafely,
  exitFullscreenSafely,
  isDoubleClick,
  type FullscreenCapableDocument,
} from './fullscreen';

function doc(overrides: Partial<FullscreenCapableDocument> = {}): FullscreenCapableDocument {
  return { ...overrides };
}

describe('isFullscreenSupported', () => {
  it('is true when the document exposes exitFullscreen', () => {
    expect(isFullscreenSupported(doc({ exitFullscreen: () => Promise.resolve() }))).toBe(true);
    expect(isFullscreenSupported(doc({ webkitExitFullscreen: () => undefined }))).toBe(true);
  });

  it('is false without the API', () => {
    expect(isFullscreenSupported(doc())).toBe(false);
    expect(isFullscreenSupported(undefined)).toBe(false);
  });
});

describe('getFullscreenElement', () => {
  it('returns the current fullscreen element (incl. webkit prefix)', () => {
    const el = {} as Element;
    expect(getFullscreenElement(doc({ fullscreenElement: el }))).toBe(el);
    expect(getFullscreenElement(doc({ webkitFullscreenElement: el }))).toBe(el);
  });

  it('returns null when nothing is fullscreen', () => {
    expect(getFullscreenElement(doc())).toBeNull();
  });
});

describe('requestFullscreenSafely', () => {
  const supportedDoc = doc({ exitFullscreen: () => Promise.resolve() });

  it('resolves true when the element accepts the request', async () => {
    const el = { requestFullscreen: () => Promise.resolve() };
    expect(await requestFullscreenSafely(el, supportedDoc)).toBe(true);
  });

  it('resolves false when the browser denies the request', async () => {
    const el = { requestFullscreen: () => Promise.reject(new Error('denied')) };
    expect(await requestFullscreenSafely(el, supportedDoc)).toBe(false);
  });

  it('resolves false for an unsupported doc, missing element, or missing method', async () => {
    expect(await requestFullscreenSafely({ requestFullscreen: () => Promise.resolve() }, doc())).toBe(false);
    expect(await requestFullscreenSafely(null, supportedDoc)).toBe(false);
    expect(await requestFullscreenSafely({}, supportedDoc)).toBe(false);
  });

  it('supports the webkit prefix', async () => {
    const el = { webkitRequestFullscreen: () => undefined };
    expect(await requestFullscreenSafely(el, supportedDoc)).toBe(true);
  });
});

describe('exitFullscreenSafely', () => {
  it('resolves true when a fullscreen element is present and exit succeeds', async () => {
    const d = doc({ fullscreenElement: {} as Element, exitFullscreen: () => Promise.resolve() });
    expect(await exitFullscreenSafely(d)).toBe(true);
  });

  it('resolves false when nothing is fullscreen', async () => {
    expect(await exitFullscreenSafely(doc({ exitFullscreen: () => Promise.resolve() }))).toBe(false);
  });

  it('resolves false when the API is unsupported', async () => {
    expect(await exitFullscreenSafely(doc({ fullscreenElement: {} as Element }))).toBe(false);
  });
});

describe('isDoubleClick', () => {
  it('is true only for detail >= 2', () => {
    expect(isDoubleClick({ detail: 2 })).toBe(true);
    expect(isDoubleClick({ detail: 3 })).toBe(true);
    expect(isDoubleClick({ detail: 1 })).toBe(false);
    expect(isDoubleClick(null)).toBe(false);
    expect(isDoubleClick(undefined)).toBe(false);
  });
});
