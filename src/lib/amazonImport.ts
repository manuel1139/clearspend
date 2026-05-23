import type { PaymentRule, Receipt, ReceiptCategory } from '../types';
import { normalizeReceiptDate } from './receiptDates';
import { resolveReceiptCategory } from './receiptCategories';

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

  const defaultCategory = resolveReceiptCategory(categories, 'Einkaufen');
  if (!defaultCategory) {
    throw new Error('No receipt categories are configured.');
  }

  const headers = splitCsvLine(lines[0]);
  const dateIdx = parseHeaderIndex(headers, 'order date');
  const merchantIdx = parseHeaderIndex(headers, 'website');
  const totalIdx = parseHeaderIndex(headers, 'total amount');
  const currencyIdx = parseHeaderIndex(headers, 'currency');
  const titleIdx = parseHeaderIndex(headers, 'product name');
  const statusIdx = parseHeaderIndex(headers, 'order status');
  const orderIdIdx = parseHeaderIndex(headers, 'order id');
  const itemTotalIdx = parseHeaderIndex(headers, 'item total');

  const ordersMap = new Map<string, Receipt>();
  let skippedCount = 0;

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;

    const row = splitCsvLine(line);
    if (statusIdx !== -1 && row[statusIdx] === 'Cancelled') continue;

    const orderId = orderIdIdx !== -1 ? row[orderIdIdx] : `line-${index}`;
    if (
      orderId &&
      existingReceipts.some((receipt) => receipt.tags.includes(`Order: ${orderId}`))
    ) {
      skippedCount++;
      continue;
    }

    const title = titleIdx !== -1 ? row[titleIdx] : '';
    const itemTotalStr = itemTotalIdx !== -1 ? row[itemTotalIdx] : '0';
    const itemTotal = parseCurrencyAmount(itemTotalStr);

    if (ordersMap.has(orderId)) {
      const existing = ordersMap.get(orderId)!;
      if (title) {
        existing.items?.push({ name: title, price: itemTotal, quantity: 1 });
      }
      continue;
    }

    const dateStr = dateIdx !== -1 ? row[dateIdx] : '';
    const merchant = merchantIdx !== -1 ? row[merchantIdx] || 'Amazon.de' : 'Amazon';
    const totalStr = totalIdx !== -1 ? row[totalIdx] : '0';
    const currency = currencyIdx !== -1 ? row[currencyIdx] : 'EUR';
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
