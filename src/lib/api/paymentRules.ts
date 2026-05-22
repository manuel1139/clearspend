import type { PaymentRule } from '../../types';

export async function listPaymentRules(): Promise<PaymentRule[]> {
  const response = await fetch('/api/payment-rules');
  return response.json();
}
