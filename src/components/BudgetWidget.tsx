import { Filter, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { Receipt } from '../types';

interface BudgetWidgetProps {
  receipts: Receipt[];
  budget: number;
  onUpdateBudget: (value: number) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
}

export function BudgetWidget({
  receipts,
  budget,
  onUpdateBudget,
  isEditing,
  setIsEditing,
}: BudgetWidgetProps) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlySpent = receipts
    .filter((receipt) => {
      const createdAt = new Date(receipt.createdAt);
      return (
        createdAt.getMonth() === currentMonth &&
        createdAt.getFullYear() === currentYear
      );
    })
    .reduce((sum, receipt) => sum + receipt.total, 0);

  const remaining = budget - monthlySpent;
  const percentage = Math.min(100, (monthlySpent / budget) * 100);

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed bottom-8 right-8 z-50 pointer-events-none"
    >
      <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-6 w-72 pointer-events-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Monatsbudget
          </h4>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-gray-400 hover:text-black transition-colors"
          >
            <Filter size={14} />
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-4 mb-4">
            <div className="flex gap-2">
              <input
                autoFocus
                type="number"
                defaultValue={budget}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onUpdateBudget(
                      parseFloat((event.target as HTMLInputElement).value),
                    );
                  }
                }}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 font-mono font-bold focus:ring-2 focus:ring-black"
              />
              <button
                onClick={(event) => {
                  const input = event.currentTarget
                    .previousSibling as HTMLInputElement;
                  onUpdateBudget(parseFloat(input.value));
                }}
                className="bg-black text-white p-2 rounded-xl"
              >
                <Plus size={18} />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 italic text-center">
              Drücken Sie Enter zum Speichern
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1 mb-2">
              <span
                className={`text-4xl font-black ${
                  remaining >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                EUR{Math.abs(remaining).toLocaleString()}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase">
                {remaining >= 0 ? 'Übrig' : 'Überz.'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-400">
                  AUSGEGEBEN: EUR{monthlySpent.toLocaleString()}
                </span>
                <span className="text-gray-400">
                  ZIEL: EUR{budget.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  className={`h-full rounded-full ${
                    percentage > 90 ? 'bg-red-500' : 'bg-black'
                  }`}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
