import { Router } from 'express';
import type sql from 'mssql';
import {
  listPaymentRules,
  listReceiptCategories,
  listReceipts,
  saveKontoEntries,
  saveReceipt,
  updateKontoEntryCategory,
} from '../database.js';
import type { GeminiService } from '../geminiService.js';
import { parseAmazonOrdersCsv } from '../amazonImport.js';
import { parseCamtZipBase64 } from '../kontoImport.js';

export function createImportsRouter(
  pool: sql.ConnectionPool,
  geminiService: GeminiService,
) {
  const router = Router();

  router.post('/amazon-csv', async (req, res) => {
    const { csvText } = req.body as { csvText: string };

    try {
      const [categories, paymentRules, existingReceipts] = await Promise.all([
        listReceiptCategories(pool),
        listPaymentRules(pool),
        listReceipts(pool),
      ]);

      const defaultRule =
        paymentRules.find((rule) => rule.frequency === 'one_time') ||
        paymentRules[0];
      const { receipts, skippedCount } = parseAmazonOrdersCsv(
        csvText,
        existingReceipts,
        categories,
        defaultRule,
      );

      const savedReceipts = [];
      for (const receipt of receipts) {
        savedReceipts.push(await saveReceipt(pool, receipt));
      }

      res.json({
        savedReceipts,
        summary: { imported: savedReceipts.length, skipped: skippedCount },
      });
    } catch (error) {
      console.error('Amazon CSV import error:', error);
      res.status(500).json({ error: 'Failed to process CSV import' });
    }
  });

  router.post('/konto-zip', async (req, res) => {
    const { fileName, base64 } = req.body as { fileName: string; base64: string };

    try {
      const { entries, detectedFormats } = await parseCamtZipBase64(fileName, base64);
      const savedEntries = await saveKontoEntries(pool, entries);

      const uncategorized = savedEntries.filter((entry) => !entry.categoryId);
      if (geminiService.isConfigured() && uncategorized.length > 0) {
        const categories = await listReceiptCategories(pool);

        try {
          const { results } = await geminiService.categorizeKontoEntries(
            'auto-categorize-zip',
            uncategorized,
            categories,
          );

          for (const result of results) {
            const matchedCategory = categories.find(
              (category) => category.name === result.category,
            );
            if (matchedCategory) {
              await updateKontoEntryCategory(
                pool,
                result.id,
                matchedCategory.id,
                'ai-generated',
              );
            }
          }

          const refreshedEntries = await saveKontoEntries(pool, entries);
          savedEntries.length = 0;
          savedEntries.push(...refreshedEntries);
        } catch (aiError) {
          console.error('AI Auto-categorization failed:', aiError);
          const sonstiges = categories.find((category) => category.name === 'Sonstiges');
          if (sonstiges) {
            for (const entry of uncategorized) {
              await updateKontoEntryCategory(
                pool,
                entry.id,
                sonstiges.id,
                'by-filter',
              );
            }
          }
        }
      }

      const existingReceipts = await listReceipts(pool);
      const updatedReceipts = [];

      for (const receipt of existingReceipts) {
        if (receipt.kontoEntryId) {
          continue;
        }

        const match = savedEntries.find(
          (entry) =>
            Math.abs(entry.amount - receipt.total) < 0.01 &&
            entry.bookingDate === receipt.date,
        );

        if (match) {
          const saved = await saveReceipt(pool, {
            ...receipt,
            kontoEntryId: match.id,
            kontoReference: match.reference,
          });
          if (saved) {
            updatedReceipts.push(saved);
          }
        }
      }

      res.json({
        savedReceipts: updatedReceipts,
        summary: {
          imported: savedEntries.length,
          skipped: entries.length - savedEntries.length,
        },
        detectedFormats,
      });
    } catch (error) {
      console.error('Konto ZIP import error:', error);
      res.status(500).json({ error: 'Failed to process Konto ZIP import' });
    }
  });

  return router;
}
