import { apiApp } from './api.ts';
import { getLocalSqliteDb, LocalSqliteD1Adapter } from './db/sqliteAdapter.ts';
import { DbClient } from './db/types.ts';

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareWorkerEnv {
  DB?: DbClient;
  ma_base_de_donnees?: DbClient;
  SESSION_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  ASSETS?: AssetsBinding;
}

function resolveD1Binding(env: CloudflareWorkerEnv): DbClient | null {
  return env.DB ?? env.ma_base_de_donnees ?? null;
}

function resolveAllowedOrigin(request: Request, env: CloudflareWorkerEnv): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;

  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) {
    return origin;
  }

  if (env.ALLOWED_ORIGINS) {
    const allowed = env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.includes(origin)) {
      return origin;
    }
  }

  // Allow local split-server dev (e.g. Vite on 3000/5173 -> Wrangler dev on 8787)
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }

  return null;
}

function withCorsHeaders(response: Response, allowedOrigin: string | null): Response {
  if (!allowedOrigin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Workspace-Token');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export { apiApp, getLocalSqliteDb, LocalSqliteD1Adapter };
export type { DbClient };

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const allowedOrigin = resolveAllowedOrigin(request, env);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      if (!allowedOrigin) {
        return new Response(null, { status: 403 });
      }
      return withCorsHeaders(new Response(null, { status: 204 }), allowedOrigin);
    }

    if (url.pathname.startsWith('/api/')) {
      const db = resolveD1Binding(env);
      if (!db) {
        return withCorsHeaders(
          new Response(
            JSON.stringify({
              error:
                'Base de données Cloudflare D1 non liée (attendu : binding "DB" ou "ma_base_de_donnees" dans wrangler.toml).',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            }
          ),
          allowedOrigin
        );
      }

      const apiRes = await apiApp.fetch(request, {
        DB: db,
        SESSION_SECRET: env.SESSION_SECRET,
      });
      return withCorsHeaders(apiRes, allowedOrigin);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return withCorsHeaders(
        new Response(
          JSON.stringify({
            ok: true,
            service: 'furex-erp-api',
            runtime: 'cloudflare-worker',
            databaseBound: Boolean(resolveD1Binding(env)),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        ),
        allowedOrigin
      );
    }

    return new Response('Not Found', { status: 404 });
  },
};
