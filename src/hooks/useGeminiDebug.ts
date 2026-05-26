import { useEffect, useState } from 'react';
import {
  getGeminiDebugStatus,
  type GeminiHistoryEntry,
} from '../lib/gemini';

interface UseGeminiDebugResult {
  aiHistory: GeminiHistoryEntry[];
  detectedEnvKeys: string[];
  geminiApiKey: string | null;
}

export function useGeminiDebug(active: boolean): UseGeminiDebugResult {
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [aiHistory, setAiHistory] = useState<GeminiHistoryEntry[]>([]);
  const [detectedEnvKeys, setDetectedEnvKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!active) {
      return;
    }

    getGeminiDebugStatus()
      .then((data) => {
        setGeminiApiKey(data.apiKey);
        setDetectedEnvKeys(data.detectedKeys);
        setAiHistory(data.aiHistory);

        const lastHistoryEntry = data.aiHistory.at(-1);
        if (lastHistoryEntry) {
          console.log('[AI Debug] Last Prompt:', lastHistoryEntry.prompt);
          console.log('[AI Debug] Last Response:', lastHistoryEntry.response);
        }
      })
      .catch(() => setGeminiApiKey(null));
  }, [active]);

  return {
    aiHistory,
    detectedEnvKeys,
    geminiApiKey,
  };
}
