// In-memory authenticated HTTP client for FUREX ERP REST API (Node Express / Cloudflare Workers)
// Tokens are kept strictly in JavaScript memory (never in localStorage or sessionStorage).

let sessionToken: string | null = null;
const workspaceTokens = new Map<string, string>();
const mutationListeners = new Set<(companyId: string) => void>();

export function setSessionToken(token: string | null) {
  sessionToken = token;
  if (!token) {
    workspaceTokens.clear();
  }
}

export function getSessionToken(): string | null {
  return sessionToken;
}

export function setWorkspaceToken(companyId: string, token: string | null) {
  if (!token) {
    workspaceTokens.delete(companyId);
  } else {
    workspaceTokens.set(companyId, token);
  }
}

export function getWorkspaceToken(companyId: string): string | null {
  return workspaceTokens.get(companyId) || null;
}

export function clearAllWorkspaceTokens() {
  workspaceTokens.clear();
}

export function subscribeDataMutation(listener: (companyId: string) => void): () => void {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
}

export function notifyDataMutation(companyId: string) {
  mutationListeners.forEach((fn) => {
    try {
      fn(companyId);
    } catch {
      // ignore listener errors
    }
  });
}

const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE =
  RAW_API_BASE && /^https?:\/\//i.test(RAW_API_BASE) ? RAW_API_BASE : '';

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    companyId?: string;
    emitMutation?: boolean;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  if (options.companyId) {
    const wsToken = workspaceTokens.get(options.companyId);
    if (wsToken) {
      headers['X-Workspace-Token'] = wsToken;
    }
  }

  const targetUrl = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
  const response = await fetch(targetUrl, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    const message =
      (typeof parsed.error === 'string' && parsed.error) ||
      `Erreur serveur (${response.status})`;
    throw new Error(message);
  }

  if (options.emitMutation && options.companyId) {
    notifyDataMutation(options.companyId);
  }

  return parsed as T;
}
