import type { ReceiptCategory } from '../types';

export function buildReceiptFilterCategories(categories: ReceiptCategory[]) {
  return ['Alle', ...categories.map((category) => category.name)];
}

export function findMatchingCategory(
  categories: ReceiptCategory[],
  preferredName: string,
) {
  const normalizedPreferredName = preferredName.trim().toLowerCase();

  return categories.find(
    (category) => category.name.trim().toLowerCase() === normalizedPreferredName,
  );
}

export function resolveReceiptCategory(
  categories: ReceiptCategory[],
  preferredName: string,
  fallbackName = 'Sonstiges',
) {
  return (
    findMatchingCategory(categories, preferredName) ??
    findMatchingCategory(categories, fallbackName) ??
    categories[0] ??
    null
  );
}
