import type { ScannedReceipt } from '../types';
import {
  AiClientBase,
  type AiProviderStatus,
  type ScanReceiptParams,
} from './aiClient';

export interface AzureStatus extends AiProviderStatus {
  endpoint: string | null;
}

export class AzureClient extends AiClientBase<AzureStatus> {
  readonly provider = 'AZURE' as const;
  protected readonly statusPath = '/api/azure/status';

  protected override normalizeStatus(data: Partial<AzureStatus>): AzureStatus {
    return {
      endpoint: data.endpoint ?? null,
      configured: !!data.configured,
      detectedKeys: data.detectedKeys ?? [],
    };
  }

  async scanReceipt({ base64, file }: ScanReceiptParams): Promise<ScannedReceipt[]> {
    const data = await this.postJson<{ receipts: ScannedReceipt[] }>(
      '/api/azure/scan',
      {
        fileName: file?.name,
        base64,
      },
    );
    return data.receipts;
  }

  async parseOrderText(): Promise<ScannedReceipt[]> {
    throw new Error('Azure AI does not support parsing order text.');
  }

  async parseAmazonCsvText(): Promise<ScannedReceipt[]> {
    throw new Error('Azure AI does not support parsing Amazon CSV text.');
  }
}

export const azureClient = new AzureClient();

export function isAzureConfigured() {
  return azureClient.isConfigured();
}

export async function checkAzureStatus() {
  return azureClient.checkStatus();
}

export async function getAzureStatus(): Promise<AzureStatus> {
  return azureClient.getStatus();
}

export async function scanReceiptWithAzure(
  file: File,
  base64: string,
): Promise<ScannedReceipt[]> {
  return azureClient.scanReceipt({ file, base64 });
}
