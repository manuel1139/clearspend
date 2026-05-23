import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { KontoEntry } from '../types';
import { listKontoEntriesRequest } from '../lib/api/kontoEntries';

export function useKontoEntries(
  onError: Dispatch<SetStateAction<string | null>>,
) {
  const [entries, setEntries] = useState<KontoEntry[]>([]);

  const refreshEntries = async () => {
    try {
      setEntries(await listKontoEntriesRequest());
    } catch (error) {
      console.error('Failed to fetch konto entries:', error);
      onError('Failed to load Konto data.');
    }
  };

  useEffect(() => {
    void refreshEntries();
  }, []);

  return {
    entries,
    refreshEntries,
  };
}
