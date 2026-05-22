import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createViteConfig } from '../shared/viteConfig.js';
import { initializeDatabase } from './database.js';
import { findRepoRoot } from './paths.js';
import { registerApiRoutes } from './routes/index.js';

export async function createApp(connectionString: string) {
  const app = express();
  const pool = await initializeDatabase(connectionString);
  const repoRoot = findRepoRoot();

  app.use(express.json({ limit: '10mb' }));
  registerApiRoutes(app, pool);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      ...createViteConfig('development'),
      configFile: false,
      root: repoRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(repoRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return { app, pool };
}
