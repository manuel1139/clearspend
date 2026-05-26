import { Router } from 'express';
import type sql from 'mssql';
import {
  listKontoEntries,
  listReceiptCategories,
  updateKontoEntryCategory,
} from '../database.js';
import type { GeminiService } from '../geminiService.js';

export function createKontoRouter(
  pool: sql.ConnectionPool,
  geminiService: GeminiService,
) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      res.json(await listKontoEntries(pool));
    } catch (error) {
      console.error('Failed to fetch konto entries:', error);
      res.status(500).json({ error: 'Failed to load entries' });
    }
  });

  router.patch('/:id/category', async (req, res) => {
    const { id } = req.params;
    const { categoryId } = req.body as { categoryId: number };

    try {
      await updateKontoEntryCategory(pool, id, categoryId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to update entry category:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  router.post('/categorize-ai', async (_req, res) => {
    if (!geminiService.isConfigured()) {
      return res.status(503).json({ error: 'Gemini is not configured' });
    }

    try {
      const [allEntries, categories] = await Promise.all([
        listKontoEntries(pool),
        listReceiptCategories(pool),
      ]);

      const sonstigesCategory = categories.find(
        (category) => category.name === 'Sonstiges',
      );
      if (!sonstigesCategory) {
        return res
          .status(500)
          .json({ error: '"Sonstiges" category not found' });
      }

      const targetEntries = allEntries.filter(
        (entry) =>
          entry.categoryId === sonstigesCategory.id &&
          entry.categoryType !== 'manually',
      );

      if (targetEntries.length === 0) {
        return res.json({ success: true, updatedCount: 0 });
      }

      const { results } = await geminiService.categorizeKontoEntries(
        'fix-sonstiges-ai',
        targetEntries,
        categories.filter((category) => category.name !== 'Sonstiges'),
      );

      for (const result of results) {
        const matchedCategory = categories.find(
          (category) => category.name === result.category,
        );
        if (matchedCategory && matchedCategory.id !== sonstigesCategory.id) {
          await updateKontoEntryCategory(
            pool,
            result.id,
            matchedCategory.id,
            'ai-generated',
          );
        }
      }

      return res.json({ success: true, updatedCount: results.length });
    } catch (error) {
      console.error('AI manual categorization failed:', error);
      return res.status(500).json({ error: 'Failed to run AI categorization' });
    }
  });

  return router;
}
