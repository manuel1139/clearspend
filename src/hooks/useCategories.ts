import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ReceiptCategory } from '../types';
import {
  deleteCategoryRequest,
  listCategories,
  saveCategoryRequest,
} from '../lib/api/categories';

export function useCategories(
  onError: Dispatch<SetStateAction<string | null>>,
) {
  const [categories, setCategories] = useState<ReceiptCategory[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategories(await listCategories());
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    void fetchCategories();
  }, []);

  const saveCategory = async (
    category: Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>,
  ) => {
    try {
      const savedCategory = await saveCategoryRequest(category);
      setCategories((currentCategories) => {
        const exists = currentCategories.some(
          (currentCategory) => currentCategory.id === savedCategory.id,
        );

        if (!exists) {
          return [...currentCategories, savedCategory];
        }

        return currentCategories.map((currentCategory) =>
          currentCategory.id === savedCategory.id ? savedCategory : currentCategory,
        );
      });

      return savedCategory;
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to save the receipt category.',
      );
      throw error;
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      await deleteCategoryRequest(id);
      setCategories((currentCategories) =>
        currentCategories.filter((category) => category.id !== id),
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to delete the receipt category.',
      );
      throw error;
    }
  };

  return {
    categories,
    saveCategory,
    deleteCategory,
  };
}
