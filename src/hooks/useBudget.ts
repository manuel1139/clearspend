import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getBudget, updateBudgetRequest } from '../lib/api/settings';

export function useBudget(onError: Dispatch<SetStateAction<string | null>>) {
  const [monthlyBudget, setMonthlyBudget] = useState(1000);
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  useEffect(() => {
    const fetchBudget = async () => {
      try {
        setMonthlyBudget(await getBudget());
      } catch (error) {
        console.error('Failed to fetch budget:', error);
      }
    };

    fetchBudget();
  }, []);

  const updateBudget = async (newBudget: number) => {
    try {
      await updateBudgetRequest(newBudget);
      setMonthlyBudget(newBudget);
      setIsEditingBudget(false);
    } catch {
      onError('Fehler beim Aktualisieren des Budgets.');
    }
  };

  return {
    monthlyBudget,
    isEditingBudget,
    setIsEditingBudget,
    updateBudget,
  };
}
