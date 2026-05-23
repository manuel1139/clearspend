import type { KontoEntry, Receipt } from '../types';

function dateDiffInDays(left: string, right: string) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24);
}

export function matchKontoEntriesToReceipts(
  entries: KontoEntry[],
  receipts: Receipt[],
) {
  const availableReceipts = receipts.filter((receipt) => !receipt.kontoEntryId);
  const updates: Receipt[] = [];

  for (const entry of entries) {
    const candidates = availableReceipts.filter((receipt) => {
      const sameAmount = Math.abs(receipt.total - entry.amount) < 0.01;
      const sameCurrency = receipt.currency === entry.currency;
      const closeDate = dateDiffInDays(receipt.date, entry.bookingDate) <= 1;

      return sameAmount && sameCurrency && closeDate;
    });

    if (candidates.length !== 1) {
      continue;
    }

    const matchedReceipt = candidates[0];
    matchedReceipt.kontoEntryId = entry.id;
    matchedReceipt.kontoReference = entry.reference;
    updates.push({
      ...matchedReceipt,
      kontoEntryId: entry.id,
      kontoReference: entry.reference,
    });
  }

  return updates;
}
