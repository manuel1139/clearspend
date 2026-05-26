import type { ScannedReceipt } from '../types';
import {
  AiClientBase,
  type AiProviderStatus,
  type ScanReceiptParams,
} from './aiClient';

export interface GeminiHistoryEntry {
  action: string;
  prompt: string;
  response: string;
  timestamp: string;
}

export interface GeminiDebugStatus extends AiProviderStatus {
  apiKey: string | null;
  aiHistory: GeminiHistoryEntry[];
}

export class GeminiClient extends AiClientBase<GeminiDebugStatus> {
  readonly provider = 'GEMINI' as const;
  protected readonly statusPath = '/api/gemini/status';

  protected override normalizeStatus(
    data: Partial<GeminiDebugStatus>,
  ): GeminiDebugStatus {
    return {
      apiKey: data.apiKey ?? null,
      aiHistory: data.aiHistory ?? [],
      configured: !!data.configured,
      detectedKeys: data.detectedKeys ?? [],
    };
  }

  async scanReceipt({
    base64,
    mimeType,
    categoryNames = [],
  }: ScanReceiptParams): Promise<ScannedReceipt[]> {
    const data = await this.postJson<{ receipts: ScannedReceipt[] }>(
      '/api/gemini/scan',
      {
        base64Image: base64,
        mimeType,
        categoryNames,
      },
    );
    return data.receipts;
  }

  async parseOrderText(
    text: string,
    categoryNames: string[],
  ): Promise<ScannedReceipt[]> {
    const data = await this.postJson<{ receipts: ScannedReceipt[] }>(
      '/api/gemini/parse-text',
      { text, categoryNames },
    );
    return data.receipts;
  }

  async parseAmazonCsvText(
    text: string,
    categoryNames: string[],
  ): Promise<ScannedReceipt[]> {
    const data = await this.postJson<{ receipts: ScannedReceipt[] }>(
      '/api/gemini/parse-csv',
      { text, categoryNames },
    );
    return data.receipts;
  }
}

export const geminiClient = new GeminiClient();

export function isGeminiConfigured() {
  return geminiClient.isConfigured();
}

export async function checkGeminiStatus() {
  return geminiClient.checkStatus();
}

export async function getGeminiDebugStatus(): Promise<GeminiDebugStatus> {
  return geminiClient.getStatus();
}

export async function scanReceipt(
  base64Image: string,
  mimeType: string,
  categoryNames: string[],
): Promise<ScannedReceipt[]> {
  return geminiClient.scanReceipt({
    base64: base64Image,
    mimeType,
    categoryNames,
  });
}

export async function parseOrderText(
  text: string,
  categoryNames: string[],
): Promise<ScannedReceipt[]> {
  return geminiClient.parseOrderText(text, categoryNames);
}

export async function parseAmazonCsvText(
  text: string,
  categoryNames: string[],
): Promise<ScannedReceipt[]> {
  return geminiClient.parseAmazonCsvText(text, categoryNames);
}
