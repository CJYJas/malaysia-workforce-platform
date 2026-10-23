export interface AccountUser {
  id: string;
  email: string;
}

export interface SavedLesson {
  item_id: string;
  item_type: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  completed: boolean;
  completed_at: string | null;
  evidence_type: string;
  mapped_skills: string[];
  unmapped_skills: string[];
  roadmap_error: string | null;
}

export interface AccountProfileSync {
  target_role: string | null;
  profile: Record<string, unknown>;
  version: number;
  roadmap: Record<string, unknown> | null;
  roadmap_error: string | null;
}

export class AccountApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function csrfCookie(): string {
  if (typeof document === "undefined") return "";
  const entry = document.cookie.split("; ").find((part) => part.startsWith("csrf_token="));
  return entry ? decodeURIComponent(entry.slice("csrf_token=".length)) : "";
}

export async function accountRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (method !== "GET") {
    const csrf = csrfCookie();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(`/api/py${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Account request failed (${response.status}).`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") message = payload.detail;
    } catch {
      // Preserve the status-based message when the response is not JSON.
    }
    throw new AccountApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function signIn(email: string, password: string): Promise<AccountUser> {
  const response = await accountRequest<{ user: AccountUser }>("/auth/login", "POST", { email, password });
  return response.user;
}

export async function registerAccount(email: string, password: string): Promise<AccountUser> {
  const response = await accountRequest<{ user: AccountUser }>("/auth/register", "POST", { email, password });
  return response.user;
}

export async function signOut(): Promise<void> {
  await accountRequest<void>("/auth/logout", "POST");
}

export function getCurrentAccount(): Promise<{ user: AccountUser }> {
  return accountRequest("/auth/me");
}

export function refreshAccount(): Promise<{ user: AccountUser }> {
  return accountRequest("/auth/refresh", "POST");
}

export function saveAccountProfile(profile: {
  target_role: string;
  skills: Array<{ name: string; level?: number }>;
  experience_years?: number | null;
  education?: string | null;
}): Promise<AccountProfileSync> {
  return accountRequest("/me/profile", "PUT", profile);
}

export function getAccountLessons(): Promise<SavedLesson[]> {
  return accountRequest("/me/lessons");
}

export function saveAccountLesson(
  itemId: string,
  value: {
    status: SavedLesson["status"];
    item_type: "pathway_step" | "course";
    title: string;
  },
): Promise<SavedLesson> {
  return accountRequest(`/me/lessons/${encodeURIComponent(itemId)}/completion`, "PUT", value);
}
