import { AlertCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface ErrorAlertProps {
  error: string | null;
  onDismiss: () => void;
}

export function ErrorAlert({ error, onDismiss }: ErrorAlertProps) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3"
        >
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={onDismiss} className="ml-auto">
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
