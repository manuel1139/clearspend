import { Router } from 'express';
import type sql from 'mssql';
import type { Receipt } from '../../shared/types.js';
import { deleteReceipt, listReceipts, saveReceipt } from '../database.js';

export function createReceiptsRouter(pool: sql.ConnectionPool) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      res.json(await listReceipts(pool));
    } catch {
      res.status(500).json({ error: 'Failed to read receipts' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { receipt } = req.body as { receipt: Receipt };
      const savedReceipt = await saveReceipt(pool, receipt);
      const isUpdate = receipt.id && !receipt.id.startsWith('temp-');
      return res.status(isUpdate ? 200 : 201).json(savedReceipt);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save receipt' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await deleteReceipt(pool, id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete receipt' });
    }
  });

  return router;
}
