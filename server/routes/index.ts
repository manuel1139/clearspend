import type { Express } from 'express';
import type sql from 'mssql';
import { createCategoriesRouter } from './categories.js';
import { createKontoEntriesRouter } from './kontoEntries.js';
import { createPaymentRulesRouter } from './paymentRules.js';
import { createReceiptsRouter } from './receipts.js';
import { createSettingsRouter } from './settings.js';

export function registerApiRoutes(app: Express, pool: sql.ConnectionPool) {
  app.use('/api/settings', createSettingsRouter(pool));
  app.use('/api/categories', createCategoriesRouter(pool));
  app.use('/api/payment-rules', createPaymentRulesRouter(pool));
  app.use('/api/receipts', createReceiptsRouter(pool));
  app.use('/api/konto-entries', createKontoEntriesRouter(pool));
}
