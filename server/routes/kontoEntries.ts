import { Router } from 'express';
import type sql from 'mssql';
import type { KontoEntry } from '../../shared/types.js';
import { listKontoEntries, saveKontoEntries } from '../database.js';
import { parseCamtZipBase64 } from '../kontoImport.js';

export function createKontoEntriesRouter(pool: sql.ConnectionPool) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      res.json(await listKontoEntries(pool));
    } catch {
      res.status(500).json({ error: 'Failed to read konto entries' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { entries } = req.body as { entries: KontoEntry[] };
      res.status(201).json(await saveKontoEntries(pool, entries));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save konto entries' });
    }
  });

  router.post('/import-camt-zip', async (req, res) => {
    try {
      const { fileName, base64 } = req.body as {
        fileName: string;
        base64: string;
      };
      res.json(await parseCamtZipBase64(fileName, base64));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to parse CAMT ZIP import' });
    }
  });

  return router;
}
