import {
  ChevronLeft,
  Landmark,
  PencilLine,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { AccountOverview } from '../lib/mockAccounts';
import type { Receipt, ReceiptCategory } from '../types';

interface ConfigPageProps {
  accounts: AccountOverview[];
  categories: ReceiptCategory[];
  monthlyBudget: number;
  receipts: Receipt[];
  onBack: () => void;
  onSaveBudget: (value: number) => void;
  onSaveAccount: (account: AccountOverview) => void;
  onDeleteAccount: (accountId: string) => void;
  onSaveCategory: (
    category: Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>,
  ) => ReceiptCategory | void | Promise<ReceiptCategory | void>;
  onDeleteCategory: (categoryId: number) => void | Promise<void>;
}

function createEmptyAccount(): AccountOverview {
  const timestamp = Date.now().toString();

  return {
    id: `acc-${timestamp}`,
    name: '',
    bank: '',
    ibanMasked: '',
    balance: 'EUR 0',
    available: 'EUR 0',
    accent: 'from-[#FF5FA2] via-[#FF78B5] to-[#FF9BCB]',
    detail: '',
    syncedAt: 'Not synced yet',
  };
}

function createEmptyCategory(): Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'> {
  return { name: '' };
}

function getReceiptProductNames(receipt: Receipt) {
  return receipt.items
    ?.map((item) => item.name.trim())
    .filter((name) => name.length > 0) ?? [];
}

