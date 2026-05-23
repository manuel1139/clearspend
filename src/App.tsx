/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Cog,
  FileImage,
  Landmark,
  PackageSearch,
  SquarePen,
  Sparkles,
  ScrollText,
  Bug,
  TrendingUp,
  Repeat,
} from 'lucide-react';
import { ErrorAlert } from './components/ErrorAlert';
import { ImportSummaryBanner } from './components/ImportSummaryBanner';
import { PasteOrderModal } from './components/PasteOrderModal';
import { ReceiptCard } from './components/ReceiptCard';
import { AccountsDrawer } from './components/AccountsDrawer';
import { ImportHubModal } from './components/ImportHubModal';
import { SpendHistoryChart } from './components/SpendHistoryChart';
import { ConfigPage } from './components/ConfigPage';
import { useBudget } from './hooks/useBudget';
import { useCategories } from './hooks/useCategories';
import { usePaymentRules } from './hooks/usePaymentRules';
import { useKontoEntries } from './hooks/useKontoEntries';
import { useReceiptImport } from './hooks/useReceiptImport';
import { useReceipts } from './hooks/useReceipts';
import {
  buildSpendHistory,
  resolveDateRange,
  resolveReceiptDateRange,
  type DateRangePreset,
} from './lib/dashboard';
import { MOCK_ACCOUNTS } from './lib/mockAccounts';
import type { AccountOverview } from './lib/mockAccounts';
import type { KontoEntry, Receipt } from './types';

const HISTORY_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'current-year', label: 'This year' },
  { value: 'current-month', label: 'Current month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-year', label: 'Last year' },
  { value: 'last-10-days', label: 'Last 10 days' },
  { value: 'custom', label: 'Custom dates' },
];

function RangeSelect({
  value,
  onChange,
}: {
  value: DateRangePreset;
  onChange: (value: DateRangePreset) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">Select history range</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DateRangePreset)}
        className="appearance-none rounded-full bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-2 pr-9 text-xs font-semibold text-white outline-none shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
      >
        {HISTORY_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="text-slate-950">
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9B2C66]/80">
        ▾
      </span>
    </label>
  );
}

