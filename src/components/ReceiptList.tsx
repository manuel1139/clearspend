import { ChevronRight, Receipt as ReceiptIcon, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import type { Receipt } from '../types';

interface ReceiptListProps {
  receipts: Receipt[];
  selectedReceiptId?: string;
  isScanning: boolean;
  onSelect: (receipt: Receipt) => void;
}

export function ReceiptList({
  receipts,
  selectedReceiptId,
  isScanning,
  onSelect,
}: ReceiptListProps) {
  if (receipts.length === 0 && !isScanning) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
        <div className="bg-gray-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Upload className="text-gray-300" size={32} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Keine Belege gefunden</h3>
        <p className="text-gray-500 text-sm max-w-xs mx-auto mt-1">
          Laden Sie Ihren ersten Beleg über die Schaltfläche &quot;Neuer Scan&quot;
          hoch, um Ihre Ausgaben zu verfolgen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {receipts.map((receipt) => (
        <motion.div
          layout
          key={receipt.id}
          onClick={() => onSelect(receipt)}
          className={`bg-white p-5 rounded-3xl border transition-all cursor-pointer hover:shadow-xl hover:shadow-gray-200/50 flex items-center group ${
            selectedReceiptId === receipt.id
              ? 'border-black ring-1 ring-black shadow-lg shadow-gray-200'
              : 'border-gray-100'
          }`}
          id={`receipt-card-${receipt.id}`}
        >
          <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center mr-4 group-hover:bg-black group-hover:text-white transition-colors">
            <ReceiptIcon size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">{receipt.merchant}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500 font-medium">
                {new Date(receipt.date).toLocaleDateString()}
              </span>
              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">
                {receipt.categoryName}
              </span>
            </div>
          </div>
          <div className="text-right mr-4">
            <div className="font-bold text-lg">
              {receipt.currency} {receipt.total.toFixed(2)}
            </div>
            <div className="flex gap-1 mt-1 justify-end">
              {receipt.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          <ChevronRight
            size={20}
            className="text-gray-300 group-hover:text-black transition-colors"
          />
        </motion.div>
      ))}
    </div>
  );
}
