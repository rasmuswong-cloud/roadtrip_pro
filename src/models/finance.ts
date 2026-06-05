import type { AuditFields, CurrencyCode } from './common';

export type Expense = AuditFields & {
  id: string;
  tripId: string;
  itineraryNodeId?: string | null;
  paidBy: string;
  category: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  fxRateToBase?: number | null;
  baseAmount?: number | null;
  occurredAt: string;
  split: Record<string, number>;
  receiptUrl?: string | null;
  metadata: Record<string, unknown>;
};

export type Budget = {
  id: string;
  tripId: string;
  category?: string | null;
  amount: number;
  currency: CurrencyCode;
  warningThreshold: number;
  createdAt: string;
  updatedAt: string;
};

export type FxRate = {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  rateDate: string;
  rate: number;
  source: string;
  fetchedAt: string;
};
