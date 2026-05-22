import { GoogleGenAI, Type } from '@google/genai';
import type { ScannedReceipt } from '../types';

const API_KEY = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

export function getAI() {
  if (!ai) {
    if (!API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined');
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
}

function buildReceiptListSchema(categoryNames: string[]) {
  const categoryProperty = categoryNames.length
    ? {
        type: Type.STRING,
        enum: categoryNames,
        description: 'Primaere Kategorie fuer die Ausgabe',
      }
    : {
        type: Type.STRING,
        description: 'Primaere Kategorie fuer die Ausgabe',
      };

  return {
    type: Type.OBJECT,
    properties: {
      receipts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            merchant: {
              type: Type.STRING,
              description: 'Name of the store or provider',
            },
            date: {
              type: Type.STRING,
              description:
                'Receipt purchase date normalized as YYYY-MM-DD. Use an empty string only if no receipt date is visible.',
            },
            total: { type: Type.NUMBER, description: 'Total amount paid' },
            currency: {
              type: Type.STRING,
              description: 'Currency code (e.g. USD, EUR)',
            },
            category: categoryProperty,
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  quantity: { type: Type.NUMBER },
                  imageUrl: {
                    type: Type.STRING,
                    description: 'URL to the item image if found in the source text',
                  },
                },
              },
            },
            box_2d: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description:
                'Bounding box of the specific receipt in the format [ymin, xmin, ymax, xmax] normalized to 0-1000',
            },
          },
          required: ['merchant', 'date', 'total', 'category'],
        },
        description: 'List of receipts found in the image or text',
      },
    },
    required: ['receipts'],
  };
}

export async function scanReceipt(
  base64Image: string,
  mimeType: string,
  categoryNames: string[],
): Promise<ScannedReceipt[]> {
  const ai = getAI();
  const categoryList = categoryNames.join(', ');

  const prompt = `Analysiere dieses Bild. Es kann einen oder mehrere Belege enthalten.
  Lies das Kaufdatum/Rechnungsdatum direkt vom Beleg aus und gib es als YYYY-MM-DD zurueck.
  Wenn mehrere Daten sichtbar sind, verwende das Datum der Transaktion/des Einkaufs, nicht das Druckdatum, Upload-Datum oder heutige Datum.
  Wenn nur ein deutsches Datum wie 12.05.2026 sichtbar ist, normalisiere es zu 2026-05-12.
  Wenn kein Belegdatum lesbar ist, gib date als leeren String zurueck.
  Extrahiere die Informationen fuer jeden gefundenen Beleg.
  Gib den Begrenzungsrahmen ([ymin, xmin, ymax, xmax]) fuer jeden erkannten Beleg an.
  Sei so genau wie moeglich. Wenn ein Wert fehlt, gib eine plausible Schaetzung ab oder lasse ihn null.
  Kategorisiere jede Ausgabe in eine der folgenden Kategorien: ${categoryList || 'Sonstiges'}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [{ text: prompt }, { inlineData: { data: base64Image, mimeType } }],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: buildReceiptListSchema(categoryNames),
    },
  });

  const parsed = JSON.parse(response.text!) as { receipts: ScannedReceipt[] };
  return parsed.receipts;
}

export async function parseOrderText(
  text: string,
  categoryNames: string[],
): Promise<ScannedReceipt[]> {
  const ai = getAI();
  const categoryList = categoryNames.join(', ');

  const prompt = `Analysiere diesen Text, der eine oder mehrere Bestellungen oder Quittungsinformationen enthaelt.
  Extrahiere alle Details wie Haendler, Datum (YYYY-MM-DD), Gesamtbetrag, Waehrung und einzelne Posten.
  Suche bei den Posten auch nach Bild-URLs, falls diese im Text enthalten sind.
  Kategorisiere die Ausgabe in: ${categoryList || 'Sonstiges'}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [{ text: prompt }, { text }],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: buildReceiptListSchema(categoryNames),
    },
  });

  const parsed = JSON.parse(response.text!) as { receipts: ScannedReceipt[] };
  return parsed.receipts;
}
