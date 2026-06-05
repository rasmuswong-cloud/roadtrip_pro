import type { CurrencyCode } from '@/models';

export type TripRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  base_currency: CurrencyCode;
  starts_at: string | null;
  ends_at: string | null;
  home_location: unknown | null;
  settings: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ItineraryNodeRow = {
  id: string;
  trip_id: string;
  poi_id: string | null;
  created_by: string;
  updated_by: string | null;
  type: string;
  title: string;
  notes: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  location: unknown | null;
  sort_order: number;
  transport_mode: string | null;
  route_to_next: Record<string, unknown> | null;
  reservation: Record<string, unknown>;
  equipment: unknown[];
  facilities: Record<string, boolean | string | number>;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ExpenseRow = {
  id: string;
  trip_id: string;
  itinerary_node_id: string | null;
  paid_by: string;
  category: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  fx_rate_to_base: number | null;
  base_amount: number | null;
  occurred_at: string;
  split: Record<string, number>;
  receipt_url: string | null;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
