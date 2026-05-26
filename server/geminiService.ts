import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { buildReceiptListSchema } from './geminiSchema.js';
import type { KontoEntry, ReceiptCategory } from '../shared/types.js';

const GEMINI_MODEL = 'gemini-2.0-flash';
const MAX_HISTORY_ENTRIES = 20;

export interface GeminiHistoryEntry {
  action: string;
  prompt: string;
  response: string;
  timestamp: string;
}

export interface GeminiDebugStatus {
  configured: boolean;
  apiKey: string | null;
  detectedKeys: string[];
  aiHistory: GeminiHistoryEntry[];
}

export interface GeminiService {
  isConfigured(): boolean;
  getStatus(): GeminiDebugStatus;
  runReceiptAction(request: GeminiReceiptRequest): Promise<unknown>;
  categorizeKontoEntries(
    action: string,
    entries: KontoEntry[],
    categories: ReceiptCategory[],
  ): Promise<{ results: { id: string; category: string }[] }>;
}

interface GeminiReceiptRequest {
  action: string;
  categoryNames: string[];
  base64Image?: string;
  mimeType?: string;
  text?: string;
}

interface GeminiReceiptActionInput {
  contents: Content[];
  prompt: string;
}

function sanitizeJsonResponse(text: string) {
  return text.replace(/```json|```/g, '').trim();
}

function buildScanPrompt(categoryNames: string[]) {
  return `Analysiere dieses Bild. Es kann einen oder mehrere Belege enthalten.
Lies das Kaufdatum/Rechnungsdatum direkt vom Beleg aus und gib es als YYYY-MM-DD zurueck.
Wenn mehrere Daten sichtbar sind, verwende das Datum der Transaktion/des Einkaufs, nicht das Druckdatum, Upload-Datum oder heutige Datum.
Wenn nur ein deutsches Datum wie 12.05.2026 sichtbar ist, normalisiere es zu 2026-05-12.
Wenn kein Belegdatum lesbar ist, gib date als leeren String zurueck.
Extrahiere die Informationen fuer jeden gefundenen Beleg.
Gib den Begrenzungsrahmen ([ymin, xmin, ymax, xmax]) fuer jeden erkannten Beleg an.
Sei so genau wie moeglich. Wenn ein Wert fehlt, gib eine plausible Schaetzung ab oder lasse ihn null.
Kategorisiere jede Ausgabe in eine der folgenden Kategorien: ${categoryNames.join(', ') || 'Sonstiges'}.`;
}

function buildParseTextPrompt(categoryNames: string[]) {
  return `Analysiere diesen Text, der eine oder mehrere Bestellungen oder Quittungsinformationen enthaelt.
Extrahiere alle Details wie Haendler, Datum (YYYY-MM-DD), Gesamtbetrag, Waehrung und einzelne Posten.
Suche bei den Posten auch nach Bild-URLs, falls diese im Text enthalten sind.
Kategorisiere die Ausgabe in: ${categoryNames.join(', ') || 'Sonstiges'}.`;
}

function buildParseCsvPrompt(categoryNames: string[]) {
  return `Analysiere diese Amazon-Bestellhistorie im CSV-Format.
Die Daten koennen mehrere Zeilen pro Bestellung enthalten.
Gruppiere Zeilen mit derselben Order ID zu genau einer Bestellung.
Ignoriere stornierte Bestellungen.
Ignoriere ausserdem Bestellungen oder Positionen, wenn klar ist, dass sie zurueckgesendet und erstattet wurden.
Fuehre identische Produkte innerhalb derselben Bestellung nur einmal auf und vermeide doppelte items in der Ausgabe.
Extrahiere fuer jede Bestellung:
merchant, date als YYYY-MM-DD, total, currency, category und items.
Verwende als merchant den Amazon-Marktplatz aus der CSV, zum Beispiel Amazon.de. Wenn nichts klar ist, verwende Amazon.
Fuer items extrahiere Produktname, Preis und Menge, wenn vorhanden.
Kategorisiere jede Bestellung in eine der folgenden Kategorien: ${categoryNames.join(', ') || 'Sonstiges'}.
Fuege im Feld tags immer "Amazon CSV" hinzu.
Wenn eine Order ID vorhanden ist, fuege zusaetzlich einen Tag im Format "Order: <id>" hinzu.`;
}

