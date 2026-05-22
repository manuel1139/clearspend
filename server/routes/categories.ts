import { Router } from 'express';
import type sql from 'mssql';
import type { ReceiptCategory } from '../../shared/types.js';
import {
  countReceiptsByCategory,
  deleteCategory,
  listReceiptCategories,
  saveCategory,
} from '../database.js';

export function createCategoriesRouter(pool: sql.ConnectionPool) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      res.json(await listReceiptCategories(pool));
    } catch {
      res.status(500).json({ error: 'Failed to load categories' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { category } = req.body as {
        category: Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>;
      };
      const normalizedName = category.name.trim();

      if (!normalizedName) {
        return res.status(400).json({ error: 'Category name is required.' });
      }

      const savedCategory = await saveCategory(pool, {
        ...category,
        name: normalizedName,
      });

      return res.status(category.id ? 200 : 201).json(savedCategory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save category' });
    }
  });

  router.delete('/:id', async (req, res) => {
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

  return router;
}
