import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PaymentRule } from '../types';
import { listPaymentRules } from '../lib/api/paymentRules';

export function usePaymentRules(
  onError: Dispatch<SetStateAction<string | null>>,
) {
  const [paymentRules, setPaymentRules] = useState<PaymentRule[]>([]);

  useEffect(() => {
    const fetchPaymentRules = async () => {
      try {
        setPaymentRules(await listPaymentRules());
      } catch (error) {
        console.error('Failed to fetch payment rules:', error);
        onError('Failed to load payment rules.');
      }
    };

    void fetchPaymentRules();
  }, [onError]);

  return {
    paymentRules,
  };
}
