import { FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ImportSummary } from '../types';

interface ImportSummaryBannerProps {
  summary: ImportSummary | null;
  onDismiss: () => void;
}

export function ImportSummaryBanner({
  summary,
  onDismiss,
}: ImportSummaryBannerProps) {
  return (
    <AnimatePresence>
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="mb-6 bg-white border border-gray-100 shadow-xl rounded-3xl p-4 flex items-center gap-4"
        >
          <div className="bg-green-50 p-3 rounded-2xl text-green-600">
            <FileText size={24} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-900">Import abgeschlossen</h4>
            <p className="text-sm text-gray-500">
              {summary.imported} neue Einträge hinzugefügt.
              {summary.skipped > 0 &&
                ` ${summary.skipped} Duplikate wurden übersprungen.`}
            </p>
          </div>
          <button onClick={onDismiss} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
