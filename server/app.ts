import express from 'express';
import path from 'path';
import { GoogleGenerativeAI, SchemaType, Content, Schema } from '@google/generative-ai';
import { createServer as createViteServer } from 'vite';
import { createViteConfig } from '../shared/viteConfig.js';
import { initializeDatabase } from './database.js';
import { findRepoRoot } from './paths.js';
import { registerApiRoutes } from './routes/index.js';

function buildReceiptListSchema(categoryNames: string[]): Schema {
  const categoryProperty: Schema = (categoryNames.length
    ? {
        type: SchemaType.STRING,
        enum: categoryNames,
        description: 'Primaere Kategorie fuer die Ausgabe',
      }
    : {
        type: SchemaType.STRING,
        description: 'Primaere Kategorie fuer die Ausgabe',
      }) as Schema;

  return {
    type: SchemaType.OBJECT,
    properties: {
      receipts: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            merchant: { 
              type: SchemaType.STRING, 
              description: 'Name of the store or provider' 
            },
            date: { 
              type: SchemaType.STRING, 
              description: 'Receipt purchase date normalized as YYYY-MM-DD. Use an empty string only if no receipt date is visible.' 
            },
            total: { 
              type: SchemaType.NUMBER, 
              description: 'Total amount paid' 
            },
            currency: { 
              type: SchemaType.STRING, 
              description: 'Currency code (e.g. USD, EUR)' 
            },
            category: categoryProperty,
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  price: { type: SchemaType.NUMBER },
                  quantity: { type: SchemaType.NUMBER },
                  imageUrl: { 
                    type: SchemaType.STRING, 
                    description: 'URL to the item image if found in the source text' 
                  },
                },
              },
            },
            tags: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING },
              description: 'Optional list of tags to persist with the receipt, such as source labels or order identifiers.'
            },
            box_2d: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.NUMBER },
              description: 'Bounding box of the specific receipt in the format [ymin, xmin, ymax, xmax] normalized to 0-1000'
            },
          },
          required: ['merchant', 'date', 'total', 'category'],
        },
      },
    },
    required: ['receipts'],
  };
}

export async function createApp(connectionString: string) {
  const app = express();
  const pool = await initializeDatabase(connectionString);
  const repoRoot = findRepoRoot();

  app.use(express.json({ limit: '50mb' }));

  const ai = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

  app.get('/api/gemini/status', (_req, res) => {
    res.json({ configured: !!process.env.GEMINI_API_KEY });
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
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let contents: Content[];

    if (action === 'scan') {
      if (!base64Image || !mimeType) {
        return res.status(400).json({ error: 'Image data and MIME type are required for scanning.' });
      }

      const prompt = `Analysiere dieses Bild. Es kann einen oder mehrere Belege enthalten.
      Lies das Kaufdatum/Rechnungsdatum direkt vom Beleg aus und gib es als YYYY-MM-DD zurueck.
      Wenn mehrere Daten sichtbar sind, verwende das Datum der Transaktion/des Einkaufs, nicht das Druckdatum, Upload-Datum oder heutige Datum.
      Wenn nur ein deutsches Datum wie 12.05.2026 sichtbar ist, normalisiere es zu 2026-05-12.
      Wenn kein Belegdatum lesbar ist, gib date als leeren String zurueck.
      Extrahiere die Informationen fuer jeden gefundenen Beleg.
      Gib den Begrenzungsrahmen ([ymin, xmin, ymax, xmax]) fuer jeden erkannten Beleg an.
      Sei so genau wie moeglich. Wenn ein Wert fehlt, gib eine plausible Schaetzung ab oder lasse ihn null.
      Kategorisiere jede Ausgabe in eine der folgenden Kategorien: ${(categoryNames || []).join(', ') || 'Sonstiges'}.`;
      contents = [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: base64Image, mimeType } }] }];
    } else if (action === 'parse-text') {
      const prompt = `Analysiere diesen Text, der eine oder mehrere Bestellungen oder Quittungsinformationen enthaelt.
      Extrahiere alle Details wie Haendler, Datum (YYYY-MM-DD), Gesamtbetrag, Waehrung und einzelne Posten.
      Suche bei den Posten auch nach Bild-URLs, falls diese im Text enthalten sind.
      Kategorisiere die Ausgabe in: ${(categoryNames || []).join(', ') || 'Sonstiges'}.`;
      contents = [{ role: 'user', parts: [{ text: prompt }, { text: text || '' }] }];
    } else if (action === 'parse-csv') {
      const prompt = `Analysiere diese Amazon-Bestellhistorie im CSV-Format.
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
      contents = [{ role: 'user', parts: [{ text: prompt }, { text: text || '' }] }];
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    try {
      const response = await model.generateContent({
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: buildReceiptListSchema(categoryNames || []),
        },
      });
      const rawResponse = response.response.text();
      try {
        res.json(JSON.parse(rawResponse));
      } catch (error: unknown) {
        console.error('Failed to parse Gemini JSON:', rawResponse, error);
        res.status(500).json({ error: 'Invalid AI response format' });
      }
    } catch (error: unknown) {
      console.error('Gemini error:', error);
      res.status(500).json({ error: 'Failed to process request' });
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
