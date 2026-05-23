import type { KontoEntry } from '../../types';

export interface ParsedKontoImportResult {
  entries: KontoEntry[];
  detectedFormats: string[];
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    throw new Error(`Server returned an empty response (${response.status}).`);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Server returned invalid JSON (${response.status}). ${text.slice(0, 160)}`,
    );
  }

  if (!response.ok) {
    const errorMessage =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error?: unknown }).error)
        : `Request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  return parsed as T;
}

export async function listKontoEntriesRequest(): Promise<KontoEntry[]> {
  const response = await fetch('/api/konto-entries');
  return parseJsonResponse<KontoEntry[]>(response);
}

export async function saveKontoEntriesRequest(
  entries: KontoEntry[],
): Promise<KontoEntry[]> {
  const response = await fetch('/api/konto-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });

  return parseJsonResponse<KontoEntry[]>(response);
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

  return parseJsonResponse<ParsedKontoImportResult>(response);
}
