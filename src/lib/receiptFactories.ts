import type {
  PaymentRule,
  Receipt,
  ReceiptCategory,
  ScannedReceipt,
} from '../types';
import { normalizeReceiptDate } from './receiptDates';
import { resolveReceiptCategory } from './receiptCategories';

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

export function createManualReceipt(
  defaultCategory: ReceiptCategory,
  defaultPaymentRule: PaymentRule,
): Receipt {
  return {
    id: `temp-${Date.now()}`,
    merchant: 'Neue Ausgabe',
    date: todayIsoDate(),
    total: 0,
    currency: 'EUR',
    categoryId: defaultCategory.id,
    categoryName: defaultCategory.name,
    paymentRuleId: defaultPaymentRule.id,
    paymentRuleName: defaultPaymentRule.name,
    paymentRuleFrequency: defaultPaymentRule.frequency,
    tags: [],
    items: [],
    createdAt: new Date().toISOString(),
  };
}

export function createReceiptFromScanResult(
  result: ScannedReceipt,
  index: number,
  categories: ReceiptCategory[],
  defaultPaymentRule: PaymentRule,
  imageUrl?: string,
): Receipt {
  const matchedCategory = resolveReceiptCategory(categories, result.category);

  if (!matchedCategory) {
    throw new Error('No receipt categories are configured.');
  }

  return {
    id: `temp-${Date.now()}-${index}`,
    merchant: result.merchant,
    date: normalizeReceiptDate(result.date) ?? todayIsoDate(),
    total: result.total,
    currency: result.currency ?? 'EUR',
    categoryId: matchedCategory.id,
    categoryName: matchedCategory.name,
    paymentRuleId: defaultPaymentRule.id,
    paymentRuleName: defaultPaymentRule.name,
    paymentRuleFrequency: defaultPaymentRule.frequency,
    tags: [],
    items: result.items ?? [],
    box_2d: result.box_2d,
    createdAt: new Date().toISOString(),
    imageUrl,
  };
}

export function createReceiptFromParsedOrder(
  result: ScannedReceipt,
  index: number,
  categories: ReceiptCategory[],
  defaultPaymentRule: PaymentRule,
): Receipt {
  const matchedCategory = resolveReceiptCategory(categories, result.category);

  if (!matchedCategory) {
    throw new Error('No receipt categories are configured.');
  }

  return {
    id: `temp-${Date.now()}-${index}`,
    merchant: result.merchant,
    date: normalizeReceiptDate(result.date) ?? todayIsoDate(),
    total: result.total,
    currency: result.currency ?? 'EUR',
    categoryId: matchedCategory.id,
    categoryName: matchedCategory.name,
    paymentRuleId: defaultPaymentRule.id,
    paymentRuleName: defaultPaymentRule.name,
    paymentRuleFrequency: defaultPaymentRule.frequency,
    tags: result.tags && result.tags.length > 0 ? result.tags : ['Pasted Text'],
    items: result.items ?? [],
    createdAt: new Date().toISOString(),
  };
}
