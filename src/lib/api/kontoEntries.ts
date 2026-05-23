import type { KontoEntry } from '../../types';

export interface ParsedKontoImportResult {
  entries: KontoEntry[];
  detectedFormats: string[];
}

export async function listKontoEntriesRequest(): Promise<KontoEntry[]> {
  const response = await fetch('/api/konto-entries');
  return response.json();
}

export async function saveKontoEntriesRequest(
  entries: KontoEntry[],
): Promise<KontoEntry[]> {
  const response = await fetch('/api/konto-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });

  return response.json();
}

export async function importKontoZipRequest(
  fileName: string,
  base64: string,
): Promise<ParsedKontoImportResult> {
  const response = await fetch('/api/konto-entries/import-camt-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, base64 }),
  });

  return response.json();
}
