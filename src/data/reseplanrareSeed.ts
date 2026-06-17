import type { ItineraryNodeType } from '@/models';

export type ReseplanrareSeedRow = {
  sourceRow: number;
  title?: string;
  date: string | null;
  place: string;
  notes?: string;
  lodgingCost?: string;
  activity?: string;
  activityCost?: string;
  hotel?: string;
  googlePlaceId?: string;
  website?: string;
  phone?: string;
  email?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  type: ItineraryNodeType;
};

export const reseplanrareSeedRows: ReseplanrareSeedRow[] = [
  {
    sourceRow: 1,
    title: 'Malmö',
    date: '2026-07-12',
    place: 'Malmö, Sweden',
    googlePlaceId: 'ChIJ_5HEdKUFU0YR5YhIvd8FqdM',
    location: { latitude: 55.604981, longitude: 13.003822 },
    type: 'custom',
  },
  {
    sourceRow: 2,
    date: '2026-07-12',
    place: 'Rehweiler 1, 96160 Geiselwind-Rehweiler, Germany',
    hotel: 'Eventhotel Ö-Cappuccino',
    googlePlaceId: 'ChIJKVIrjM5vokcR_LRpuytutx8',
    location: { latitude: 49.7685299, longitude: 10.4345108 },
    type: 'lodging',
  },
  {
    sourceRow: 3,
    date: '2026-07-13',
    place: 'Stahlgruberring 4, 81829 München, Germany',
    hotel: 'Wyndham Garden Munich Messe',
    googlePlaceId: 'ChIJP0FSJDcLnkcR1m2fbTG9080',
    location: { latitude: 48.1330434, longitude: 11.6632124 },
    type: 'lodging',
  },
  {
    sourceRow: 4,
    date: '2026-07-14',
    place: 'Wildenau 14, 82467 Garmisch-Partenkirchen, Germany',
    activity: 'Partnachklamm',
    googlePlaceId: 'ChIJOUFSRI8GnUcRZncn4ALFq0A',
    location: { latitude: 47.4675607, longitude: 11.1200271 },
    type: 'activity',
  },
  {
    sourceRow: 5,
    date: '2026-07-15',
    place: 'Ködnitz 16, 9981 Kals am Großglockner, Austria',
    hotel: 'Gasthof Ködnitzhof',
    googlePlaceId: 'ChIJeZshde1td0cR0JwG5Jk8FHM',
    location: { latitude: 47.001204, longitude: 12.6453957 },
    type: 'lodging',
  },
  {
    sourceRow: 6,
    date: '2026-07-16',
    place: 'Piazza O. Dogliani, 19, 32023 Caprile BL, Italy',
    hotel: 'Hotel alla Posta',
    notes: 'Tel: +390437721171\nEmail: booking@hotelposta.com\nWebsite: https://www.hotelposta.com/',
    googlePlaceId: 'ChIJXy3O0blIeEcRgAyi-8Mnm5E',
    website: 'https://www.hotelposta.com/',
    phone: '+390437721171',
    email: 'booking@hotelposta.com',
    location: { latitude: 46.4377758, longitude: 11.9956244 },
    type: 'lodging',
  },
  {
    sourceRow: 7,
    title: 'Caorle',
    date: '2026-07-18',
    place: 'Caorle, Italy',
    googlePlaceId: 'ChIJK10sOLvxe0cRAw8pCmgcw1Q',
    location: { latitude: 45.6001992, longitude: 12.8874114 },
    type: 'custom',
  },
  {
    sourceRow: 8,
    date: '2026-07-19',
    place: 'Via Giorgio Rizzardi, 21, 30175 Marghera, Italy',
    hotel: 'Hotel Mondial',
    googlePlaceId: 'ChIJDTqqqCa0fkcR1MYwF03AZYY',
    location: { latitude: 45.4796381, longitude: 12.231777 },
    type: 'lodging',
  },
  {
    sourceRow: 9,
    title: 'Montecchio Emilia',
    date: '2026-07-20',
    place: 'Montecchio Emilia, Italy',
    googlePlaceId: 'ChIJ3w0ROAARgEcRoHu7_AubBwQ',
    location: { latitude: 44.6983978, longitude: 10.4484194 },
    type: 'custom',
  },
];

export const reseplanrareIdeaPlaces = [
  'Bologna',
  'Rimini',
  'Pescara',
  'Peschici',
  'Ancona',
  'Bari',
  'Neapel',
  'Rom',
  'Florens',
  'Pisa',
  'Gardasjon',
  'Como',
  'Milano',
  'Solden',
  'Zurich',
  'Paris',
  'Brussel',
  'Amsterdam',
  'Hamburg',
];
