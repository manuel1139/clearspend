export interface AccountOverview {
  id: string;
  name: string;
  bank: string;
  ibanMasked: string;
  balance: string;
  available: string;
  accent: string;
  detail: string;
  syncedAt: string;
}

export const MOCK_ACCOUNTS: AccountOverview[] = [
  {
    id: 'acc-main',
    name: 'Main Budget',
    bank: 'Sparkasse',
    ibanMasked: 'DE89 **** 2294',
    balance: 'EUR 100',
    available: 'EUR 100',
    accent: 'from-[#1F3CFF] to-[#6E86FF]',
    detail: 'Konto',
    syncedAt: 'Synced 08:42',
  },
  {
    id: 'acc-savings',
    name: 'Aktienkonto',
    bank: 'Revolut',
    ibanMasked: 'DE55 **** 9817',
    balance: 'EUR 400',
    available: 'EUR 400',
    accent: 'from-[#5A6BFF] to-[#97A6FF]',
    detail: 'Aktien und Puffer',
    syncedAt: 'Synced yesterday',
  },
];
