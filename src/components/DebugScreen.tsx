import React from 'react';
import type { GeminiHistoryEntry } from '../lib/gemini';
import { KontoEntry, Receipt } from '../types';

interface DebugScreenProps {
  kontoEntries: { entries: KontoEntry[] };
  receipts: { receipts: Receipt[] };
  geminiApiKey: string | null;
  detectedEnvKeys: string[];
  aiHistory: GeminiHistoryEntry[];
}

export function DebugScreen({ kontoEntries, receipts, geminiApiKey, detectedEnvKeys, aiHistory }: DebugScreenProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-xl">
        <p className="text-[11px] uppercase tracking-widest text-white/60">System Debug</p>
      </div>

      <div className="rounded-[1.7rem] bg-white/12 p-5 text-white backdrop-blur-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Statistics</h3>
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
              {geminiApiKey || `Not found. Found: ${detectedEnvKeys.join(', ') || 'None'}`}
            </p>
          </div>
          {aiHistory.slice().reverse().map((result, idx) => (
            <div key={idx} className="col-span-2 space-y-3 rounded-2xl bg-white/5 p-3 mb-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
                  {result.action} @ {new Date(result.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <p className="text-white/50 text-[10px]">AI Prompt</p>
                <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[9px] text-white/70">
                  {result.prompt}
                </pre>
              </div>
              <div className="border-t border-white/5 pt-2">
                <p className="text-white/50 text-[10px]">AI Response</p>
                <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[9px] text-green-400/80">
                  {result.response}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
