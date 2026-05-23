import { useState, useEffect } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { saveReceiptRequest } from '../lib/api/receipts';
import { isGeminiConfigured, checkGeminiStatus } from '../lib/gemini';
import { parseOrderText, scanReceipt } from '../lib/gemini';
import {
  createReceiptFromParsedOrder,
  createReceiptFromScanResult,
} from '../lib/receiptFactories';
import type { ImportSummary, Receipt, ReceiptItem } from '../types';
import type { UseReceiptImportOptions } from './receiptImportTypes';

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

interface UseReceiptImportHandlersOptions extends UseReceiptImportOptions {
  setImportSummary: (summary: ImportSummary | null) => void;
}

type ImportPhase = 'idle' | 'preparing' | 'calling-gemini' | 'saving' | 'done' | 'failed';
type ImportKind = 'receipt-image' | 'amazon-text' | 'amazon-csv' | 'konto-zip' | null;

function getOrderTag(receipt: Receipt) {
  return receipt.tags.find((tag) => tag.startsWith('Order: ')) ?? null;
}

function isDuplicateReceipt(candidate: Receipt, existing: Receipt[]): boolean {
  const orderTag = getOrderTag(candidate);
  if (orderTag && existing.some((r) => r.tags.includes(orderTag))) return true;

  // Fingerprint match: Merchant + Date + Total
  return existing.some(
    (r) =>
      r.merchant.toLowerCase().trim() ===
        candidate.merchant.toLowerCase().trim() &&
      r.date === candidate.date &&
      Math.abs(r.total - candidate.total) < 0.01,
  );
}

function dedupeAmazonReceiptItems(receipt: Receipt): Receipt {
  if (!receipt.items || receipt.items.length === 0) {
    return receipt;
  }

  const itemMap = new Map<string, ReceiptItem>();

  for (const item of receipt.items) {
    const normalizedName = item.name.trim();
    if (!normalizedName) continue;

    const key = `${normalizedName.toLowerCase()}::${item.price.toFixed(2)}`;
    const existingItem = itemMap.get(key);
    if (!existingItem) {
      itemMap.set(key, {
        ...item,
        name: normalizedName,
        quantity: item.quantity || 1,
      });
      continue;
    }

    existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
  }

  return {
    ...receipt,
    items: Array.from(itemMap.values()),
  };
}

