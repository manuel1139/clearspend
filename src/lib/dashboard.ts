import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import type { Receipt } from '../types';

export interface SpendHistoryPoint {
  date: string;
  label: string;
  spent: number;
  cumulative: number;
}

export type DateRangePreset =
  | 'all'
  | 'current-year'
  | 'current-week'
  | 'current-month'
  | 'last-month'
  | 'last-year'
  | 'last-10-days'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export function resolveReceiptDateRange(receipts: Receipt[]): DateRange {
  if (receipts.length === 0) {
    const today = new Date();
    return {
      start: startOfDay(today),
      end: endOfDay(today),
    };
  }

  const sortedReceiptDates = receipts
    .map((receipt) => parseISO(receipt.date))
    .sort((left, right) => left.getTime() - right.getTime());

  return {
    start: startOfDay(sortedReceiptDates[0]),
    end: endOfDay(sortedReceiptDates[sortedReceiptDates.length - 1]),
  };
}

export function resolveDateRange(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
): DateRange {
  const now = new Date();

  switch (preset) {
    case 'all':
      return {
        start: startOfDay(new Date(1970, 0, 1)),
        end: endOfDay(now),
      };
    case 'current-month':
      return {
        start: startOfDay(startOfMonth(now)),
        end: endOfDay(now),
      };
    case 'current-week':
      return {
        start: startOfDay(startOfWeek(now, { weekStartsOn: 1 })),
        end: endOfDay(now),
      };
    case 'current-year':
      return {
        start: startOfDay(new Date(now.getFullYear(), 0, 1)),
        end: endOfDay(now),
      };
    case 'last-month': {
      const lastMonth = subMonths(now, 1);
      return {
        start: startOfDay(startOfMonth(lastMonth)),
        end: endOfDay(endOfMonth(lastMonth)),
      };
    }
    case 'last-year': {
      const lastYear = subYears(now, 1);
      return {
        start: startOfDay(startOfMonth(new Date(lastYear.getFullYear(), 0, 1))),
        end: endOfDay(new Date(lastYear.getFullYear(), 11, 31)),
      };
    }
    case 'custom': {
      const startCandidate = customStart
        ? startOfDay(parseISO(customStart))
        : startOfDay(now);
      const endCandidate = customEnd ? endOfDay(parseISO(customEnd)) : endOfDay(now);

      return startCandidate <= endCandidate
        ? { start: startCandidate, end: endCandidate }
        : { start: startOfDay(endCandidate), end: endOfDay(startCandidate) };
    }
    case 'last-10-days':
    default:
      return {
        start: startOfDay(subDays(now, 9)),
        end: endOfDay(now),
      };
  }
}

export function filterReceiptsByDateRange(receipts: Receipt[], range: DateRange) {
  return receipts.filter((receipt) => {
    const receiptDate = parseISO(receipt.date);
    return isWithinInterval(receiptDate, range);
  });
}

export function getRangeSpent(receipts: Receipt[], range: DateRange) {
  const receiptsInRange = filterReceiptsByDateRange(receipts, range);

  return receiptsInRange.reduce((sum, receipt) => sum + receipt.total, 0);
}

export function buildSpendHistory(
  receipts: Receipt[],
  range: DateRange,
): SpendHistoryPoint[] {
  const dailyTotals = new Map<string, number>();

  for (const receipt of receipts) {
    const receiptDate = parseISO(receipt.date);
    if (!isWithinInterval(receiptDate, range)) {
      continue;
    }

    const key = format(receiptDate, 'yyyy-MM-dd');
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + receipt.total);
  }

  let runningTotal = 0;

  return eachDayOfInterval(range).map((day) => {
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
