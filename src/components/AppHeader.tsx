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
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-bottom border-gray-100 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="bg-[#1A1A1A] p-2 rounded-xl">
          <ReceiptIcon className="text-white w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">ClearSpend</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => csvInputRef.current?.click()}
          className="flex bg-gray-100 text-gray-700 px-4 py-2 rounded-full font-medium items-center gap-2 hover:bg-gray-200 transition-all font-mono text-sm"
        >
          <FileText size={16} />
          <span className="hidden sm:inline">Upload CSV</span>
          <span className="sm:hidden">CSV</span>
        </button>
        <button
          onClick={onManualEntry}
          className="flex bg-gray-100 text-gray-700 px-4 py-2 rounded-full font-medium items-center gap-2 hover:bg-gray-200 transition-all font-mono text-sm"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Manuelle Eingabe</span>
          <span className="sm:hidden">Neu</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-[#1A1A1A] text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-black/10"
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
