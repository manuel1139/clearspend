import { Router } from 'express';
import type sql from 'mssql';
import { getBudget, updateBudget } from '../database.js';

export function createSettingsRouter(pool: sql.ConnectionPool) {
  const router = Router();

  router.get('/budget', async (_req, res) => {
    try {
      res.json({ budget: await getBudget(pool) });
    } catch {
      res.status(500).json({ error: 'Failed to load budget' });
    }
  });

  router.post('/budget', async (req, res) => {
    try {
      const { budget } = req.body;
      await updateBudget(pool, budget);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to save budget' });
    }
  });

  return router;
}
