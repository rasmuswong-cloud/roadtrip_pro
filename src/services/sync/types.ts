export type SyncTable = 'trips' | 'pois' | 'itinerary_nodes' | 'expenses' | 'budgets';

export type PendingMutation = {
  id: string;
  tripId: string;
  table: SyncTable;
  operation: 'insert' | 'update' | 'delete';
  rowId: string;
  payload: Record<string, unknown>;
  baseVersion?: number;
  createdAt: string;
  attempts: number;
};

export type ConflictRecord = {
  mutation: PendingMutation;
  serverPayload: Record<string, unknown>;
  detectedAt: string;
};
