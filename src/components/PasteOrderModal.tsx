import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

interface PasteOrderModalProps {
  isOpen: boolean;
  pastedText: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function PasteOrderModal({
  isOpen,
  pastedText,
  onChange,
  onClose,
  onSubmit,
}: PasteOrderModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-2xl rounded-4xl shadow-2xl p-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Bestellung einfügen</h3>
              <button onClick={onClose}>
                <X />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Kopieren Sie den Text Ihrer Amazon-Bestellbestätigung oder -seite
              und fügen Sie ihn hier ein.
            </p>
            <textarea
              autoFocus
              className="w-full h-64 bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-black mb-6"
              placeholder="Hier Text einfügen..."
              value={pastedText}
              onChange={(event) => onChange(event.target.value)}
            />
            <button
              onClick={onSubmit}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-900 transition-all"
            >
              Text analysieren
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
