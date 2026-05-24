import express from 'express';
import path from 'path';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { createServer as createViteServer } from 'vite';
import { createViteConfig } from '../shared/viteConfig.js';
import { 
  initializeDatabase, 
  listReceiptCategories, 
  listPaymentRules, 
  listKontoEntries,
  listReceipts, 
  saveReceipt, 
  saveKontoEntries,
  updateKontoEntryCategory
} from './database.js';
import { findRepoRoot } from './paths.js';
import { registerApiRoutes } from './routes/index.js';
import { buildReceiptListSchema } from './geminiSchema.js';
import { parseAmazonOrdersCsv } from './amazonImport.js';
import { parseCamtZipBase64 } from './kontoImport.js';

const aiHistory: { action: string; prompt: string; response: string; timestamp: string }[] = [];

const gemini_model = 'gemini-2.0-flash';

function addToHistory(action: string, prompt: string, response: string) {
  aiHistory.push({
    action,
    prompt,
    response,
    timestamp: new Date().toISOString()
  });
  if (aiHistory.length > 20) aiHistory.shift();
}

export async function createApp(connectionString: string) {
  const app = express();
  const pool = await initializeDatabase(connectionString);
  const repoRoot = findRepoRoot();

  app.use(express.json({ limit: '50mb' }));

  // Use the correct environment variable for Gemini
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const ai = apiKey ? new GoogleGenerativeAI(apiKey) : null;

  app.get('/api/gemini/status', (_req, res) => {
    res.json({ 
      configured: !!apiKey, 
      apiKey: apiKey || null,
      detectedKeys: Object.keys(process.env).filter(k => /gemini|gemniy/i.test(k)),
      aiHistory
    });
  });

  app.post('/api/gemini/:action', async (req, res) => {
    if (!ai) return res.status(503).json({ error: 'Gemini is not configured' });
    const { action } = req.params;
    const { base64Image, mimeType, categoryNames, text } = req.body as { 
      base64Image?: string; 
      mimeType?: string; 
      categoryNames?: string[]; 
      text?: string 
    };
    const model = ai.getGenerativeModel({ model: gemini_model });

    let contents: Content[];
    let promptText: string;

    if (action === 'scan') {
      if (!base64Image || !mimeType) {
        return res.status(400).json({ error: 'Image data and MIME type are required for scanning.' });
      }

      promptText = `Analysiere dieses Bild. Es kann einen oder mehrere Belege enthalten.
      Lies das Kaufdatum/Rechnungsdatum direkt vom Beleg aus und gib es als YYYY-MM-DD zurueck.
      Wenn mehrere Daten sichtbar sind, verwende das Datum der Transaktion/des Einkaufs, nicht das Druckdatum, Upload-Datum oder heutige Datum.
      Wenn nur ein deutsches Datum wie 12.05.2026 sichtbar ist, normalisiere es zu 2026-05-12.
      Wenn kein Belegdatum lesbar ist, gib date als leeren String zurueck.
      Extrahiere die Informationen fuer jeden gefundenen Beleg.
      Gib den Begrenzungsrahmen ([ymin, xmin, ymax, xmax]) fuer jeden erkannten Beleg an.
      Sei so genau wie moeglich. Wenn ein Wert fehlt, gib eine plausible Schaetzung ab oder lasse ihn null.
      Kategorisiere jede Ausgabe in eine der folgenden Kategorien: ${(categoryNames || []).join(', ') || 'Sonstiges'}.`;
      contents = [{ role: 'user', parts: [{ text: promptText }, { inlineData: { data: base64Image, mimeType } }] }];
    } else if (action === 'parse-text') {
      promptText = `Analysiere diesen Text, der eine oder mehrere Bestellungen oder Quittungsinformationen enthaelt.
      Extrahiere alle Details wie Haendler, Datum (YYYY-MM-DD), Gesamtbetrag, Waehrung und einzelne Posten.
      Suche bei den Posten auch nach Bild-URLs, falls diese im Text enthalten sind.
      Kategorisiere die Ausgabe in: ${(categoryNames || []).join(', ') || 'Sonstiges'}.`;
      contents = [{ role: 'user', parts: [{ text: promptText }, { text: text || '' }] }];
    } else if (action === 'parse-csv') {
      promptText = `Analysiere diese Amazon-Bestellhistorie im CSV-Format.
      Die Daten koennen mehrere Zeilen pro Bestellung enthalten.
      Gruppiere Zeilen mit derselben Order ID zu genau einer Bestellung.
      Ignoriere stornierte Bestellungen.
      Ignoriere ausserdem Bestellungen oder Positionen, wenn klar ist, dass sie zurueckgesendet und erstattet wurden.
      Fuehre identische Produkte innerhalb derselben Bestellung nur einmal auf und vermeide doppelte items in der Ausgabe.
      Extrahiere fuer jede Bestellung:
      merchant, date als YYYY-MM-DD, total, currency, category und items.
      Verwende als merchant den Amazon-Marktplatz aus der CSV, zum Beispiel Amazon.de. Wenn nichts klar ist, verwende Amazon.
      Fuer items extrahiere Produktname, Preis und Menge, wenn vorhanden.
      Kategorisiere jede Bestellung in eine der folgenden Kategorien: ${(categoryNames || []).join(', ') || 'Sonstiges'}.
      Fuege im Feld tags immer "Amazon CSV" hinzu.
      Wenn eine Order ID vorhanden ist, fuege zusaetzlich einen Tag im Format "Order: <id>" hinzu.`;
      contents = [{ role: 'user', parts: [{ text: promptText }, { text: text || '' }] }];
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    try {
      console.log(`[Gemini Request - ${action}]`, promptText);
      const response = await model.generateContent({
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: buildReceiptListSchema(categoryNames || []),
        },
      });
      const rawResponse = response.response.text();
      console.log(`[Gemini Response - ${action}]`, rawResponse);

      addToHistory(action, promptText, rawResponse);

      try {
        res.json(JSON.parse(rawResponse));
      } catch (error: unknown) {
        console.error('Failed to parse Gemini JSON:', rawResponse, error);
        res.status(500).json({ error: 'Invalid AI response format' });
      }
    } catch (error: unknown) {
      console.error('Gemini error:', error);
      const message = error instanceof Error ? error.message : 'Failed to process request';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/konto', async (_req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const entries = await listKontoEntries(pool);
      res.json(entries);
    } catch (error) {
      console.error('Failed to fetch konto entries:', error);
      res.status(500).json({ error: 'Failed to load entries' });
    }
  });

  app.post('/api/imports/amazon-csv', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { csvText } = req.body as { csvText: string };

    try {
      const [categories, paymentRules, existingReceipts] = await Promise.all([
        listReceiptCategories(pool),
        listPaymentRules(pool),
        listReceipts(pool)
      ]);

      const defaultRule = paymentRules.find(r => r.frequency === 'one_time') || paymentRules[0];
      const { receipts, skippedCount } = parseAmazonOrdersCsv(csvText, existingReceipts, categories, defaultRule);

      const savedReceipts = [];
      for (const receipt of receipts) {
        savedReceipts.push(await saveReceipt(pool, receipt));
      }

      res.json({ savedReceipts, summary: { imported: savedReceipts.length, skipped: skippedCount } });
    } catch (error) {
      console.error('Amazon CSV import error:', error);
      res.status(500).json({ error: 'Failed to process CSV import' });
    }
  });

  app.post('/api/imports/konto-zip', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { fileName, base64 } = req.body as { fileName: string; base64: string };

    try {
      // 1. Parse ZIP and XML via the existing service
      const { entries, detectedFormats } = await parseCamtZipBase64(fileName, base64);
      
      // 2. Persist the entries (Upsert logic)
      const savedEntries = await saveKontoEntries(pool, entries);

      // 3. AI Categorization Fallback for anything not caught by filters
      const uncategorized = savedEntries.filter(e => !e.categoryId);
      if (ai && uncategorized.length > 0) {
        const categories = await listReceiptCategories(pool);
        const categoryNames = categories.map(c => c.name);
        const model = ai.getGenerativeModel({ model: gemini_model });

        const prompt = `Kategorisiere diese Banktransaktionen in folgende Kategorien: ${categoryNames.join(', ')}.
        Partner: {counterpartyName}, Referenz: {reference}.
        Antworte NUR mit einem JSON-Objekt: { "results": [{ "id": "...", "category": "Kategoriename" }] }`;

        try {
          const aiPrompt = `${prompt}\n\nTransaktionen:\n${uncategorized.map(e => `ID: ${e.id}, Partner: ${e.counterpartyName}, Ref: ${e.reference}`).join('\n')}`;
          const result = await model.generateContent(aiPrompt);
          const responseText = result.response.text().replace(/```json|```/g, '').trim();
          const { results } = JSON.parse(responseText) as { results: { id: string; category: string }[] };

          addToHistory('auto-categorize-zip', aiPrompt, responseText);

          for (const res of results) {
            const matchedCat = categories.find(c => c.name === res.category);
            if (matchedCat) {
              await updateKontoEntryCategory(pool, res.id, matchedCat.id, 'ai-generated');
            }
          }
          
          // Refresh internal entries list to reflect AI changes for matching step
          const refreshedEntries = await saveKontoEntries(pool, entries);
          savedEntries.length = 0;
          savedEntries.push(...refreshedEntries);
        } catch (aiError) {
          console.error('AI Auto-categorization failed:', aiError);
          // Fallback to Sonstiges if AI fails completely
          const sonstiges = categories.find(c => c.name === 'Sonstiges');
          if (sonstiges) {
            for (const entry of uncategorized) {
              await updateKontoEntryCategory(pool, entry.id, sonstiges.id, 'by-filter');
            }
          }
        }
      }

      // 4. Perform matching against existing receipts on the server
      const existingReceipts = await listReceipts(pool);
      const updatedReceipts = [];

      for (const receipt of existingReceipts) {
        if (receipt.kontoEntryId) continue;

        // Matching heuristic: Exact amount and matching booking date
        const match = savedEntries.find(e => 
          Math.abs(e.amount - receipt.total) < 0.01 && 
          e.bookingDate === receipt.date
        );

        if (match) {
          const saved = await saveReceipt(pool, {
            ...receipt,
            kontoEntryId: match.id,
            kontoReference: match.reference
          });
          if (saved) updatedReceipts.push(saved);
        }
      }

      res.json({ 
        savedReceipts: updatedReceipts, 
        summary: { imported: savedEntries.length, skipped: entries.length - savedEntries.length },
        detectedFormats 
      });
    } catch (error) {
      console.error('Konto ZIP import error:', error);
      res.status(500).json({ error: 'Failed to process Konto ZIP import' });
    }
  });

  app.patch('/api/konto/:id/category', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
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

  app.post('/api/konto/categorize-ai', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    if (!ai) return res.status(503).json({ error: 'Gemini is not configured' });

    try {
      const [allEntries, categories] = await Promise.all([
        listKontoEntries(pool),
        listReceiptCategories(pool)
      ]);

      const sonstigesCat = categories.find(c => c.name === 'Sonstiges');
      if (!sonstigesCat) return res.status(500).json({ error: '"Sonstiges" category not found' });

      const targetEntries = allEntries.filter(e => 
        e.categoryId === sonstigesCat.id && e.categoryType !== 'manually'
      );

      if (targetEntries.length === 0) {
        return res.json({ success: true, updatedCount: 0 });
      }

      const categoryNames = categories.map(c => c.name).filter(n => n !== 'Sonstiges');
      const model = ai.getGenerativeModel({ model: gemini_model });

      const prompt = `Kategorisiere diese Banktransaktionen in folgende Kategorien: ${categoryNames.join(', ')}. Partner: {counterpartyName}, Referenz: {reference}. Antworte NUR mit einem JSON-Objekt: { "results": [{ "id": "...", "category": "Kategoriename" }] }
      
      Transaktionen:
      ${targetEntries.map(e => `ID: ${e.id}, Partner: ${e.counterpartyName}, Ref: ${e.reference}`).join('\n')}`;

      const aiResult = await model.generateContent(prompt);
      const responseText = aiResult.response.text().replace(/```json|```/g, '').trim();
      const { results } = JSON.parse(responseText) as { results: { id: string; category: string }[] };

      addToHistory('fix-sonstiges-ai', prompt, responseText);

      for (const resItem of results) {
        const matchedCat = categories.find(c => c.name === resItem.category);
        if (matchedCat && matchedCat.id !== sonstigesCat.id) {
          await updateKontoEntryCategory(pool, resItem.id, matchedCat.id, 'ai-generated');
        }
      }

      res.json({ success: true, updatedCount: results.length });
    } catch (error) {
      console.error('AI manual categorization failed:', error);
      res.status(500).json({ error: 'Failed to run AI categorization' });
    }
  });

  registerApiRoutes(app, pool);

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      return res.status(413).json({
        error: 'Import file is too large. Please try a smaller ZIP export.',
      });
    }

    return next(error);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      ...createViteConfig('development'),
      configFile: false,
      root: repoRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(repoRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return { app, pool };
}
