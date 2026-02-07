import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';

const STORAGE_KEY = 'listing-form-draft';

export function useFormPersist(form: UseFormReturn<ListingFormData>) {
  const { watch, reset } = form;

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        reset(data);
      } catch (error) {
        console.error('Failed to load saved form:', error);
      }
    }
  }, [reset]);

  // Save to localStorage on change
  useEffect(() => {
    const subscription = watch((data) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to save form:', error);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return { clearDraft };
}
