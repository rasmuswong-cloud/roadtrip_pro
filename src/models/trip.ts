import type { AuditFields, Coordinates, CurrencyCode } from './common';

export type TripRole = 'owner' | 'editor' | 'viewer';

export type Trip = AuditFields & {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  baseCurrency: CurrencyCode;
  startsAt?: string | null;
  endsAt?: string | null;
  homeLocation?: Coordinates | null;
  settings: TripSettings;
};

export type TripSettings = {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  preferScenicRoutes?: boolean;
  offlineRegions?: OfflineRegion[];
};

export type OfflineRegion = {
  id: string;
  name: string;
  bounds: {
    northEast: Coordinates;
    southWest: Coordinates;
  };
  minZoom: number;
  maxZoom: number;
  downloadedAt?: string;
};

export type TripMember = {
  tripId: string;
  userId: string;
  role: TripRole;
  joinedAt: string;
};
