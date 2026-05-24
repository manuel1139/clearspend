import React from 'react';
import { useMemo } from 'react';
import { resolveDateRange, resolveReceiptDateRange, DateRangePreset } from '../lib/dashboard';
import { KontoEntry, Receipt } from '../types';

interface ForecastScreenProps {
  kontoEntries: { entries: KontoEntry[] };
  receipts: { receipts: Receipt[] };
  budget: { monthlyBudget: number };
  historyRange: DateRangePreset;
  customRangeStart: string;
  customRangeEnd: string;
}

export function ForecastScreen({ kontoEntries, receipts, budget, historyRange, customRangeStart, customRangeEnd }: ForecastScreenProps) {
  const selectedRange = useMemo(
    () => (historyRange === 'all' ? resolveReceiptDateRange(receipts.receipts) : resolveDateRange(historyRange, customRangeStart, customRangeEnd)),
    [customRangeEnd, customRangeStart, historyRange, receipts.receipts]
  );

  const forecastTotal = useMemo(() => {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const kontoInRange = kontoEntries.entries.filter((e: KontoEntry) => e.bookingDate >= selectedRange.start.toISOString());
    const spentSoFar = kontoInRange.reduce((sum: number, entry: KontoEntry) => sum + entry.amount, 0);
    return (spentSoFar / Math.max(currentDay, 1)) * daysInMonth;
  }, [kontoEntries.entries, selectedRange]);

  const progress = Math.min(100, (forecastTotal / budget.monthlyBudget) * 100);
  const isOver = forecastTotal > budget.monthlyBudget;

  return (
    <div className="space-y-4">
      <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-xl">
        <p className="text-[11px] uppercase tracking-widest text-white/60">Spending Forecast</p>
        <p className="mt-2 text-sm text-white/72">Linear projection of your current monthly spending.</p>
      </div>

      <div className="rounded-[1.7rem] bg-white/12 p-6 text-white backdrop-blur-sm">
        <p className="text-[11px] uppercase tracking-widest text-white/60">Estimated Month End</p>
        <p className="mt-2 text-3xl font-bold">EUR {forecastTotal.toFixed(2)}</p>
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Target Budget</span>
            <span>EUR {budget.monthlyBudget.toFixed(2)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-all ${isOver ? 'bg-red-400' : 'bg-green-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {isOver && (
            <p className="text-[10px] text-red-300 font-medium">Predicted to exceed budget by EUR {(forecastTotal - budget.monthlyBudget).toFixed(2)}</p>
          )}
        </div>
      </div>
    </div>
  );
}