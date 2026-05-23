import type { PaymentRule, Receipt, ReceiptCategory } from '../types';
import { normalizeReceiptDate } from './receiptDates';
import { resolveReceiptCategory } from './receiptCategories';

export interface AmazonCsvRow {
  'order id': string;
  'order date': string;
  'website': string;
  'total amount': string;
  'currency': string;
  'product name': string;
  'order status': string;
  'item total': string;
  'refund': string;
  'shipping_refund': string;
  'items': string;
  'payments': string;
}

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

function hasRefundOrReturnMarker(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('return') ||
    normalized.includes('returned') ||
    normalized.includes('refund') ||
    normalized.includes('refunded') ||
    normalized.includes('rücksend') ||
    normalized.includes('retoure') ||
    normalized.includes('erstattet')
  );
}

export function findRefundedAmazonOrderIds(text: string) {
  const lines = text.split('\n');
  if (lines.length < 2) {
    return new Set<string>();
  }

  const headers = splitCsvLine(lines[0]);
  const orderIdIdx = parseHeaderIndex(headers, 'order id');
  const refundIdx = parseHeaderIndex(headers, 'refund');
  const shippingRefundIdx = parseHeaderIndex(headers, 'shipping_refund');
  const itemsIdx = parseHeaderIndex(headers, 'items');
  const paymentsIdx = parseHeaderIndex(headers, 'payments');

  const refundedOrderIds = new Set<string>();

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;

    const row = splitCsvLine(line);
    const orderId = orderIdIdx !== -1 ? row[orderIdIdx] : '';
    if (!orderId) continue;

    const refundAmount = refundIdx !== -1 ? parseCurrencyAmount(row[refundIdx] ?? '') : 0;
    const shippingRefundAmount =
      shippingRefundIdx !== -1 ? parseCurrencyAmount(row[shippingRefundIdx] ?? '') : 0;
    const itemsValue = itemsIdx !== -1 ? row[itemsIdx] ?? '' : '';
    const paymentsValue = paymentsIdx !== -1 ? row[paymentsIdx] ?? '' : '';

    if (
      refundAmount > 0 ||
      (shippingRefundAmount > 0 && hasRefundOrReturnMarker(paymentsValue)) ||
      hasRefundOrReturnMarker(itemsValue) ||
      hasRefundOrReturnMarker(paymentsValue)
    ) {
      refundedOrderIds.add(orderId);
    }
  }

  return refundedOrderIds;
}

export function parseAmazonOrdersCsv(
  text: string,
  existingReceipts: Receipt[],
  categories: ReceiptCategory[],
  defaultPaymentRule: PaymentRule,
) {
  const lines = text.split('\n');
  if (lines.length < 2) {
    return { receipts: [], skippedCount: 0 };
  }

  const refundedOrderIds = findRefundedAmazonOrderIds(text);
  const headers = splitCsvLine(lines[0]);
  
  // Map header names to their column indices for robust access
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

  const defaultCategory = resolveReceiptCategory(categories, 'Einkaufen');
  if (!defaultCategory) {
    throw new Error('No receipt categories are configured.');
  }

  const ordersMap = new Map<string, Receipt>();
  let skippedCount = 0;

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;

    const row = splitCsvLine(line);
    const orderId = indices.orderId !== -1 ? row[indices.orderId] : `line-${index}`;
    const status = indices.status !== -1 ? row[indices.status] : '';

    // Skip cancelled or refunded orders
    if (status === 'Cancelled' || refundedOrderIds.has(orderId)) {
      continue;
    }

    if (
      orderId &&
      existingReceipts.some((receipt) => receipt.tags.includes(`Order: ${orderId}`))
    ) {
      skippedCount++;
      continue;
    }

    const title = indices.title !== -1 ? row[indices.title] : '';
    const itemTotalStr = indices.itemTotal !== -1 ? row[indices.itemTotal] : '0';
    const itemTotal = parseCurrencyAmount(itemTotalStr);

    if (ordersMap.has(orderId)) {
      const existing = ordersMap.get(orderId)!;
      if (title) {
        const existingItem = existing.items.find(i => i.name === title && i.price === itemTotal);
        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          existing.items.push({ name: title, price: itemTotal, quantity: 1 });
        }
      }
      continue;
    }

    const dateStr = indices.date !== -1 ? row[indices.date] : '';
    const merchant = indices.merchant !== -1 ? row[indices.merchant] || 'Amazon.de' : 'Amazon';
    const totalStr = indices.total !== -1 ? row[indices.total] : '0';
    const currency = indices.currency !== -1 ? row[indices.currency] : 'EUR';
    const total = parseCurrencyAmount(totalStr);

    if (isNaN(total) || total === 0) continue;

    ordersMap.set(orderId, {
      id: `temp-${Date.now()}-${index}`,
      merchant: merchant || 'Amazon',
      date: normalizeReceiptDate(dateStr) ?? todayIsoDate(),
      total,
      currency,
      categoryId: defaultCategory.id,
      categoryName: defaultCategory.name,
      paymentRuleId: defaultPaymentRule.id,
      paymentRuleName: defaultPaymentRule.name,
      paymentRuleFrequency: defaultPaymentRule.frequency,
      tags: ['Amazon CSV', `Order: ${orderId}`],
      items: title ? [{ name: title, price: itemTotal || total, quantity: 1 }] : [],
      createdAt: new Date().toISOString(),
    });
  }

  return {
    receipts: Array.from(ordersMap.values()),
    skippedCount,
  };
}