export function ConfigPage({
  accounts,
  categories,
  monthlyBudget,
  receipts,
  onBack,
  onSaveBudget,
  onSaveAccount,
  onDeleteAccount,
  onSaveCategory,
  onDeleteCategory,
}: ConfigPageProps) {
  const [activeSection, setActiveSection] = useState<
    'accounts' | 'receipts' | 'budget' | 'mapping'
  >('accounts');
  const [draftAccount, setDraftAccount] = useState<AccountOverview>(
    accounts[0] ?? createEmptyAccount(),
  );
  const [budgetInput, setBudgetInput] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(
    receipts[0]?.id ?? null,
  );
  const [draftCategory, setDraftCategory] = useState<
    Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>
  >(categories[0] ? { id: categories[0].id, name: categories[0].name } : createEmptyCategory());

  const displayedAccount = accounts.some(
    (account) => account.id === draftAccount.id,
  )
    ? draftAccount
    : (accounts[0] ?? createEmptyAccount());
  const activeAccountId = displayedAccount.id;
  const displayedBudgetInput = budgetInput ?? monthlyBudget.toString();
  const displayedReceipt =
    receipts.find((receipt) => receipt.id === selectedReceiptId) ?? receipts[0] ?? null;
  const displayedCategory =
    (draftCategory.id !== undefined
      ? categories.find((category) => category.id === draftCategory.id)
      : null) ??
    (categories[0] ? { id: categories[0].id, name: categories[0].name } : null) ??
    draftCategory;

  const handleFieldChange =
    (field: keyof AccountOverview) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setDraftAccount((current) => ({
        ...current,
        [field]: value,
      }));
    };

  const handleNewAccount = () => {
    const nextAccount = createEmptyAccount();
    setDraftAccount(nextAccount);
  };

  const handleCategorySave = async () => {
    if (!displayedCategory.name.trim()) return;

    const savedCategory = await onSaveCategory({
      id: displayedCategory.id,
      name: displayedCategory.name.trim(),
    });

    if (savedCategory) {
      setDraftCategory({
        id: savedCategory.id,
        name: savedCategory.name,
      });
      return;
    }

    setDraftCategory((current) => ({
      ...current,
      name: displayedCategory.name.trim(),
    }));
  };

  const handleCategoryDelete = async () => {
    if (displayedCategory.id === undefined) return;

    const currentIndex = categories.findIndex(
      (category) => category.id === displayedCategory.id,
    );

    await onDeleteCategory(displayedCategory.id);

    const nextCategory =
      categories[currentIndex + 1] ??
      categories[currentIndex - 1] ??
      null;

    setDraftCategory(
      nextCategory
        ? { id: nextCategory.id, name: nextCategory.name }
        : createEmptyCategory(),
    );
  };

  const isExistingAccount = accounts.some(
    (account) => account.id === displayedAccount.id,
  );
  const isExistingCategory = categories.some(
    (category) => category.id === displayedCategory.id,
  );
  const quickLinks: {
    id: 'accounts' | 'receipts' | 'budget' | 'mapping';
    label: 'Accounts' | 'Receipts' | 'Budget' | 'Kategorie';
  }[] = [
    { id: 'accounts', label: 'Accounts' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'budget', label: 'Budget' },
    { id: 'mapping', label: 'Kategorie' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-5 text-white shadow-[0_24px_70px_rgba(130,37,90,0.24)]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white shadow-[0_12px_28px_rgba(130,37,90,0.18)]"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="mr-2">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
              Configuration
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => setActiveSection(link.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(130,37,90,0.18)] ${
                  activeSection === link.id ? 'bg-white/24' : 'bg-white/12'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeSection === 'budget' && (
        <section className="rounded-[1.9rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-4 shadow-[0_16px_40px_rgba(130,37,90,0.14)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#B56A8F]">
                Budget
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#45152F]">
                Monthly baseline
              </h2>
            </div>
            <Settings2 size={18} className="text-[#B56A8F]" />
          </div>

          <div className="mt-4 flex gap-3">
            <input
              type="number"
              min="0"
              value={displayedBudgetInput}
              onChange={(event) => setBudgetInput(event.target.value)}
              className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-base font-medium text-[#45152F] outline-none transition focus:border-[#B9387B]"
              placeholder="1000"
            />
            <button
              onClick={() => {
                onSaveBudget(Number(displayedBudgetInput) || 0);
                setBudgetInput(null);
              }}
              className="rounded-[1.2rem] bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
            >
              Save
            </button>
          </div>
        </section>
      )}

      {activeSection === 'accounts' && (
        <section className="rounded-[1.9rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-4 shadow-[0_16px_40px_rgba(130,37,90,0.14)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#B56A8F]">
                Accounts
              </p>
            </div>
            <button
              onClick={handleNewAccount}
              className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-[#9B2C66]"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div className="rounded-[1.7rem] bg-white/10 p-3 backdrop-blur-sm max-h-72 overflow-y-auto">
            {accounts.map((account) => {
              const isActive = account.id === activeAccountId;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    setDraftAccount(account);
                  }}
                  className={`w-full rounded-[1.4rem] bg-linear-to-br ${account.accent} px-3 py-3 text-left text-white shadow-[0_16px_36px_rgba(114,29,83,0.28)] transition-transform ${
                    isActive ? 'ring-2 ring-white/60' : ''
                  }`}
                  style={{ marginTop: account.id === accounts[0]?.id ? 0 : 10 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white/15 p-3 text-white">
                        <Landmark size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{account.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/70">
                          {account.bank}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-white/85">{account.balance}</p>
                  </div>
                </button>
              );
            })}

            {accounts.length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/50 px-4 py-5 text-sm text-[#9B2C66]">
                No accounts yet. Create the first one from the form.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-[1.7rem] bg-white/12 p-4 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#B56A8F]">
                Editor
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#45152F]">
                Account details
              </h2>
            </div>
            <PencilLine size={18} className="text-[#B56A8F]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#7E2158]">
                Account name
              </span>
              <input
                value={displayedAccount.name}
                onChange={handleFieldChange('name')}
                className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-sm text-[#45152F] outline-none transition focus:border-[#B9387B]"
                placeholder="Main Budget"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#7E2158]">
                Bank
              </span>
              <input
                value={displayedAccount.bank}
                onChange={handleFieldChange('bank')}
                className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-sm text-[#45152F] outline-none transition focus:border-[#B9387B]"
                placeholder="Sparkasse"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#7E2158]">
                Balance
              </span>
              <input
                value={displayedAccount.balance}
                onChange={handleFieldChange('balance')}
                className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-sm text-[#45152F] outline-none transition focus:border-[#B9387B]"
                placeholder="EUR 1200"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#7E2158]">
                Available
              </span>
              <input
                value={displayedAccount.available}
                onChange={handleFieldChange('available')}
                className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-sm text-[#45152F] outline-none transition focus:border-[#B9387B]"
                placeholder="EUR 1200"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#7E2158]">
                Masked IBAN
              </span>
              <input
                value={displayedAccount.ibanMasked}
                onChange={handleFieldChange('ibanMasked')}
                className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-sm text-[#45152F] outline-none transition focus:border-[#B9387B]"
                placeholder="DE89 **** 2294"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#7E2158]">
                Sync label
              </span>
              <input
                value={displayedAccount.syncedAt}
                onChange={handleFieldChange('syncedAt')}
                className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-sm text-[#45152F] outline-none transition focus:border-[#B9387B]"
                placeholder="Synced 08:42"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-2 block text-sm font-medium text-[#7E2158]">
              Detail
            </span>
            <textarea
              value={displayedAccount.detail}
              onChange={handleFieldChange('detail')}
              rows={4}
              className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-sm text-[#45152F] outline-none transition focus:border-[#B9387B]"
              placeholder="Primary spending account for recurring expenses."
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => onDeleteAccount(displayedAccount.id)}
              disabled={!isExistingAccount}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/40 px-4 py-2 text-sm font-medium text-[#9B2C66] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={16} />
              Delete
            </button>

            <button
              onClick={() => onSaveAccount(displayedAccount)}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
            >
              {isExistingAccount ? 'Save changes' : 'Create account'}
            </button>
          </div>
          </div>
        </section>
      )}

      {activeSection === 'receipts' && (
        <section className="rounded-[1.9rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-4 shadow-[0_16px_40px_rgba(130,37,90,0.14)] backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#B56A8F]">
                  Receipts
                </p>
              </div>
            </div>

            <div className="rounded-[1.7rem] bg-white/10 p-3 backdrop-blur-sm max-h-72 overflow-y-auto">
              {receipts.map((receipt) => {
                const isActive = receipt.id === displayedReceipt?.id;
                const productNames = getReceiptProductNames(receipt);
                return (
                  <button
                    key={receipt.id}
                    type="button"
                    onClick={() => setSelectedReceiptId(receipt.id)}
                    className={`w-full rounded-[1.4rem] bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-3 text-left text-white shadow-[0_16px_36px_rgba(114,29,83,0.28)] transition ${
                      isActive
                        ? 'ring-2 ring-white/60'
                        : ''
                    }`}
                    style={{ marginTop: receipt.id === receipts[0]?.id ? 0 : 10 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{receipt.merchant}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/70">
                          {receipt.categoryName}
                        </p>
                        {productNames.length > 0 && (
                          <p className="mt-2 text-xs text-white/78">
                            {productNames[0]}
                            {productNames.length > 1 ? ` +${productNames.length - 1}` : ''}
                          </p>
                        )}
                        {isActive && (
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/78">
                            Current selection
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white/85">
                        {receipt.currency} {receipt.total.toFixed(2)}
                      </p>
                    </div>
                  </button>
                );
              })}

              {receipts.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/20 bg-white/50 px-4 py-5 text-sm text-[#9B2C66]">
                  No receipts available yet.
                </div>
              )}
            </div>

          <div className="mt-4 rounded-[1.7rem] bg-white/12 p-4 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#B56A8F]">
                  Receipt details
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#45152F]">
                  Current selection
                </h2>
              </div>
              <PencilLine size={18} className="text-[#B56A8F]" />
            </div>

            {displayedReceipt ? (
              <div className="space-y-4">
                {getReceiptProductNames(displayedReceipt).length > 0 && (
                  <div className="rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#B56A8F]">
                      Product name
                    </p>
                    <div className="mt-2 space-y-2">
                      {getReceiptProductNames(displayedReceipt).map((productName) => (
                        <p key={productName} className="text-sm font-semibold text-[#45152F]">
                          {productName}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#B56A8F]">
                      Merchant
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#45152F]">
                      {displayedReceipt.merchant}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#B56A8F]">
                      Total
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#45152F]">
                      {displayedReceipt.currency} {displayedReceipt.total.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#B56A8F]">
                      Date
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#45152F]">
                      {new Date(displayedReceipt.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#B56A8F]">
                      Category
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#45152F]">
                      {displayedReceipt.categoryName}
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#B56A8F]">
                    Tags
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {displayedReceipt.tags.length > 0 ? (
                      displayedReceipt.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#F9D8E8] px-3 py-1 text-xs font-medium text-[#9B2C66]"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[#7E2158]">No tags</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/50 px-4 py-5 text-sm text-[#9B2C66]">
                Select a receipt to inspect its details.
              </div>
            )}
          </div>
        </section>
      )}

      {activeSection === 'mapping' && (
        <section className="rounded-[1.9rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-4 shadow-[0_16px_40px_rgba(130,37,90,0.14)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#B56A8F]">
                Kategorie
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#45152F]">
                Kategorie
              </h2>
            </div>
            <button
              onClick={() => {
                setDraftCategory(createEmptyCategory());
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-[#9B2C66]"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div className="rounded-[1.7rem] bg-white/10 p-3 backdrop-blur-sm max-h-72 overflow-y-auto">
            {categories.map((category) => {
              const isActive = category.id === displayedCategory.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setDraftCategory({ id: category.id, name: category.name });
                  }}
                  className={`w-full rounded-[1.4rem] bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-4 py-3 text-left text-white shadow-[0_16px_36px_rgba(114,29,83,0.28)] transition ${
                    isActive ? 'ring-2 ring-white/60' : ''
                  }`}
                  style={{ marginTop: category.id === categories[0]?.id ? 0 : 10 }}
                >
                  <p className="text-sm font-semibold text-white">{category.name}</p>
                </button>
              );
            })}

            {categories.length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/50 px-4 py-5 text-sm text-[#9B2C66]">
                No Kategorien yet. Create the first one here.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-[1.7rem] bg-white/12 p-4 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#B56A8F]">
                Kategorie editor
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#45152F]">
                Edit Kategorie
              </h2>
            </div>
            <PencilLine size={18} className="text-[#B56A8F]" />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#7E2158]">
              Name
            </span>
            <input
              value={displayedCategory.name}
              onChange={(event) =>
                setDraftCategory((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="w-full rounded-[1.2rem] border border-white/20 bg-white/80 px-4 py-3 text-sm text-[#45152F] outline-none transition focus:border-[#B9387B]"
              placeholder="Groceries"
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => void handleCategoryDelete()}
              disabled={!isExistingCategory}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/40 px-4 py-2 text-sm font-medium text-[#9B2C66] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={16} />
              Delete
            </button>

            <button
              onClick={() => void handleCategorySave()}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(130,37,90,0.24)]"
            >
              {isExistingCategory ? 'Save Kategorie' : 'Create Kategorie'}
            </button>
          </div>
          </div>
        </section>
      )}
    </div>
  );
}
