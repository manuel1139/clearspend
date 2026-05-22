import { Camera, FileText, Plus, Receipt as ReceiptIcon } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';

interface AppHeaderProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  csvInputRef: RefObject<HTMLInputElement | null>;
  onManualEntry: () => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onCsvUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function AppHeader({
  fileInputRef,
  csvInputRef,
  onManualEntry,
  onFileUpload,
  onCsvUpload,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/80 px-6 py-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="rounded-xl bg-[#1A1A1A] p-2">
          <ReceiptIcon className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">ClearSpend</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => csvInputRef.current?.click()}
          className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 font-mono text-sm font-medium text-gray-700 transition-all hover:bg-gray-200"
        >
          <FileText size={16} />
          <span className="hidden sm:inline">Upload CSV</span>
          <span className="sm:hidden">CSV</span>
        </button>
        <button
          onClick={onManualEntry}
          className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 font-mono text-sm font-medium text-gray-700 transition-all hover:bg-gray-200"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Manuelle Eingabe</span>
          <span className="sm:hidden">Neu</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-full bg-[#1A1A1A] px-4 py-2 font-medium text-white shadow-lg shadow-black/10 transition-all hover:bg-black"
          id="scan-button"
        >
          <Camera size={18} />
          <span className="hidden sm:inline">Neuer Scan</span>
          <span className="sm:hidden">Scan</span>
        </button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={csvInputRef}
        onChange={onCsvUpload}
        accept=".csv"
        className="hidden"
      />
    </header>
  );
}
