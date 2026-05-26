import type {
  AnalyzedDocument,
  CurrencyValue,
  DocumentField,
} from '@azure/ai-form-recognizer';
import type { ScannedReceipt } from '../shared/types.js';

interface AzureScanRequest {
  fileName?: string;
  base64: string;
}

export interface AzureStatus {
  configured: boolean;
  endpoint: string | null;
  detectedKeys: string[];
}

export interface AzureService {
  isConfigured(): boolean;
  getStatus(): AzureStatus;
  scanReceipt(request: AzureScanRequest): Promise<{ receipts: ScannedReceipt[] }>;
}

function pickAzureEndpoint() {
  return (
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim() ||
    process.env.AZURE_FORM_RECOGNIZER_ENDPOINT?.trim() ||
    null
  );
}

function pickAzureApiKey() {
  return (
    process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY?.trim() ||
    process.env.AZURE_FORM_RECOGNIZER_API_KEY?.trim() ||
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim() ||
    process.env.AZURE_FORM_RECOGNIZER_KEY?.trim() ||
    null
  );
}

function normalizeBase64(base64: string) {
  const [, encoded = base64] = base64.split(',');
  return encoded;
}

function mapCurrencySymbol(symbol?: string) {
  switch (symbol) {
    case 'EUR':
    case '€':
    case 'â‚¬':
      return 'EUR';
    case 'USD':
    case '$':
      return 'USD';
    case 'GBP':
    case '£':
    case 'Â£':
      return 'GBP';
    case 'CHF':
      return 'CHF';
    default:
      return symbol?.trim() || 'EUR';
  }
}

function getField(
  fields: Record<string, DocumentField | undefined> | undefined,
  name: string,
) {
  return fields?.[name];
}

function getFieldString(field?: DocumentField) {
  if (field?.kind === 'string' || field?.kind === 'phoneNumber' || field?.kind === 'countryRegion') {
    return field.value?.trim() ?? '';
  }

  if (field?.kind === 'date') {
    return field.value?.toISOString().slice(0, 10) ?? '';
  }

  if (typeof field?.content === 'string') {
    return field.content.trim();
  }

  return '';
}

function getFieldNumber(field?: DocumentField) {
  if (field?.kind === 'number' || field?.kind === 'integer') {
    return field.value ?? 0;
  }

  if (field?.kind === 'currency') {
    return field.value?.amount ?? 0;
  }

  return 0;
}

function getFieldCurrency(field?: DocumentField) {
  if (field?.kind !== 'currency') {
    return 'EUR';
  }

  const value: CurrencyValue | undefined = field.value;
  return mapCurrencySymbol(value.currencyCode ?? value.currencySymbol);
}

function getFieldProperties(field?: DocumentField) {
  return field?.kind === 'object' ? field.properties : {};
}

function getArrayValues(field?: DocumentField) {
  return field?.kind === 'array' ? field.values : [];
}

function mapReceiptResult(document: AnalyzedDocument): ScannedReceipt {
  const fields = document.fields;
  const merchant =
    getFieldString(getField(fields, 'MerchantName')) || 'Unknown merchant';
  const date = getFieldString(getField(fields, 'TransactionDate'));
  const totalField = getField(fields, 'Total') ?? getField(fields, 'Subtotal');
  const totalAmount = getFieldNumber(totalField);
  const currency = getFieldCurrency(totalField);
  const items =
    getArrayValues(getField(fields, 'Items'))
      .map((item) => {
        const properties = getFieldProperties(item);
        const name = getFieldString(properties.Description) || 'Item';
        const quantity = getFieldNumber(properties.Quantity) || 1;
        const totalPrice =
          getFieldNumber(properties.TotalPrice) ||
          getFieldNumber(properties.Price);
        return {
          name,
          quantity,
          price: totalPrice,
        };
      })
      .filter((item) => item.name.length > 0) ?? [];

  return {  
    merchant,
    date,
    total: totalAmount,
    currency,
    category: 'Sonstiges',
    items,
    tags: ['Azure Receipt AI'],
  };
}

async function loadAzureSdk() {
  const formRecognizerModuleName = '@azure/ai-form-recognizer';
  const azureCoreAuthModuleName = '@azure/core-auth';

  try {
    const [{ DocumentAnalysisClient }, { AzureKeyCredential }] = await Promise.all([
      import(formRecognizerModuleName),
      import(azureCoreAuthModuleName),
    ]);

    return { DocumentAnalysisClient, AzureKeyCredential };
  } catch {
    throw new Error(
      'Azure AI SDK is not installed. Add @azure/ai-form-recognizer and @azure/core-auth to enable Azure receipt analysis.',
    );
  }
}

export function createAzureService(): AzureService {
  const endpoint = pickAzureEndpoint();
  const apiKey = pickAzureApiKey();

  return {
    isConfigured() {
      return !!endpoint && !!apiKey;
    },

    getStatus() {
      return {
        configured: !!endpoint && !!apiKey,
        endpoint,
        detectedKeys: Object.keys(process.env).filter((key) =>
          /azure|form_recognizer|document_intelligence/i.test(key),
        ),
      };
    },

    async scanReceipt({ base64 }: AzureScanRequest) {
      if (!endpoint || !apiKey) {
        throw new Error('Azure receipt analysis is not configured');
      }

      const { DocumentAnalysisClient, AzureKeyCredential } = await loadAzureSdk();
      const client = new DocumentAnalysisClient(
        endpoint,
        new AzureKeyCredential(apiKey),
      );
      const buffer = Buffer.from(normalizeBase64(base64), 'base64');
      const poller = await client.beginAnalyzeDocument('prebuilt-receipt', buffer);
      const result = await poller.pollUntilDone();
      const document = result.documents?.[0] as AnalyzedDocument | undefined;

      if (!document) {
        throw new Error('No receipt found');
      }

      const receipt = mapReceiptResult(document);
      return { receipts: [receipt] };
    },
  };
}
