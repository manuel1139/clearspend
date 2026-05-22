export interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
  imageUrl?: string;
}

export interface ReceiptCategory {
  id: number;
  name: string;
}

export interface PaymentRule {
  id: number;
  name: string;
  frequency: 'monthly' | 'yearly' | 'one_time';
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
  paymentRuleFrequency: PaymentRule['frequency'];
  tags: string[];
  items?: ReceiptItem[];
  createdAt: string;
  imageUrl?: string;
  box_2d?: [number, number, number, number];
}

export interface ScannedReceipt {
  merchant: string;
  total: number;
  category: string;
  date?: string;
  currency?: string;
  items?: ReceiptItem[];
  box_2d?: [number, number, number, number];
}

export interface ImportSummary {
  imported: number;
  skipped: number;
}
