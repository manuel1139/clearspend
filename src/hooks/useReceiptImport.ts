import { useEffect, useState } from 'react';
import type {
  ChangeEvent,
  Dispatch,
  DragEvent,
  SetStateAction,
} from 'react';
import { parseOrderText, scanReceipt } from '../lib/gemini';
import { createReceiptFromParsedOrder, createReceiptFromScanResult } from '../lib/receiptFactories';
import { saveReceiptRequest } from '../lib/api/receipts';
import { parseAmazonOrdersCsv } from '../lib/amazonImport';
import type {
  ImportSummary,
  PaymentRule,
  Receipt,
  ReceiptCategory,
} from '../types';

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

interface UseReceiptImportOptions {
  categories: ReceiptCategory[];
  paymentRules: PaymentRule[];
  receipts: Receipt[];
  onError: Dispatch<SetStateAction<string | null>>;
  onImportedReceipts: (receipts: Receipt[]) => void;
  onReviewReceipts: (receipts: Receipt[]) => void;
  onClearReview: () => void;
}

export function useReceiptImport({
  categories,
  paymentRules,
  receipts,
  onError,
  onImportedReceipts,
  onReviewReceipts,
  onClearReview,
}: UseReceiptImportOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (!importSummary) return;

    const timer = setTimeout(() => setImportSummary(null), 5000);
    return () => clearTimeout(timer);
  }, [importSummary]);

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

    try {
      const results = await parseOrderText(
        pastedText,
        categories.map((category) => category.name),
      );
      const savedReceipts: Receipt[] = [];

      for (let index = 0; index < results.length; index++) {
        const saved = await saveReceiptRequest(
          createReceiptFromParsedOrder(
            results[index],
            index,
            categories,
            defaultPaymentRule,
          ),
        );
        savedReceipts.push(saved);
      }

      if (savedReceipts.length > 0) {
        onImportedReceipts(savedReceipts);
        setImportSummary({ imported: savedReceipts.length, skipped: 0 });
        setPastedText('');
      } else {
        onError('Keine Bestelldaten im Text erkannt.');
      }
    } catch (error) {
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

    try {
      const imageUrl = await readFileAsDataUrl(file);
      const base64 = imageUrl.split(',')[1];
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

      if (newReceipts.length > 0) {
        onReviewReceipts(newReceipts);
      } else {
        onError('Keine Belege im Bild erkannt.');
      }
    } catch (error) {
      console.error('Scan error:', error);
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

    try {
      const text = await readFileAsText(file);
      const defaultPaymentRule =
        paymentRules.find((rule) => rule.frequency === 'one_time') ??
        paymentRules[0];
      if (!defaultPaymentRule) {
        throw new Error('No payment rules are configured.');
      }

      const parsed = parseAmazonOrdersCsv(
        text,
        receipts,
        categories,
        defaultPaymentRule,
      );
      const savedReceipts: Receipt[] = [];

      for (const receipt of parsed.receipts) {
        try {
          savedReceipts.push(await saveReceiptRequest(receipt));
        } catch (error) {
          console.error('Failed to save imported order:', error);
        }
      }

      if (savedReceipts.length > 0 || parsed.skippedCount > 0) {
        onImportedReceipts(savedReceipts);
        setImportSummary({
          imported: savedReceipts.length,
          skipped: parsed.skippedCount,
        });
      } else {
        onError('Keine gültigen Bestelldaten in der CSV-Datei gefunden.');
      }
    } catch (error) {
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
    importSummary,
    setImportSummary,
    handlePasteSubmit,
    handleFileUpload,
    handleCsvUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
