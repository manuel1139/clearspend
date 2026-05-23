import { useImportSummary } from './useImportSummary';
import type { UseReceiptImportOptions } from './receiptImportTypes';
import { useReceiptImportHandlers } from './useReceiptImportHandlers';

export function useReceiptImport({
  categories,
  paymentRules,
  receipts,
  onError,
  onImportedReceipts,
  onReviewReceipts,
  onClearReview,
}: UseReceiptImportOptions) {
  const { importSummary, setImportSummary } = useImportSummary();
  const handlers = useReceiptImportHandlers({
    categories,
    paymentRules,
    receipts,
    onError,
    onImportedReceipts,
    onReviewReceipts,
    onClearReview,
    setImportSummary,
  });

  return {
    ...handlers,
    importSummary,
    setImportSummary,
  };
}
