import { GoogleGenAI, Type } from "@google/genai";
import type { ScannedReceipt } from "../types";

const API_KEY = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

export function getAI() {
  if (!ai) {
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
}

export const ReceiptSchema = {
  type: Type.OBJECT,
  properties: {
    merchant: { type: Type.STRING, description: "Name of the store or provider" },
    date: { type: Type.STRING, description: "Receipt purchase date normalized as YYYY-MM-DD. Use an empty string only if no receipt date is visible." },
    total: { type: Type.NUMBER, description: "Total amount paid" },
    currency: { type: Type.STRING, description: "Currency code (e.g. USD, EUR)" },
    category: { 
      type: Type.STRING, 
      enum: ["Essen", "Verkehr", "Einkaufen", "Unterhaltung", "Gesundheit", "Nebenkosten", "Lionas", "Malias", "Sonstiges"],
      description: "Primäre Kategorie für die Ausgabe" 
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          price: { type: Type.NUMBER },
          quantity: { type: Type.NUMBER },
          imageUrl: { type: Type.STRING, description: "URL to the item image if found in the source text" }
        }
      }
    },
    box_2d: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Begrenzungsrahmen des spezifischen Belegs im Format [ymin, xmin, ymax, xmax] (normalisiert 0-1000)"
    }
  },
  required: ["merchant", "date", "total", "category"]
};

export const ReceiptListSchema = {
  type: Type.OBJECT,
  properties: {
    receipts: {
      type: Type.ARRAY,
      items: ReceiptSchema,
      description: "Liste aller im Bild gefundenen Belege"
    }
  },
  required: ["receipts"]
};

export async function scanReceipt(base64Image: string, mimeType: string): Promise<ScannedReceipt[]> {
  const ai = getAI();
  
  const prompt = `Analysiere dieses Bild. Es kann einen oder mehrere Belege enthalten.
  Lies das Kaufdatum/Rechnungsdatum direkt vom Beleg aus und gib es als YYYY-MM-DD zurueck.
  Wenn mehrere Daten sichtbar sind, verwende das Datum der Transaktion/des Einkaufs, nicht das Druckdatum, Upload-Datum oder heutige Datum.
  Wenn nur ein deutsches Datum wie 12.05.2026 sichtbar ist, normalisiere es zu 2026-05-12.
  Wenn kein Belegdatum lesbar ist, gib date als leeren String zurueck.
  Extrahiere die Informationen für jeden gefundenen Beleg.
  Geben Sie den Begrenzungsrahmen ([ymin, xmin, ymax, xmax]) für jeden erkannten Beleg an.
  Seien Sie so genau wie möglich. Wenn ein Wert fehlt, geben Sie eine plausible Schätzung ab oder lassen Sie ihn null.
  Kategorisieren Sie jede Ausgabe in eine der folgenden Kategorien: Essen, Verkehr, Einkaufen, Unterhaltung, Gesundheit, Nebenkosten, Lionas, Malias, Sonstiges.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: ReceiptListSchema
    }
  });

  const parsed = JSON.parse(response.text!) as { receipts: ScannedReceipt[] };
  return parsed.receipts;
}

export async function parseOrderText(text: string): Promise<ScannedReceipt[]> {
  const ai = getAI();
  
  const prompt = `Analysiere diesen Text, der eine oder mehrere Bestellungen (z.B. Amazon) oder Quittungsinformationen enthält.
  Extrahiere alle Details wie Händler, Datum (YYYY-MM-DD), Gesamtbetrag, Währung und einzelne Posten.
  Suche bei den Posten auch nach Bild-URLs, falls diese im Text enthalten sind.
  Kategorisiere die Ausgabe in: Essen, Verkehr, Einkaufen, Unterhaltung, Gesundheit, Nebenkosten, Lionas, Malias, Sonstiges.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: prompt },
          { text: text }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: ReceiptListSchema
    }
  });

  const parsed = JSON.parse(response.text!) as { receipts: ScannedReceipt[] };
  return parsed.receipts;
}
