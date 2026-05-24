import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { buildSpendHistory, resolveDateRange, resolveReceiptDateRange, DateRangePreset } from '../lib/dashboard';
import { KontoEntry, Receipt, ReceiptCategory } from '../types';
import { AccountOverview } from '../lib/mockAccounts';
import { SpendHistoryChart } from './SpendHistoryChart';

interface DashboardProps {
  accounts: AccountOverview[];
  budget: { monthlyBudget: number };
  categories: { // Changed from any
    categories: ReceiptCategory[];
    refreshCategories?: () => Promise<void>;
  };
  historyRange: DateRangePreset;
  customRangeStart: string;
  customRangeEnd: string;
  receipts: {
    receipts: Receipt[];
    setSelectedReceipt: (r: Receipt | null) => void; // Can be null
  };
  kontoEntries: {
    entries: KontoEntry[];
    refreshEntries: () => Promise<void>; // Added refreshEntries
  };
  selectedCategoryName: string | null;
  setSelectedCategoryName: (name: string | null) => void;
  draggedCategoryIndex: number | null;
  setDraggedCategoryIndex: (index: number | null) => void;
  isCategorizingAI: boolean;
  setIsCategorizingAI: (val: boolean) => void;
  geminiConfigured: boolean;
  setError: (err: string | null) => void;
}

interface DashboardListItem {
  id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  categoryName: string;
  productLabel?: string;
  receipt?: Receipt;
  kontoEntry?: KontoEntry;
}

