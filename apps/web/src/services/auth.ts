import { config } from '@/app/config';
import type { LoginRequest, LoginResponse, MeResponse } from '@/types/auth';

const TOKEN_KEY = 'auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${config.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error?.message || 'Login failed.');
  }
  return response.json();
}

export async function getCurrentUser(): Promise<MeResponse> {
  const response = await fetch(`${config.apiUrl}/auth/me`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch current user.');
  }
  return response.json();
}
