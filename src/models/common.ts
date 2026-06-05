export type CurrencyCode = 'SEK' | 'EUR' | 'USD' | 'NOK' | 'DKK' | 'CHF' | string;

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type AuditFields = {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version: number;
};

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'failed';

export type EntityEnvelope<T> = T & {
  syncStatus?: SyncStatus;
  clientMutationId?: string;
};
