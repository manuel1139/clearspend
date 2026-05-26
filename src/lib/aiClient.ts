import type { ScannedReceipt } from '../types';

export type AiProvider = 'AZURE' | 'GEMINI';

export interface AiProviderStatus {
  configured: boolean;
  detectedKeys: string[];
}

export interface ScanReceiptParams {
  base64: string;
  file?: File;
  mimeType?: string;
  categoryNames?: string[];
}

export abstract class AiClientBase<TStatus extends AiProviderStatus> {
  private configured = false;

  abstract readonly provider: AiProvider;
  protected abstract readonly statusPath: string;

  isConfigured() {
    return this.configured;
  }

  protected setConfigured(configured: boolean) {
    this.configured = configured;
  }

  protected async getJson<TResponse>(path: string): Promise<TResponse> {
    const response = await fetch(path);
    return (await response.json()) as TResponse;
  }

  protected async postJson<TResponse>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<TResponse> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await response.json()) as TResponse;
  }

  async getStatus(): Promise<TStatus> {
    const data = await this.getJson<Partial<TStatus>>(this.statusPath);
    const normalizedStatus = this.normalizeStatus(data);
    this.setConfigured(normalizedStatus.configured);
    return normalizedStatus;
  }

  async checkStatus() {
    const status = await this.getStatus();
    return status.configured;
  }

  protected normalizeStatus(data: Partial<TStatus>): TStatus {
    return {
      ...data,
      configured: !!data.configured,
      detectedKeys: data.detectedKeys ?? [],
    } as TStatus;
  }

  abstract scanReceipt(params: ScanReceiptParams): Promise<ScannedReceipt[]>;
  abstract parseOrderText(
    text: string,
    categoryNames: string[],
  ): Promise<ScannedReceipt[]>;
  abstract parseAmazonCsvText(
    text: string,
    categoryNames: string[],
  ): Promise<ScannedReceipt[]>;
}
