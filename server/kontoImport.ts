import JSZip from 'jszip';
import { parseCamt053 } from 'camt-parser';
import { XMLParser } from 'fast-xml-parser';
import type { KontoEntry } from '../shared/types.js';

export interface ParsedKontoImportResult {
  entries: KontoEntry[];
  detectedFormats: string[];
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function findNodesByKey(input: unknown, key: string, results: any[] = []): any[] {
  if (!input || typeof input !== 'object') {
    return results;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      findNodesByKey(item, key, results);
    }
    return results;
  }

  for (const [currentKey, value] of Object.entries(input)) {
    if (currentKey === key) {
      results.push(value);
    }
    findNodesByKey(value, key, results);
  }

  return results;
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  return value.slice(0, 10);
}

function extractAmount(value: any) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  if (value && typeof value === 'object') {
    if (typeof value['#text'] === 'string') {
      return Number(value['#text']);
    }

    if (typeof value['@_'] === 'string') {
      return Number(value['@_']);
    }
  }

  return 0;
}

function extractCurrency(value: any) {
  if (value && typeof value === 'object' && typeof value['@_Ccy'] === 'string') {
    return value['@_Ccy'];
  }

  return 'EUR';
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildReference(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(' | ');
}

function stableHash(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index++) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

function detectCamtFormat(xml: string) {
  const namespaceMatch = xml.match(
    /urn:iso:std:iso:20022:tech:xsd:(camt\.\d{3}\.\d{3}\.\d{2})/i,
  );

  return namespaceMatch?.[1] ?? 'unknown';
}

function parseCamt053Statements(
  fileName: string,
  statements: Awaited<ReturnType<typeof parseCamt053>>,
) {
  const entries: KontoEntry[] = [];

  for (const statement of statements) {
    for (const transaction of statement.transactions) {
      if (transaction.type !== 'debit') {
        continue;
      }

      const reference = buildReference([
        safeString(transaction.endToEndReference),
        safeString(transaction.remittanceReference),
        safeString(transaction.description),
        safeString(transaction.purpose),
      ]);
      const rawId = [
        fileName,
        normalizeDate(transaction.date),
        safeString(transaction.counterpartyName),
        Math.abs(transaction.amount).toFixed(2),
        reference,
      ].join('|');

      entries.push({
        id: `konto-${stableHash(rawId)}`,
        bookingDate: normalizeDate(transaction.date),
        amount: Math.abs(transaction.amount),
        currency: transaction.currency || statement.currency || 'EUR',
        counterpartyName: safeString(transaction.counterpartyName) || 'Konto',
        reference,
        endToEndId: safeString(transaction.endToEndReference) || undefined,
        remittanceInfo: safeString(transaction.description) || undefined,
        sourceFileName: fileName,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return entries;
}

function parseTransactionDetails(
  entry: any,
  fileName: string,
): KontoEntry[] {
  const txDetails = findNodesByKey(entry, 'TxDtls').flatMap((value) => toArray(value));
  const entryAmount = extractAmount(entry.Amt);
  const entryCurrency = extractCurrency(entry.Amt);
  const entryBookingDate =
    normalizeDate(entry.BookgDt?.Dt ?? entry.BookgDt?.DtTm) ||
    normalizeDate(entry.ValDt?.Dt ?? entry.ValDt?.DtTm);
  const entryValueDate = normalizeDate(entry.ValDt?.Dt ?? entry.ValDt?.DtTm);

  if (txDetails.length === 0) {
    const debitCreditIndicator = safeString(entry.CdtDbtInd).toUpperCase();
    if (debitCreditIndicator && debitCreditIndicator !== 'DBIT') {
      return [];
    }

    const counterpartyName =
      safeString(entry.NtryDtls?.TxDtls?.RltdPties?.Cdtr?.Nm) ||
      safeString(entry.NtryDtls?.TxDtls?.RltdPties?.Dbtr?.Nm) ||
      'Konto';
    const reference = buildReference([
      safeString(entry.AddtlNtryInf),
      safeString(entry.NtryRef),
    ]);
    const rawId = [
      fileName,
      entryBookingDate,
      counterpartyName,
      entryAmount.toFixed(2),
      reference,
    ].join('|');

    return [
      {
        id: `konto-${stableHash(rawId)}`,
        bookingDate: entryBookingDate,
        valueDate: entryValueDate || undefined,
        amount: Math.abs(entryAmount),
        currency: entryCurrency,
        counterpartyName,
        reference,
        createdAt: new Date().toISOString(),
        sourceFileName: fileName,
      },
    ];
  }

  return txDetails
    .map((detail): KontoEntry | null => {
      const amount = extractAmount(detail.Amt || entry.Amt);
      const currency = extractCurrency(detail.Amt || entry.Amt);
      const debitCreditIndicator =
        safeString(detail.CdtDbtInd || entry.CdtDbtInd).toUpperCase();

      if (debitCreditIndicator && debitCreditIndicator !== 'DBIT') {
        return null;
      }

      const counterpartyName =
        safeString(detail.RltdPties?.Cdtr?.Nm) ||
        safeString(detail.RltdPties?.Dbtr?.Nm) ||
        safeString(detail.RltdAgts?.CdtrAgt?.FinInstnId?.Nm) ||
        'Konto';
      const remittanceLines = toArray(detail.RmtInf?.Ustrd).map(safeString);
      const reference = buildReference([
        safeString(detail.Refs?.EndToEndId),
        safeString(detail.Refs?.TxId),
        safeString(detail.AddtlTxInf),
        ...remittanceLines,
      ]);
      const bookingDate =
        normalizeDate(detail.RltdDts?.IntrBkSttlmDt?.DtTm) ||
        normalizeDate(detail.RltdDts?.AccptncDtTm) ||
        entryBookingDate;
      const rawId = [
        fileName,
        bookingDate,
        counterpartyName,
        Math.abs(amount).toFixed(2),
        reference,
      ].join('|');

      return {
        id: `konto-${stableHash(rawId)}`,
        bookingDate,
        valueDate: entryValueDate || undefined,
        amount: Math.abs(amount),
        currency,
        counterpartyName,
        reference,
        endToEndId: safeString(detail.Refs?.EndToEndId) || undefined,
        remittanceInfo: remittanceLines.join(' | ') || undefined,
        sourceFileName: fileName,
        createdAt: new Date().toISOString(),
      };
    })
    .filter((entry): entry is KontoEntry => entry !== null && entry.amount > 0);
}

export async function parseCamtZipBase64(
  fileName: string,
  base64: string,
): Promise<ParsedKontoImportResult> {
  const zip = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    attributeNamePrefix: '@_',
  });
  const entries: KontoEntry[] = [];
  const detectedFormats = new Set<string>();

  for (const zipEntry of Object.values(zip.files)) {
    if (zipEntry.dir || !zipEntry.name.toLowerCase().endsWith('.xml')) {
      continue;
    }

    const xml = await zipEntry.async('text');
    const detectedFormat = detectCamtFormat(xml);
    detectedFormats.add(detectedFormat);

    if (detectedFormat.startsWith('camt.053')) {
      const statements = await parseCamt053(xml);
      entries.push(...parseCamt053Statements(zipEntry.name, statements));
      continue;
    }

    const parsed = parser.parse(xml);
    const ntryNodes = findNodesByKey(parsed, 'Ntry').flatMap((value) => toArray(value));

    for (const entry of ntryNodes) {
      entries.push(...parseTransactionDetails(entry, zipEntry.name));
    }
  }

  const uniqueEntries = new Map<string, KontoEntry>();
  for (const entry of entries) {
    uniqueEntries.set(entry.id, entry);
  }

  return {
    entries: Array.from(uniqueEntries.values()),
    detectedFormats: Array.from(detectedFormats),
  };
}
