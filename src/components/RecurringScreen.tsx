import React from 'react';
import { useMemo } from 'react';
import { Receipt } from '../types'; // Corrected path

export function RecurringScreen({ receipts }: { receipts: { receipts: Receipt[] } }) { // Explicitly typed
  const recurringReceipts = useMemo(
    () => receipts.receipts.filter((r: Receipt) => r.paymentRuleFrequency !== 'one_time'),
    [receipts.receipts]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-xl">
        <p className="text-[11px] uppercase tracking-widest text-white/60">Recurring Expenses</p>
        <p className="mt-2 text-sm text-white/72">Review your subscriptions and recurring payments.</p>
      </div>

      <div className="space-y-2">
        {recurringReceipts.length === 0 ? (
          <div className="rounded-[1.7rem] bg-white/12 p-8 text-center text-sm text-white/60">No recurring payments found.</div>
        ) : (
          recurringReceipts.map((receipt: Receipt) => (
            <div
              key={receipt.id}
              className="flex items-center justify-between gap-3 rounded-[1.7rem] bg-white/12 p-4 text-white backdrop-blur-sm"
            >
              <div>
                <p className="text-sm font-semibold">{receipt.merchant}</p>
                <p className="mt-1 text-[10px] uppercase text-white/60">
                  {receipt.paymentRuleFrequency} • {receipt.categoryName}
                </p>
              </div>
              <p className="text-sm font-bold">{receipt.currency} {receipt.total.toFixed(2)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}