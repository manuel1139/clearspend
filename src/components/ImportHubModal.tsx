import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight,
  FileImage,
  Landmark,
  PackageSearch,
  ScrollText,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface ImportHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportReceiptImage: () => void;
  onImportAmazonCsv: () => void;
  onImportAmazonText: () => void;
  onUploadBankData: () => void;
}

function ActionTile({
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[1.6rem] bg-white px-4 py-4 text-left shadow-[0_14px_34px_rgba(15,26,84,0.08)] transition-transform hover:-translate-y-0.5"
    >
      <div className="rounded-[1.2rem] bg-[#EEF2FF] p-3 text-[#2747FF]">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-slate-950">{title}</h4>
          {badge && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.24em] text-slate-500">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
      <ChevronRight size={18} className="text-slate-300" />
    </button>
  );
}

export function ImportHubModal({
  isOpen,
  onClose,
  onImportReceiptImage,
  onImportAmazonCsv,
  onImportAmazonText,
  onUploadBankData,
}: ImportHubModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end bg-[#08102E]/42 p-3 sm:p-6"
        >
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            className="mx-auto w-full max-w-[28rem] rounded-[2rem] bg-[#F6F7FB] p-4 shadow-[0_28px_80px_rgba(8,16,46,0.35)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Import
                </p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">
                  Add new spending data
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-white p-2 text-slate-500 shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <ActionTile
                icon={<FileImage size={20} />}
                title="Scan receipt image"
                description="Import a photo or screenshot of a receipt and review the extracted data."
                onClick={onImportReceiptImage}
              />
              <ActionTile
                icon={<PackageSearch size={20} />}
                title="Amazon order CSV"
                description="Bring in exported Amazon order history and group items by order."
                onClick={onImportAmazonCsv}
              />
              <ActionTile
                icon={<ScrollText size={20} />}
                title="Amazon order text"
                description="Paste a confirmation email or order detail page to import Amazon items."
                onClick={onImportAmazonText}
              />
              <ActionTile
                icon={<Landmark size={20} />}
                title="Upload banking data"
                description="Reserve entry point for connected statements and bank transaction imports."
                badge="Later"
                onClick={onUploadBankData}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
