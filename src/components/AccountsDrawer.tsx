import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, WalletCards, X } from 'lucide-react';
import { useState } from 'react';
import type { AccountOverview } from '../lib/mockAccounts';

interface AccountsDrawerProps {
  accounts: AccountOverview[];
  isOpen: boolean;
  onClose: () => void;
}

export function AccountsDrawer({
  accounts,
  isOpen,
  onClose,
}: AccountsDrawerProps) {
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(
    accounts[0]?.id ?? null,
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end bg-[#4F1836]/36 p-3 sm:p-6"
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="mx-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col rounded-4xl bg-[linear-gradient(180deg,#FFF8FB_0%,#FCECF5_100%)] p-4 shadow-[0_28px_80px_rgba(110,28,74,0.28)] sm:max-h-[calc(100vh-3rem)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#B56A8F]">
                  Accounts
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[#45152F]">
                  Available accounts
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-white p-2 text-[#A54B79] shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {accounts.map((account, index) => {
                const isExpanded = expandedAccountId === account.id;
                return (
                  <motion.button
                    type="button"
                    key={account.id}
                    layout
                    onClick={() =>
                      setExpandedAccountId(isExpanded ? null : account.id)
                    }
                    className={`w-full overflow-hidden rounded-[1.8rem] bg-linear-to-br ${account.accent} px-4 py-4 text-left text-white shadow-[0_16px_40px_rgba(141,44,102,0.24)]`}
                    style={{
                      marginTop: index === 0 ? 0 : -14,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-white/15 p-2.5">
                          <WalletCards size={18} />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-white/70">
                            {account.bank}
                          </p>
                          <h4 className="mt-1 text-lg font-semibold">
                            {account.name}
                          </h4>
                        </div>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`mt-1 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs text-white/65">Current balance</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {account.balance}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs text-white/65">{account.syncedAt}</p>
                        <p className="mt-1 text-sm text-white/85">
                          {account.ibanMasked}
                        </p>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 rounded-[1.4rem] bg-white/12 p-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-white/65">Available</p>
                                <p className="mt-1 font-medium">
                                  {account.available}
                                </p>
                              </div>
                              <div>
                                <p className="text-white/65">Account type</p>
                                <p className="mt-1 font-medium">Connected</p>
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-white/82">
                              {account.detail}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
