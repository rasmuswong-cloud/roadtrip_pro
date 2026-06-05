import type {
  EquipmentItem,
  Expense,
  ItineraryNode,
  ItineraryNodeType,
  ReservationDetails,
  RouteSummary,
  TransportMode,
  Trip,
  TripSettings,
} from '@/models';
import { parsePostgisPoint, toPostgisPoint } from './geo';
import type { ExpenseRow, ItineraryNodeRow, TripRow } from './rows';

export function tripFromRow(row: TripRow): Trip {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    baseCurrency: row.base_currency,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    homeLocation: parsePostgisPoint(row.home_location),
    settings: row.settings as TripSettings,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function tripToRow(trip: Trip): Partial<TripRow> {
  return {
    id: trip.id,
    owner_id: trip.ownerId,
    name: trip.name,
    description: trip.description ?? null,
    base_currency: trip.baseCurrency,
    starts_at: trip.startsAt ?? null,
    ends_at: trip.endsAt ?? null,
    home_location: toPostgisPoint(trip.homeLocation),
    settings: trip.settings,
  };
}

export function itineraryNodeFromRow(row: ItineraryNodeRow): ItineraryNode {
  return {
    id: row.id,
    tripId: row.trip_id,
    poiId: row.poi_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    type: row.type as ItineraryNodeType,
    title: row.title,
    notes: row.notes,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    location: parsePostgisPoint(row.location),
    sortOrder: row.sort_order,
    transportMode: row.transport_mode as TransportMode | null,
    routeToNext: row.route_to_next as RouteSummary | null,
    reservation: row.reservation as ReservationDetails,
    equipment: row.equipment as EquipmentItem[],
    facilities: row.facilities,
    metadata: row.metadata,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function itineraryNodeToRow(node: ItineraryNode): Partial<ItineraryNodeRow> {
  return {
    id: node.id,
    trip_id: node.tripId,
    poi_id: node.poiId ?? null,
    created_by: node.createdBy,
    updated_by: node.updatedBy ?? null,
    type: node.type,
    title: node.title,
    notes: node.notes ?? null,
    starts_at: node.startsAt ?? null,
    ends_at: node.endsAt ?? null,
    timezone: node.timezone ?? null,
    location: toPostgisPoint(node.location),
    sort_order: node.sortOrder,
    transport_mode: node.transportMode ?? null,
    route_to_next: node.routeToNext as Record<string, unknown> | null,
    reservation: node.reservation,
    equipment: node.equipment,
    facilities: node.facilities,
    metadata: node.metadata,
  };
}

export function expenseFromRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    tripId: row.trip_id,
    itineraryNodeId: row.itinerary_node_id,
    paidBy: row.paid_by,
    category: row.category,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    fxRateToBase: row.fx_rate_to_base,
    baseAmount: row.base_amount,
    occurredAt: row.occurred_at,
    split: row.split,
    receiptUrl: row.receipt_url,
    metadata: row.metadata,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function expenseToRow(expense: Expense): Partial<ExpenseRow> {
  return {
    id: expense.id,
    trip_id: expense.tripId,
    itinerary_node_id: expense.itineraryNodeId ?? null,
    paid_by: expense.paidBy,
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    fx_rate_to_base: expense.fxRateToBase ?? null,
    base_amount: expense.baseAmount ?? null,
    occurred_at: expense.occurredAt,
    split: expense.split,
    receipt_url: expense.receiptUrl ?? null,
    metadata: expense.metadata,
  };
}
