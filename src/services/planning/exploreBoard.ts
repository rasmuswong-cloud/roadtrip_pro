import type { Coordinates, ItineraryNodeType } from '@/models';
import type { GooglePlace } from '@/services/google/googlePlaces';
import type { AppView } from '@/components/layout/workspaceTypes';

export type TravelPlaceholderType =
  | 'route-day'
  | 'lodging'
  | 'activity'
  | 'food'
  | 'fuel'
  | 'transport'
  | 'generic-place'
  | 'budget'
  | 'notes-explore';

export type ExploreCategory = 'Sevärdheter' | 'Restauranger' | 'Hotell' | 'Aktiviteter' | 'Egna tips';

export type ImageSource = 'google_place_photo' | 'placeholder' | 'manual';

export type ExplorePlace = {
  id: string;
  title: string;
  place?: string;
  description?: string;
  category: ExploreCategory;
  type: ItineraryNodeType;
  coordinates?: Coordinates | null;
  googlePlaceId?: string;
  mapsUrl?: string;
  rating?: number | null;
  imageUrl?: string | null;
  imageSource: ImageSource;
  photoName?: string;
  photoAttributions?: unknown[];
  statusChips: string[];
};

export type AddExplorePlaceTarget = {
  view: AppView;
  dayKey: string;
  title: string;
  place: string;
  type: ItineraryNodeType;
  latitude: string;
  longitude: string;
  notes: string;
};

export function emptyExploreState(places: ExplorePlace[]): { isEmpty: boolean; message: string } {
  return {
    isEmpty: places.length === 0,
    message: places.length === 0 ? 'Spara tips, restauranger och stopp här innan de hamnar i resplanen.' : `${places.length} platser sparade`,
  };
}

export function groupExplorePlaces(places: ExplorePlace[]): Record<ExploreCategory, ExplorePlace[]> {
  return {
    Sevärdheter: places.filter((place) => place.category === 'Sevärdheter'),
    Restauranger: places.filter((place) => place.category === 'Restauranger'),
    Hotell: places.filter((place) => place.category === 'Hotell'),
    Aktiviteter: places.filter((place) => place.category === 'Aktiviteter'),
    'Egna tips': places.filter((place) => place.category === 'Egna tips'),
  };
}

export function explorePlaceFromGooglePlace(place: GooglePlace): ExplorePlace {
  const title = place.displayName?.text?.trim() || 'Namnlös plats';
  const photoName = safeString(place.photos?.[0]?.name);
  const coordinates = validCoordinates(place.location?.latitude, place.location?.longitude);

  return {
    id: `google:${place.id}`,
    title,
    place: safeString(place.formattedAddress),
    description: [place.rating ? `${place.rating} i betyg` : '', safeString(place.primaryType)].filter(Boolean).join(' / '),
    category: categoryForGoogleType(place.primaryType),
    type: itineraryTypeForGoogleType(place.primaryType),
    coordinates,
    googlePlaceId: place.id,
    mapsUrl: safeString(place.googleMapsUri),
    rating: typeof place.rating === 'number' && Number.isFinite(place.rating) ? place.rating : null,
    imageUrl: null,
    imageSource: photoName ? 'google_place_photo' : 'placeholder',
    photoName,
    photoAttributions: Array.isArray(place.photos?.[0]?.authorAttributions) ? place.photos?.[0]?.authorAttributions : [],
    statusChips: coordinates ? ['Kartposition klar'] : ['Saknar kartposition'],
  };
}

export function recommendedPlacesFromNodes(nodes: Array<{
  id: string;
  title: string;
  type: ItineraryNodeType;
  startsAt?: string | null;
  location?: Coordinates | null;
  metadata: Record<string, unknown>;
}>): ExplorePlace[] {
  return nodes.slice(0, 6).map((node) => ({
    id: `node:${node.id}`,
    title: node.title || 'Stopp',
    place: safeString(node.metadata.place),
    description: node.startsAt ? `Planerat ${node.startsAt.slice(0, 10)}` : 'Tips från resplanen',
    category: categoryForNodeType(node.type),
    type: node.type,
    coordinates: node.location ?? null,
    imageSource: 'placeholder',
    statusChips: node.location ? ['På kartan'] : ['Saknar kartposition'],
  }));
}

export function addExplorePlaceTarget(place: ExplorePlace, dayKey: string | null | undefined): AddExplorePlaceTarget | null {
  if (!dayKey) {
    return null;
  }

  return {
    view: 'days',
    dayKey,
    title: place.title,
    place: place.place ?? '',
    type: place.type,
    latitude: Number.isFinite(place.coordinates?.latitude) ? String(place.coordinates?.latitude) : '',
    longitude: Number.isFinite(place.coordinates?.longitude) ? String(place.coordinates?.longitude) : '',
    notes: [place.description, place.mapsUrl].filter(Boolean).join('\n'),
  };
}

export function placeholderTypeForPlace(place: Pick<ExplorePlace, 'type' | 'category'>): TravelPlaceholderType {
  switch (place.type) {
    case 'lodging':
    case 'camping':
      return 'lodging';
    case 'gastronomy':
      return 'food';
    case 'fuel':
      return 'fuel';
    case 'transport':
      return 'transport';
    case 'activity':
      return 'activity';
    default:
      return place.category === 'Egna tips' ? 'notes-explore' : 'generic-place';
  }
}

export function imageSourceForPlace(place: Pick<ExplorePlace, 'imageUrl' | 'photoName' | 'imageSource'>): ImageSource {
  if (place.imageUrl) {
    return 'manual';
  }

  if (place.photoName) {
    return 'google_place_photo';
  }

  return 'placeholder';
}

function categoryForGoogleType(type: string | undefined): ExploreCategory {
  const normalized = type?.toLowerCase() ?? '';
  if (/(restaurant|cafe|bakery|bar|meal|food)/.test(normalized)) {
    return 'Restauranger';
  }
  if (/(lodging|hotel|campground)/.test(normalized)) {
    return 'Hotell';
  }
  if (/(museum|tourist|landmark|park|view|attraction)/.test(normalized)) {
    return 'Sevärdheter';
  }
  if (/(activity|adventure|sports|hiking|bicycle)/.test(normalized)) {
    return 'Aktiviteter';
  }
  return 'Egna tips';
}

function itineraryTypeForGoogleType(type: string | undefined): ItineraryNodeType {
  const category = categoryForGoogleType(type);
  if (category === 'Restauranger') return 'gastronomy';
  if (category === 'Hotell') return 'lodging';
  if (category === 'Aktiviteter' || category === 'Sevärdheter') return 'activity';
  return 'custom';
}

function categoryForNodeType(type: ItineraryNodeType): ExploreCategory {
  if (type === 'gastronomy') return 'Restauranger';
  if (type === 'lodging' || type === 'camping') return 'Hotell';
  if (type === 'activity') return 'Aktiviteter';
  return 'Egna tips';
}

function validCoordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    ? { latitude, longitude }
    : null;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
