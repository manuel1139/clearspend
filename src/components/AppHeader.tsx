import React from 'react';
// Removed duplicate React import
import { ArrowLeft, Bug, Cog, Landmark, Repeat, SquarePen, TrendingUp } from 'lucide-react';
import { DateRangePreset } from '../lib/dashboard';

interface AppHeaderProps {
  activeScreen: string;
  historyRange: DateRangePreset;
  setHistoryRange: (range: DateRangePreset) => void;
  customRangeStart: string;
  setCustomRangeStart: (val: string) => void;
  customRangeEnd: string;
  setCustomRangeEnd: (val: string) => void;
  onNavigate: (screen: 'dashboard' | 'intake' | 'config' | 'konto' | 'debug' | 'forecast' | 'recurring') => void; // Explicitly typed
  RangeSelect: React.ComponentType<{ value: DateRangePreset; onChange: (v: DateRangePreset) => void }>; // Explicitly typed
}

export function AppHeader({
  activeScreen,
  historyRange,
  setHistoryRange,
  customRangeStart,
  setCustomRangeStart,
  customRangeEnd,
  setCustomRangeEnd,
  onNavigate,
  RangeSelect,
}: AppHeaderProps) {
  const isNestedScreen = ['intake', 'konto', 'debug', 'forecast', 'recurring'].includes(activeScreen);

  return (
    <div className="mb-5 space-y-4">
      <div className="flex items-center justify-start gap-2">
        {isNestedScreen ? (
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-lg"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <>
            <NavButton onClick={() => onNavigate('konto')} icon={<Landmark size={18} />} />
            <NavButton onClick={() => onNavigate('recurring')} icon={<Repeat size={18} />} />
            <NavButton onClick={() => onNavigate('forecast')} icon={<TrendingUp size={18} />} />
            <NavButton onClick={() => onNavigate('debug')} icon={<Bug size={18} />} />
            <NavButton onClick={() => onNavigate('intake')} icon={<SquarePen size={18} />} />
            <NavButton onClick={() => onNavigate('config')} icon={<Cog size={18} />} />
          </>
        )}
      </div>

      {activeScreen !== 'dashboard' && (
        <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-950">
          {activeScreen === 'intake'
            ? 'Data Entry'
            : activeScreen === 'konto'
              ? 'Banking'
              : activeScreen === 'debug'
                ? 'Debug'
                : activeScreen === 'forecast'
                  ? 'Forecast'
                  : activeScreen === 'recurring'
                    ? 'Recurring'
                    : 'Configuration'}
        </h1>
      )}

      {activeScreen === 'dashboard' && (
        <div className="space-y-3">
          <div className="flex justify-start">
            <RangeSelect value={historyRange} onChange={setHistoryRange} />
          </div>
          {historyRange === 'custom' && (
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={customRangeStart}
                onChange={(e) => setCustomRangeStart(e.target.value)}
                className="rounded-full bg-white/14 px-4 py-2 text-xs font-medium text-slate-950 outline-none ring-1 ring-white/20"
              />
              <input
                type="date"
                value={customRangeEnd}
                onChange={(e) => setCustomRangeEnd(e.target.value)}
                className="rounded-full bg-white/14 px-4 py-2 text-xs font-medium text-slate-950 outline-none ring-1 ring-white/20"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NavButton({ onClick, icon }: { onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 text-white shadow-lg"
    >
      {icon}
    </button>
  );
}