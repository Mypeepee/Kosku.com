import { useEffect, useRef } from 'react';
import { UseFormWatch } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';

interface UseAutoSaveProps {
  watch: UseFormWatch<ListingFormData>;
  onSave: (data: Partial<ListingFormData>) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

export function useAutoSave({ 
  watch, 
  onSave, 
  delay = 30000, // 30 seconds
  enabled = true 
}: UseAutoSaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const previousDataRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;

    const subscription = watch((data) => {
      const currentData = JSON.stringify(data);
      
      // Only save if data has changed
      if (currentData === previousDataRef.current) return;
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(async () => {
        try {
          await onSave(data as Partial<ListingFormData>);
          previousDataRef.current = currentData;
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, delay);
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [watch, onSave, delay, enabled]);
}
