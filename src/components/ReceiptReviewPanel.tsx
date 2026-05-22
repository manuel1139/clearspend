import { Loader2, Tag as TagIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { ReceiptCard } from './ReceiptCard';
import type { Receipt } from '../types';

interface ReceiptReviewPanelProps {
  isScanning: boolean;
  selectedReceipt: Receipt | null;
  reviewQueue: Receipt[];
  isUploading: boolean;
  onSave: (receipt: Receipt) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ReceiptReviewPanel({
  isScanning,
  selectedReceipt,
  reviewQueue,
  isUploading,
  onSave,
  onDelete,
  onClose,
}: ReceiptReviewPanelProps) {
  return (
    <div className="sticky top-28">
      {isScanning ? (
        <div className="flex min-h-100 flex-col items-center justify-center rounded-4xl border border-gray-100 bg-white p-8 shadow-xl">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="mb-6"
          >
            <Loader2 size={48} className="text-black" />
          </motion.div>
          <h3 className="text-xl font-bold mb-2">Beleg wird analysiert</h3>
          <p className="text-gray-500 text-center text-sm">
            Unsere KI extrahiert Daten und kategorisiert Ihren Scan...
          </p>
        </div>
      ) : selectedReceipt ? (
        <div className="space-y-4">
          {reviewQueue.length > 1 && (
            <div className="flex items-center justify-between rounded-full bg-black px-6 py-3 text-xs font-bold text-white shadow-xl">
              <span>MEHRERE BELEGE ERKANNT</span>
              <span>
                {reviewQueue.findIndex((receipt) => receipt.id === selectedReceipt.id) + 1}{' '}
                von {reviewQueue.length}
              </span>
            </div>
          )}
          <ReceiptCard
            key={selectedReceipt.id}
            receipt={selectedReceipt}
            onSave={onSave}
            onDelete={onDelete}
            isUploading={isUploading}
            onClose={onClose}
          />
        </div>
      ) : (
        <div className="flex min-h-100 flex-col items-center justify-center rounded-4xl border-2 border-dashed border-gray-300 bg-gray-200/50 p-8 text-center">
          <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
            <TagIcon className="text-gray-300" size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-700">Scan-Zusammenfassung</h3>
          <p className="text-gray-500 text-sm mt-2">
            Wählen Sie einen Beleg aus oder scannen Sie einen neuen, um Details und
            Tags zu sehen.
          </p>
        </div>
      )}
    </div>
  );
}
