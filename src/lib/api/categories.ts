import type { ReceiptCategory } from '../../types';

export async function listCategories(): Promise<ReceiptCategory[]> {
  const response = await fetch('/api/categories');
  return response.json();
}

export async function saveCategoryRequest(
  category: Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>,
): Promise<ReceiptCategory> {
  const response = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(data?.error ?? 'Failed to save category');
  }

  return response.json();
}

export async function deleteCategoryRequest(id: number): Promise<void> {
  const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(data?.error ?? 'Failed to delete category');
  }
}
