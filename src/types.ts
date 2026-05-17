export interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
  imageUrl?: string;
}

export interface Receipt {
  id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  category: string;
  tags: string[];
  items?: ReceiptItem[];
  createdAt: string;
  imageUrl?: string;
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
}

export type ScannedReceipt = Pick<Receipt, 'merchant' | 'total' | 'category'> &
  Partial<Pick<Receipt, 'date' | 'currency' | 'items' | 'box_2d'>>;