export function Dashboard({
  accounts,
  budget,
  categories,
  historyRange,
  customRangeStart,
  customRangeEnd,
  receipts,
  kontoEntries,
  selectedCategoryName,
  setSelectedCategoryName,
  draggedCategoryIndex,
  setDraggedCategoryIndex,
  isCategorizingAI,
  setIsCategorizingAI,
  geminiConfigured,
  setError,
}: DashboardProps) {
  const selectedRange = useMemo(
    () => (historyRange === 'all' ? resolveReceiptDateRange(receipts.receipts) : resolveDateRange(historyRange, customRangeStart, customRangeEnd)),
    [customRangeEnd, customRangeStart, historyRange, receipts.receipts]
  );

  const kontoEntriesInRange = useMemo(
    () => kontoEntries.entries.filter((entry: KontoEntry) => entry.bookingDate >= selectedRange.start.toISOString() && entry.bookingDate <= selectedRange.end.toISOString()),
    [kontoEntries.entries, selectedRange]
  );

  const categoryStackItems = useMemo(() => categories.categories.map((c) => c.name), [categories.categories]);

  const activeCategoryItems = useMemo<DashboardListItem[]>(() => {
    const items = kontoEntriesInRange.map((entry: KontoEntry): DashboardListItem => {
      const linkedReceipt = receipts.receipts.find((r: Receipt) => r.kontoEntryId === entry.id);
      return {
        id: entry.id,
        merchant: linkedReceipt?.merchant ?? entry.counterpartyName ?? 'Konto',
        date: entry.bookingDate,
        total: entry.amount,
        currency: entry.currency,
        categoryName: linkedReceipt?.categoryName ?? entry.categoryName ?? 'Sonstiges',
        productLabel: linkedReceipt ? linkedReceipt.items?.[0]?.name : entry.reference || entry.remittanceInfo,
        receipt: linkedReceipt,
        kontoEntry: entry,
      };
    });

    return !selectedCategoryName
      ? []
      : items.filter((item) => item.categoryName === selectedCategoryName).sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCategoryName, kontoEntriesInRange, receipts.receipts]);

  const categoryStackTotals = useMemo(() => {
    const totals = new Map<string, { amount: number; currency: string }>();
    for (const entry of kontoEntriesInRange) {
      const linkedReceipt = receipts.receipts.find((r: Receipt) => r.kontoEntryId === entry.id);
      const catName = linkedReceipt?.categoryName ?? entry.categoryName ?? 'Sonstiges';
      const current = totals.get(catName) ?? { amount: 0, currency: entry.currency || 'EUR' };
      current.amount += entry.amount;
      totals.set(catName, current);
    }
    return totals;
  }, [kontoEntriesInRange, receipts.receipts]);

  const spendHistory = useMemo(
    () =>
      buildSpendHistory(
        kontoEntriesInRange.map((e: KontoEntry) => {
          const r = receipts.receipts.find((rec: Receipt) => rec.kontoEntryId === e.id);
          return { date: e.bookingDate, total: e.amount, categoryName: r?.categoryName ?? e.categoryName ?? 'Sonstiges' };
        }) as unknown as Receipt[],
        selectedRange
      ),
    [kontoEntriesInRange, receipts.receipts, selectedRange]
  );

  const currentBalanceTotal = useMemo(() => accounts.reduce((sum, account) => sum + parseFloat(account.balance.replace(/[^0-9.-]+/g, '')), 0), [accounts]);

  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', categoryStackItems[index] || '');
  };

  const handleCategoryDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCategoryIndex === null || draggedCategoryIndex === index) {
      setDraggedCategoryIndex(null);
      return;
    }
    const newCategories = [...categories.categories];
    const [moved] = newCategories.splice(draggedCategoryIndex, 1);
    newCategories.splice(index, 0, moved);
    try {
      const res = await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: newCategories.map((cat, idx) => ({ id: cat.id, displayOrder: idx })) }),
      });
      if (res.ok && categories.refreshCategories) {
        await categories.refreshCategories();
      }
    } catch {
      setError('Failed to reorder categories');
    } finally {
      setDraggedCategoryIndex(null);
    }
  };

  const handleUpdateEntryCategory = async (entryId: string, categoryId: number) => {
    try {
      const res = await fetch(`/api/konto/${entryId}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });
      if (res.ok) await kontoEntries.refreshEntries();
    } catch {
      setError('Failed to update category');
    }
  };

  const handleCategorizeSonstigesAI = async () => {
    if (isCategorizingAI) return;
    setIsCategorizingAI(true);
    try {
      const res = await fetch('/api/konto/categorize-ai', { method: 'POST' });
      if (res.ok) await kontoEntries.refreshEntries();
    } catch {
      setError('AI categorization failed');
    } finally {
      setIsCategorizingAI(false);
    }
  };

  return (
    <>
      <SpendHistoryChart points={spendHistory} />
      <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-4 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] uppercase tracking-widest text-white/60">Kategorien</p>
          <button
            onClick={handleCategorizeSonstigesAI}
            disabled={isCategorizingAI || !geminiConfigured}
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[9px] font-bold uppercase text-white transition hover:bg-white/20 disabled:opacity-40"
          >
            <Sparkles size={12} className={isCategorizingAI ? 'animate-pulse' : 'text-[#FFD0E6]'} />
            <span>{isCategorizingAI ? 'Categorizing...' : 'AI Fix Sonstige'}</span>
          </button>
        </div>
        <div className="mt-3 h-[32rem] overflow-y-auto overscroll-contain rounded-[1.7rem] bg-white/10 p-3 backdrop-blur-sm [scrollbar-width:none]">
          <div className="flex flex-col gap-3">
            {categoryStackItems.map((categoryName: string, index: number) => (
              <div
                key={categoryName}
                draggable
                onDragStart={(e) => handleCategoryDragStart(e, index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleCategoryDrop(e, index)}
                className={`flex flex-col gap-2 transition-opacity ${draggedCategoryIndex === index ? 'opacity-40' : 'opacity-100'}`}
              >
                <button
                  onClick={() => setSelectedCategoryName(selectedCategoryName === categoryName ? null : categoryName)}
                  className={`rounded-[1.4rem] bg-linear-to-br from-[#FF5FA2] to-[#FF9BCB] px-3 py-2.5 text-left shadow-lg ${selectedCategoryName === categoryName ? 'ring-2 ring-white/60' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{categoryName}</p>
                    <p className="shrink-0 text-sm font-semibold text-white/86">
                      {categoryStackTotals.get(categoryName)?.currency} {categoryStackTotals.get(categoryName)?.amount.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </button>
                {selectedCategoryName === categoryName && (
                  <div className="space-y-2 py-1">
                    {activeCategoryItems.map((item) => (
                      <div key={item.id} className="flex flex-col gap-2 rounded-[1.2rem] bg-white/10 px-3 py-3">
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{item.merchant}</p>
                            <p className="truncate text-[10px] text-white/60">{item.productLabel}</p>
                          </div>
                          <p className="text-sm font-bold text-white">{item.currency} {item.total.toFixed(2)}</p>
                        </div>
                        {!item.receipt && (
                          <select
                            className="w-full bg-transparent text-[10px] text-white/40 outline-none"
                            value={
                              categories.categories.find((c: ReceiptCategory) => c.name === item.categoryName)
                                ?.id || ''
                            }
                            onChange={(e) => handleUpdateEntryCategory(item.id, Number(e.target.value))}
                          >
                            {categories.categories.map((cat: ReceiptCategory) => (
                              <option key={cat.id} value={cat.id} className="text-black">
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatBox label="Balance" value={`EUR ${currentBalanceTotal.toFixed(2)}`} />
        <StatBox label="Budget" value={`EUR ${budget.monthlyBudget.toFixed(2)}`} />
      </div>
    </>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.7rem] bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-3 text-white shadow-lg">
      <p className="text-[11px] uppercase tracking-widest text-white/60">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}