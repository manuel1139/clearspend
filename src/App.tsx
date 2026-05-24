/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ImportSummaryBanner } from './components/ImportSummaryBanner';
import { PasteOrderModal } from './components/PasteOrderModal';
import { ReceiptCard } from './components/ReceiptCard';
import { AccountsDrawer } from './components/AccountsDrawer';
import { ImportHubModal } from './components/ImportHubModal';
import { ConfigPage } from './components/ConfigPage';
import { useBudget } from './hooks/useBudget';
import { useCategories } from './hooks/useCategories';
import { usePaymentRules } from './hooks/usePaymentRules';
import { useKontoEntries } from './hooks/useKontoEntries';
import { useReceiptImport } from './hooks/useReceiptImport';
import { ErrorAlert } from './components/ErrorAlert';
import { useReceipts } from './hooks/useReceipts';
import { DateRangePreset } from './lib/dashboard';
import { MOCK_ACCOUNTS } from './lib/mockAccounts';
import type { AccountOverview } from './lib/mockAccounts';

// Screen Components
import { Dashboard } from './components/Dashboard';
import { IntakeScreen } from './components/IntakeScreen';
import { BankingScreen } from './components/BankingScreen';
import { RecurringScreen } from './components/RecurringScreen';
import { ForecastScreen } from './components/ForecastScreen';
import { DebugScreen } from './components/DebugScreen';
import { AppHeader } from './components/AppHeader';

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
  const [aiHistory, setAiHistory] = useState<{ action: string; prompt: string; response: string; timestamp: string }[]>([]);
  const [detectedEnvKeys, setDetectedEnvKeys] = useState<string[]>([]);
  const [activeScreen, setActiveScreen] = useState<
    'dashboard' | 'intake' | 'config' | 'konto' | 'debug' | 'forecast' | 'recurring'
  >('dashboard');

  useEffect(() => {
    if (activeScreen === 'debug') {
      fetch('/api/gemini/status')
        .then((res) => res.json())
        .then((data) => {
          setGeminiApiKey(data.apiKey);
          setDetectedEnvKeys(data.detectedKeys || []);
          setAiHistory(data.aiHistory || []);
          if (data.aiHistory && data.aiHistory.length > 0) {
            const last = data.aiHistory[data.aiHistory.length - 1];
            console.log('[AI Debug] Last Prompt:', last.prompt);
            console.log('[AI Debug] Last Response:', last.response);
          }
        })
        .catch(() => setGeminiApiKey(null));
    }
  }, [activeScreen]);

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
              <AppHeader
                activeScreen={activeScreen}
                historyRange={historyRange}
                setHistoryRange={setHistoryRange}
                customRangeStart={customRangeStart}
                setCustomRangeStart={setCustomRangeStart}
                customRangeEnd={customRangeEnd}
                setCustomRangeEnd={setCustomRangeEnd}
                onNavigate={setActiveScreen}
                RangeSelect={RangeSelect}
              />

              {activeScreen === 'dashboard' && (
                <Dashboard
                  accounts={accounts}
                  budget={budget}
                  categories={categories}
                  historyRange={historyRange}
                  customRangeStart={customRangeStart}
                  customRangeEnd={customRangeEnd}
                  receipts={receipts}
                  kontoEntries={kontoEntries}
                  selectedCategoryName={selectedCategoryName}
                  setSelectedCategoryName={setSelectedCategoryName}
                  draggedCategoryIndex={draggedCategoryIndex}
                  setDraggedCategoryIndex={setDraggedCategoryIndex}
                  isCategorizingAI={isCategorizingAI}
                  setIsCategorizingAI={setIsCategorizingAI}
                  geminiConfigured={imports.geminiConfigured}
                  setError={setError}
                />
              )}
              {activeScreen === 'intake' && (
                <IntakeScreen
                  imports={imports}
                  fileInputRef={fileInputRef}
                  csvInputRef={csvInputRef}
                  kontoZipInputRef={kontoZipInputRef}
                  onManualEntry={receipts.handleManualEntry}
                />
              )}
              {activeScreen === 'konto' && (
                <BankingScreen
                  kontoEntries={kontoEntries}
                  isCategorizingAI={isCategorizingAI}
                  setIsCategorizingAI={setIsCategorizingAI}
                  geminiConfigured={imports.geminiConfigured}
                  setError={setError}
                />
              )}
              {activeScreen === 'recurring' && <RecurringScreen receipts={receipts} />}
              {activeScreen === 'forecast' && (
                <ForecastScreen
                  kontoEntries={kontoEntries}
                  receipts={receipts}
                  budget={budget}
                  historyRange={historyRange}
                  customRangeStart={customRangeStart}
                  customRangeEnd={customRangeEnd}
                />
              )}
              {activeScreen === 'debug' && (
                <DebugScreen
                  kontoEntries={kontoEntries}
                  receipts={receipts}
                  geminiApiKey={geminiApiKey}
                  detectedEnvKeys={detectedEnvKeys}
                  aiHistory={aiHistory}
                />
              )}
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
                onDelete={() => receipts.deleteReceipt(receipts.selectedReceipt!.id)}
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
