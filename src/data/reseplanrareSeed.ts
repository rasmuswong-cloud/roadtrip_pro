import type { ItineraryNodeType } from '@/models';

export type ReseplanrareSeedRow = {
  sourceRow: number;
  date: string | null;
  place: string;
  lodgingCost?: string;
  activity?: string;
  activityCost?: string;
  hotel?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  type: ItineraryNodeType;
};

export const reseplanrareSeedRows: ReseplanrareSeedRow[] = [
  {
    sourceRow: 2,
    date: '2026-07-12',
    place: 'Bro',
    lodgingCost: '225',
    type: 'transport',
  },
  {
    sourceRow: 3,
    date: '2026-07-12',
    place: 'Bat',
    lodgingCost: '1500',
    type: 'transport',
  },
  {
    sourceRow: 4,
    date: '2026-07-12',
    place: 'Hotell motorvagen',
    lodgingCost: '550',
    hotel: 'Pension zum Amboss',
    location: { latitude: 49.1867, longitude: 10.3845 },
    type: 'lodging',
  },
  {
    sourceRow: 6,
    date: '2026-07-13',
    place: 'Munich',
    activity: 'BMW museet',
    activityCost: '500',
    location: { latitude: 48.1769, longitude: 11.5562 },
    type: 'activity',
  },
  {
    sourceRow: 7,
    date: '2026-07-13',
    place: 'Munich',
    activity: 'Hofbraeuhaus ol',
    activityCost: '0',
    location: { latitude: 48.1376, longitude: 11.5799 },
    type: 'gastronomy',
  },
  {
    sourceRow: 8,
    date: '2026-07-13',
    place: 'Munich',
    activity: 'Hofbraeuhaus tour request price from',
    location: { latitude: 48.1376, longitude: 11.5799 },
    type: 'activity',
  },
  {
    sourceRow: 10,
    date: null,
    place: 'Garmisch-Partenkirchen',
    activity: 'Partnachklammet',
    activityCost: '200',
    location: { latitude: 47.4656, longitude: 11.1175 },
    type: 'activity',
  },
  {
    sourceRow: 12,
    date: '2026-07-15',
    place: 'Kals am Grossglockner',
    location: { latitude: 47.0033, longitude: 12.6456 },
    type: 'custom',
  },
  {
    sourceRow: 14,
    date: '2026-07-15',
    place: 'Dolomiterna',
    lodgingCost: '4625',
    hotel: 'Hotel alla Posta',
    location: { latitude: 46.5405, longitude: 12.1357 },
    type: 'lodging',
  },
  {
    sourceRow: 15,
    date: '2026-07-16',
    place: 'Lagazuoi',
    activity: 'Lagazuoi cable car',
    activityCost: '450',
    hotel: 'Ga upp',
    location: { latitude: 46.5279, longitude: 12.0091 },
    type: 'activity',
  },
  {
    sourceRow: 16,
    date: '2026-07-16',
    place: 'Lagazuoi',
    activity: 'WW1 mines (ta med hjalm, handskar, skor)',
    location: { latitude: 46.5279, longitude: 12.0091 },
    type: 'activity',
  },
  {
    sourceRow: 17,
    date: '2026-07-16',
    place: 'Dolomiterna',
    location: { latitude: 46.5405, longitude: 12.1357 },
    type: 'custom',
  },
  {
    sourceRow: 18,
    date: '2026-07-17',
    place: 'Dolomiterna',
    location: { latitude: 46.5405, longitude: 12.1357 },
    type: 'custom',
  },
  {
    sourceRow: 21,
    date: '2026-07-17',
    place: 'Dolomiterna',
    location: { latitude: 46.5405, longitude: 12.1357 },
    type: 'custom',
  },
  {
    sourceRow: 24,
    date: '2026-07-18',
    place: 'Caorle alt. Venedig',
    location: { latitude: 45.5968, longitude: 12.8758 },
    type: 'custom',
  },
  {
    sourceRow: 27,
    date: '2026-07-20',
    place: 'Montecchio Emilia',
    lodgingCost: '874',
    activityCost: '850',
    hotel: 'Hotel Conteverde',
    location: { latitude: 44.7005, longitude: 10.4524 },
    type: 'lodging',
  },
  {
    sourceRow: 28,
    date: '2026-07-21',
    place: 'Montecchio Emilia',
    location: { latitude: 44.7005, longitude: 10.4524 },
    type: 'custom',
  },
  {
    sourceRow: 33,
    date: '2026-07-25',
    place: 'Bat',
    lodgingCost: '1700',
    type: 'transport',
  },
  {
    sourceRow: 34,
    date: '2026-07-25',
    place: 'Bro',
    lodgingCost: '225',
    type: 'transport',
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
