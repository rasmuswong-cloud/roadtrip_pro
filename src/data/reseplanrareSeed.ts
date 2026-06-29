import type { ItineraryNodeType } from '@/models';
import type { PlaceholderDriveTimeRange, PlaceholderStopType } from '@/services/planning/placeholderStops';

export type ReseplanrareSeedRow = {
  sourceRow: number;
  title?: string;
  date: string | null;
  place: string;
  notes?: string;
  cost?: string;
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
  placeholderType?: PlaceholderStopType;
  placeholderIntent?: string;
  preferredDriveTimeRange?: PlaceholderDriveTimeRange;
  type: ItineraryNodeType;
};

export const reseplanrareSeedRows: ReseplanrareSeedRow[] = [
  { sourceRow: 1, date: '2026-07-12', title: 'Bro', place: 'Broavgift', cost: '225', type: 'transport' },
  { sourceRow: 2, date: '2026-07-12', title: 'Båt', place: 'Färja', cost: '1296', type: 'transport' },
  {
    sourceRow: 3,
    date: '2026-07-12',
    title: 'Oranienbaum-Wörlitz',
    place: 'Oranienbaum-Wörlitz, Germany',
    hotel: 'Hotel Restaurant Elbebrücke',
    lodgingCost: '806',
    notes: 'Hotel: Hotel Restaurant Elbebrücke',
    type: 'lodging',
  },
  { sourceRow: 4, date: '2026-07-13', title: 'Oranienbaum-Wörlitz', place: 'Oranienbaum-Wörlitz, Germany', type: 'custom' },
  {
    sourceRow: 5,
    date: '2026-07-13',
    title: 'München',
    place: 'Munich, Germany',
    hotel: 'Ramada Encore by Wyndham Munich Messe',
    lodgingCost: '805',
    notes: 'Hotel: Ramada Encore by Wyndham Munich Messe',
    type: 'lodging',
  },
  { sourceRow: 6, date: '2026-07-13', title: 'Motorworld München', place: 'Motorworld München', activity: 'Motorworld München', type: 'activity' },
  { sourceRow: 7, date: '2026-07-14', title: 'München', place: 'Munich, Germany', type: 'custom' },
  { sourceRow: 8, date: '2026-07-14', title: 'Garmisch-Partenkirchen', place: 'Garmisch-Partenkirchen, Germany', type: 'custom' },
  { sourceRow: 9, date: '2026-07-14', title: 'Partnachklamm', place: 'Partnachklamm, Germany', activity: 'Partnachklamm', activityCost: '200', type: 'activity' },
  { sourceRow: 10, date: '2026-07-14', title: 'Mittenwald', place: 'Mittenwald, Germany', type: 'custom' },
  { sourceRow: 11, date: '2026-07-14', title: 'Sterzing', place: 'Sterzing, Italy', type: 'custom' },
  { sourceRow: 12, date: '2026-07-15', title: 'Sterzing', place: 'Sterzing, Italy', type: 'custom' },
  {
    sourceRow: 13,
    date: '2026-07-15',
    title: 'Dolomiterna',
    place: 'Dolomites, Italy',
    hotel: 'Hotel alla Posta',
    lodgingCost: '4625',
    notes: 'Hotel: Hotel alla Posta',
    type: 'lodging',
  },
  {
    sourceRow: 14,
    date: '2026-07-15',
    title: 'Lagazuoi',
    place: 'Lagazuoi, Italy',
    activity: 'Lagazuoi cable car',
    activityCost: '450',
    notes: 'Aktivitet: Lagazuoi cable car\nNotering: gå upp',
    type: 'activity',
  },
  {
    sourceRow: 15,
    date: '2026-07-15',
    title: 'WW1 mines',
    place: 'Lagazuoi WW1 mines',
    activity: 'WW1 mines',
    notes: 'Notering: ta med hjälm, handskar, skor',
    type: 'activity',
  },
  { sourceRow: 16, date: '2026-07-16', title: 'Dolomiterna', place: 'Dolomites, Italy', type: 'custom' },
  {
    sourceRow: 17,
    date: '2026-07-16',
    title: 'Cinque Torri',
    place: 'Cinque Torri, Italy',
    activity: 'Lift',
    activityCost: '450',
    notes: 'Aktivitet: Lift\nNotering: gå upp',
    type: 'activity',
  },
  { sourceRow: 18, date: '2026-07-16', title: 'Passo Giau', place: 'Passo Giau, Italy', notes: 'Notering: eller vandra', type: 'activity' },
  { sourceRow: 19, date: '2026-07-17', title: 'Dolomiterna', place: 'Dolomites, Italy', type: 'custom' },
  { sourceRow: 20, date: '2026-07-17', title: 'Caorle', place: 'Caorle, Italy', type: 'custom' },
  { sourceRow: 21, date: '2026-07-18', title: 'Caorle', place: 'Caorle, Italy', type: 'custom' },
  { sourceRow: 22, date: '2026-07-19', title: 'Caorle', place: 'Caorle, Italy', type: 'custom' },
  {
    sourceRow: 23,
    date: '2026-07-19',
    title: 'Castelnuovo del Garda',
    place: 'Castelnuovo del Garda, Italy',
    hotel: 'Hotel Doré',
    lodgingCost: '1300',
    notes: 'Hotel: Hotel Doré',
    type: 'lodging',
  },
  { sourceRow: 24, date: '2026-07-19', title: 'Gardasjön', place: 'Lake Garda, Italy', type: 'custom' },
  { sourceRow: 25, date: '2026-07-19', title: 'Vingård', place: 'Vingård nära Gardasjön', cost: '780', type: 'activity' },
  { sourceRow: 26, date: '2026-07-20', title: 'Castelnuovo del Garda', place: 'Castelnuovo del Garda, Italy', type: 'custom' },
  {
    sourceRow: 27,
    date: '2026-07-20',
    title: 'Montecchio Emilia',
    place: 'Montecchio Emilia, Italy',
    hotel: 'Hotel Conteverde',
    lodgingCost: '874',
    notes: 'Hotel: Hotel Conteverde',
    type: 'lodging',
  },
  { sourceRow: 28, date: '2026-07-20', title: 'Vingård', place: 'Vingård nära Montecchio Emilia', activity: 'Vingård', activityCost: '934', type: 'activity' },
  { sourceRow: 29, date: '2026-07-21', title: 'Montecchio Emilia', place: 'Montecchio Emilia, Italy', type: 'custom' },
  { sourceRow: 30, date: '2026-07-21', title: 'Cinque Terre', place: 'Cinque Terre, Italy', type: 'custom' },
  {
    sourceRow: 31,
    date: '2026-07-21',
    title: 'Riomaggiore',
    place: 'Riomaggiore, Italy',
    hotel: 'Hotel Villa Argentina',
    lodgingCost: '1804',
    notes: 'Hotel: Hotel Villa Argentina',
    type: 'lodging',
  },
  { sourceRow: 32, date: '2026-07-22', title: 'Cinque Terre', place: 'Cinque Terre, Italy', type: 'custom' },
  {
    sourceRow: 33,
    date: '2026-07-22',
    title: 'Como/Lugano/Maggiore',
    place: 'Como, Lugano or Lake Maggiore',
    notes: 'Unresolved area from spreadsheet: Como/Lugano/Maggiore.',
    placeholderType: 'unknown',
    placeholderIntent: 'Välj exakt område eller övernattning runt Como, Lugano eller Maggiore.',
    preferredDriveTimeRange: '4-6h',
    type: 'custom',
  },
  {
    sourceRow: 34,
    date: '2026-07-23',
    title: 'Como/Lugano/Maggiore',
    place: 'Como, Lugano or Lake Maggiore',
    notes: 'Unresolved route-home area from spreadsheet.',
    placeholderType: 'unknown',
    placeholderIntent: 'Bekräfta startpunkt för hemresan från Como/Lugano/Maggiore.',
    preferredDriveTimeRange: '4-6h',
    type: 'custom',
  },
  {
    sourceRow: 35,
    date: '2026-07-23',
    title: 'Lindau',
    place: 'Lindau, Germany',
    notes: 'Placeholder on route home; exact stop/overnight not confirmed.',
    placeholderType: 'drive_time',
    placeholderIntent: 'Bekräfta om Lindau är stopp eller bara riktmärke på hemvägen.',
    preferredDriveTimeRange: '6-8h',
    type: 'custom',
  },
  {
    sourceRow: 36,
    date: '2026-07-23',
    title: 'Schwarzwald',
    place: 'Black Forest, Germany',
    notes: 'Placeholder on route home; exact stop/overnight not confirmed.',
    placeholderType: 'overnight',
    placeholderIntent: 'Välj exakt övernattning eller stopp i Schwarzwald.',
    preferredDriveTimeRange: '6-8h',
    type: 'lodging',
  },
  { sourceRow: 37, date: '2026-07-24', title: 'Frankfurt', place: 'Frankfurt, Germany', type: 'custom' },
  { sourceRow: 38, date: '2026-07-25', title: 'Frankfurt', place: 'Frankfurt, Germany', type: 'custom' },
  { sourceRow: 39, date: '2026-07-25', title: 'Båt', place: 'Färja', cost: '1700', type: 'transport' },
  { sourceRow: 40, date: '2026-07-25', title: 'Bro', place: 'Broavgift', cost: '225', type: 'transport' },
  { sourceRow: 41, date: null, title: 'Bensin', place: 'General budget', cost: '6000', notes: 'Generell budgetpost från kalkylbladet.', type: 'fuel' },
  { sourceRow: 42, date: null, title: 'Vägtull', place: 'General budget', cost: '600', notes: 'Generell budgetpost från kalkylbladet.', type: 'transport' },
  { sourceRow: 43, date: null, title: 'Turistskatt', place: 'General budget', cost: '2000', notes: 'Generell budgetpost från kalkylbladet.', type: 'custom' },
  { sourceRow: 44, date: null, title: 'Mat', place: 'General budget', cost: '10000', notes: 'Generell budgetpost från kalkylbladet.', type: 'gastronomy' },
  {
    sourceRow: 45,
    date: null,
    title: 'Kalkylbladets totalsummor',
    place: 'Spreadsheet summary',
    notes: 'Kända totalsummor från kalkylbladet:\nBoende cirka 14 440 SEK\nAktiviteter/övrigt cirka 20 634 SEK\nTotalt cirka 35 074 SEK',
    type: 'note',
  },
];

export const reseplanrareIdeaPlaces = [
  'Como',
  'Lugano',
  'Lake Maggiore',
  'Lindau',
  'Schwarzwald',
];
