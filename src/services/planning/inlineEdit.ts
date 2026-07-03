import type { CurrencyCode, ItineraryNode, ItineraryNodeType } from '@/models';
import { formatKnownCostLabel, formatParkingCostLabel } from '@/services/planning/costs';

export type InlineFieldKey =
  | 'title'
  | 'place'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'type'
  | 'cost'
  | 'parkingCost'
  | 'currency'
  | 'bookingStatus'
  | 'bookingReference'
  | 'notes';

export type ActiveInlineEdit = {
  nodeId: string;
  field: InlineFieldKey;
} | null;

export type InlineFieldValue = string | number | null;

export const inlineNodeTypes: ItineraryNodeType[] = ['lodging', 'camping', 'activity', 'gastronomy', 'fuel', 'transport', 'note', 'custom'];
export const inlineCurrencies: CurrencyCode[] = ['SEK', 'EUR', 'USD', 'NOK', 'DKK', 'CHF'];

const inlineBookingStatuses = ['none', 'planned', 'requested', 'confirmed', 'cancelled'] as const;
export { inlineBookingStatuses };

type BookingStatus = typeof inlineBookingStatuses[number];

type InlineValidationResult = {
  valid: boolean;
  value: string;
  error?: string;
};

export function inlineFieldLabel(field: InlineFieldKey): string {
  switch (field) {
    case 'title':
      return 'titel';
    case 'place':
      return 'plats';
    case 'date':
      return 'datum';
    case 'startTime':
      return 'starttid';
    case 'endTime':
      return 'sluttid';
    case 'type':
      return 'typ';
    case 'cost':
      return 'kostnad';
    case 'parkingCost':
      return 'parkeringspris';
    case 'currency':
      return 'valuta';
    case 'bookingStatus':
      return 'bokningsstatus';
    case 'bookingReference':
      return 'bokningsreferens';
    case 'notes':
      return 'anteckningar';
    default:
      return 'fält';
  }
}

export function inlineFieldValue(node: ItineraryNode, field: InlineFieldKey): string {
  switch (field) {
    case 'title':
      return node.title;
    case 'place':
      return typeof node.metadata.place === 'string' ? node.metadata.place : '';
    case 'date':
      return datePart(node.startsAt);
    case 'startTime':
      return timePart(node.startsAt);
    case 'endTime':
      return timePart(node.endsAt);
    case 'type':
      return node.type;
    case 'cost':
      return formatRawNodeCost(node);
    case 'parkingCost':
      return formatParkingNodeCost(node);
    case 'currency':
      return typeof node.metadata.currency === 'string' ? node.metadata.currency : 'SEK';
    case 'bookingStatus':
      return typeof node.metadata.bookingStatus === 'string' ? node.metadata.bookingStatus : 'none';
    case 'bookingReference':
      return node.reservation.reference ?? '';
    case 'notes':
      return node.notes ?? '';
    default:
      return '';
  }
}

export function displayInlineFieldValue(node: ItineraryNode, field: InlineFieldKey): string {
  const value = inlineFieldValue(node, field);
  switch (field) {
    case 'date':
      return value || 'Datum saknas';
    case 'startTime':
    case 'endTime':
      return value || '--:--';
    case 'cost':
      return value ? formatKnownCostLabel(value) : 'Kostnad saknas';
    case 'parkingCost':
      return value ? formatParkingCostLabel(value) : 'Lägg till parkeringspris';
    case 'currency':
      return value || 'SEK';
    case 'bookingStatus':
      return formatBookingStatus(value);
    case 'bookingReference':
      return value || 'Referens saknas';
    case 'notes':
      return value || 'Anteckningar saknas';
    case 'place':
      return value || (node.location ? 'Textplats saknas' : 'Plats saknas');
    case 'type':
      return formatNodeType(value as ItineraryNodeType);
    default:
      return value || 'Saknas';
  }
}

