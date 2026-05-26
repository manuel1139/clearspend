import React from 'react';
import { FileImage, Landmark, PackageSearch, ScrollText, SquarePen } from 'lucide-react';
import { ImportSummary } from '../types';

interface IntakeScreenProps {
  imports: { // Changed from any
    aiConfigured: boolean;
    lastImportPhase: string;
    lastImportMessage: string;
    setIsPasting: (v: boolean) => void;
    isScanning: boolean;
    lastImportKind: string | null;
    importSummary: ImportSummary | null;
    [key: string]: any;
  };
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  kontoZipInputRef: React.RefObject<HTMLInputElement | null>;
  onManualEntry: () => void;
}

export function IntakeScreen({ imports, fileInputRef, csvInputRef, kontoZipInputRef, onManualEntry }: IntakeScreenProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-4 text-white shadow-xl">
        <p className="text-[11px] uppercase tracking-widest text-white/60">Data sources</p>
        <p className="mt-2 text-sm leading-6 text-white/72">Add spending from Amazon, receipt images, or banking data.</p>
      </div>

      <div className="rounded-[1.7rem] bg-white/12 p-4 text-white backdrop-blur-sm">
        <div className="flex justify-between gap-3 text-xs">
          <p>AI: <strong>{imports.aiConfigured ? 'Configured' : 'Missing Key'}</strong></p>
          <p>Status: <strong>{imports.lastImportPhase}</strong></p> {/* Added imports.lastImportPhase */}
        </div>
        <p className="mt-3 text-xs text-white/60 italic">{imports.lastImportMessage}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DataEntryTile
          icon={<FileImage size={20} />}
          title="Receipt image"
          description="Import a photo or screenshot."
          onClick={() => fileInputRef.current?.click()}
        />
        <DataEntryTile
          icon={<PackageSearch size={20} />}
          title="Amazon CSV"
          description="Group items by exported order."
          onClick={() => csvInputRef.current?.click()}
        />
        <DataEntryTile
          icon={<ScrollText size={20} />}
          title="Amazon text"
          description="Paste order details from an email."
          onClick={() => imports.setIsPasting(true)}
        />
        <DataEntryTile
          icon={<Landmark size={20} />}
          title="Konto"
          description="Import account ZIP statements."
          onClick={() => kontoZipInputRef.current?.click()}
        />
        <DataEntryTile
          icon={<SquarePen size={20} />}
          title="Manual entry"
          description="Create a manual expense entry."
          onClick={onManualEntry}
        />
      </div>
    </div>
  );
}

function DataEntryTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-[1.7rem] bg-white/10 p-4 text-left text-white shadow-lg backdrop-blur-sm transition-transform hover:-translate-y-0.5"
    >
      <div className="rounded-[1.2rem] bg-white/14 p-3 w-fit">{icon}</div>
      <p className="mt-4 text-base font-semibold">{title}</p>
      <p className="mt-1 text-xs text-white/72">{description}</p>
    </button>
  );
}
