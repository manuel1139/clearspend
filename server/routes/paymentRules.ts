import { Router } from 'express';
import type sql from 'mssql';
import { listPaymentRules } from '../database.js';

export function createPaymentRulesRouter(pool: sql.ConnectionPool) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      res.json(await listPaymentRules(pool));
    } catch {
      res.status(500).json({ error: 'Failed to load payment rules' });
    }
  });

  return router;
}
