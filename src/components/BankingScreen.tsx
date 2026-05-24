import React from 'react';
import { Sparkles } from 'lucide-react';
import { KontoEntry } from '../types';

interface BankingScreenProps {
  kontoEntries: {
    entries: KontoEntry[];
    refreshEntries: () => Promise<void>;
  };
  isCategorizingAI: boolean;
  setIsCategorizingAI: (val: boolean) => void;
  geminiConfigured: boolean;
  setError: (err: string | null) => void;
}

export function BankingScreen({ kontoEntries, isCategorizingAI, setIsCategorizingAI, geminiConfigured, setError }: BankingScreenProps) {
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
    <div className="space-y-4">
      <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-xl">
        <p className="text-[11px] uppercase tracking-widest text-white/60">Account Transactions</p>
        <p className="mt-2 text-sm leading-6 text-white/72">Review imported bank statement transactions.</p>
      </div>

      <div className="rounded-[1.7rem] bg-white/12 p-3 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-[11px] uppercase tracking-widest text-white/60">Entries</p>
          <button
            onClick={handleCategorizeSonstigesAI}
            disabled={isCategorizingAI || !geminiConfigured}
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-2 py-0.5 text-[9px] font-bold text-white transition hover:bg-white/20"
          >
            <Sparkles size={10} className={isCategorizingAI ? 'animate-pulse' : 'text-[#FFD0E6]'} />
            <span>AI Fix</span>
          </button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto [scrollbar-width:none]">
          {kontoEntries.entries.map((entry: KontoEntry) => (
            <div key={entry.id} className="flex justify-between gap-3 rounded-[1.2rem] bg-white/10 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{entry.counterpartyName}</p>
                <p className="truncate text-xs text-white/78">{entry.reference || entry.remittanceInfo}</p>
                <p className="mt-1 text-[10px] text-white/50">{new Date(entry.bookingDate).toLocaleDateString()}</p>
              </div>
              <p className="text-sm font-bold text-white">{entry.currency} {entry.amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}