export function useReceiptImportHandlers({
  categories,
  paymentRules,
  receipts,
  onError,
  onImportedReceipts,
  onMergeReceipts,
  onReviewReceipts,
  onClearReview,
  onRefreshKontoEntries,
  setImportSummary,
}: UseReceiptImportHandlersOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [lastImportKind, setLastImportKind] = useState<ImportKind>(null);
  const [lastImportPhase, setLastImportPhase] = useState<ImportPhase>('idle');
  const [lastImportMessage, setLastImportMessage] = useState('No import started yet.');
  const [geminiConfigured, setGeminiConfigured] = useState(isGeminiConfigured());

  useEffect(() => {
    const checkStatus = async () => {
      const isOk = await checkGeminiStatus();
      setGeminiConfigured(isOk);
    };
    void checkStatus();
  }, []);

  const updateImportStatus = (
    kind: ImportKind,
    phase: ImportPhase,
    message: string,
  ) => {
    setLastImportKind(kind);
    setLastImportPhase(phase);
    setLastImportMessage(message);
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    const defaultPaymentRule =
      paymentRules.find((rule) => rule.frequency === 'one_time') ?? paymentRules[0];

    if (categories.length === 0 || !defaultPaymentRule) {
      onError('Create categories and payment rules before importing receipts.');
      return;
    }

    setIsScanning(true);
    setIsPasting(false);
    onError(null);
    updateImportStatus('amazon-text', 'preparing', 'Preparing Amazon text for Gemini.');

    try {
      updateImportStatus('amazon-text', 'calling-gemini', 'Calling Gemini for Amazon text extraction.');
      const results = await parseOrderText(
        pastedText,
        categories.map((category) => category.name),
      );
      const savedReceipts: Receipt[] = [];

      let skippedCount = 0;
      updateImportStatus('amazon-text', 'saving', 'Saving extracted Amazon text receipts.');
      for (let index = 0; index < results.length; index++) {
        const candidate = createReceiptFromParsedOrder(
          results[index],
          index,
          categories,
          defaultPaymentRule,
        );

        if (isDuplicateReceipt(candidate, [...receipts, ...savedReceipts])) {
          skippedCount++;
          continue;
        }

        const saved = await saveReceiptRequest(candidate);
        savedReceipts.push(saved);
      }

      if (savedReceipts.length > 0 || skippedCount > 0) {
        onImportedReceipts(savedReceipts);
        setImportSummary({ imported: savedReceipts.length, skipped: skippedCount });
        setPastedText('');
        updateImportStatus(
          'amazon-text',
          'done',
          `Imported ${savedReceipts.length} receipt(s), skipped ${skippedCount} duplicates.`,
        );
      } else {
        onError('Keine Bestelldaten im Text erkannt.');
        updateImportStatus('amazon-text', 'failed', 'Gemini returned no usable Amazon text receipts.');
      }
    } catch (error) {
      updateImportStatus(
        'amazon-text',
        'failed',
        error instanceof Error ? error.message : 'Amazon text import failed.',
      );
      onError(
        'Fehler beim Verarbeiten des Textes.' +
          (error instanceof Error ? ` ${error.message}` : ''),
      );
    } finally {
      setIsScanning(false);
    }
  };

  const processFile = async (file: File) => {
    const defaultPaymentRule =
      paymentRules.find((rule) => rule.frequency === 'one_time') ?? paymentRules[0];

    if (categories.length === 0 || !defaultPaymentRule) {
      onError('Create categories and payment rules before importing receipts.');
      return;
    }

    setIsScanning(true);
    onError(null);
    onClearReview();
    updateImportStatus('receipt-image', 'preparing', 'Preparing receipt image for Gemini.');

    try {
      const imageUrl = await readFileAsDataUrl(file);
      const base64 = imageUrl.split(',')[1];
      updateImportStatus('receipt-image', 'calling-gemini', 'Calling Gemini for receipt image analysis.');
      const results = await scanReceipt(
        base64,
        file.type,
        categories.map((category) => category.name),
      );
      const newReceipts = results.map((result, index) =>
        createReceiptFromScanResult(
          result,
          index,
          categories,
          defaultPaymentRule,
          imageUrl,
        ),
      );
      const uniqueReceipts = newReceipts.filter(
        (r) => !isDuplicateReceipt(r, receipts),
      );
      const skippedCount = newReceipts.length - uniqueReceipts.length;

      if (uniqueReceipts.length > 0) {
        onReviewReceipts(uniqueReceipts);
        updateImportStatus(
          'receipt-image',
          'done',
          `Gemini found ${newReceipts.length} receipt(s); ${uniqueReceipts.length} ready for review, ${skippedCount} duplicates skipped.`,
        );
      } else {
        const message = skippedCount > 0 
          ? 'Alle erkannten Belege sind bereits im System vorhanden.' 
          : 'Keine Belege im Bild erkannt.';
        onError(message);
        updateImportStatus('receipt-image', 'failed', 'No new receipts found in image.');
      }
    } catch (error) {
      console.error('Scan error:', error);
      updateImportStatus(
        'receipt-image',
        'failed',
        error instanceof Error ? error.message : 'Receipt image analysis failed.',
      );
      onError(
        error instanceof Error && error.message === 'Datei konnte nicht gelesen werden.'
          ? error.message
          : 'Analyse des Belegs fehlgeschlagen. Das Bild ist möglicherweise unscharf.',
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    void processFile(file);
    event.target.value = '';
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    onError(null);
    updateImportStatus('amazon-csv', 'preparing', 'Preparing Amazon CSV for import.');

    try {
      const text = await readFileAsText(file);
      if (categories.length === 0) {
        throw new Error('Create categories before importing receipts.');
      }

      const defaultPaymentRule =
        paymentRules.find((rule) => rule.frequency === 'one_time') ??
        paymentRules[0];
      if (!defaultPaymentRule) {
        throw new Error('No payment rules are configured.');
      }

      updateImportStatus('amazon-csv', 'saving', 'Processing Amazon CSV on server.');
      const response = await fetch('/api/imports/amazon-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text }),
      });

      if (!response.ok) throw new Error('Server import failed');
      const result = await response.json();

      if (result.savedReceipts.length > 0 || result.summary.skipped > 0) {
        onImportedReceipts(result.savedReceipts);
        setImportSummary(result.summary);
        updateImportStatus(
          'amazon-csv',
          'done',
          `Imported ${result.savedReceipts.length} Amazon order(s), skipped ${result.summary.skipped} duplicates.`,
        );
      } else {
        onError('Keine gültigen Bestelldaten in der CSV-Datei gefunden.');
        updateImportStatus('amazon-csv', 'failed', 'No usable Amazon CSV orders found.');
      }
    } catch (error) {
      updateImportStatus(
        'amazon-csv',
        'failed',
        error instanceof Error ? error.message : 'Amazon CSV import failed.',
      );
      onError(
        error instanceof Error
          ? error.message
          : 'Die CSV-Datei konnte nicht verarbeitet werden.',
      );
    } finally {
      setIsScanning(false);
      event.target.value = '';
    }
  };

  const handleKontoZipUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    onError(null);
    updateImportStatus('konto-zip', 'preparing', 'Preparing CAMT ZIP import.');

    try {
      const base64 = await readFileAsBase64(file);
      updateImportStatus('konto-zip', 'saving', 'Processing CAMT ZIP on server.');
      
      const response = await fetch('/api/imports/konto-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, base64 }),
      });

      if (!response.ok) throw new Error('Server Konto import failed');
      const result = await response.json();

      if (result.summary.imported === 0) {
        onError(
          `Keine neuen Konto-Buchungen in der ZIP-Datei gefunden.`,
        );
        return;
      }

      if (result.savedReceipts.length > 0) {
        onMergeReceipts(result.savedReceipts);
      }

      await onRefreshKontoEntries();

      setImportSummary(result.summary);
      const detectedFormatsLabel = result.detectedFormats?.join(', ') || 'unknown';
      
      updateImportStatus(
        'konto-zip',
        'done',
        `Detected ${detectedFormatsLabel}; imported ${result.summary.imported} entries and linked ${result.savedReceipts.length} receipt(s).`,
      );
    } catch (error) {
      updateImportStatus(
        'konto-zip',
        'failed',
        error instanceof Error ? error.message : 'Konto ZIP import failed.',
      );
      onError(
        error instanceof Error
          ? error.message
          : 'Die Konto-ZIP-Datei konnte nicht verarbeitet werden.',
      );
    } finally {
      setIsScanning(false);
      event.target.value = '';
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void processFile(file);
      return;
    }

    onError('Bitte ziehen Sie eine gültige Bilddatei hierher.');
  };

  return {
    isScanning,
    isPasting,
    setIsPasting,
    pastedText,
    setPastedText,
    isDragging,
    geminiConfigured,
    lastImportKind,
    lastImportPhase,
    lastImportMessage,
    handlePasteSubmit,
    handleFileUpload,
    handleCsvUpload,
    handleKontoZipUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
