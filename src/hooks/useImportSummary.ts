import { useEffect, useState } from 'react';
import type { ImportSummary } from '../types';

export function useImportSummary() {
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (!importSummary) return;

    const timer = setTimeout(() => setImportSummary(null), 5000);
    return () => clearTimeout(timer);
  }, [importSummary]);

  return {
    importSummary,
    setImportSummary,
  };
}
