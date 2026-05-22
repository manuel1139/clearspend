import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type { Receipt, ReceiptCategory } from './src/types';
import {
  countReceiptsByCategory,
  deleteCategory,
  deleteReceipt,
  getBudget,
  initializeDatabase,
  listPaymentRules,
  listReceiptCategories,
  listReceipts,
  saveCategory,
  saveReceipt,
  updateBudget,
} from './src/server/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envMode =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';

dotenv.config({ path: path.resolve(process.cwd(), `.env.${envMode}`) });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      `AZURE_SQL_CONNECTION_STRING is required in .env.${envMode} or the process environment`,
    );
  }

  const pool = await initializeDatabase(connectionString);
  console.log('Connected to Azure SQL Database');

  app.get('/api/settings/budget', async (_req, res) => {
    try {
      res.json({ budget: await getBudget(pool) });
    } catch {
      res.status(500).json({ error: 'Failed to load budget' });
    }
  });

  app.post('/api/settings/budget', async (req, res) => {
    try {
      const { budget } = req.body;
      await updateBudget(pool, budget);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to save budget' });
    }
  });

  app.get('/api/categories', async (_req, res) => {
    try {
      res.json(await listReceiptCategories(pool));
    } catch {
      res.status(500).json({ error: 'Failed to load categories' });
    }
  });

  app.get('/api/payment-rules', async (_req, res) => {
    try {
      res.json(await listPaymentRules(pool));
    } catch {
      res.status(500).json({ error: 'Failed to load payment rules' });
    }
  });

  app.post('/api/categories', async (req, res) => {
    try {
      const { category } = req.body as {
        category: Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>;
      };
      const normalizedName = category.name.trim();

      if (!normalizedName) {
        return res.status(400).json({ error: 'Category name is required.' });
      }
      const savedCategory = await saveCategory(pool, { ...category, name: normalizedName });
      return res.status(category.id ? 200 : 201).json(savedCategory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save category' });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const usageCount = await countReceiptsByCategory(pool, id);

      if (usageCount > 0) {
        return res.status(409).json({
          error: 'This category is still assigned to receipts and cannot be deleted.',
        });
      }

      await deleteCategory(pool, id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  app.get('/api/receipts', async (_req, res) => {
    try {
      res.json(await listReceipts(pool));
    } catch {
      res.status(500).json({ error: 'Failed to read receipts' });
    }
  });

  app.post('/api/receipts', async (req, res) => {
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

  app.delete('/api/receipts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await deleteReceipt(pool, id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete receipt' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
