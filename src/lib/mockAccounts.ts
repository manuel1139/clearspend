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
    accent: 'from-[#FF5FA2] via-[#FF78B5] to-[#FF9BCB]',
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
    accent: 'from-[#A73CFF] via-[#CC66FF] to-[#F58DDA]',
    detail: 'Aktien und Puffer',
    syncedAt: 'Synced yesterday',
  },
  {
    id: 'acc-daily',
    name: 'Daily Spend',
    bank: 'N26',
    ibanMasked: 'DE44 **** 1102',
    balance: 'EUR 260',
    available: 'EUR 245',
    accent: 'from-[#FF7AA8] via-[#FF93BF] to-[#FFC2D9]',
    detail: 'Everyday spending and subscriptions.',
    syncedAt: 'Synced 09:14',
  },
];
