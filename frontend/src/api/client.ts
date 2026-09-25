/**
 * Single low-level HTTP client. Every other module in src/api/ goes through
 * this instead of calling fetch() directly, so base URL handling, JSON
 * parsing, and error normalization live in exactly one place.
 */
import type { ApiErrorBody } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;
  constructor(status: number, body: ApiErrorBody | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = await res.json();
    } catch {
      // response had no JSON body; fall through with null
    }
    throw new ApiError(res.status, body, body?.message ?? `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`);
    return handle<T>(res);
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return handle<T>(res);
  },
  async postForm<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { method: "POST", body: form });
    return handle<T>(res);
  },
  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return handle<T>(res);
  }
};
