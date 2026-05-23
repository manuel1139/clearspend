import { useImportSummary } from './useImportSummary';
import type { UseReceiptImportOptions } from './receiptImportTypes';
import { useReceiptImportHandlers } from './useReceiptImportHandlers';

export function useReceiptImport({
  categories,
  paymentRules,
  receipts,
  onError,
  onImportedReceipts,
  onMergeReceipts,
  onReviewReceipts,
  onClearReview,
  onRefreshKontoEntries,
}: UseReceiptImportOptions) {
  const { importSummary, setImportSummary } = useImportSummary();
  const handlers = useReceiptImportHandlers({
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
  });

  return {
    ...handlers,
    importSummary,
    setImportSummary,
  };
}
