import { apiApp } from './server/api.ts';
import { DbClient } from './server/db/types.ts';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareWorkerEnv {
  DB: DbClient;
  SESSION_SECRET?: string;
  ASSETS?: AssetsBinding;
}

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return apiApp.fetch(request, {
        DB: env.DB,
        SESSION_SECRET: env.SESSION_SECRET,
      });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
