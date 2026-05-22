/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  BanknoteArrowDown,
  Camera,
  Cog,
  CreditCard,
  Plus,
  Sparkles,
  WalletCards,
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
import { buildSpendHistory, getMonthlySpent } from './lib/dashboard';
import { MOCK_ACCOUNTS } from './lib/mockAccounts';
import type { AccountOverview } from './lib/mockAccounts';

function DashboardMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.7rem] bg-white p-4 shadow-[0_16px_40px_rgba(15,26,84,0.08)]">
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  note,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-[1.6rem] bg-white p-4 text-left shadow-[0_16px_40px_rgba(15,26,84,0.08)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <div className="rounded-[1rem] bg-[#EEF2FF] p-3 text-[#2646FF]">
          {icon}
        </div>
        <ArrowUpRight size={18} className="text-slate-300" />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-sm leading-5 text-slate-500">{note}</p>
    </button>
  );
}

function ReceiptSnapshot({
  merchant,
  date,
  total,
  currency,
  category,
  tags,
  onClick,
}: {
  merchant: string;
  date: string;
  total: number;
  currency: string;
  category: string;
  tags: string[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[1.7rem] bg-white p-4 text-left shadow-[0_16px_40px_rgba(15,26,84,0.08)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-950">{merchant}</p>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(date).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-950">
            {currency} {total.toFixed(2)}
          </p>
          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] uppercase tracking-[0.26em] text-slate-500">
            {category}
          </span>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-medium text-[#3150FF]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const [isImportHubOpen, setIsImportHubOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
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

  const spendHistory = useMemo(
    () => buildSpendHistory(receipts.receipts),
    [receipts.receipts],
  );
  const monthlySpent = useMemo(
    () => getMonthlySpent(receipts.receipts),
    [receipts.receipts],
  );
  const remainingBudget = budget.monthlyBudget - monthlySpent;

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef2ff_0%,#f6f7fb_42%,#edf1ff_100%)] px-3 py-4 text-slate-950 sm:px-6 sm:py-6">
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
        className={`mx-auto min-h-[calc(100vh-2rem)] max-w-[430px] overflow-hidden rounded-[2.4rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(245,247,255,0.95))] shadow-[0_35px_120px_rgba(24,39,94,0.18)] backdrop-blur-xl ${
          imports.isDragging ? 'ring-4 ring-[#2646FF]/20' : ''
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
            <div className="space-y-4">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    ClearSpend Mobile
                  </p>
                  <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-950">
                    Dashboard
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveScreen('config')}
                    className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,26,84,0.12)]"
                  >
                    <Cog size={16} />
                    Config
                  </button>
                  <button
                    onClick={() => setIsAccountsOpen(true)}
                    className="flex items-center gap-2 rounded-full bg-[#0E1433] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(14,20,51,0.28)]"
                  >
                    <WalletCards size={16} />
                    Accounts
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#f3f5ff_100%)] p-4 shadow-[0_18px_50px_rgba(15,26,84,0.1)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      This month
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                      EUR {monthlySpent.toFixed(0)}
                    </p>
                  </div>
                  <div className="rounded-full bg-[#EEF2FF] px-3 py-1.5 text-xs font-medium text-[#2646FF]">
                    30 day window
                  </div>
                </div>
                <SpendHistoryChart points={spendHistory} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DashboardMetric
                  label="Initial Budget"
                  value={`EUR ${budget.monthlyBudget.toFixed(0)}`}
                  note="Monthly budget baseline"
                />
                <DashboardMetric
                  label="Current Budget"
                  value={`EUR ${remainingBudget.toFixed(0)}`}
                  note={
                    remainingBudget >= 0 ? 'Still available to spend' : 'Currently overspent'
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <QuickAction
                  icon={<Camera size={20} />}
                  label="Scan"
                  note="Import receipt images, Amazon orders, or future data sources."
                  onClick={() => setIsImportHubOpen(true)}
                />
                <QuickAction
                  icon={<BanknoteArrowDown size={20} />}
                  label="Banking data"
                  note="Entry point is ready. The bank data flow will be added next."
                  onClick={handleBankDataClick}
                />
                <QuickAction
                  icon={<CreditCard size={20} />}
                  label="All accounts"
                  note="Open the full connected accounts overview with expandable details."
                  onClick={() => setIsAccountsOpen(true)}
                />
                <QuickAction
                  icon={<Plus size={20} />}
                  label="Manual receipt"
                  note="Create a new expense entry and adjust the extracted details yourself."
                  onClick={receipts.handleManualEntry}
                />
              </div>

              <div className="rounded-[2rem] bg-[#0E1433] px-4 py-4 text-white shadow-[0_22px_64px_rgba(14,20,51,0.26)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">
                      Accounts preview
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Stackable overview
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      Tap to expand the full list of available accounts and inspect the details.
                    </p>
                  </div>
                  <Sparkles size={18} className="mt-1 text-white/70" />
                </div>

                <button
                  onClick={() => setIsAccountsOpen(true)}
                  className="mt-4 flex w-full flex-col gap-3 rounded-[1.7rem] bg-white/7 p-3 text-left"
                >
                  {accounts.slice(0, 3).map((account, index) => (
                    <div
                      key={account.id}
                      className={`rounded-[1.4rem] bg-gradient-to-br ${account.accent} p-3 shadow-[0_16px_36px_rgba(18,24,62,0.28)] ${
                        index > 0 ? '-mt-3' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.24em] text-white/65">
                            {account.bank}
                          </p>
                          <p className="mt-1 text-base font-semibold">{account.name}</p>
                        </div>
                        <p className="text-sm text-white/78">{account.balance}</p>
                      </div>
                    </div>
                  ))}
                </button>
              </div>

              <section className="pt-2">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      Recent receipts
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      Spending overview
                    </h2>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                    {receipts.filteredReceipts.length} items
                  </div>
                </div>

                <div className="space-y-3">
                  {receipts.filteredReceipts.length === 0 ? (
                    <div className="rounded-[1.8rem] bg-white p-5 text-center shadow-[0_16px_40px_rgba(15,26,84,0.08)]">
                      <p className="text-base font-medium text-slate-950">
                        No receipts yet
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Start with the Scan action above to import receipts or Amazon data into the dashboard.
                      </p>
                    </div>
                  ) : (
                    receipts.filteredReceipts.map((receipt) => (
                      <ReceiptSnapshot
                        key={receipt.id}
                        merchant={receipt.merchant}
                        date={receipt.date}
                        total={receipt.total}
                        currency={receipt.currency}
                        category={receipt.categoryName}
                        tags={receipt.tags}
                        onClick={() => receipts.setSelectedReceipt(receipt)}
                      />
                    ))
                  )}
                </div>
              </section>
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
          <div className="mx-auto w-full max-w-[28rem]">
            {imports.isScanning ? (
              <div className="rounded-[2rem] bg-[#0E1433] px-6 py-8 text-white shadow-[0_28px_80px_rgba(8,16,46,0.35)]">
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
