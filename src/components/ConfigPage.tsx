import { Landmark, PencilLine, Plus, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { AccountOverview } from '../lib/mockAccounts';
import type { ReceiptCategory } from '../types';

interface ConfigPageProps {
  accounts: AccountOverview[];
  categories: ReceiptCategory[];
  monthlyBudget: number;
  onBack: () => void;
  onSaveBudget: (value: number) => void;
  onSaveAccount: (account: AccountOverview) => void;
  onDeleteAccount: (accountId: string) => void;
  onSaveCategory: (
    category: Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>,
  ) => void | Promise<void>;
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
    accent: 'from-[#1F3CFF] to-[#6E86FF]',
    detail: '',
    syncedAt: 'Not synced yet',
  };
}

export function ConfigPage({
  accounts,
  categories,
  monthlyBudget,
  onBack,
  onSaveBudget,
  onSaveAccount,
  onDeleteAccount,
  onSaveCategory,
  onDeleteCategory,
}: ConfigPageProps) {
  const [draftAccount, setDraftAccount] = useState<AccountOverview>(
    accounts[0] ?? createEmptyAccount(),
  );
  const [budgetInput, setBudgetInput] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState<
    Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>
  >(
    categories[0]
      ? { id: categories[0].id, name: categories[0].name }
      : { name: '' },
  );

  const displayedAccount = accounts.some(
    (account) => account.id === draftAccount.id,
  )
    ? draftAccount
    : (accounts[0] ?? createEmptyAccount());
  const activeAccountId = displayedAccount.id;
  const displayedBudgetInput = budgetInput ?? monthlyBudget.toString();
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

    await onSaveCategory({
      id: displayedCategory.id,
      name: displayedCategory.name.trim(),
    });
  };

  const isExistingAccount = accounts.some(
    (account) => account.id === displayedAccount.id,
  );
  const isExistingCategory = categories.some(
    (category) => category.id === displayedCategory.id,
  );

  return (
    <div className="space-y-5">
      <div className="rounded-4xl bg-[linear-gradient(135deg,#0E1433_0%,#1E2B6F_100%)] p-5 text-white shadow-[0_24px_70px_rgba(14,20,51,0.24)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">
              Configuration
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-tight">
              Manage accounts
            </h1>
            <p className="mt-3 max-w-[20rem] text-sm leading-6 text-white/72">
              Update connected account details, maintain receipt categories, and
              keep the dashboard budget aligned.
            </p>
          </div>
          <button
            onClick={onBack}
            className="rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white"
          >
            Back
          </button>
        </div>
      </div>

      <section className="rounded-[1.9rem] bg-white p-4 shadow-[0_16px_40px_rgba(15,26,84,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
              Budget
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Monthly baseline
            </h2>
          </div>
          <Settings2 size={18} className="text-slate-300" />
        </div>

        <div className="mt-4 flex gap-3">
          <input
            type="number"
            min="0"
            value={displayedBudgetInput}
            onChange={(event) => setBudgetInput(event.target.value)}
            className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium text-slate-950 outline-none transition focus:border-[#2646FF]"
            placeholder="1000"
          />
          <button
            onClick={() => {
              onSaveBudget(Number(displayedBudgetInput) || 0);
              setBudgetInput(null);
            }}
            className="rounded-[1.2rem] bg-[#2646FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(38,70,255,0.24)]"
          >
            Save
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.9rem] bg-white p-4 shadow-[0_16px_40px_rgba(15,26,84,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                Accounts
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Available list
              </h2>
            </div>
            <button
              onClick={handleNewAccount}
              className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-2 text-sm font-medium text-[#2646FF]"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div className="space-y-3">
            {accounts.map((account) => {
              const isActive = account.id === activeAccountId;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    setDraftAccount(account);
                  }}
                  className={`w-full rounded-3xl border p-4 text-left transition ${
                    isActive
                      ? 'border-[#2646FF] bg-[#EEF2FF]'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-2xl bg-linear-to-br ${account.accent} p-3 text-white`}
                      >
                        <Landmark size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {account.name}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                          {account.bank}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      {account.balance}
                    </p>
                  </div>
                </button>
              );
            })}

            {accounts.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No accounts yet. Create the first one from the form.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.9rem] bg-white p-4 shadow-[0_16px_40px_rgba(15,26,84,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                Editor
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Account details
              </h2>
            </div>
            <PencilLine size={18} className="text-slate-300" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">
                Account name
              </span>
              <input
                value={displayedAccount.name}
                onChange={handleFieldChange('name')}
                className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2646FF]"
                placeholder="Main Budget"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">
                Bank
              </span>
              <input
                value={displayedAccount.bank}
                onChange={handleFieldChange('bank')}
                className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2646FF]"
                placeholder="Sparkasse"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">
                Balance
              </span>
              <input
                value={displayedAccount.balance}
                onChange={handleFieldChange('balance')}
                className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2646FF]"
                placeholder="EUR 1200"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">
                Available
              </span>
              <input
                value={displayedAccount.available}
                onChange={handleFieldChange('available')}
                className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2646FF]"
                placeholder="EUR 1200"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">
                Masked IBAN
              </span>
              <input
                value={displayedAccount.ibanMasked}
                onChange={handleFieldChange('ibanMasked')}
                className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2646FF]"
                placeholder="DE89 **** 2294"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">
                Sync label
              </span>
              <input
                value={displayedAccount.syncedAt}
                onChange={handleFieldChange('syncedAt')}
                className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2646FF]"
                placeholder="Synced 08:42"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-2 block text-sm font-medium text-slate-600">
              Detail
            </span>
            <textarea
              value={displayedAccount.detail}
              onChange={handleFieldChange('detail')}
              rows={4}
              className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2646FF]"
              placeholder="Primary spending account for recurring expenses."
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => onDeleteAccount(displayedAccount.id)}
              disabled={!isExistingAccount}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={16} />
              Delete
            </button>

            <button
              onClick={() => onSaveAccount(displayedAccount)}
              className="inline-flex items-center gap-2 rounded-full bg-[#0E1433] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(14,20,51,0.22)]"
            >
              {isExistingAccount ? 'Save changes' : 'Create account'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.9rem] bg-white p-4 shadow-[0_16px_40px_rgba(15,26,84,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                Categories
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Receipt mapping
              </h2>
            </div>
            <button
              onClick={() => {
                setDraftCategory({ name: '' });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-2 text-sm font-medium text-[#2646FF]"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div className="space-y-3">
            {categories.map((category) => {
              const isActive = category.id === displayedCategory.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setDraftCategory({ id: category.id, name: category.name });
                  }}
                  className={`w-full rounded-3xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-[#2646FF] bg-[#EEF2FF]'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {category.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.9rem] bg-white p-4 shadow-[0_16px_40px_rgba(15,26,84,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                Category editor
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Database-backed category
              </h2>
            </div>
            <PencilLine size={18} className="text-slate-300" />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-600">
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
              className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2646FF]"
              placeholder="Groceries"
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() =>
                displayedCategory.id !== undefined
                  ? onDeleteCategory(displayedCategory.id)
                  : undefined
              }
              disabled={!isExistingCategory}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={16} />
              Delete
            </button>

            <button
              onClick={() => void handleCategorySave()}
              className="inline-flex items-center gap-2 rounded-full bg-[#0E1433] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(14,20,51,0.22)]"
            >
              {isExistingCategory ? 'Save category' : 'Create category'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
