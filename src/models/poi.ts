import type { AuditFields, Coordinates } from './common';

export type Poi = AuditFields & {
  id: string;
  tripId?: string | null;
  createdBy: string;
  name: string;
  category: string;
  location: Coordinates;
  address?: string | null;
  source: 'custom' | 'google_places' | 'mapbox' | 'osm';
  externalRef?: string | null;
  rating?: number | null;
  openingHours: Record<string, unknown>;
  contact: Record<string, string>;
  imagery: Array<{ url: string; attribution?: string }>;
  metadata: Record<string, unknown>;
  isPrivate: boolean;
};
