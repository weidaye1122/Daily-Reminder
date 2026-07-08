import type { AuthUser } from '@shared/types';

export class ApiError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Schedule-Reminder-Request': 'fetch',
      ...(init?.headers ?? {})
    },
    ...init
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? '请求失败',
      response.status,
      payload?.details
    );
  }

  return payload as T;
};

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE'
    }),
  me: () => request<AuthUser>('/api/auth/me')
};
