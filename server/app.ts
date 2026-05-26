import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createViteConfig } from '../shared/viteConfig.js';
import { initializeDatabase } from './database.js';
import { findRepoRoot } from './paths.js';
import { registerApiRoutes } from './routes/index.js';
import { createAzureService } from './azureService.js';
import { createGeminiService } from './geminiService.js';

export async function createApp(connectionString: string) {
  const app = express();
  const pool = await initializeDatabase(connectionString);
  const repoRoot = findRepoRoot();

  app.use(express.json({ limit: '50mb' }));

  const azureService = createAzureService();
  const geminiService = createGeminiService(process.env.GEMINI_API_KEY);

  registerApiRoutes(app, pool, azureService, geminiService);

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      return res.status(413).json({
        error: 'Import file is too large. Please try a smaller ZIP export.',
      });
    }

    return next(error);
  });

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
