import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { apiApp } from './server/index.ts';
import { getLocalSqliteDb } from './server/db/sqliteAdapter.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const db = getLocalSqliteDb();
  const app = express();

  app.disable('x-powered-by');

  // Bridge all /api/* requests to the Web-Standard Hono Worker API
  app.use('/api', async (req, res) => {
    try {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `127.0.0.1:${PORT}`;
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (val === undefined) continue;
        if (Array.isArray(val)) {
          val.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, val);
        }
      }

      let bodyBuffer: Buffer | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (chunks.length > 0) {
          bodyBuffer = Buffer.concat(chunks);
        }
      }

      const webReq = new Request(fullUrl, {
        method: req.method,
        headers,
        body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
      });

      const workerRes = await apiApp.fetch(webReq, {
        DB: db,
        SESSION_SECRET: process.env.SESSION_SECRET,
      });

      res.status(workerRes.status);
      workerRes.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'transfer-encoding') return;
        res.setHeader(key, value);
      });

      const arrayBuf = await workerRes.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (err) {
      console.error('Express API bridge error:', err);
      res.status(500).json({ error: 'Erreur passerelle serveur.' });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build dist/index.html manquant. Exécutez npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FUREX ERP Server running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FUREX ERP server:', err);
  process.exit(1);
});
