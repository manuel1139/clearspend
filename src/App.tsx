/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useRef, useState } from 'react';
import {
  Cog,
  Sparkles,
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
  type DateRangePreset,
} from './lib/dashboard';
import { MOCK_ACCOUNTS } from './lib/mockAccounts';
import type { AccountOverview } from './lib/mockAccounts';

const CATEGORY_STACK_FALLBACK = ['Einkaufen', 'Essen', 'Gesundheit'];
const HISTORY_RANGE_OPTIONS: { value: Exclude<DateRangePreset, 'custom'>; label: string }[] =
  [
    { value: 'current-month', label: 'Current month' },
    { value: 'last-month', label: 'Last month' },
    { value: 'last-year', label: 'Last year' },
    { value: 'last-10-days', label: 'Last 10 days' },
  ];

function RangeSelect({
  value,
  onChange,
}: {
  value: Exclude<DateRangePreset, 'custom'>;
  onChange: (value: Exclude<DateRangePreset, 'custom'>) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">Select history range</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as Exclude<DateRangePreset, 'custom'>)
        }
        className="appearance-none rounded-full bg-white/12 px-4 py-2 pr-9 text-xs font-semibold text-white/82 outline-none backdrop-blur-sm"
      >
        {HISTORY_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="text-slate-950">
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/72">
        ▾
      </span>
    </label>
  );
}

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const [isImportHubOpen, setIsImportHubOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [historyRange, setHistoryRange] =
    useState<Exclude<DateRangePreset, 'custom'>>('last-10-days');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(
    CATEGORY_STACK_FALLBACK[0],
  );
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'config'>(
    'dashboard',
  );
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
  const categoryStackItems =
    categories.categories.length > 0
      ? categories.categories.slice(0, 3).map((category) => category.name)
      : CATEGORY_STACK_FALLBACK;
  const selectedRange = useMemo(
    () => resolveDateRange(historyRange),
    [historyRange],
  );
  const activeCategoryName = categoryStackItems.includes(selectedCategoryName ?? '')
    ? selectedCategoryName
    : (categoryStackItems[0] ?? null);
  const activeCategoryReceipts = useMemo(
    () =>
      activeCategoryName
        ? filterReceiptsByDateRange(receipts.receipts, selectedRange).filter(
            (receipt) => receipt.categoryName === activeCategoryName,
          )
        : [],
    [activeCategoryName, receipts.receipts, selectedRange],
  );
  const spendHistory = useMemo(
    () => buildSpendHistory(receipts.receipts, selectedRange),
    [receipts.receipts, selectedRange],
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe0ef_0%,#fff1f7_38%,#f7e9ff_100%)] px-3 py-4 text-slate-950 sm:px-6 sm:py-6">
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
        className={`mx-auto min-h-[calc(100vh-2rem)] max-w-107.5 overflow-hidden rounded-[2.4rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,241,247,0.96))] shadow-[0_35px_120px_rgba(124,40,92,0.16)] backdrop-blur-xl ${
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

          {activeScreen === 'dashboard' ? (
            <div className="space-y-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    ClearSpend Mobile
                  </p>
                  <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-950">
                    Dashboard
                  </h1>
                </div>
                <button
                  onClick={() => setActiveScreen('config')}
                  aria-label="Open configuration"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#9B2C66] shadow-[0_12px_28px_rgba(155,44,102,0.14)]"
                >
                  <Cog size={18} />
                </button>
              </div>

              <SpendHistoryChart
                points={spendHistory}
                rangeLabel={
                  HISTORY_RANGE_OPTIONS.find((option) => option.value === historyRange)
                    ?.label ?? 'Last 10 days'
                }
                headerAction={
                  <RangeSelect value={historyRange} onChange={setHistoryRange} />
                }
              />

              <div
                className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-4 text-left text-white shadow-[0_22px_64px_rgba(130,37,90,0.28)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                      Kategorien
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-[#FFD0E6]" />
                    <RangeSelect value={historyRange} onChange={setHistoryRange} />
                  </div>
                </div>

                <div className="mt-3 flex w-full flex-col gap-3 rounded-[1.7rem] bg-white/10 p-3 backdrop-blur-sm">
                  {categoryStackItems.map((categoryName, index) => (
                    <button
                      type="button"
                      key={categoryName}
                      onClick={() => setSelectedCategoryName(categoryName)}
                      className={`rounded-[1.4rem] bg-linear-to-br ${
                        accounts[index % accounts.length]?.accent ??
                        'from-[#FF5FA2] via-[#FF78B5] to-[#FF9BCB]'
                      } p-3 text-left shadow-[0_16px_36px_rgba(114,29,83,0.28)] transition-transform ${
                        activeCategoryName === categoryName
                          ? 'ring-2 ring-white/60'
                          : ''
                      } ${
                        index > 0 ? '-mt-3' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.24em] text-white/65">
                            Receipt mapping
                          </p>
                          <p className="mt-1 text-base font-semibold">{categoryName}</p>
                        </div>
                        <p className="text-sm text-white/78">Kategorie</p>
                      </div>
                    </button>
                  ))}
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

                  <div className="mt-3 space-y-2">
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
                          <div>
                            <p className="text-sm font-medium text-white">
                              {receipt.merchant}
                            </p>
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
            </div>
          ) : (
            <ConfigPage
              accounts={accounts}
              categories={categories.categories}
              monthlyBudget={budget.monthlyBudget}
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
