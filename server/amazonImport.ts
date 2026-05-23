import type { PaymentRule, Receipt, ReceiptCategory } from '../shared/types.js';

function parseCurrencyAmount(value: string) {
  return parseFloat(value.replace(/,/g, '').replace(/[^0-9.-]+/g, '')) || 0;
}

function splitCsvLine(line: string) {
  return line
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((value) => value.trim().replace(/"/g, ''));
}

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function parseHeaderIndex(headers: string[], pattern: string) {
  return headers.findIndex((header) => header.toLowerCase().includes(pattern));
}

function normalizeReceiptDate(value: string) {
  if (!value) return null;
  // Simple normalization for common CSV formats
  const parts = value.split(/[./-]/);
  if (parts.length === 3) {
    // Assume DD.MM.YYYY or YYYY-MM-DD
    if (parts[0].length === 4) return parts.join('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return value;
}

function getOrderTag(receipt: Receipt) {
  return receipt.tags.find((tag) => tag.startsWith('Order: ')) ?? null;
}

function isDuplicateReceipt(candidate: Receipt, existing: Receipt[]): boolean {
  const orderTag = getOrderTag(candidate);
  if (orderTag && existing.some((r) => r.tags.includes(orderTag))) return true;

  return existing.some(
    (r) =>
      r.merchant.toLowerCase().trim() === candidate.merchant.toLowerCase().trim() &&
      r.date === candidate.date &&
      Math.abs(r.total - candidate.total) < 0.01
  );
}

function findRefundedAmazonOrderIds(text: string) {
  const lines = text.split('\n');
  if (lines.length < 2) return new Set<string>();

  const headers = splitCsvLine(lines[0]);
  const orderIdIdx = parseHeaderIndex(headers, 'order id');
  const refundIdx = parseHeaderIndex(headers, 'refund');

  const refundedOrderIds = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvLine(lines[i]);
    const orderId = orderIdIdx !== -1 ? row[orderIdIdx] : '';
    const refundAmount = refundIdx !== -1 ? parseCurrencyAmount(row[refundIdx] ?? '') : 0;
    if (orderId && refundAmount > 0) refundedOrderIds.add(orderId);
  }
  return refundedOrderIds;
}

export function parseAmazonOrdersCsv(
  text: string,
  existingReceipts: Receipt[],
  categories: ReceiptCategory[],
  defaultPaymentRule: PaymentRule
) {
  const lines = text.split('\n');
  if (lines.length < 2) return { receipts: [], skippedCount: 0 };

  const refundedOrderIds = findRefundedAmazonOrderIds(text);
  const headers = splitCsvLine(lines[0]);
  const indices = {
    date: parseHeaderIndex(headers, 'order date'),
    merchant: parseHeaderIndex(headers, 'website'),
    total: parseHeaderIndex(headers, 'total amount'),
    currency: parseHeaderIndex(headers, 'currency'),
    title: parseHeaderIndex(headers, 'product name'),
    status: parseHeaderIndex(headers, 'order status'),
    orderId: parseHeaderIndex(headers, 'order id'),
    itemTotal: parseHeaderIndex(headers, 'item total'),
  };

  const defaultCategory = categories.find(c => c.name === 'Einkaufen') || categories[0];
  const ordersMap = new Map<string, Receipt>();
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = splitCsvLine(line);
    const orderId = indices.orderId !== -1 ? row[indices.orderId] : `line-${i}`;
    const status = indices.status !== -1 ? row[indices.status] : '';

    if (status === 'Cancelled' || refundedOrderIds.has(orderId)) continue;

    const title = indices.title !== -1 ? row[indices.title] : '';
    const itemTotal = parseCurrencyAmount(indices.itemTotal !== -1 ? row[indices.itemTotal] : '0');

    const candidate: Receipt = {
      id: `temp-${Date.now()}-${i}`,
      merchant: (indices.merchant !== -1 ? row[indices.merchant] : '') || 'Amazon',
      date: normalizeReceiptDate(indices.date !== -1 ? row[indices.date] : '') ?? todayIsoDate(),
      total: parseCurrencyAmount(indices.total !== -1 ? row[indices.total] : '0'),
      currency: (indices.currency !== -1 ? row[indices.currency] : '') || 'EUR',
      categoryId: defaultCategory.id,
      categoryName: defaultCategory.name,
      paymentRuleId: defaultPaymentRule.id,
      paymentRuleName: defaultPaymentRule.name,
      paymentRuleFrequency: defaultPaymentRule.frequency,
      tags: ['Amazon CSV', `Order: ${orderId}`],
      items: title ? [{ name: title, price: itemTotal, quantity: 1 }] : [],
      createdAt: new Date().toISOString(),
    };

    if (isDuplicateReceipt(candidate, existingReceipts)) {
      skippedCount++;
      continue;
    }

    if (ordersMap.has(orderId)) {
      const existing = ordersMap.get(orderId)!;
      if (title) {
        const item = existing.items.find(it => it.name === title && it.price === itemTotal);
        if (item) item.quantity += 1;
        else existing.items.push({ name: title, price: itemTotal, quantity: 1 });
      }
    } else {
      ordersMap.set(orderId, candidate);
    }
  }

  return { receipts: Array.from(ordersMap.values()), skippedCount };
}