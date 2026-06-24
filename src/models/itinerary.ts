import type { AuditFields, Coordinates } from './common';
import type { LineString } from 'geojson';

export type ItineraryNodeType =
  | 'lodging'
  | 'camping'
  | 'activity'
  | 'gastronomy'
  | 'fuel'
  | 'transport'
  | 'note'
  | 'custom';

export type TransportMode = 'driving' | 'walking' | 'hiking' | 'cycling' | 'mtb' | 'transit';

export type ItineraryNode = AuditFields & {
  id: string;
  tripId: string;
  poiId?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  type: ItineraryNodeType;
  title: string;
  notes?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string | null;
  location?: Coordinates | null;
  sortOrder: number;
  transportMode?: TransportMode | null;
  routeToNext?: RouteSummary | null;
  reservation: ReservationDetails;
  equipment: EquipmentItem[];
  facilities: Record<string, boolean | string | number>;
  metadata: Record<string, unknown>;
};

export type ReservationDetails = {
  provider?: string;
  reference?: string;
  checkInWindow?: TimeWindow;
  checkOutWindow?: TimeWindow;
  siteNumber?: string;
  accessDetails?: string;
};

export type TimeWindow = {
  opensAt?: string;
  closesAt?: string;
};

export type EquipmentItem = {
  name: string;
  quantity: number;
  pickupLocation?: Coordinates | string;
  pickupAt?: string;
  returnAt?: string;
};

export type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
  provider: 'google_routes' | 'mapbox' | 'osrm' | 'offline';
  legs?: RouteLegSummary[];
  geometry?: LineString;
  elevation?: ElevationProfile;
  instructions?: NavigationInstruction[];
};

export type RouteLegSummary = {
  fromTitle: string;
  toTitle: string;
  distanceMeters: number;
  durationSeconds: number;
  provider: 'google_routes' | 'mapbox' | 'osrm' | 'offline';
};

export type ElevationProfile = {
  ascentMeters: number;
  descentMeters: number;
  samples: Array<{
    distanceMeters: number;
    elevationMeters: number;
  }>;
};

export type NavigationInstruction = {
  distanceMeters: number;
  durationSeconds: number;
  maneuver: string;
  instruction: string;
};
