import {
  eachDayOfInterval,
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import type { Receipt } from '../types';

export interface SpendHistoryPoint {
  date: string;
  label: string;
  spent: number;
  cumulative: number;
}

export function getMonthlySpent(receipts: Receipt[]) {
  const now = new Date();
  const rangeStart = startOfDay(subDays(now, 29));
  const rangeEnd = endOfDay(now);

  return receipts
    .filter((receipt) => {
      const receiptDate = parseISO(receipt.date);
      return isWithinInterval(receiptDate, {
        start: rangeStart,
        end: rangeEnd,
      });
    })
    .reduce((sum, receipt) => sum + receipt.total, 0);
}

export function buildSpendHistory(receipts: Receipt[]): SpendHistoryPoint[] {
  const now = new Date();
  const rangeStart = startOfDay(subDays(now, 29));
  const rangeEnd = endOfDay(now);

  const dailyTotals = new Map<string, number>();

  for (const receipt of receipts) {
    const receiptDate = parseISO(receipt.date);
    if (
      !isWithinInterval(receiptDate, {
        start: rangeStart,
        end: rangeEnd,
      })
    ) {
      continue;
    }

    const key = format(receiptDate, 'yyyy-MM-dd');
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + receipt.total);
  }

  let runningTotal = 0;

  return eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    const spent = dailyTotals.get(key) ?? 0;
    runningTotal += spent;

    return {
      date: key,
      label: format(day, 'dd MMM'),
      spent,
      cumulative: runningTotal,
    };
  });
}