export function validateInlineFieldValue(node: ItineraryNode, field: InlineFieldKey, rawValue: InlineFieldValue): InlineValidationResult {
  const value = String(rawValue ?? '').trim();

  if (field === 'title' && !value) {
    return { valid: false, value, error: 'Titel måste fyllas i.' };
  }

  if (field === 'date' && value && !isValidDateInput(value)) {
    return { valid: false, value, error: 'Datum ska anges som ÅÅÅÅ-MM-DD.' };
  }

  if ((field === 'startTime' || field === 'endTime') && value && !isValidTimeInput(value)) {
    return { valid: false, value, error: `${inlineFieldLabel(field)} ska anges som TT:MM.` };
  }

  if (field === 'startTime' && value && !node.startsAt) {
    return { valid: false, value, error: 'Sätt datum innan du anger starttid.' };
  }

  if (field === 'endTime' && value && !node.startsAt) {
    return { valid: false, value, error: 'Sätt datum och starttid innan du anger sluttid.' };
  }

  if (field === 'type' && !inlineNodeTypes.includes(value as ItineraryNodeType)) {
    return { valid: false, value, error: 'Okänd stopptyp.' };
  }

  if (field === 'currency' && value && !inlineCurrencies.includes(value as CurrencyCode)) {
    return { valid: false, value, error: 'Välj en giltig valuta.' };
  }

  if (field === 'bookingStatus' && !inlineBookingStatuses.includes(value as BookingStatus)) {
    return { valid: false, value, error: 'Välj en giltig bokningsstatus.' };
  }

  if ((field === 'cost' || field === 'parkingCost') && value) {
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { valid: false, value, error: `${inlineFieldLabel(field)} behöver vara 0 eller ett positivt tal.` };
    }
  }

  return { valid: true, value };
}

export function applyInlineFieldUpdate(node: ItineraryNode, field: InlineFieldKey, rawValue: InlineFieldValue, now = new Date().toISOString()): ItineraryNode {
  const validation = validateInlineFieldValue(node, field, rawValue);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Kontrollera fältet.');
  }

  const value = validation.value;
  const nextMetadata = { ...node.metadata };
  const nextReservation = { ...node.reservation };
  let nextNode: ItineraryNode = {
    ...node,
    metadata: nextMetadata,
    reservation: nextReservation,
    updatedAt: now,
    version: node.version + 1,
  };

  if (field === 'title') {
    nextNode = { ...nextNode, title: value };
  }

  if (field === 'place') {
    if (value) {
      nextMetadata.place = value;
    } else {
      delete nextMetadata.place;
    }
  }

  if (field === 'date') {
    const startTime = timePart(node.startsAt);
    const endTime = timePart(node.endsAt);
    nextNode = {
      ...nextNode,
      startsAt: value ? composeDateTime(value, startTime || '09:00', node.startsAt) : null,
      endsAt: node.endsAt && value ? composeEndDateTime(value, startTime || '09:00', endTime, node.endsAt) : null,
    };
  }

  if (field === 'startTime') {
    const startDate = datePart(node.startsAt);
    const endTime = timePart(node.endsAt);
    nextNode = {
      ...nextNode,
      startsAt: value && startDate ? composeDateTime(startDate, value, node.startsAt) : null,
      endsAt: node.endsAt && value && startDate ? composeEndDateTime(startDate, value, endTime, node.endsAt) : node.endsAt ?? null,
    };
  }

  if (field === 'endTime') {
    const startDate = datePart(node.startsAt);
    const startTime = timePart(node.startsAt);
    nextNode = {
      ...nextNode,
      endsAt: value && startDate ? composeEndDateTime(startDate, startTime || '09:00', value, node.endsAt ?? node.startsAt) : null,
    };
  }

  if (field === 'type') {
    nextNode = { ...nextNode, type: value as ItineraryNodeType };
  }

  if (field === 'cost') {
    if (value) {
      const normalized = value.replace(',', '.');
      nextMetadata.costSek = normalized;
      delete nextMetadata.cost;
      delete nextMetadata.price;
    } else {
      delete nextMetadata.costSek;
      delete nextMetadata.cost;
      delete nextMetadata.price;
    }
  }

  if (field === 'parkingCost') {
    if (value) {
      nextMetadata.parkingCostSek = value.replace(',', '.');
      delete nextMetadata.parkingCost;
    } else {
      delete nextMetadata.parkingCostSek;
      delete nextMetadata.parkingCost;
    }
  }

  if (field === 'currency') {
    // Currency and booking status are metadata-only fields in the current data model.
    nextMetadata.currency = value || 'SEK';
  }

  if (field === 'bookingStatus') {
    if (value === 'none') {
      delete nextMetadata.bookingStatus;
    } else {
      nextMetadata.bookingStatus = value;
    }
  }

  if (field === 'bookingReference') {
    if (value) {
      nextReservation.reference = value;
    } else {
      delete nextReservation.reference;
    }
  }

  if (field === 'notes') {
    nextNode = { ...nextNode, notes: value || null };
  }

  return nextNode;
}

