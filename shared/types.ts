export interface ReceiptCategory {
  id: number;
  name: string;
}

export interface PaymentRule {
  id: number;
  name: string;
  frequency: 'one_time' | 'monthly' | 'yearly';
}

export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Receipt {
  id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  categoryId: number;
  categoryName: string;
  paymentRuleId: number;
  paymentRuleName: string;
  paymentRuleFrequency: 'one_time' | 'monthly' | 'yearly';
  tags: string[];
  items: ReceiptItem[];
  createdAt: string;
  imageUrl?: string;
  box_2d?: number[];
  kontoEntryId?: string;
  kontoReference?: string;
}

export interface KontoEntry {
  id: string;
  bookingDate: string;
  valueDate?: string;
  amount: number;
  currency: string;
  counterpartyName: string;
  reference: string;
  endToEndId?: string;
  remittanceInfo?: string;
  sourceFileName?: string;
  createdAt: string;
}

export interface ScannedReceipt {
  merchant: string;
  date: string;
  total: number;
  currency?: string;
  category: string;
  items?: ReceiptItem[];
  tags?: string[];
  box_2d?: number[];
}

export interface ImportSummary {
  imported: number;
  skipped: number;
}