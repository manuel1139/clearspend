import type { Express } from 'express';
import type sql from 'mssql';
import { createAzureRouter } from './azure.js';
import { createCategoriesRouter } from './categories.js';
import { createGeminiRouter } from './gemini.js';
import { createImportsRouter } from './imports.js';
import { createKontoRouter } from './konto.js';
import { createKontoEntriesRouter } from './kontoEntries.js';
import { createPaymentRulesRouter } from './paymentRules.js';
import { createReceiptsRouter } from './receipts.js';
import { createSettingsRouter } from './settings.js';
import type { AzureService } from '../azureService.js';
import type { GeminiService } from '../geminiService.js';

export function registerApiRoutes(
  app: Express,
  pool: sql.ConnectionPool,
  azureService: AzureService,
  geminiService: GeminiService,
) {
  app.use('/api/azure', createAzureRouter(azureService));
  app.use('/api/gemini', createGeminiRouter(geminiService));
  app.use('/api/imports', createImportsRouter(pool, geminiService));
  app.use('/api/konto', createKontoRouter(pool, geminiService));
  app.use('/api/settings', createSettingsRouter(pool));
  app.use('/api/categories', createCategoriesRouter(pool));
  app.use('/api/payment-rules', createPaymentRulesRouter(pool));
  app.use('/api/receipts', createReceiptsRouter(pool));
  app.use('/api/konto-entries', createKontoEntriesRouter(pool));
}
