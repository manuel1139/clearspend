/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Cog,
  FileImage,
  Landmark,
  PackageSearch,
  SquarePen,
  Sparkles,
  ScrollText,
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
import { useReceiptImport } from './hooks/useReceiptImport';
import { useReceipts } from './hooks/useReceipts';
import {
  buildSpendHistory,
  filterReceiptsByDateRange,
  resolveDateRange,
  resolveReceiptDateRange,
  type DateRangePreset,
} from './lib/dashboard';
import { MOCK_ACCOUNTS } from './lib/mockAccounts';
import type { AccountOverview } from './lib/mockAccounts';

const CATEGORY_STACK_FALLBACK = ['Alle', 'Einkaufen', 'Essen'];
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

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const [isImportHubOpen, setIsImportHubOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [historyRange, setHistoryRange] = useState<DateRangePreset>('current-month');
  const [customRangeStart, setCustomRangeStart] = useState('');
  const [customRangeEnd, setCustomRangeEnd] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(
    'Alle',
  );
  const [activeScreen, setActiveScreen] = useState<
    'dashboard' | 'intake' | 'config'
  >('dashboard');
  const [accounts, setAccounts] = useState<AccountOverview[]>(MOCK_ACCOUNTS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const categories = useCategories(setError);
  const paymentRules = usePaymentRules(setError);
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
    onReviewReceipts: receipts.startReview,
    onClearReview: receipts.clearReview,
  });
  const selectedRange = useMemo(
    () =>
      historyRange === 'all'
        ? resolveReceiptDateRange(receipts.receipts)
        : resolveDateRange(historyRange, customRangeStart, customRangeEnd),
    [customRangeEnd, customRangeStart, historyRange, receipts.receipts],
  );
  const receiptsInRange = useMemo(
    () => filterReceiptsByDateRange(receipts.receipts, selectedRange),
    [receipts.receipts, selectedRange],
  );
  const categoryStackItems = useMemo(() => {
    const categoryNames = categories.categories.map((category) => category.name);
    const fallbackNames =
      categoryNames.length > 0 ? ['Alle', ...categoryNames] : CATEGORY_STACK_FALLBACK;
    const counts = new Map<string, number>();

    for (const receipt of receiptsInRange) {
      counts.set(receipt.categoryName, (counts.get(receipt.categoryName) ?? 0) + 1);
    }

    const prioritized = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([name]) => name);
    const remaining = fallbackNames.filter((name) => name !== 'Alle' && !prioritized.includes(name));

    return ['Alle', ...prioritized, ...remaining];
  }, [categories.categories, receiptsInRange]);
  const activeCategoryName = categoryStackItems.includes(selectedCategoryName ?? '')
    ? selectedCategoryName
    : (categoryStackItems[0] ?? null);
  const activeCategoryReceipts = useMemo(
    () =>
      activeCategoryName
        ? activeCategoryName === 'Alle'
          ? receiptsInRange
          : receiptsInRange.filter(
              (receipt) => receipt.categoryName === activeCategoryName,
            )
        : [],
    [activeCategoryName, receiptsInRange],
  );
  const categoryStackTotals = useMemo(() => {
    const totals = new Map<string, { amount: number; currency: string }>();
    let allAmount = 0;
    let allCurrency = 'EUR';

    for (const receipt of receiptsInRange) {
      const currency = receipt.currency || 'EUR';
      const categoryTotal = totals.get(receipt.categoryName) ?? {
        amount: 0,
        currency,
      };

      categoryTotal.amount += receipt.total;
      categoryTotal.currency = categoryTotal.currency || currency;
      totals.set(receipt.categoryName, categoryTotal);

      allAmount += receipt.total;
      allCurrency = allCurrency === 'EUR' ? currency : allCurrency;
    }

    totals.set('Alle', { amount: allAmount, currency: allCurrency });

    return totals;
  }, [receiptsInRange]);
  const spendHistory = useMemo(
    () => buildSpendHistory(receipts.receipts, selectedRange),
    [receipts.receipts, selectedRange],
  );
  const currentBalanceTotal = useMemo(
    () =>
      accounts.reduce(
        (sum, account) => sum + parseCurrencyValue(account.balance),
        0,
      ),
    [accounts],
  );

  const handleReviewDelete = () => {
    if (!receipts.selectedReceipt) return;

    if (receipts.selectedReceipt.id.startsWith('temp-')) {
      receipts.dismissSelectedReviewReceipt();
      return;
    }

    void receipts.deleteReceipt(receipts.selectedReceipt.id);
  };

  const handleBankDataClick = () => {
    setIsImportHubOpen(false);
    setError('Banking data upload is reserved for the next integration pass.');
  };

  const handleSaveAccount = (draftAccount: AccountOverview) => {
    if (!draftAccount.name.trim() || !draftAccount.bank.trim()) {
      setError('Account name and bank are required.');
      return;
    }

    setAccounts((currentAccounts) => {
      const existingIndex = currentAccounts.findIndex(
        (account) => account.id === draftAccount.id,
      );

      if (existingIndex === -1) {
        return [...currentAccounts, draftAccount];
      }

      return currentAccounts.map((account) =>
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
                  {activeScreen === 'intake' ? (
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
                      <Sparkles size={18} className="mt-1 text-[#FFD0E6]" />
                    </div>

                <div className="mt-3 h-72 overflow-y-auto overscroll-contain rounded-[1.7rem] bg-white/10 p-3 backdrop-blur-sm touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-full flex-col gap-3">
                  {categoryStackItems.map((categoryName, index) => (
                    <button
                      type="button"
                      key={categoryName}
                          onClick={() => setSelectedCategoryName(categoryName)}
                          className={`rounded-[1.4rem] bg-linear-to-br ${
                            accounts[index % accounts.length]?.accent ??
                            'from-[#FF5FA2] via-[#FF78B5] to-[#FF9BCB]'
                          } px-3 py-2.5 text-left shadow-[0_16px_36px_rgba(114,29,83,0.28)] transition-transform ${
                            activeCategoryName === categoryName
                              ? 'ring-2 ring-white/60'
                              : ''
                          } ${
                            index > 0 ? 'mt-1.5' : ''
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
                  ))}
                  </div>
                </div>

                <div className="mt-4 rounded-[1.7rem] bg-white/12 p-3 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                      {activeCategoryName ?? 'Kategorie'}
                    </p>
                    <p className="text-xs text-white/72">
                      {activeCategoryReceipts.length} items
                    </p>
                  </div>

                  <div className="mt-3 h-72 space-y-2 overflow-y-auto overscroll-contain touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                    {activeCategoryReceipts.length === 0 ? (
                      <div className="rounded-[1.2rem] bg-white/10 px-3 py-3 text-sm text-white/78">
                        No receipt items for this category yet.
                          </div>
                        ) : (
                          activeCategoryReceipts.map((receipt) => (
                            <button
                              key={receipt.id}
                              type="button"
                              onClick={() => receipts.setSelectedReceipt(receipt)}
                              className="flex w-full items-center justify-between gap-3 rounded-[1.2rem] bg-white/10 px-3 py-3 text-left transition hover:bg-white/16"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-white">
                                  {receipt.merchant}
                                </p>
                                {getReceiptProductNames(receipt).length > 0 && (
                                  <p className="mt-1 truncate text-xs text-white/78">
                                    {getReceiptProductNames(receipt)[0]}
                                    {getReceiptProductNames(receipt).length > 1
                                      ? ` +${getReceiptProductNames(receipt).length - 1}`
                                      : ''}
                                  </p>
                                )}
                                <p className="mt-1 text-xs text-white/68">
                                  {new Date(receipt.date).toLocaleDateString()}
                                </p>
                              </div>
                              <p className="text-sm font-medium text-white/82">
                                {receipt.currency} {receipt.total.toFixed(2)}
                              </p>
                            </button>
                          ))
                        )}
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
                      title="Banking data"
                      description="Use the prepared entry point for future bank transaction imports."
                      onClick={handleBankDataClick}
                    />
                    <DataEntryTile
                      icon={<SquarePen size={20} />}
                      title="Manual entry"
                      description="Create a new expense entry and edit the data yourself."
                      onClick={receipts.handleManualEntry}
                    />
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
        onUploadBankData={handleBankDataClick}
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