function parseCurrencyValue(value: string) {
  const normalized = value.replace(/[^0-9,.-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyAmount(currency: string | undefined, amount: number) {
  return `${currency ?? 'EUR'} ${amount.toFixed(2)}`;
}

function getReceiptProductNames(receipt: { items?: { name: string }[] }) {
  return receipt.items
    ?.map((item) => item.name.trim())
    .filter((name) => name.length > 0) ?? [];
}

function isDateWithinRange(date: string, start: Date, end: Date) {
  const value = new Date(date);
  return value >= start && value <= end;
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

function DataEntryTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[1.7rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] p-4 text-left text-white shadow-[0_16px_36px_rgba(114,29,83,0.24)] backdrop-blur-sm transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-[1.2rem] bg-white/14 p-3 text-white">{icon}</div>
      </div>
      <p className="mt-4 text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-white/72">{description}</p>
    </button>
  );
}

function formatImportKind(kind: string | null) {
  switch (kind) {
    case 'receipt-image':
      return 'Receipt image';
    case 'amazon-text':
      return 'Amazon text';
    case 'amazon-csv':
      return 'Amazon CSV';
    case 'konto-zip':
      return 'Konto ZIP';
    default:
      return 'No import yet';
  }
}

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const [isImportHubOpen, setIsImportHubOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isCategorizingAI, setIsCategorizingAI] = useState(false);
  const [historyRange, setHistoryRange] = useState<DateRangePreset>('current-month');
  const [customRangeStart, setCustomRangeStart] = useState('');
  const [customRangeEnd, setCustomRangeEnd] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [detectedEnvKeys, setDetectedEnvKeys] = useState<string[]>([]);

  const [activeScreen, setActiveScreen] = useState<
    'dashboard' | 'intake' | 'config' | 'konto' | 'debug' | 'forecast' | 'recurring'
  >('dashboard');

  useEffect(() => {
    fetch('/api/gemini/status')
      .then((res) => res.json())
      .then((data) => {
        setGeminiApiKey(data.apiKey);
        setDetectedEnvKeys(data.detectedKeys || []);
      })
      .catch(() => setGeminiApiKey(null));
  }, []);

  const [accounts, setAccounts] = useState<AccountOverview[]>(MOCK_ACCOUNTS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const kontoZipInputRef = useRef<HTMLInputElement>(null);

  const categories = useCategories(setError);
  const paymentRules = usePaymentRules(setError);
  const kontoEntries = useKontoEntries(setError);
  const receipts = useReceipts(
    setError,
    categories.categories,
    paymentRules.paymentRules,
  );
  const budget = useBudget(setError);
  const imports = useReceiptImport({
    categories: categories.categories,
    paymentRules: paymentRules.paymentRules,
    receipts: receipts.receipts,
    onError: setError,
    onImportedReceipts: receipts.prependReceipts,
    onMergeReceipts: receipts.mergeReceipts,
    onReviewReceipts: receipts.startReview,
    onClearReview: receipts.clearReview,
    onRefreshKontoEntries: kontoEntries.refreshEntries,
  });
  const selectedRange = useMemo(
    () =>
      historyRange === 'all'
        ? resolveReceiptDateRange(receipts.receipts)
        : resolveDateRange(historyRange, customRangeStart, customRangeEnd),
    [customRangeEnd, customRangeStart, historyRange, receipts.receipts],
  );
  const kontoEntriesInRange = useMemo(
    () =>
      kontoEntries.entries.filter(
        (entry) =>
          isDateWithinRange(entry.bookingDate, selectedRange.start, selectedRange.end),
      ),
    [kontoEntries.entries, selectedRange],
  );

  const recurringReceipts = useMemo(
    () => receipts.receipts.filter((r) => r.paymentRuleFrequency !== 'one_time'),
    [receipts.receipts],
  );

  const categoryStackItems = useMemo(() => {
    return categories.categories.map((c) => c.name);
  }, [categories.categories]);

  const activeCategoryName = selectedCategoryName;
  const activeCategoryItems = useMemo<DashboardListItem[]>(
    () => {
      const items = kontoEntriesInRange.map((entry): DashboardListItem => {
        const linkedReceipt = receipts.receipts.find((r) => r.kontoEntryId === entry.id);

        return {
          id: entry.id,
          merchant: linkedReceipt?.merchant ?? entry.counterpartyName ?? 'Konto',
          date: entry.bookingDate,
          total: entry.amount,
          currency: entry.currency,
          categoryName: linkedReceipt?.categoryName ?? entry.categoryName ?? 'Sonstiges',
          productLabel: linkedReceipt
            ? getReceiptProductNames(linkedReceipt)[0]
              ? `${getReceiptProductNames(linkedReceipt)[0]}${
                  getReceiptProductNames(linkedReceipt).length > 1
                    ? ` +${getReceiptProductNames(linkedReceipt).length - 1}`
                    : ''
                }`
              : undefined
            : entry.reference || entry.remittanceInfo,
          receipt: linkedReceipt,
          kontoEntry: entry,
        };
      });

      const filtered = !activeCategoryName
        ? []
        : items.filter((item) => item.categoryName === activeCategoryName);

      return filtered.sort((left, right) => right.date.localeCompare(left.date));
    },
    [activeCategoryName, kontoEntriesInRange, receipts.receipts],
  );
  const categoryStackTotals = useMemo(() => {
    const totals = new Map<string, { amount: number; currency: string }>();

    for (const entry of kontoEntriesInRange) {
      const linkedReceipt = receipts.receipts.find((r) => r.kontoEntryId === entry.id);
      const catName = linkedReceipt?.categoryName ?? entry.categoryName ?? 'Sonstiges';

      const categoryTotal = totals.get(catName) ?? {
        amount: 0,
        currency: entry.currency || 'EUR',
      };

      categoryTotal.amount += entry.amount;
      totals.set(catName, categoryTotal);
    }

    return totals;
  }, [kontoEntriesInRange, receipts.receipts]);

  const spendHistory = useMemo(
    () =>
      buildSpendHistory(
        kontoEntriesInRange.map((e) => {
          const r = receipts.receipts.find((rec) => rec.kontoEntryId === e.id);
          return {
            date: e.bookingDate,
            total: e.amount,
            categoryName: r?.categoryName ?? e.categoryName ?? 'Sonstiges',
                };
              }) as unknown as Receipt[],
        selectedRange,
      ),
    [kontoEntriesInRange, receipts.receipts, selectedRange],
  );
  const currentBalanceTotal = useMemo(
    () =>
      accounts.reduce(
        (sum, account) => sum + parseCurrencyValue(account.balance),
        0,
      ),
    [accounts],
  );

  const forecastTotal = useMemo(() => {
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0,
    ).getDate();
    const currentDay = new Date().getDate();
    const spentSoFar = Array.from(categoryStackTotals.values()).reduce(
      (sum, val) => sum + val.amount,
      0,
    );

    // Linear extrapolation
    return (spentSoFar / Math.max(currentDay, 1)) * daysInMonth;
  }, [categoryStackTotals]);

  const handleReviewDelete = () => {
    if (!receipts.selectedReceipt) return;

    if (receipts.selectedReceipt.id.startsWith('temp-')) {
      receipts.dismissSelectedReviewReceipt();
      return;
    }

    void receipts.deleteReceipt(receipts.selectedReceipt.id);
  };

  const handleSaveAccount = (draftAccount: AccountOverview) => {
    if (!draftAccount.name.trim() || !draftAccount.bank.trim()) {
      setError('Account name and bank are required.');
      return;
    }

    setAccounts((currentAccounts: AccountOverview[]) => {
      const existingIndex = currentAccounts.findIndex(
        (account: AccountOverview) => account.id === draftAccount.id,
      );

      if (existingIndex === -1) {
        return [...currentAccounts, draftAccount];
      }

      return currentAccounts.map((account: AccountOverview) =>
        account.id === draftAccount.id ? draftAccount : account,
      );
    });

    setError(null);
  };

  const handleDeleteAccount = (accountId: string) => {
    setAccounts((currentAccounts) =>
      currentAccounts.filter((account) => account.id !== accountId),
    );
  };

  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Required for drag and drop to work in many browsers
    e.dataTransfer.setData('text/plain', categoryStackItems[index] || '');
  };

  const handleCategoryDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCategoryIndex === null) {
      setDraggedCategoryIndex(null);
      return;
    }
    const targetIndex = index;
    if (draggedCategoryIndex === targetIndex) {
      setDraggedCategoryIndex(null);
      return;
    }

    const newCategories = [...categories.categories];
    const [moved] = newCategories.splice(draggedCategoryIndex, 1);
    newCategories.splice(targetIndex, 0, moved);

    const reorders = newCategories.map((cat, idx) => ({
      id: cat.id,
      displayOrder: idx,
    }));

    try {
      const response = await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: reorders }),
      });

      if (response.ok) {
        const refresh = (categories as unknown as { refreshCategories?: () => Promise<void> })
          .refreshCategories;
        if (typeof refresh === 'function') {
          await refresh();
        }
      }
    } catch {
      setError('Failed to save new category order.');
    } finally {
      setDraggedCategoryIndex(null);
    }
  };

  const handleUpdateEntryCategory = async (entryId: string, categoryId: number) => {
    try {
      const response = await fetch(`/api/konto/${entryId}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });

      if (response.ok) {
        await kontoEntries.refreshEntries();
      }
    } catch {
      setError('Failed to update transaction category.');
    }
  };

  const handleCategorizeSonstigesAI = async () => {
    if (isCategorizingAI) return;
    setIsCategorizingAI(true);
    try {
      const response = await fetch('/api/konto/categorize-ai', {
        method: 'POST',
      });
      if (response.ok) {
        await kontoEntries.refreshEntries();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to run AI categorization.');
      }
    } catch {
      setError('An error occurred during AI categorization.');
    } finally {
      setIsCategorizingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-3 py-4 text-slate-950 sm:px-6 sm:py-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={imports.handleFileUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={csvInputRef}
        onChange={imports.handleCsvUpload}
        accept=".csv"
        className="hidden"
      />
      <input
        type="file"
        ref={kontoZipInputRef}
        onChange={imports.handleKontoZipUpload}
        accept=".zip,application/zip"
        className="hidden"
      />

      <div
        className={`mx-auto min-h-[calc(100vh-2rem)] max-w-107.5 overflow-hidden rounded-[2.4rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] shadow-[0_35px_120px_rgba(52,11,36,0.28)] backdrop-blur-xl ${
          imports.isDragging ? 'ring-4 ring-[#FF5FA2]/20' : ''
        }`}
        onDragOver={imports.handleDragOver}
        onDragLeave={imports.handleDragLeave}
        onDrop={imports.handleDrop}
      >
        <div className="px-4 pb-8 pt-5 sm:px-5">
          <ImportSummaryBanner
            summary={imports.importSummary}
            onDismiss={() => imports.setImportSummary(null)}
          />

          <ErrorAlert error={error} onDismiss={() => setError(null)} />

          {activeScreen !== 'config' ? (
            <div className="space-y-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    ClearSpend Mobile
                  </p>
                  <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-950">
                    {activeScreen === 'dashboard'
                      ? 'Dashboard'
                      : activeScreen === 'intake'
                        ? 'Data Entry'
                        : activeScreen === 'konto'
                          ? 'Banking'
                          : activeScreen === 'debug'
                            ? 'Debug'
                            : activeScreen === 'forecast'
                              ? 'Forecast'
                              : activeScreen === 'recurring'
                                ? 'Recurring'
                          : 'Configuration'}
                  </h1>
                  {activeScreen === 'dashboard' && (
                    <div className="mt-3 space-y-3">
                      <div className="flex justify-start">
                        <RangeSelect value={historyRange} onChange={setHistoryRange} />
                      </div>
                      {historyRange === 'custom' && (
                        <div className="flex flex-wrap gap-2">
                          <label className="min-w-[8.75rem] flex-1">
                            <span className="sr-only">Custom range start date</span>
                            <input
                              type="date"
                              value={customRangeStart}
                              onChange={(event) => setCustomRangeStart(event.target.value)}
                              className="w-full rounded-full bg-white/14 px-4 py-2 text-xs font-medium text-slate-950 outline-none ring-1 ring-white/20 placeholder:text-slate-500"
                            />
                          </label>
                          <label className="min-w-[8.75rem] flex-1">
                            <span className="sr-only">Custom range end date</span>
                            <input
                              type="date"
                              value={customRangeEnd}
                              onChange={(event) => setCustomRangeEnd(event.target.value)}
                              className="w-full rounded-full bg-white/14 px-4 py-2 text-xs font-medium text-slate-950 outline-none ring-1 ring-white/20 placeholder:text-slate-500"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {[
                    'intake',
                    'konto',
                    'debug',
                    'forecast',
                    'recurring',
                  ].includes(activeScreen) ? (
                    <button
                      onClick={() => setActiveScreen('dashboard')}
                      aria-label="Back to dashboard"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setActiveScreen('konto')}
                        aria-label="Open banking entries"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
                      >
                        <Landmark size={18} />
                      </button>
                      <button
                        onClick={() => setActiveScreen('recurring')}
                        aria-label="Open recurring payments"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
                      >
                        <Repeat size={18} />
                      </button>
                      <button
                        onClick={() => setActiveScreen('forecast')}
                        aria-label="Open forecast"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
                      >
                        <TrendingUp size={18} />
                      </button>
                      <button
                        onClick={() => setActiveScreen('debug')}
                        aria-label="Open debug info"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
                      >
                        <Bug size={18} />
                      </button>
                      <button
                        onClick={() => setActiveScreen('intake')}
                        aria-label="Open data entry"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
                      >
                        <SquarePen size={18} />
                      </button>
                      <button
                        onClick={() => setActiveScreen('config')}
                        aria-label="Open configuration"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
                      >
                        <Cog size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {activeScreen === 'dashboard' ? (
                <>
                  <SpendHistoryChart points={spendHistory} />

                  <div
                    className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-4 text-left text-white shadow-[0_22px_64px_rgba(130,37,90,0.28)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                          Kategorien
                        </p>
                      </div>
                      <button
                        onClick={handleCategorizeSonstigesAI}
                        disabled={isCategorizingAI || !imports.geminiConfigured}
                        title="Categorize 'Sonstiges' items using AI"
                        className="mt-0.5 flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white transition hover:bg-white/20 disabled:opacity-40"
                      >
                        <Sparkles size={12} className={isCategorizingAI ? 'animate-pulse text-white' : 'text-[#FFD0E6]'} />
                        <span>{isCategorizingAI ? 'Categorizing...' : 'AI Fix Sonstige'}</span>
                      </button>
                    </div>

                <div className="mt-3 h-[32rem] overflow-y-auto overscroll-contain rounded-[1.7rem] bg-white/10 p-3 backdrop-blur-sm touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-full flex-col gap-3">
                  {categoryStackItems.map((categoryName, index) => (
                    <div
                      key={categoryName}
                      draggable
                      onDragStart={(e) => handleCategoryDragStart(e, index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleCategoryDrop(e, index)}
                      onDragEnd={() => setDraggedCategoryIndex(null)}
                      className={`flex flex-col gap-2 transition-opacity ${
                        draggedCategoryIndex === index ? 'opacity-40' : 'opacity-100'
                      }`}
                    >
                      <button
                        type="button"
                          onClick={() =>
                            setSelectedCategoryName((curr) => (curr === categoryName ? null : categoryName))
                          }
                          className={`rounded-[1.4rem] bg-linear-to-br ${
                            accounts[index % accounts.length]?.accent ??
                            'from-[#FF5FA2] via-[#FF78B5] to-[#FF9BCB]'
                          } px-3 py-2.5 text-left shadow-[0_16px_36px_rgba(114,29,83,0.28)] transition-transform ${
                            activeCategoryName === categoryName
                              ? 'ring-2 ring-white/60'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                              {categoryName}
                            </p>
                            <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-white/86">
                              {formatCurrencyAmount(
                                categoryStackTotals.get(categoryName)?.currency,
                                categoryStackTotals.get(categoryName)?.amount ?? 0,
                              )}
                            </p>
                          </div>
                      </button>
                      {activeCategoryName === categoryName && (
                        <div className="space-y-2 py-1">
                          {activeCategoryItems.length === 0 ? (
                            <div className="rounded-[1.2rem] bg-white/5 px-3 py-3 text-xs text-white/60">
                              No items for this category yet.
                            </div>
                          ) : (
                            activeCategoryItems.map((item) => (
                              <div
                                key={item.id}
                                className="group relative flex w-full flex-col gap-2 rounded-[1.2rem] bg-white/10 px-3 py-3 transition hover:bg-white/16"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.receipt) {
                                        receipts.setSelectedReceipt(item.receipt);
                                      }
                                    }}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <p className="text-sm font-medium text-white">
                                      {item.merchant}
                                    </p>
                                    {item.productLabel && (
                                      <p className="mt-1 truncate text-xs text-white/78">
                                        {item.productLabel}
                                      </p>
                                    )}
                                    <p className="mt-1 text-xs text-white/68">
                                      {new Date(item.date).toLocaleDateString()}
                                    </p>
                                  </button>
                                  <p className="text-sm font-medium text-white/82 shrink-0">
                                    {item.currency} {item.total.toFixed(2)}
                                  </p>
                                </div>
                                {!item.receipt && (
                                  <div className="mt-2 border-t border-white/10 pt-2">
                                    <select
                                      className="w-full bg-transparent text-[10px] text-white/60 outline-none"
                                      value={categories.categories.find(c => c.name === item.categoryName)?.id || ''}
                                      onChange={(e) => handleUpdateEntryCategory(item.id, Number(e.target.value))}
                                    >
                                      {categories.categories.map(cat => (
                                        <option key={cat.id} value={cat.id} className="text-slate-900">{cat.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[1.7rem] bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-3 text-white shadow-[0_16px_36px_rgba(114,29,83,0.24)]">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                        Current balance
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        EUR {currentBalanceTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-[1.7rem] bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-3 text-white shadow-[0_16px_36px_rgba(114,29,83,0.24)]">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                        Budget
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        EUR {budget.monthlyBudget.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </>
              ) : activeScreen === 'intake' ? (
                <div className="space-y-4">
                  <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-[0_22px_64px_rgba(130,37,90,0.28)]">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                      Data sources
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      Add new spending data from Amazon, receipt images, banking data, or manual entries.
                    </p>
                  </div>

                  <div className="rounded-[1.7rem] bg-white/12 p-4 text-white backdrop-blur-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                          Gemini status
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {imports.geminiConfigured ? 'Configured' : 'Missing API key'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                          Last import
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatImportKind(imports.lastImportKind)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-white/76">
                      Status: {imports.lastImportPhase}
                    </p>
                    <p className="mt-1 text-sm text-white/76">
                      {imports.lastImportMessage}
                    </p>
                    <p className="mt-3 text-xs text-white/60">
                      Gemini is used for receipt images, Amazon text, and Amazon CSV. Konto ZIP and manual entry do not call Gemini.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DataEntryTile
                      icon={<FileImage size={20} />}
                      title="Receipt image"
                      description="Import a photo or screenshot and review the extracted receipt."
                      onClick={() => fileInputRef.current?.click()}
                    />
                    <DataEntryTile
                      icon={<PackageSearch size={20} />}
                      title="Amazon CSV"
                      description="Upload exported Amazon order history and group items by order."
                      onClick={() => csvInputRef.current?.click()}
                    />
                    <DataEntryTile
                      icon={<ScrollText size={20} />}
                      title="Amazon text"
                      description="Paste an order email or detail page to import Amazon items."
                      onClick={() => imports.setIsPasting(true)}
                    />
                    <DataEntryTile
                      icon={<Landmark size={20} />}
                      title="Konto"
                      description="Import a ZIP file with CAMT.008 account data and link it to receipts."
                      onClick={() => kontoZipInputRef.current?.click()}
                    />
                    <DataEntryTile
                      icon={<SquarePen size={20} />}
                      title="Manual entry"
                      description="Create a new expense entry and edit the data yourself."
                      onClick={receipts.handleManualEntry}
                    />
                  </div>
                </div>
              ) : activeScreen === 'konto' ? (
                <div className="space-y-4">
                  <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-[0_22px_64px_rgba(130,37,90,0.28)]">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                      Account Transactions
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      Review all imported transactions from your bank statements and matching status.
                    </p>
                  </div>

                  <div className="rounded-[1.7rem] bg-white/12 p-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3 px-1 mb-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                        Entries
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleCategorizeSonstigesAI}
                          disabled={isCategorizingAI || !imports.geminiConfigured}
                          className="flex items-center gap-1.5 rounded-full bg-white/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white transition hover:bg-white/20 disabled:opacity-40"
                        >
                          <Sparkles size={10} className={isCategorizingAI ? 'animate-pulse' : 'text-[#FFD0E6]'} />
                          <span>AI Fix</span>
                        </button>
                        <p className="text-[10px] font-medium text-white/40">{kontoEntries.entries.length} items</p>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                      {kontoEntries.entries.length === 0 ? (
                        <div className="rounded-[1.2rem] bg-white/10 px-3 py-8 text-center text-sm text-white/78">
                          No banking entries found. Import a ZIP file in Data Entry.
                        </div>
                      ) : (
                        kontoEntries.entries.map((entry) => (
                          <div key={entry.id} className="flex w-full items-center justify-between gap-3 rounded-[1.2rem] bg-white/10 px-3 py-3 text-left">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">{entry.counterpartyName}</p>
                              {entry.counterpartyId && (
                                <p className="mt-0.5 text-[10px] text-white/50 truncate">ID: {entry.counterpartyId}</p>
                              )}
                              <p className="mt-1 truncate text-xs text-white/78">{entry.reference || entry.remittanceInfo}</p>
                              <p className="mt-1 text-xs text-white/68">{new Date(entry.bookingDate).toLocaleDateString()}</p>
                              {entry.sourceFileName && (
                                <p className="mt-1 text-[10px] italic text-white/40 truncate">
                                  Source: {entry.sourceFileName}
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-medium text-white/82 tabular-nums">
                              {entry.currency} {entry.amount.toFixed(2)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : activeScreen === 'recurring' ? (
                <div className="space-y-4">
                  <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-[0_22px_64px_rgba(130,37,90,0.28)]">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                      Recurring Expenses
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      Review your subscriptions and recurring payments identified from your receipts.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {recurringReceipts.length === 0 ? (
                      <div className="rounded-[1.7rem] bg-white/12 p-8 text-center text-sm text-white/60 backdrop-blur-sm">
                        No recurring payments found yet.
                      </div>
                    ) : (
                      recurringReceipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="flex items-center justify-between gap-3 rounded-[1.7rem] bg-white/12 p-4 text-white backdrop-blur-sm"
                        >
                          <div>
                            <p className="text-sm font-semibold">{receipt.merchant}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wider text-white/60">
                              {receipt.paymentRuleFrequency} • {receipt.categoryName}
                            </p>
                          </div>
                          <p className="text-sm font-bold">
                            {receipt.currency} {receipt.total.toFixed(2)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : activeScreen === 'forecast' ? (
                <div className="space-y-4">
                  <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-[0_22px_64px_rgba(130,37,90,0.28)]">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                      Spending Forecast
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      Linear projection of your current spending for the remainder of the month.
                    </p>
                  </div>

                  <div className="rounded-[1.7rem] bg-white/12 p-6 text-white backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-widest text-white/60">
                      Estimated Month End
                    </p>
                    <p className="mt-2 text-3xl font-bold">
                      EUR {forecastTotal.toFixed(2)}
                    </p>
                    <div className="mt-6 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Target Budget</span>
                        <span>EUR {budget.monthlyBudget.toFixed(2)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full transition-all ${
                            forecastTotal > budget.monthlyBudget ? 'bg-red-400' : 'bg-green-400'
                          }`}
                          style={{
                            width: `${Math.min(100, (forecastTotal / budget.monthlyBudget) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeScreen === 'debug' ? (
                <div className="space-y-4">
                  <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-[0_22px_64px_rgba(130,37,90,0.28)]">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                      System Debug
                    </p>
                  </div>

                  <div className="rounded-[1.7rem] bg-white/12 p-5 text-white backdrop-blur-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
                      Statistics
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-2xl bg-white/5 p-3">
                        <p className="text-white/50 text-[10px]">Bank Entries</p>
                        <p className="text-lg font-semibold">{kontoEntries.entries.length}</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-3">
                        <p className="text-white/50 text-[10px]">Receipts</p>
                        <p className="text-lg font-semibold">{receipts.receipts.length}</p>
                      </div>
                      <div className="col-span-2 rounded-2xl bg-white/5 p-3">
                        <p className="text-white/50 text-[10px]">Gemini API Key</p>
                        <p className={`mt-1 break-all font-mono text-[10px] ${geminiApiKey ? 'text-white/80' : 'text-red-400'}`}>
                          {geminiApiKey || `Not found. Found keys: ${detectedEnvKeys.join(', ') || 'None'}`}
                        </p>
                        {!geminiApiKey && detectedEnvKeys.length > 0 && (
                          <p className="mt-2 text-[9px] text-white/40 italic">
                            Check if the key name in Azure Portal matches GEMINI_API_KEY exactly.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <ConfigPage
              accounts={accounts}
              categories={categories.categories}
              monthlyBudget={budget.monthlyBudget}
              receipts={receipts.receipts}
              onBack={() => setActiveScreen('dashboard')}
              onSaveBudget={(value) => void budget.updateBudget(value)}
              onSaveAccount={handleSaveAccount}
              onDeleteAccount={handleDeleteAccount}
              onSaveCategory={categories.saveCategory}
              onDeleteCategory={categories.deleteCategory}
            />
          )}
        </div>
      </div>

      <ImportHubModal
        isOpen={isImportHubOpen}
        onClose={() => setIsImportHubOpen(false)}
        onImportReceiptImage={() => {
          setIsImportHubOpen(false);
          fileInputRef.current?.click();
        }}
        onImportAmazonCsv={() => {
          setIsImportHubOpen(false);
          csvInputRef.current?.click();
        }}
        onImportAmazonText={() => {
          setIsImportHubOpen(false);
          imports.setIsPasting(true);
        }}
        onUploadBankData={() => {
          setIsImportHubOpen(false);
          kontoZipInputRef.current?.click();
        }}
      />

      <AccountsDrawer
        accounts={accounts}
        isOpen={isAccountsOpen}
        onClose={() => setIsAccountsOpen(false)}
      />

      <PasteOrderModal
        isOpen={imports.isPasting}
        pastedText={imports.pastedText}
        onChange={imports.setPastedText}
        onClose={() => imports.setIsPasting(false)}
        onSubmit={() => void imports.handlePasteSubmit()}
      />

      {(imports.isScanning || receipts.selectedReceipt) && (
        <div className="fixed inset-0 z-40 flex items-end bg-[#08102E]/40 p-3 sm:p-6">
          <div className="mx-auto w-full max-w-md">
            {imports.isScanning ? (
              <div className="rounded-4xl bg-[#0E1433] px-6 py-8 text-white shadow-[0_28px_80px_rgba(8,16,46,0.35)]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">
                  Scanning
                </p>
                <h3 className="mt-3 text-2xl font-semibold">
                  Analyzing your receipt
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  We are extracting merchant, date, line items, and categorization from the import.
                </p>
              </div>
            ) : receipts.selectedReceipt ? (
              <ReceiptCard
                categories={categories.categories}
                paymentRules={paymentRules.paymentRules}
                receipt={receipts.selectedReceipt}
                onSave={(receipt) => void receipts.saveReceipt(receipt)}
                onDelete={handleReviewDelete}
                isUploading={receipts.isUploading}
                onClose={receipts.clearReview}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
