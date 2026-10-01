import { config } from '@/app/config';
import { getStoredToken } from '@/services/auth';

type SessionExpiredHandler = () => void;

let onSessionExpired: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler) {
  onSessionExpired = handler;
}

function getAuthHeaders(isJson: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  const t = getStoredToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  if (isJson) h['Content-Type'] = 'application/json';
  return h;
}

/**
 * Error carrying the backend error code and HTTP status so callers can react to
 * specific conditions (e.g. TOO_MANY_SESSIONS) rather than parsing messages.
 */
export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error as { name?: string })?.name === 'AbortError'
  );
}

async function handleResponse<T>(res: Response, skipGlobal401?: boolean): Promise<T> {
  if (res.status === 401 && !skipGlobal401) {
    onSessionExpired?.();
    throw new Error('Session expired.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.error?.message || `Request failed (${res.status})`,
      res.status,
      body.error?.code,
    );
  }
  return res.json();
}

export function apiGet<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const sp = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v));
  const qs = sp.toString();
  return fetch(`${config.apiUrl}${endpoint}${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders(true) })
    .then((r) => handleResponse<T>(r));
}

export function apiPost<T>(endpoint: string, body?: unknown, skipGlobal401?: boolean, signal?: AbortSignal): Promise<T> {
  return fetch(`${config.apiUrl}${endpoint}`, {
    method: 'POST',
    headers: getAuthHeaders(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  }).then((r) => handleResponse<T>(r, skipGlobal401));
}

export function apiPatch<T>(endpoint: string, body: unknown): Promise<T> {
  return fetch(`${config.apiUrl}${endpoint}`, {
    method: 'PATCH',
    headers: getAuthHeaders(true),
    body: JSON.stringify(body),
  }).then((r) => handleResponse<T>(r));
}

export function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  return fetch(`${config.apiUrl}${endpoint}`, {
    method: 'PUT',
    headers: getAuthHeaders(true),
    body: JSON.stringify(body),
  }).then((r) => handleResponse<T>(r));
}

export function apiDelete<T>(endpoint: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return fetch(`${config.apiUrl}${endpoint}`, {
    method: 'DELETE',
    headers: getAuthHeaders(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  }).then((r) => handleResponse<T>(r));
}

export function apiUpload<T>(endpoint: string, method: string, fd: FormData): Promise<T> {
  return fetch(`${config.apiUrl}${endpoint}`, { method, headers: getAuthHeaders(false), body: fd })
    .then((r) => handleResponse<T>(r));
}
