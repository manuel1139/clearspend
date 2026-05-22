import type { Receipt } from '../../types';

export async function listReceipts(): Promise<Receipt[]> {
  const response = await fetch('/api/receipts');
  return response.json();
}

export async function saveReceiptRequest(receipt: Receipt): Promise<Receipt> {
  const response = await fetch('/api/receipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt }),
  });

  return response.json();
}

export async function deleteReceiptRequest(id: string): Promise<void> {
  await fetch(`/api/receipts/${id}`, { method: 'DELETE' });
}
