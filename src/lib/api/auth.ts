/**
 * Client for the auth API service (`server/`, THEA-90 / THEA-84c). Talks
 * over plain `fetch` — no dependency on the server's own node_modules
 * (mysql2/express/argon2 never touch this bundle, mirroring AGENTS.md's
 * "Layering" rule the other direction).
 *
 * Base URL is `EXPO_PUBLIC_API_BASE_URL` (Expo only inlines env vars with
 * that prefix into the client bundle). There is no live deploy yet — see
 * `server/README.md` "What a real deploy needs" — so this defaults to a
 * local dev server and every call fails with a `network_error` until either
 * the env var is set or `npm start` is running in `server/` locally.
 */

const DEFAULT_BASE_URL = 'http://localhost:3001';

function baseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL;
}

export interface AuthUser {
  id: string;
  email: string;
  /** Only present on `me()` — register()/login()/refresh() don't re-fetch consent state. */
  tosAccepted?: boolean;
  healthDataConsent?: boolean;
}

export interface AuthSession {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
}

/** Stable `code` mirrors the server's `error.code` (server/README.md
 *  endpoint table) — switch on this, not `message`, for UI branching. */
export class AuthApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    // Network down, DNS failure, no server at that base URL, etc. — the one
    // case the server itself can't produce an { error: { code } } body for.
    throw new AuthApiError(0, 'network_error', 'Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (e.g. a proxy's HTML error page) — fall through to the
    // generic message below rather than throwing a JSON-parse error.
  }

  if (!res.ok) {
    const errorBody = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new AuthApiError(res.status, errorBody?.code ?? 'unknown_error', errorBody?.message ?? 'Something went wrong.');
  }

  return body as T;
}

export function register(input: {
  email: string;
  password: string;
  /** `YYYY-MM-DD`, self-attested. THEA-95 account-age gate (18+) — the
   *  server is the enforcement point (`error.code === 'under_18'`); this is
   *  just what ships over the wire. */
  dateOfBirth: string;
  tosAccepted: boolean;
  healthDataConsent: boolean;
}): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: { email: string; password: string }): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export function refresh(refreshToken: string): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
}

export function logout(refreshToken: string): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
}

export function me(accessToken: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/api/auth/me', { headers: { authorization: `Bearer ${accessToken}` } });
}