export function shouldSaveInlineField(node: ItineraryNode, field: InlineFieldKey, rawValue: InlineFieldValue): boolean {
  const validation = validateInlineFieldValue(node, field, rawValue);
  if (!validation.valid) {
    return true;
  }

  return validation.value !== inlineFieldValue(node, field);
}

export function formatNodeType(type: ItineraryNodeType): string {
  switch (type) {
    case 'lodging':
      return 'Boende';
    case 'camping':
      return 'Camping';
    case 'activity':
      return 'Aktivitet';
    case 'gastronomy':
      return 'Mat';
    case 'fuel':
      return 'Bränsle';
    case 'transport':
      return 'Transport';
    case 'note':
      return 'Notis';
    default:
      return 'Övrigt';
  }
}

export function formatBookingStatus(value: string): string {
  switch (value) {
    case 'planned':
      return 'Planerad';
    case 'requested':
      return 'Förfrågad';
    case 'confirmed':
      return 'Bekräftad';
    case 'cancelled':
      return 'Avbokad';
    default:
      return 'Ej bokad';
  }
}

function formatRawNodeCost(node: ItineraryNode): string {
  const cost = node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price;
  if (typeof cost === 'number') {
    return String(cost);
  }

  if (typeof cost === 'string') {
    return cost;
  }

  return '';
}

function formatParkingNodeCost(node: ItineraryNode): string {
  const cost = node.metadata.parkingCostSek ?? node.metadata.parkingCost;
  if (typeof cost === 'number') {
    return String(cost);
  }

  if (typeof cost === 'string') {
    return cost;
  }

  return '';
}

function datePart(value?: string | null): string {
  return parseDateTime(value)?.date ?? '';
}

function timePart(value?: string | null): string {
  return parseDateTime(value)?.time ?? '';
}

function composeEndDateTime(startDate: string, startTime: string, endTime: string, template?: string | null): string | null {
  if (!endTime) {
    return null;
  }

  const endDate = compareTime(endTime, startTime) < 0 ? addDays(startDate, 1) : startDate;
  return composeDateTime(endDate, endTime, template);
}

function composeDateTime(date: string, time: string, template?: string | null): string {
  if (!isValidDateInput(date) || !isValidTimeInput(time)) {
    throw new Error('Ange datum som ÅÅÅÅ-MM-DD och tid som TT:MM.');
  }

  const parsed = parseDateTime(template);
  return `${date}T${time}${parsed?.suffix ?? ':00'}`;
}

function parseDateTime(value?: string | null): { date: string; time: string; suffix: string } | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(.*)$/.exec(value);
  const date = match?.[1] ?? '';
  const time = match?.[2] ?? '';
  const suffix = match?.[3] ?? ':00';
  if (!match || !isValidDateInput(date) || !isValidTimeInput(time)) {
    return null;
  }

  return { date, time, suffix: suffix || ':00' };
}

function isValidDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function isValidTimeInput(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function compareTime(left: string, right: string): number {
  return minutesFromTime(left) - minutesFromTime(right);
}

function minutesFromTime(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function addDays(date: string, days: number): string {
  const [rawYear = 0, rawMonth = 1, rawDay = 1] = date.split('-').map(Number);
  let year = rawYear;
  let month = rawMonth;
  let day = rawDay;
  day += days;

  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
