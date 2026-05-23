import type { Dispatch, SetStateAction } from 'react';
import type { PaymentRule, Receipt, ReceiptCategory } from '../types';

export interface UseReceiptImportOptions {
  categories: ReceiptCategory[];
  paymentRules: PaymentRule[];
  receipts: Receipt[];
  onError: Dispatch<SetStateAction<string | null>>;
  onImportedReceipts: (receipts: Receipt[]) => void;
  onMergeReceipts: (receipts: Receipt[]) => void;
  onReviewReceipts: (receipts: Receipt[]) => void;
  onClearReview: () => void;
  onRefreshKontoEntries: () => void | Promise<void>;
}