function buildBankCategorizationPrompt(
  categoryNames: string[],
  entries: KontoEntry[],
) {
  return `Kategorisiere diese Banktransaktionen in folgende Kategorien: ${categoryNames.join(', ')}.
Partner: {counterpartyName}, Referenz: {reference}.
Antworte NUR mit einem JSON-Objekt: { "results": [{ "id": "...", "category": "Kategoriename" }] }

Transaktionen:
${entries.map((entry) => `ID: ${entry.id}, Partner: ${entry.counterpartyName}, Ref: ${entry.reference}`).join('\n')}`;
}

function createReceiptActionInput(
  request: GeminiReceiptRequest,
): GeminiReceiptActionInput {
  switch (request.action) {
    case 'scan': {
      if (!request.base64Image || !request.mimeType) {
        throw new Error('Image data and MIME type are required for scanning.');
      }

      const prompt = buildScanPrompt(request.categoryNames);
      return {
        prompt,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: request.base64Image,
                  mimeType: request.mimeType,
                },
              },
            ],
          },
        ],
      };
    }
    case 'parse-text': {
      const prompt = buildParseTextPrompt(request.categoryNames);
      return {
        prompt,
        contents: [{ role: 'user', parts: [{ text: prompt }, { text: request.text || '' }] }],
      };
    }
    case 'parse-csv': {
      const prompt = buildParseCsvPrompt(request.categoryNames);
      return {
        prompt,
        contents: [{ role: 'user', parts: [{ text: prompt }, { text: request.text || '' }] }],
      };
    }
    default:
      throw new Error('Invalid action');
  }
}

export function createGeminiService(apiKey: string | undefined): GeminiService {
  const trimmedApiKey = apiKey?.trim() || null;
  const ai = trimmedApiKey ? new GoogleGenerativeAI(trimmedApiKey) : null;
  const aiHistory: GeminiHistoryEntry[] = [];

  const addToHistory = (action: string, prompt: string, response: string) => {
    aiHistory.push({
      action,
      prompt,
      response,
      timestamp: new Date().toISOString(),
    });

    if (aiHistory.length > MAX_HISTORY_ENTRIES) {
      aiHistory.shift();
    }
  };

  const requireModel = () => {
    if (!ai) {
      throw new Error('Gemini is not configured');
    }

    return ai.getGenerativeModel({ model: GEMINI_MODEL });
  };

  return {
    isConfigured() {
      return !!trimmedApiKey;
    },

    getStatus(): GeminiDebugStatus {
      return {
        configured: !!trimmedApiKey,
        apiKey: trimmedApiKey,
        detectedKeys: Object.keys(process.env).filter((key) => /gemini|gemniy/i.test(key)),
        aiHistory,
      };
    },

    async runReceiptAction(request: GeminiReceiptRequest) {
      const model = requireModel();
      const { prompt, contents } = createReceiptActionInput(request);

      console.log(`[Gemini Request - ${request.action}]`, prompt);
      const response = await model.generateContent({
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: buildReceiptListSchema(request.categoryNames),
        },
      });
      const rawResponse = response.response.text();
      console.log(`[Gemini Response - ${request.action}]`, rawResponse);

      addToHistory(request.action, prompt, rawResponse);
      return JSON.parse(rawResponse);
    },

    async categorizeKontoEntries(action: string, entries: KontoEntry[], categories: ReceiptCategory[]) {
      const model = requireModel();
      const prompt = buildBankCategorizationPrompt(
        categories.map((category) => category.name),
        entries,
      );
      const result = await model.generateContent(prompt);
      const responseText = sanitizeJsonResponse(result.response.text());

      addToHistory(action, prompt, responseText);

      return JSON.parse(responseText) as {
        results: { id: string; category: string }[];
      };
    },
  };
}
