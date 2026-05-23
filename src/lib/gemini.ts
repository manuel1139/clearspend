import type { ScannedReceipt } from '../types';

let geminiConfigured = false;

export function isGeminiConfigured() {
  return geminiConfigured;
}

export async function checkGeminiStatus() {
  const res = await fetch('/api/gemini/status');
  const data = await res.json();
  geminiConfigured = !!data.configured;
  return geminiConfigured;
}

export async function scanReceipt(
  base64Image: string,
  mimeType: string,
  categoryNames: string[],
): Promise<ScannedReceipt[]> {
  const response = await fetch('/api/gemini/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, mimeType, categoryNames }),
  });
  const data = await response.json();
  return data.receipts;
}

export async function parseOrderText(
  text: string,
  categoryNames: string[],
): Promise<ScannedReceipt[]> {
  const response = await fetch('/api/gemini/parse-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, categoryNames }),
  });
  const data = await response.json();
  return data.receipts;
}

export async function parseAmazonCsvText(
  text: string,
  categoryNames: string[],
): Promise<ScannedReceipt[]> {
  const response = await fetch('/api/gemini/parse-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, categoryNames }),
  });
  const data = await response.json();
  return data.receipts;
}
