import { getUseAiSetting } from './api/settings';
import { type AiClientBase, type AiProvider, type AiProviderStatus } from './aiClient';
import { azureClient } from './azure';
import { geminiClient } from './gemini';

export type ActiveAiClient = AiClientBase<AiProviderStatus>;

function normalizeUseAiProvider(value: string | null): AiProvider {
  const normalizedValue = value?.trim().toUpperCase();
  return normalizedValue === 'AZURE' ? 'AZURE' : 'GEMINI';
}

function getClientForProvider(provider: AiProvider): ActiveAiClient {
  return provider === 'AZURE' ? azureClient : geminiClient;
}

let activeAiClientPromise: Promise<ActiveAiClient> | null = null;

export async function getActiveAiProvider(): Promise<AiProvider> {
  return normalizeUseAiProvider(await getUseAiSetting());
}

export async function getActiveAiClient(): Promise<ActiveAiClient> {
  if (!activeAiClientPromise) {
    activeAiClientPromise = getActiveAiProvider().then((provider) =>
      getClientForProvider(provider),
    );
  }

  return activeAiClientPromise;
}
