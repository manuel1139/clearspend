import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PaymentRule, Receipt, ReceiptCategory } from '../types';
import { deleteReceiptRequest, listReceipts, saveReceiptRequest } from '../lib/api/receipts';
import { createManualReceipt } from '../lib/receiptFactories';

export function useReceipts(
  onError: Dispatch<SetStateAction<string | null>>,
  categories: ReceiptCategory[],
  paymentRules: PaymentRule[],
) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Receipt[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Alle');

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        setReceipts(await listReceipts());
      } catch (error) {
        console.error('Failed to fetch:', error);
      }
    };

    fetchReceipts();
  }, []);

  const filteredReceipts = receipts.filter((receipt) => {
    const normalizedQuery = searchQuery.toLowerCase();
    const matchesSearch =
      receipt.merchant.toLowerCase().includes(normalizedQuery) ||
      receipt.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
    const matchesFilter =
      filterCategory === 'Alle' || receipt.categoryName === filterCategory;

    return matchesSearch && matchesFilter;
  });

  const handleManualEntry = () => {
    const defaultCategory =
      categories.find((category) => category.name === 'Sonstiges') ?? categories[0];
    const defaultPaymentRule =
      paymentRules.find((rule) => rule.frequency === 'one_time') ?? paymentRules[0];

    if (!defaultCategory || !defaultPaymentRule) {
      onError('Create categories and payment rules before adding receipts.');
      return;
    }

    setSelectedReceipt(createManualReceipt(defaultCategory, defaultPaymentRule));
  };

  const prependReceipts = (newReceipts: Receipt[]) => {
    setReceipts((currentReceipts) => [...newReceipts, ...currentReceipts]);
  };

  const mergeReceipts = (nextReceipts: Receipt[]) => {
    setReceipts((currentReceipts) => {
      const mergedReceipts = [...currentReceipts];

      for (const receipt of nextReceipts) {
        const index = mergedReceipts.findIndex((current) => current.id === receipt.id);
        if (index === -1) {
          mergedReceipts.unshift(receipt);
          continue;
        }

        mergedReceipts[index] = receipt;
      }

      return mergedReceipts;
    });
  };

  const startReview = (newReceipts: Receipt[]) => {
    setReviewQueue(newReceipts);
    setSelectedReceipt(newReceipts[0] ?? null);
  };

  const clearReview = () => {
    setReviewQueue([]);
    setSelectedReceipt(null);
  };

  const dismissSelectedReviewReceipt = () => {
    if (!selectedReceipt) return;

    const remaining = reviewQueue.filter((receipt) => receipt.id !== selectedReceipt.id);
    setReviewQueue(remaining);
    setSelectedReceipt(remaining[0] ?? null);
  };

  const saveReceipt = async (receipt: Receipt) => {
    setIsUploading(true);
    try {
      const saved = await saveReceiptRequest(receipt);

      setReceipts((currentReceipts) => {
        const index = currentReceipts.findIndex((current) => current.id === saved.id);
        if (index !== -1) {
          const nextReceipts = [...currentReceipts];
          nextReceipts[index] = saved;
          return nextReceipts;
        }

        return [saved, ...currentReceipts];
      });

      setReviewQueue((currentQueue) => {
        const remaining = currentQueue.filter((item) => item.id !== receipt.id);
        setSelectedReceipt(remaining[0] ?? null);
        return remaining;
      });
    } catch {
      onError('Fehler beim Speichern des Belegs.');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteReceipt = async (id: string) => {
    try {
      await deleteReceiptRequest(id);
      setReceipts((currentReceipts) =>
        currentReceipts.filter((receipt) => receipt.id !== id),
      );

      if (selectedReceipt?.id === id) {
        setSelectedReceipt(null);
      }
    } catch {
      onError('Löschen fehlgeschlagen.');
    }
  };

  return {
    receipts,
    filteredReceipts,
    selectedReceipt,
    setSelectedReceipt,
    reviewQueue,
    setReviewQueue,
    isUploading,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    handleManualEntry,
    prependReceipts,
    mergeReceipts,
    startReview,
    clearReview,
    dismissSelectedReviewReceipt,
    saveReceipt,
    deleteReceipt,
  };
}
