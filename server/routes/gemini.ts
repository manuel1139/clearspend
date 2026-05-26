import { Router } from 'express';
import type { GeminiService } from '../geminiService.js';

export function createGeminiRouter(geminiService: GeminiService) {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json(geminiService.getStatus());
  });

  router.post('/:action', async (req, res) => {
    const { action } = req.params;
    const { base64Image, mimeType, categoryNames, text } = req.body as {
      base64Image?: string;
      mimeType?: string;
      categoryNames?: string[];
      text?: string;
    };

    try {
      res.json(
        await geminiService.runReceiptAction({
          action,
          base64Image,
          mimeType,
          categoryNames: categoryNames || [],
          text,
        }),
      );
    } catch (error: unknown) {
      console.error('Gemini error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to process request';
      res
        .status(message === 'Gemini is not configured' ? 503 : 500)
        .json({ error: message });
    }
  });

  return router;
}
