import JSZip from 'jszip';
import { parseCamt053 } from 'camt-parser';
import { XMLParser } from 'fast-xml-parser';
import type { KontoEntry } from '../shared/types.js';

export interface ParsedKontoImportResult {
  entries: KontoEntry[];
  detectedFormats: string[];
}

interface CamtAmount {
  '#text'?: string | number;
  '@_Ccy'?: string;
}

interface CamtDate {
  Dt?: string;
  DtTm?: string;
}

interface CamtParty {
  Nm?: string;
}

interface CamtRelatedParties {
  Cdtr?: CamtParty;
  Dbtr?: CamtParty;
  UltmtCdtr?: CamtParty;
  UltmtDbtr?: CamtParty;
  CdtrAcct?: { Id?: { IBAN?: string; Othr?: { Id?: string } } };
  DbtrAcct?: { Id?: { IBAN?: string; Othr?: { Id?: string } } };
}

interface CamtAgent {
  FinInstnId?: {
    Nm?: string;
    BIC?: string;
  };
}

interface CamtRemittanceInformation {
  Ustrd?: string | string[];
  Strd?: {
    CdtrRefInf?: {
      Ref?: string;
    };
    AddtlRmtInf?: string | string[];
  } | Array<{
    CdtrRefInf?: { Ref?: string };
    AddtlRmtInf?: string | string[];
  }>;
}

interface CamtEntry {
  Amt?: CamtAmount;
  BookgDt?: CamtDate;
  ValDt?: CamtDate;
  CdtDbtInd?: string;
  AddtlNtryInf?: string;
  NtryRef?: string;
  NtryDtls?: {
    TxDtls?: CamtTransactionDetail | CamtTransactionDetail[];
  };
}

interface CamtTransactionDetail {
  Amt?: CamtAmount;
  CdtDbtInd?: string;
  RltdPties?: CamtRelatedParties;
  RltdAgts?: {
    CdtrAgt?: CamtAgent;
    DbtrAgt?: CamtAgent;
  };
  RmtInf?: CamtRemittanceInformation;
  Refs?: { EndToEndId?: string; TxId?: string };
  AddtlTxInf?: string;
  RltdDts?: { IntrBkSttlmDt?: CamtDate; AccptncDtTm?: string };
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function findNodesByKey(input: unknown, key: string, results: unknown[] = []): unknown[] {
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

function extractAmount(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj['#text'] === 'string') {
      return Number(obj['#text']);
    }

    if (typeof obj['@_'] === 'string') {
      return Number(obj['@_']);
    }
  }

  return 0;
}

function extractCurrency(value: unknown) {
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj['@_Ccy'] === 'string') {
      return obj['@_Ccy'];
    }
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
  entry: unknown,
  fileName: string,
): KontoEntry[] {
  const e = entry as CamtEntry;
  const amtNode = e.Amt;
  const bookgDt = e.BookgDt;
  const valDt = e.ValDt;

  const txDetails = findNodesByKey(e, 'TxDtls').flatMap((value) => toArray(value));
  const entryAmount = extractAmount(amtNode);
  const entryCurrency = extractCurrency(amtNode);
  const entryBookingDate =
    normalizeDate(bookgDt?.Dt ?? bookgDt?.DtTm) ||
    normalizeDate(valDt?.Dt ?? valDt?.DtTm);
  const entryValueDate = normalizeDate(valDt?.Dt ?? valDt?.DtTm);

  if (txDetails.length === 0) {
    const debitCreditIndicator = safeString(e.CdtDbtInd).toUpperCase();
    if (debitCreditIndicator && debitCreditIndicator !== 'DBIT') {
      return [];
    }

    const firstDetail = toArray(e.NtryDtls?.TxDtls)[0];
    const counterpartyName =
      safeString(firstDetail?.RltdPties?.Cdtr?.Nm) ||
      safeString(firstDetail?.RltdPties?.Dbtr?.Nm) ||
      'Konto';
    const reference = buildReference([
      safeString(e.AddtlNtryInf),
      safeString(e.NtryRef),
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
    .map((detailNode): KontoEntry | null => {
      const detail = detailNode as CamtTransactionDetail;
      const detailAmt = detail.Amt || e.Amt;
      const amount = extractAmount(detailAmt);
      const currency = extractCurrency(detailAmt);
      const debitCreditIndicator =
        safeString(detail.CdtDbtInd || e.CdtDbtInd).toUpperCase();

      if (debitCreditIndicator && debitCreditIndicator !== 'DBIT') {
        return null;
      }

      const counterpartyName =
        safeString(detail.RltdPties?.Cdtr?.Nm) ||
        safeString(detail.RltdPties?.Dbtr?.Nm) ||
        safeString(detail.RltdAgts?.CdtrAgt?.FinInstnId?.Nm) ||
        'Konto';
      const remittanceLines = toArray(detail.RmtInf?.Ustrd).map(safeString);
      const structuredRefs = toArray(detail.RmtInf?.Strd).map((s) => safeString(s?.CdtrRefInf?.Ref));
      const reference = buildReference([
        safeString(detail.Refs?.EndToEndId),
        safeString(detail.Refs?.TxId),
        safeString(detail.AddtlTxInf),
        ...structuredRefs,
        ...remittanceLines,
      ]);
      const bookingDate =
        normalizeDate(detail.RltdDts?.IntrBkSttlmDt?.Dt || detail.RltdDts?.IntrBkSttlmDt?.DtTm) ||
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
