export async function getBudget(): Promise<number> {
  const response = await fetch('/api/settings/budget');
  const data = await response.json();
  return parseFloat(data.budget);
}

export async function getUseAiSetting(): Promise<string | null> {
  const response = await fetch('/api/settings/use-ai');
  const data = (await response.json()) as { useAi?: string | null };
  return data.useAi ?? null;
}

export async function updateBudgetRequest(newBudget: number): Promise<void> {
  await fetch('/api/settings/budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budget: newBudget }),
  });
}
