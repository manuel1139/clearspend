import { Router } from 'express';
import type { AzureService } from '../azureService.js';

export function createAzureRouter(azureService: AzureService) {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json(azureService.getStatus());
  });

  router.post('/scan', async (req, res) => {
    const { fileName, base64 } = req.body as {
      fileName?: string;
      base64?: string;
    };

    if (!base64) {
      return res
        .status(400)
        .json({ error: 'Image data is required for Azure receipt scanning.' });
    }

    try {
      return res.json(await azureService.scanReceipt({ fileName, base64 }));
    } catch (error: unknown) {
      console.error('Azure receipt scan error:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to analyze receipt with Azure';

      return res
        .status(message === 'Azure receipt analysis is not configured' ? 503 : 500)
        .json({ error: message });
    }
  });

  return router;
}
