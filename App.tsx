import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MapRail } from '@/components/layout/MapRail';
import { MobileFlowNav } from '@/components/layout/MobileFlowNav';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { TripHero } from '@/components/layout/TripHero';
import { APP_TABS, budgetCostEditorTarget, dayShortcutTarget, resolveSelectedDayKey } from '@/components/layout/workspaceLogic';
import type { AppView } from '@/components/layout/workspaceTypes';
import { BudgetWorkspace } from '@/components/workspaces/BudgetWorkspace';
import { DaysWorkspace } from '@/components/workspaces/DaysWorkspace';
import { ExploreWorkspace } from '@/components/workspaces/ExploreWorkspace';
import { OverviewWorkspace } from '@/components/workspaces/OverviewWorkspace';
import { RouteWorkspace } from '@/components/workspaces/RouteWorkspace';
import { ToolsWorkspace } from '@/components/workspaces/ToolsWorkspace';
import { SectionTitle } from '@/components/workspaces/WorkspaceBits';
import { reseplanrareIdeaPlaces, reseplanrareSeedRows, type ReseplanrareSeedRow } from '@/data/reseplanrareSeed';
import type { BudgetCategories, BudgetSummary, Coordinates, DayChecklistItem, DayInsightSummary, DayPlan, Expense, ItineraryNode, ItineraryNodeType, Poi, RouteSummary, Trip, TripMember } from '@/models';
import { getCurrentUser, getOrCreateAnonymousUser, sendMagicLink, signOut } from '@/services/auth/authService';
import { applyConfirmedMutationPlan } from '@/services/ai/applyMutationPlan';
import { parseItineraryCommand } from '@/services/ai/agent';
import type { ItineraryMutationPlan } from '@/services/ai/itineraryMutationSchema';
import {
  deleteTripExploreItem,
  explorePlaceFromItem,
  explorePlaceToItem,
  listTripExploreItems,
  noteToExploreItem,
  upsertTripExploreItem,
  type TripExploreItem,
} from '@/services/database/exploreRepository';
import { upsertPoi } from '@/services/database/poiRepository';
import { ensureUserProfile } from '@/services/database/profileRepository';
import {
  createTripShareCode,
  deleteItineraryNode,
  ensureFirstTrip,
  getTripById,
  joinTripByShareCode,
  listItineraryNodes,
  listTripMembers,
  moveItineraryNode,
  upsertItineraryNode,
} from '@/services/database/tripRepository';
import {
  googlePlaceToPoi,
  googlePlacesMissingApiKeyMessage,
  hasGooglePlacesApiKey,
  searchGooglePlaces,
  type GooglePlace,
} from '@/services/google/googlePlaces';
import { calculateGoogleRoute, getRoutableStops, routeStopSignature } from '@/services/google/googleRoutes';
import { analyzeDayWarnings, moveNodeToDay, summarizeDay, validatePlannerDraft, type DaySummary } from '@/services/planning/dayAnalysis';
import { buildTravelBudgetCenter } from '@/services/planning/budgetAnalysis';
import { buildExplorePlaceDuplicateKey, buildItineraryNodeDuplicateKey, prepareItineraryNodeForActiveTripSave, prepareLocalNodeForCloud } from '@/services/planning/cloudSync';
import {
  formatKnownCostLabel,
  hasKnownDetailedNodeCost,
  hasKnownNodeCost,
  hasKnownRawNodeCost,
  parseCostValue,
} from '@/services/planning/costs';
import { dayKeyForNode as itineraryDayKeyForNode, mergeManualDayKeys, normalizeDayKey, suggestNewDayKey } from '@/services/planning/dayManagement';
import { calculateFuelEstimate, parseFuelNumber } from '@/services/routing/fuelEstimate';
import {
  addExplorePlaceTarget,
  emptyExploreState,
  explorePlaceFromGooglePlace,
  groupExplorePlaces,
  recommendedPlacesFromNodes,
  type ExplorePlace,
} from '@/services/planning/exploreBoard';
import {
  buildNearbySearchContexts,
  buildNearbySearchInput,
  NEARBY_CATEGORIES,
  nearbyExplorePlaceFromGooglePlace,
  type NearbyCategoryId,
} from '@/services/planning/nearbySearch';
import {
  buildSmartStopQuery,
  fillPlaceholderWithGooglePlace,
  isPlaceholderStop,
  midpointBetweenStops,
  placeholderMetadata,
  PLACEHOLDER_TYPES,
  SMART_DRIVE_TIME_OPTIONS,
  SMART_STOP_OPTIONS,
  unresolvedPlaceholderStops,
  type PlaceholderDriveTimeRange,
  type PlaceholderStopType,
  type SmartStopType,
} from '@/services/planning/placeholderStops';
import {
  formatBulkCoordinateSummary,
  formatBulkCoordinateDiagnostics,
  getBulkCoordinateCandidates,
  summarizeBulkCoordinateOutcomes,
  type BulkCoordinateOutcome,
} from '@/services/planning/bulkCoordinateUpdate';
import {
  applyInlineFieldUpdate,
  type ActiveInlineEdit,
  inlineFieldLabel,
  inlineFieldValue,
  inlineNodeTypes,
  type InlineFieldKey,
  type InlineFieldValue,
} from '@/services/planning/inlineEdit';
import { applyGooglePlaceCoordinateUpdate } from '@/services/planning/placeCoordinateUpdate';
import { planReseplanrareImport } from '@/services/planning/reseplanrareImport';
import { buildTripReadiness } from '@/services/planning/tripReadiness';
import { buildTripQualityCounts } from '@/services/planning/tripQuality';
import { estimateRouteSummary } from '@/services/routing/routeEstimate';
import { getSupabaseConfigurationError } from '@/services/supabaseClient';
import { subscribeToTripChanges } from '@/services/sync/realtime';
import { clearPersistedActiveCloudTripId, persistActiveCloudTripId, readPersistedActiveCloudTripId, shortenTripId, tripRoleLabel } from '@/services/sharing/activeCloudTrip';
import { buildShareInviteLink, normalizeShareCode, readShareCodeFromLocation } from '@/services/sharing/tripSharing';
import { useTripStore } from '@/store/tripStore';
import { formatDateLabel as formatSafeDateLabel, formatTimeLabel } from '@/utils/dateTimeLabels';
import { formatDistance, formatDuration } from '@/utils/formatters';

const PERSISTED_APP_STATE_KEY = 'roadtrip:persisted-app-state:v1';

type PersistedAppState = {
  itineraryNodes: ItineraryNode[];
  travelerCountText: string;
  isEditMode: boolean;
  exploreNotes?: string;
  explorePlaces?: ExplorePlace[];
  fuelConsumptionText?: string;
  fuelPriceText?: string;
};

type OnlineSaveState = 'idle' | 'saving' | 'saved' | 'error';

type UndoSnapshot = {
  label: string;
  itineraryNodes: ItineraryNode[];
};

type CalculatedRouteState = {
  route: RouteSummary;
  signature: string;
  includedStopCount: number;
  skippedStopCount: number;
};

type LocalTripImportOffer = {
  tripId: string;
  userId: string;
  nodes: ItineraryNode[];
  exploreNotes: string;
  explorePlaces: ExplorePlace[];
  cloudNodeCount: number;
  cloudExploreCount: number;
};

type CloudSyncBaseState = {
  nodes: ItineraryNode[];
  exploreNotes: string;
  exploreNoteItemId: string | null;
  explorePlaces: ExplorePlace[];
};

type CloudSyncResult = CloudSyncBaseState & {
  importedCount: number;
  skippedNodeCount: number;
  failedLabels: string[];
};

const appTabs = APP_TABS;

const viewHeroCopy: Record<AppView, { eyebrow: string; title: string; body: string }> = {
  overview: {
    eyebrow: 'Resestatus',
    title: 'Din roadtrip i ett lugnt beslutsflöde',
    body: 'Se vad som är klart, vad som saknas och vilket steg som för resan framåt.',
  },
  explore: {
    eyebrow: 'Utforska',
    title: 'Samla idéer innan de blir resplan',
    body: 'Spara tips, platser, restauranger och anteckningar innan du bestämmer vilken dag de hör hemma.',
  },
  route: {
    eyebrow: 'Kontrollera rutten',
    title: 'Karta, ordning och körsträcka',
    body: 'Fokusera på vart ni ska, vilka stopp som ingår och om kartpositionerna är redo.',
  },
  days: {
    eyebrow: 'Planera dagarna',
    title: 'Dag-för-dag utan att tappa detaljerna',
    body: 'Redigera tider, platser, bokningar och anteckningar där resplanen faktiskt händer.',
  },
  budget: {
    eyebrow: 'Förfina budgeten',
    title: 'Kostnader som går att förstå',
    body: 'Följ totalen, per person och saknade kostnader utan att blanda in ruttverktyg.',
  },
  tools: {
    eyebrow: 'Avancerade verktyg',
    title: 'Import, synk och underhåll samlat',
    body: 'Tekniska åtgärder ligger här så huvudflödet kan vara rent och praktiskt.',
  },
};

const demoTrip: Trip = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  name: 'Alp-roadtrip',
  description: 'München till Dolomiterna med vandring, camping och MTB-stopp.',
  baseCurrency: 'SEK',
  startsAt: new Date().toISOString(),
  endsAt: null,
  homeLocation: { latitude: 59.3293, longitude: 18.0686 },
  settings: {
    avoidTolls: false,
    avoidHighways: false,
    preferScenicRoutes: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  version: 1,
};

const demoNodes: ItineraryNode[] = reseplanrareSeedRows.map((row) => buildDemoNodeFromSeedRow(row));

const demoExpenses: Expense[] = [
  {
    id: '55555555-5555-4555-8555-555555555555',
    tripId: demoTrip.id,
    paidBy: demoTrip.ownerId,
    category: 'Boende',
    description: 'Hotellförskott München',
    amount: 1800,
    currency: 'SEK',
    baseAmount: 1800,
    fxRateToBase: 1,
    occurredAt: new Date().toISOString(),
    split: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    version: 1,
  },
];

function readPersistedAppState(): PersistedAppState | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawState = storage.getItem(PERSISTED_APP_STATE_KEY);
    if (!rawState) {
      return null;
    }

    const parsedState: unknown = JSON.parse(rawState);
    if (!isPersistedAppState(parsedState)) {
      return null;
    }

    return {
      itineraryNodes: sortNodes(parsedState.itineraryNodes.map(cleanItineraryNodeImportNotes)),
      travelerCountText: parsedState.travelerCountText,
      isEditMode: parsedState.isEditMode === true,
      exploreNotes: typeof parsedState.exploreNotes === 'string' ? parsedState.exploreNotes : '',
      explorePlaces: Array.isArray(parsedState.explorePlaces) ? parsedState.explorePlaces.filter(isPersistedExplorePlace) : [],
      fuelConsumptionText: typeof parsedState.fuelConsumptionText === 'string' ? parsedState.fuelConsumptionText : '6.5',
      fuelPriceText: typeof parsedState.fuelPriceText === 'string' ? parsedState.fuelPriceText : '20',
    };
  } catch {
    return null;
  }
}

function savePersistedAppState(state: PersistedAppState): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(PERSISTED_APP_STATE_KEY, JSON.stringify(state));
  } catch {
    // Local persistence should never block the planner if storage is unavailable or full.
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (!('localStorage' in globalThis)) {
      return null;
    }

    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function removeInviteCodeFromUrl(): void {
  try {
    if (!globalThis.location?.href || !globalThis.history?.replaceState) {
      return;
    }

    const url = new URL(globalThis.location.href);
    if (!url.searchParams.has('invite')) {
      return;
    }

    url.searchParams.delete('invite');
    globalThis.history.replaceState(globalThis.history.state, '', url.toString());
  } catch {
    // URL cleanup is only cosmetic; the persisted cloud trip id drives reloads.
  }
}

function isPersistedAppState(value: unknown): value is PersistedAppState {
  if (
    !isRecord(value)
    || !Array.isArray(value.itineraryNodes)
    || typeof value.travelerCountText !== 'string'
    || (value.isEditMode !== undefined && typeof value.isEditMode !== 'boolean')
    || (value.exploreNotes !== undefined && typeof value.exploreNotes !== 'string')
    || (value.explorePlaces !== undefined && !Array.isArray(value.explorePlaces))
    || (value.fuelConsumptionText !== undefined && typeof value.fuelConsumptionText !== 'string')
    || (value.fuelPriceText !== undefined && typeof value.fuelPriceText !== 'string')
  ) {
    return false;
  }

  return value.itineraryNodes.every(isPersistedItineraryNode)
    && (!Array.isArray(value.explorePlaces) || value.explorePlaces.every(isPersistedExplorePlace));
}

function isPersistedItineraryNode(value: unknown): value is ItineraryNode {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.createdBy === 'string'
    && typeof value.type === 'string'
    && typeof value.title === 'string'
    && typeof value.sortOrder === 'number'
    && isRecord(value.metadata)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPersistedExplorePlace(value: unknown): value is ExplorePlace {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.category === 'string'
    && typeof value.type === 'string'
    && typeof value.imageSource === 'string'
    && Array.isArray(value.statusChips)
  );
}

function formatOnlineSaveLabel(state: OnlineSaveState, lastSavedAt: string | null, hasActiveTrip: boolean): string {
  if (!hasActiveTrip) {
    return 'Endast lokalt sparat';
  }

  if (state === 'saving') {
    return 'Resan sparas i Supabase...';
  }

  if (state === 'error') {
    return 'Lokala ändringar ej synkade';
  }

  if (state === 'saved' && lastSavedAt) {
    return `Senast sparad i molnet ${formatShortTime(lastSavedAt)}`;
  }

  return 'Resan sparas i Supabase';
}

function formatStatusMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed && trimmed !== '[object Object]' ? trimmed : fallback;
}

function formatShortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function confirmNewBlankTrip(): boolean {
  const message = 'Vill du starta en ny tom reseplan? Detta påverkar inte tidigare sparade resor om de finns i molnet.';
  const maybeWindow = globalThis as typeof globalThis & { confirm?: (message: string) => boolean };

  return typeof maybeWindow.confirm === 'function' ? maybeWindow.confirm(message) : true;
}

export default function App() {
  const isDark = false;
  const { width: viewportWidth } = useWindowDimensions();
  const isMobile = viewportWidth <= 640;
  const initialPersistedState = useMemo(() => readPersistedAppState(), []);
  const [command, setCommand] = useState('');
  const [statusMessage, setStatusMessage] = useState('Redo att ansluta resan.');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(() => initialPersistedState?.isEditMode ?? false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [generatedShareCode, setGeneratedShareCode] = useState('');
  const [generatedShareLink, setGeneratedShareLink] = useState('');
  const initialInviteCode = useMemo(() => readShareCodeFromLocation(), []);
  const [pendingInviteCode, setPendingInviteCode] = useState(initialInviteCode);
  const [tripMembers, setTripMembers] = useState<TripMember[]>([]);
  const [placeQuery, setPlaceQuery] = useState('camping nära Cortina');
  const [activePlaceDayKey, setActivePlaceDayKey] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<GooglePlace[]>([]);
  const [exploreNotes, setExploreNotes] = useState('');
  const initialExplorePlaces = initialPersistedState?.explorePlaces ?? [];
  const [exploreSearchQuery, setExploreSearchQuery] = useState('');
  const [exploreResults, setExploreResults] = useState<GooglePlace[]>([]);
  const [explorePlaces, setExplorePlaces] = useState<ExplorePlace[]>(() => initialExplorePlaces);
  const [nearbyCategoryId, setNearbyCategoryId] = useState<NearbyCategoryId>('restaurants');
  const [nearbyContextId, setNearbyContextId] = useState<string>('');
  const [nearbyResults, setNearbyResults] = useState<ExplorePlace[]>([]);
  const [nearbyMessage, setNearbyMessage] = useState<string | null>(null);
  const [exploreNoteItemId, setExploreNoteItemId] = useState<string | null>(null);
  const [localTripImportOffer, setLocalTripImportOffer] = useState<LocalTripImportOffer | null>(null);
  const [hasStartedBlankPlan, setHasStartedBlankPlan] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [itineraryNodes, setItineraryNodes] = useState<ItineraryNode[]>(() => initialPersistedState?.itineraryNodes ?? []);
  const [latestAiPlan, setLatestAiPlan] = useState<ItineraryMutationPlan | null>(null);
  const [selectedPlannerNodeId, setSelectedPlannerNodeId] = useState<string | null>(null);
  const [draftPlannerDayKey, setDraftPlannerDayKey] = useState<string | null>(null);
  const [pendingMapAddLocation, setPendingMapAddLocation] = useState<Coordinates | null>(null);
  const [plannerTitle, setPlannerTitle] = useState('');
  const [plannerType, setPlannerType] = useState<ItineraryNodeType>('custom');
  const [plannerPlace, setPlannerPlace] = useState('');
  const [plannerDate, setPlannerDate] = useState('');
  const [plannerTime, setPlannerTime] = useState('');
  const [plannerLatitude, setPlannerLatitude] = useState('');
  const [plannerLongitude, setPlannerLongitude] = useState('');
  const [plannerCost, setPlannerCost] = useState('');
  const [plannerHotelNote, setPlannerHotelNote] = useState('');
  const [plannerNotes, setPlannerNotes] = useState('');
  const [plannerSearchText, setPlannerSearchText] = useState('');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [manualDayKeys, setManualDayKeys] = useState<string[]>([]);
  const [showPlannerTechnicalDetails, setShowPlannerTechnicalDetails] = useState(false);
  const [travelerCountText, setTravelerCountText] = useState(() => initialPersistedState?.travelerCountText ?? '2');
  const [fuelConsumptionText, setFuelConsumptionText] = useState(() => initialPersistedState?.fuelConsumptionText ?? '6.5');
  const [fuelPriceText, setFuelPriceText] = useState(() => initialPersistedState?.fuelPriceText ?? '20');
  const [packingDraftByDay, setPackingDraftByDay] = useState<Record<string, string>>({});
  const [hasLoadedPersistentState, setHasLoadedPersistentState] = useState(false);
  const [onlineSaveState, setOnlineSaveState] = useState<OnlineSaveState>('idle');
  const [lastOnlineSavedAt, setLastOnlineSavedAt] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const contentScrollRef = useRef<ScrollView | null>(null);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingFromCloudRef = useRef(false);
  const lastLocalCloudSaveAtRef = useRef(0);
  const movingStopIdsRef = useRef<Set<string>>(new Set());
  const inlineSaveInFlightRef = useRef(false);
  const [activeInlineEdit, setActiveInlineEdit] = useState<ActiveInlineEdit>(null);
  const [activeInlineDraftChanged, setActiveInlineDraftChanged] = useState(false);
  const [inlineEditMessage, setInlineEditMessage] = useState<string | null>(null);
  const [coordinateSearchNodeId, setCoordinateSearchNodeId] = useState<string | null>(null);
  const [coordinateSearchQuery, setCoordinateSearchQuery] = useState('');
  const [coordinateSearchResults, setCoordinateSearchResults] = useState<GooglePlace[]>([]);
  const [coordinateSearchMessage, setCoordinateSearchMessage] = useState<string | null>(null);
  const [smartStopNodeId, setSmartStopNodeId] = useState<string | null>(null);
  const [smartStopFromId, setSmartStopFromId] = useState<string>('');
  const [smartStopToId, setSmartStopToId] = useState<string>('');
  const [smartStopDriveTimeRange, setSmartStopDriveTimeRange] = useState<PlaceholderDriveTimeRange>('6-8h');
  const [smartStopType, setSmartStopType] = useState<SmartStopType>('lodging');
  const [smartStopResults, setSmartStopResults] = useState<GooglePlace[]>([]);
  const [smartStopMessage, setSmartStopMessage] = useState<string | null>(null);
  const [calculatedRoute, setCalculatedRoute] = useState<CalculatedRouteState | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [routeCalculationMessage, setRouteCalculationMessage] = useState<string | null>(null);
  const [isRouteCalculating, setIsRouteCalculating] = useState(false);
  const { activeTripId, setActiveTrip, upsertTrip, upsertPoi: upsertPoiInStore } = useTripStore();

  const isShowingDemoPlan = !activeTripId && itineraryNodes.length === 0 && !hasStartedBlankPlan;
  const displayedNodes = isShowingDemoPlan ? demoNodes : itineraryNodes;
  const isDemoMode = isShowingDemoPlan || !isEditMode;
  const hasLocalTripData = !activeTripId && (itineraryNodes.length > 0 || explorePlaces.length > 0 || exploreNotes.trim().length > 0);
  const estimatedRouteSummary = useMemo(() => estimateRouteSummary(displayedNodes), [displayedNodes]);
  const currentRouteSignature = useMemo(() => routeStopSignature(displayedNodes), [displayedNodes]);
  const activeCalculatedRoute = calculatedRoute?.signature === currentRouteSignature ? calculatedRoute : null;
  const routeSummary = activeCalculatedRoute?.route ?? estimatedRouteSummary;
  const routableStopCount = useMemo(() => getRoutableStops(displayedNodes).length, [displayedNodes]);
  const routeSkippedStopCount = displayedNodes.length - routableStopCount;
  const dayPlans = useMemo(() => buildDayPlans(displayedNodes, manualDayKeys), [displayedNodes, manualDayKeys]);
  const suggestedNewDayKey = useMemo(
    () => suggestNewDayKey(dayPlans.map((dayPlan) => dayPlan.key)),
    [dayPlans],
  );
  const dayMoveTargets = useMemo(() => dayPlans
    .filter((dayPlan) => dayPlan.key !== 'unscheduled')
    .map((dayPlan) => ({ key: dayPlan.key, title: dayPlan.title })), [dayPlans]);
  const filteredDayPlans = useMemo(() => filterDayPlans(dayPlans, plannerSearchText), [dayPlans, plannerSearchText]);
  const filteredStopCount = useMemo(() => filteredDayPlans.reduce((count, dayPlan) => count + dayPlan.nodes.length, 0), [filteredDayPlans]);
  const visibleDayPlans = plannerSearchText.trim() ? filteredDayPlans : dayPlans;
  const selectedDayPlan = useMemo(() => {
    if (visibleDayPlans.length === 0) {
      return null;
    }

    return visibleDayPlans.find((dayPlan) => dayPlan.key === selectedDayKey) ?? visibleDayPlans[0] ?? null;
  }, [selectedDayKey, visibleDayPlans]);
  const budgetSummary = useMemo(() => buildBudgetSummary(displayedNodes), [displayedNodes]);
  const nearbyContexts = useMemo(() => buildNearbySearchContexts({
    dayContexts: dayPlans.map((dayPlan) => ({ key: dayPlan.key, title: dayPlan.title, nodes: dayPlan.nodes })),
    selectedDayKey: selectedDayPlan?.key ?? null,
    stops: displayedNodes,
  }), [dayPlans, displayedNodes, selectedDayPlan?.key]);
  const selectedNearbyContext = nearbyContexts.find((context) => context.id === nearbyContextId) ?? nearbyContexts[0] ?? null;
  const selectedNearbyCategory = NEARBY_CATEGORIES.find((category) => category.id === nearbyCategoryId) ?? NEARBY_CATEGORIES[0]!;
  const travelerCount = parseTravelerCount(travelerCountText);
  const fuelEstimate = useMemo(() => calculateFuelEstimate({
    distanceMeters: routeSummary.distanceMeters,
    consumptionLitersPer100Km: parseFuelNumber(fuelConsumptionText, 6.5),
    fuelPricePerLiter: parseFuelNumber(fuelPriceText, 20),
    travelerCount,
  }), [fuelConsumptionText, fuelPriceText, routeSummary.distanceMeters, travelerCount]);
  const budgetCenter = useMemo(() => buildTravelBudgetCenter(displayedNodes, travelerCount), [displayedNodes, travelerCount]);
  const bulkCoordinateCandidates = useMemo(() => getBulkCoordinateCandidates(displayedNodes), [displayedNodes]);
  const missingCoordinateCount = bulkCoordinateCandidates.length;
  const unresolvedPlaceholderCount = useMemo(() => unresolvedPlaceholderStops(displayedNodes).length, [displayedNodes]);
  const tripQualityCounts = useMemo(() => buildTripQualityCounts(displayedNodes), [displayedNodes]);
  const { missingBookingCount, missingTimeCount, planningGapCount } = tripQualityCounts;
  const tripReadiness = useMemo(() => buildTripReadiness({
    stopCount: displayedNodes.length,
    dayCount: dayPlans.filter((dayPlan) => dayPlan.key !== 'unscheduled').length,
    missingCoordinateCount,
    missingCostCount: budgetCenter.missingCostCount,
    missingBookingCount,
    missingTimeCount,
    planningGapCount,
  }), [displayedNodes.length, dayPlans, missingCoordinateCount, budgetCenter.missingCostCount, missingBookingCount, missingTimeCount, planningGapCount]);
  const firstRouteStop = displayedNodes[0] ?? null;
  const lastRouteStop = displayedNodes[displayedNodes.length - 1] ?? null;
  const activeHeroCopy = viewHeroCopy[activeView];
  const exploreGroups = useMemo(() => groupExplorePlaces(explorePlaces), [explorePlaces]);
  const exploreEmptyState = useMemo(() => emptyExploreState(explorePlaces), [explorePlaces]);
  const recommendedPlaces = useMemo(() => recommendedPlacesFromNodes(displayedNodes), [displayedNodes]);
  const totalSpend = budgetSummary.total;
  const costPerTraveler = travelerCount > 0 ? totalSpend / travelerCount : totalSpend;
  const onlineSaveLabel = formatOnlineSaveLabel(onlineSaveState, lastOnlineSavedAt, Boolean(activeTripId));
  const visibleStatusMessage = formatStatusMessage(statusMessage, onlineSaveLabel);
  const activeTripMember = activeTripId && userId
    ? tripMembers.find((member) => member.tripId === activeTripId && member.userId === userId) ?? null
    : null;
  const activeTripRole = activeTripMember?.role ?? (activeTripId && userId ? 'owner' : null);
  const sharedTripStatusText = activeTripId
    ? `Delad resa aktiv · Trip ID: ${shortenTripId(activeTripId)} · Roll: ${tripRoleLabel(activeTripRole)}`
    : null;

  useEffect(() => {
    setHasLoadedPersistentState(true);
    if (initialPersistedState?.itineraryNodes.length) {
      setStatusMessage(`Återställde ${initialPersistedState.itineraryNodes.length} sparade stopp från denna enhet.`);
    }
    if (initialPersistedState?.exploreNotes) {
      setExploreNotes(initialPersistedState.exploreNotes);
    }
  }, [initialPersistedState]);

  useEffect(() => {
    if (!hasLoadedPersistentState || activeTripId) {
      return;
    }

    savePersistedAppState({
      itineraryNodes,
      travelerCountText,
      isEditMode,
      exploreNotes,
      explorePlaces,
      fuelConsumptionText,
      fuelPriceText,
    });
  }, [activeTripId, hasLoadedPersistentState, itineraryNodes, travelerCountText, isEditMode, exploreNotes, explorePlaces, fuelConsumptionText, fuelPriceText]);

  useEffect(() => {
    void connectSupabaseTrip(pendingInviteCode ? { inviteCode: pendingInviteCode } : {});
  }, []);

  useEffect(() => {
    if (!activeTripId || !userId) {
      return undefined;
    }

    const channel = subscribeToTripChanges(activeTripId, () => {
      scheduleCloudRefresh('realtime');
    });

    return () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      void channel.unsubscribe();
    };
  }, [activeTripId, userId]);

  useEffect(() => {
    const nextSelectedDayKey = resolveSelectedDayKey(visibleDayPlans.map((dayPlan) => dayPlan.key), selectedDayKey);
    if (nextSelectedDayKey !== selectedDayKey) {
      setSelectedDayKey(nextSelectedDayKey);
    }
  }, [selectedDayKey, visibleDayPlans]);

  function toggleEditMode() {
    setIsEditMode((current) => {
      const next = !current;
      savePersistedAppState({
        itineraryNodes,
        travelerCountText,
        isEditMode: next,
        exploreNotes,
        explorePlaces,
        fuelConsumptionText,
        fuelPriceText,
      });
      setStatusMessage(next ? 'Redigeringsläge på. Ändringar sparas när du sparar fälten.' : 'Redigeringsläge av.');
      return next;
    });
  }

  function goToView(target: AppView) {
    setActiveView(target);
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }

  async function saveAppSnapshot() {
    if (selectedPlannerNodeId && !isLoading && !isDemoMode) {
      await savePlannerEdit();
      return;
    }

    savePersistedAppState({
      itineraryNodes,
      travelerCountText,
      isEditMode,
      exploreNotes,
      explorePlaces,
      fuelConsumptionText,
      fuelPriceText,
    });
    setStatusMessage('Appen sparad. Nästa gång öppnas samma plan och läge.');
  }

  function startNewBlankTrip() {
    if (isLoading || !confirmNewBlankTrip()) {
      return;
    }

    rememberUndo('Starta om resa');
    setActiveTrip('');
    clearPersistedActiveCloudTripId();
    setUserId(null);
    setOnlineSaveState('idle');
    setLastOnlineSavedAt(null);
    setItineraryNodes([]);
    setExploreNotes('');
    setExplorePlaces([]);
    setExploreResults([]);
    setNearbyResults([]);
    setLocalTripImportOffer(null);
    setLatestAiPlan(null);
    setSelectedPlannerNodeId(null);
    setDraftPlannerDayKey(null);
    setPlannerSearchText('');
    setSelectedDayKey(null);
    setPendingMapAddLocation(null);
    setPackingDraftByDay({});
    setCalculatedRoute(null);
    setRouteCalculationMessage(null);
    setCoordinateSearchNodeId(null);
    setCoordinateSearchQuery('');
    setCoordinateSearchResults([]);
    setCoordinateSearchMessage(null);
    setSmartStopNodeId(null);
    setSmartStopResults([]);
    setSmartStopMessage(null);
    setActiveInlineEdit(null);
    setInlineEditMessage(null);
    setActiveInlineDraftChanged(false);
    setIsEditMode(true);
    setHasStartedBlankPlan(true);
    savePersistedAppState({
      itineraryNodes: [],
      travelerCountText,
      isEditMode: true,
      exploreNotes: '',
      explorePlaces: [],
      fuelConsumptionText,
      fuelPriceText,
    });
    clearPlannerEditor();
    setStatusMessage('Ny tom reseplan skapad lokalt. Tidigare molnresor påverkas inte.');
    goToView('days');
  }

  function markOnlineSaveStart() {
    if (activeTripId) {
      setOnlineSaveState('saving');
    }
  }

  function markOnlineSaveSuccess() {
    setOnlineSaveState('saved');
    setLastOnlineSavedAt(new Date().toISOString());
    lastLocalCloudSaveAtRef.current = Date.now();
  }

  function markOnlineSaveError() {
    setOnlineSaveState('error');
  }

  async function saveItineraryNodeOnline(node: ItineraryNode): Promise<ItineraryNode> {
    if (!activeTripId || !userId) {
      throw new Error('Ingen aktiv molnresa att spara till.');
    }

    markOnlineSaveStart();

    try {
      const savedNode = await upsertItineraryNode(prepareItineraryNodeForActiveTripSave(node, activeTripId, userId));
      markOnlineSaveSuccess();
      return savedNode;
    } catch (error) {
      markOnlineSaveError();
      throw error;
    }
  }

  async function deleteItineraryNodeOnline(nodeId: string): Promise<void> {
    if (!activeTripId) {
      throw new Error('Ingen aktiv molnresa att ta bort frÃ¥n.');
    }

    markOnlineSaveStart();

    try {
      await deleteItineraryNode(nodeId, activeTripId);
      markOnlineSaveSuccess();
    } catch (error) {
      markOnlineSaveError();
      throw error;
    }
  }

  async function cleanLoadedNodesOnline(nodes: ItineraryNode[]): Promise<ItineraryNode[]> {
    const cleanedNodes = nodes.map(cleanItineraryNodeImportNotes);
    const nodesToUpdate = cleanedNodes.filter((node, index) => node.notes !== nodes[index]?.notes);

    if (nodesToUpdate.length === 0) {
      return cleanedNodes;
    }

    markOnlineSaveStart();
    try {
      await Promise.all(nodesToUpdate.map((node) => upsertItineraryNode({
        ...node,
        updatedAt: new Date().toISOString(),
        version: node.version + 1,
      })));
      markOnlineSaveSuccess();
      return cleanedNodes;
    } catch (error) {
      markOnlineSaveError();
      throw error;
    }
  }

  function rememberUndo(label: string) {
    setUndoSnapshot({
      label,
      itineraryNodes: itineraryNodes.map(cloneItineraryNode),
    });
  }

  async function undoLastChange() {
    if (!undoSnapshot || isLoading) {
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Ångrar: ${undoSnapshot.label}...`);

    try {
      await restoreUndoSnapshotOnline(undoSnapshot.itineraryNodes);
      const restoredNodes = sortNodes(undoSnapshot.itineraryNodes.map(cloneItineraryNode));
      setItineraryNodes(restoredNodes);
      setUndoSnapshot(null);
      if (selectedPlannerNodeId && !restoredNodes.some((node) => node.id === selectedPlannerNodeId)) {
        clearPlannerEditor();
      }
      setStatusMessage(`Ångrat: ${undoSnapshot.label}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function restoreUndoSnapshotOnline(previousNodes: ItineraryNode[]): Promise<void> {
    if (!activeTripId || !userId) {
      return;
    }

    markOnlineSaveStart();
    const now = new Date().toISOString();
    const previousById = new Map(previousNodes.map((node) => [node.id, node]));
    const currentById = new Map(itineraryNodes.map((node) => [node.id, node]));
    const restoredNodes = previousNodes.map((node) => ({
      ...node,
      deletedAt: null,
      updatedAt: now,
      version: node.version + 1,
    }));
    const nodesToDelete = itineraryNodes
      .filter((node) => !previousById.has(node.id))
      .map((node) => ({
        ...node,
        deletedAt: now,
        updatedAt: now,
        version: node.version + 1,
      }));
    const changedRestoredNodes = restoredNodes.filter((node) => {
      const currentNode = currentById.get(node.id);
      return !currentNode || JSON.stringify({ ...node, version: 0, updatedAt: '' }) !== JSON.stringify({ ...currentNode, deletedAt: null, version: 0, updatedAt: '' });
    });

    try {
      await Promise.all(
        [...changedRestoredNodes, ...nodesToDelete]
          .map((node) => upsertItineraryNode(prepareItineraryNodeForActiveTripSave(node, activeTripId, userId, now))),
      );
      markOnlineSaveSuccess();
    } catch (error) {
      markOnlineSaveError();
      throw error;
    }
  }

  async function connectSupabaseTrip(options: { syncLocalWhenCloudEmpty?: boolean; inviteCode?: string } = {}) {
    const configurationError = getSupabaseConfigurationError();
    if (configurationError) {
      setStatusMessage(configurationError);
      setOnlineSaveState('idle');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Ansluter resan...');

    try {
      const localSnapshot = buildLocalTripSnapshot(itineraryNodes, exploreNotes, explorePlaces);
      const existingUser = await getCurrentUser();
      const user = existingUser ?? (await getOrCreateAnonymousUser());

      setUserId(user.id);
      await ensureUserProfile(user.id, user.email ?? 'Reseplanerare');
      const invitedTrip = options.inviteCode ? await joinTripByShareCode(options.inviteCode) : null;
      let trip = invitedTrip;
      if (!trip) {
        const persistedTripId = readPersistedActiveCloudTripId();
        if (persistedTripId) {
          try {
            trip = await getTripById(persistedTripId);
          } catch {
            clearPersistedActiveCloudTripId();
          }
        }
      }
      trip = trip ?? await ensureFirstTrip(user.id);
      const cloudState = await loadCloudTrip(trip, user.id);
      const cleanedNodes = cloudState.nodes;
      const exploreItems = cloudState.exploreItems;
      const cloudNoteItem = cloudState.noteItem;
      const cloudExplorePlaces = cloudState.explorePlaces;
      const importOffer = buildLocalTripImportOffer({
        tripId: trip.id,
        userId: user.id,
        localNodes: localSnapshot.nodes,
        localExploreNotes: localSnapshot.exploreNotes,
        localExplorePlaces: localSnapshot.explorePlaces,
        cloudNodes: cleanedNodes,
        cloudExploreItems: exploreItems,
      });
      const canAutoSyncLocalTrip = Boolean(options.syncLocalWhenCloudEmpty && importOffer && cleanedNodes.length === 0 && exploreItems.length === 0);

      if (invitedTrip) {
        setPendingInviteCode('');
        setShareCode('');
        setLocalTripImportOffer(null);
        markOnlineSaveSuccess();
        removeInviteCodeFromUrl();
        setStatusMessage(`Gick med i delad resa: ${trip.name}`);
        return;
      }

      if (canAutoSyncLocalTrip && importOffer) {
        markOnlineSaveStart();
        const syncResult = await syncLocalTripOfferToSupabase(importOffer, {
          nodes: cleanedNodes,
          exploreNotes: cloudNoteItem?.description ?? '',
          exploreNoteItemId: cloudNoteItem?.id ?? null,
          explorePlaces: cloudExplorePlaces,
        });
        setItineraryNodes(syncResult.nodes);
        setExploreNotes(syncResult.exploreNotes);
        setExploreNoteItemId(syncResult.exploreNoteItemId);
        setExplorePlaces(syncResult.explorePlaces);
        setLocalTripImportOffer(syncResult.failedLabels.length > 0 ? importOffer : null);
        markOnlineSaveSuccess();
        const failedText = syncResult.failedLabels.length > 0 ? ` Kunde inte synka: ${syncResult.failedLabels.slice(0, 3).join(', ')}.` : '';
        setStatusMessage(`Resan sparas i Supabase. Synkade ${syncResult.importedCount} lokala poster till molnet.${failedText}`);
        return;
      }

      setLocalTripImportOffer(importOffer);
      markOnlineSaveSuccess();
      if (importOffer) {
        setStatusMessage(
          cleanedNodes.length === 0
            ? 'Molnresan är tom än så länge. Synka lokal resa till molnet när du är redo.'
            : 'Det finns både lokal data och en molnresa. Välj om du vill fortsätta med molnresan eller synka lokal resa till molnet.',
        );
      } else {
        setStatusMessage(cleanedNodes.length === 0 ? 'Molnresan är tom än så länge.' : `Ansluten: ${trip.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOnlineSaveState('error');
      setStatusMessage(`Kunde inte ansluta till Supabase. ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCloudTrip(trip: Trip, currentUserId: string) {
    const [nodes, exploreItems, members] = await Promise.all([
      listItineraryNodes(trip.id),
      listTripExploreItems(trip.id),
      listTripMembers(trip.id),
    ]);
    const cleanedNodes = await cleanLoadedNodesOnline(nodes);
    const cloudNoteItem = exploreItems.find((item) => item.itemType === 'note') ?? null;
    const cloudExplorePlaces = exploreItems
      .map(explorePlaceFromItem)
      .filter((place): place is ExplorePlace => Boolean(place));

    setUserId(currentUserId);
    upsertTrip(trip);
    setActiveTrip(trip.id);
    persistActiveCloudTripId(trip.id);
    setItineraryNodes(cleanedNodes);
    applyLoadedExploreItems(exploreItems);
    setTripMembers(members);

    return {
      nodes: cleanedNodes,
      exploreItems,
      noteItem: cloudNoteItem,
      explorePlaces: cloudExplorePlaces,
      members,
    };
  }

  function scheduleCloudRefresh(source: 'realtime' | 'manual' = 'realtime') {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }

    const delayMs = Date.now() - lastLocalCloudSaveAtRef.current < 1000 ? 1200 : 700;
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void refreshActiveCloudTrip(source);
    }, source === 'manual' ? 0 : delayMs);
  }

  async function refreshActiveCloudTrip(source: 'realtime' | 'manual' = 'manual') {
    if (!activeTripId || !userId || isRefreshingFromCloudRef.current) {
      return;
    }

    isRefreshingFromCloudRef.current = true;
    if (source === 'manual') {
      setIsLoading(true);
      setStatusMessage('Uppdaterar frÃ¥n molnet...');
    }

    try {
      const trip = await getTripById(activeTripId);
      await loadCloudTrip(trip, userId);
      markOnlineSaveSuccess();
      setStatusMessage(source === 'realtime' ? 'Ã„ndringar frÃ¥n annan anvÃ¤ndare hÃ¤mtades.' : 'Synkad frÃ¥n molnet.');
    } catch (error) {
      markOnlineSaveError();
      setStatusMessage(`Kunde inte uppdatera frÃ¥n molnet. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      isRefreshingFromCloudRef.current = false;
      if (source === 'manual') {
        setIsLoading(false);
      }
    }
  }

  async function syncCurrentTripToCloud() {
    if (activeTripId) {
      setStatusMessage('Resan sparas redan i Supabase.');
      return;
    }

    await connectSupabaseTrip({ syncLocalWhenCloudEmpty: true });
  }

  async function importLocalTripToSupabase() {
    if (!localTripImportOffer || !activeTripId || !userId) {
      setStatusMessage('Anslut resan innan du kopierar lokal data.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Synkar lokal resa till molnet...');
    markOnlineSaveStart();

    try {
      const result = await syncLocalTripOfferToSupabase(localTripImportOffer, {
        nodes: itineraryNodes,
        exploreNotes,
        exploreNoteItemId,
        explorePlaces,
      });

      setItineraryNodes(result.nodes);
      setExploreNotes(result.exploreNotes);
      setExploreNoteItemId(result.exploreNoteItemId);
      setExplorePlaces(result.explorePlaces);
      setLocalTripImportOffer(result.failedLabels.length > 0 ? localTripImportOffer : null);
      markOnlineSaveSuccess();

      const skippedText = result.skippedNodeCount > 0 ? ` ${result.skippedNodeCount} stopp fanns redan och hoppades över.` : '';
      const failedText = result.failedLabels.length > 0 ? ` Kunde inte synka: ${result.failedLabels.slice(0, 3).join(', ')}.` : '';
      setStatusMessage(`Resan sparas i Supabase. Synkade ${result.importedCount} lokala poster till molnet.${skippedText}${failedText}`);
    } catch (error) {
      markOnlineSaveError();
      setStatusMessage(`Kunde inte synka lokal resa. Lokal data finns kvar i den här webbläsaren. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function syncLocalTripOfferToSupabase(offer: LocalTripImportOffer, cloudState: CloudSyncBaseState): Promise<CloudSyncResult> {
    const existingNodeKeys = new Set(cloudState.nodes.map(buildItineraryNodeDuplicateKey));
    const preparedNodes = offer.nodes.map((node, index) => prepareLocalNodeForCloud(node, offer.tripId, offer.userId, index));
    const nodesToImport = preparedNodes.filter((node) => !existingNodeKeys.has(buildItineraryNodeDuplicateKey(node)));
    const importedNodes: ItineraryNode[] = [];
    const failedLabels: string[] = [];

    for (const node of nodesToImport) {
      try {
        const savedNode = await upsertItineraryNode(node);
        importedNodes.push(savedNode);
        existingNodeKeys.add(buildItineraryNodeDuplicateKey(savedNode));
      } catch {
        failedLabels.push(node.title);
      }
    }

    const existingExploreKeys = new Set(cloudState.explorePlaces.map(buildExplorePlaceDuplicateKey));
    const placesToImport = offer.explorePlaces
      .filter((place) => !existingExploreKeys.has(buildExplorePlaceDuplicateKey(place)));
    const importedPlaces: ExplorePlace[] = [];

    for (const [index, place] of placesToImport.entries()) {
      try {
        const savedItem = await upsertTripExploreItem(explorePlaceToItem({
          place,
          tripId: offer.tripId,
          userId: offer.userId,
          sortOrder: cloudState.explorePlaces.length + importedPlaces.length + index + 1,
        }));
        const savedPlace = explorePlaceFromItem(savedItem);
        if (savedPlace) {
          importedPlaces.push(savedPlace);
          existingExploreKeys.add(buildExplorePlaceDuplicateKey(savedPlace));
        }
      } catch {
        failedLabels.push(place.title);
      }
    }

    let importedNoteCount = 0;
    let nextExploreNotes = cloudState.exploreNotes;
    let nextExploreNoteItemId = cloudState.exploreNoteItemId;
    if (offer.exploreNotes.trim() && !cloudState.exploreNotes.trim()) {
      try {
        const savedItem = await upsertTripExploreItem(noteToExploreItem({
          tripId: offer.tripId,
          userId: offer.userId,
          description: offer.exploreNotes,
        }));
        nextExploreNotes = offer.exploreNotes;
        nextExploreNoteItemId = savedItem.id;
        importedNoteCount = 1;
      } catch {
        failedLabels.push('Utforska-anteckningar');
      }
    }

    return {
      nodes: sortNodes([...cloudState.nodes, ...importedNodes]),
      exploreNotes: nextExploreNotes,
      exploreNoteItemId: nextExploreNoteItemId,
      explorePlaces: [...importedPlaces, ...cloudState.explorePlaces],
      importedCount: importedNodes.length + importedPlaces.length + importedNoteCount,
      skippedNodeCount: offer.nodes.length - nodesToImport.length,
      failedLabels,
    };
  }

  function continueWithEmptyCloudTrip() {
    setLocalTripImportOffer(null);
    setStatusMessage('Fortsätter med molnresan. Lokal resa finns kvar i den här webbläsaren.');
  }

  function showLocalTripPreview() {
    if (!localTripImportOffer) {
      return;
    }

    setActiveTrip('');
    clearPersistedActiveCloudTripId();
    setUserId(null);
    setOnlineSaveState('idle');
    setItineraryNodes(localTripImportOffer.nodes.map(cloneItineraryNode));
    setExploreNotes(localTripImportOffer.exploreNotes);
    setExplorePlaces(localTripImportOffer.explorePlaces);
    setLocalTripImportOffer(null);
    setPendingMapAddLocation(null);
    setStatusMessage('Visar lokal resa. Den är inte kopierad till Supabase ännu.');
  }

  async function sendLoginLink() {
    if (!email.trim()) {
      setStatusMessage('Skriv din e-post först.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Skickar inloggningslänk...');

    try {
      await sendMagicLink(email.trim());
      setStatusMessage('Inloggningslänk skickad. Öppna den i denna webbläsare och tryck Anslut.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function disconnect() {
    setIsLoading(true);

    try {
      await signOut();
      setUserId(null);
      setActiveTrip('');
      clearPersistedActiveCloudTripId();
      setGeneratedShareCode('');
      setGeneratedShareLink('');
      setTripMembers([]);
      setPendingMapAddLocation(null);
      setStatusMessage('Utloggad.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function createShareCode() {
    if (!activeTripId) {
      setStatusMessage('Anslut en resa först.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Skapar inbjudningslänk...');

    try {
      const code = await createTripShareCode(activeTripId);
      const link = buildShareInviteLink(code);
      setGeneratedShareCode(code);
      setGeneratedShareLink(link);
      setStatusMessage('Inbjudningslänk skapad. Dela den bara med personer som ska kunna redigera resan.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function copyShareCode() {
    const shareValue = generatedShareLink || generatedShareCode;
    if (!shareValue) {
      setStatusMessage('Skapa en inbjudningslänk först.');
      return;
    }

    try {
      if ('navigator' in globalThis && globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(shareValue);
        setStatusMessage('Kopierade inbjudningslänken.');
        return;
      }

      setStatusMessage(`Markera och kopiera länken: ${shareValue}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function joinSharedTrip() {
    const normalizedShareCode = normalizeShareCode(shareCode);

    if (!normalizedShareCode) {
      setStatusMessage('Klistra in en delningskod först.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Går med i delad resa...');

    try {
      const user = await getCurrentUser();
      if (!user) {
        setStatusMessage('Logga in med e-post innan du går med i en resa.');
        return;
      }

      await ensureUserProfile(user.id, user.email ?? 'Reseplanerare');
      const trip = await joinTripByShareCode(normalizedShareCode);
      await loadCloudTrip(trip, user.id);
      setShareCode('');
      setPendingInviteCode('');
      setLocalTripImportOffer(null);
      markOnlineSaveSuccess();
      removeInviteCodeFromUrl();
      setStatusMessage(`Gick med i delad resa: ${trip.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function searchPlaces() {
    if (!placeQuery.trim()) {
      setStatusMessage('Skriv vad du vill söka efter först.');
      return;
    }

    if (!activePlaceDayKey) {
      setStatusMessage('Välj en dag att lägga platsen i först.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Söker platser till ${formatDayKey(activePlaceDayKey)}...`);

    try {
      const results = await searchGooglePlaces({
        query: placeQuery.trim(),
        center: centerForDay(activePlaceDayKey),
        radiusMeters: 30_000,
        languageCode: 'sv',
      });

      setPlaceResults(results);
      setStatusMessage(`Hittade ${results.length} platser.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function savePlace(place: GooglePlace, dayKey = activePlaceDayKey) {
    if (!activeTripId || !userId) {
      setStatusMessage('Tryck Anslut innan du sparar en plats.');
      return;
    }

    if (!dayKey) {
      setStatusMessage('Välj vilken dag platsen ska läggas till i.');
      return;
    }

    const poi = googlePlaceToPoi(place, activeTripId, userId);
    if (!poi) {
      setStatusMessage('Den här platsen saknar koordinater.');
      return;
    }

    rememberUndo('lägg till plats');
    setIsLoading(true);
    setStatusMessage(`Sparar ${poi.name}...`);

    try {
      const savedPoi = await upsertPoi(poi);
      const node = await createNodeFromPoi(savedPoi, dayKey);
      upsertPoiInStore(savedPoi);
      setItineraryNodes((current) => sortNodes([...current.filter((candidate) => candidate.id !== node.id), node]));
      setPlaceResults([]);
      setStatusMessage(`Sparade ${savedPoi.name} i ${formatDayKey(dayKey)}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function addPlaceholderAfterStop(node: ItineraryNode) {
    const nextStop = itineraryNodes
      .filter((candidate) => dayKeyForNode(candidate) === dayKeyForNode(node) && candidate.sortOrder > node.sortOrder)
      .sort((left, right) => left.sortOrder - right.sortOrder)[0];
    const placeholderType = node.type === 'fuel' ? PLACEHOLDER_TYPES[3]! : PLACEHOLDER_TYPES[0]!;
    const now = new Date().toISOString();
    const sortOrder = nextStop ? Math.round((node.sortOrder + nextStop.sortOrder) / 2) : node.sortOrder + 50;
    const placeholderNode: ItineraryNode = {
      id: cryptoRandomId(),
      tripId: activeTripId || 'local-current-roadtrip',
      createdBy: userId ?? 'local-import',
      type: placeholderType.nodeType,
      title: placeholderType.title,
      startsAt: node.startsAt ?? null,
      endsAt: null,
      timezone: node.startsAt ? 'Europe/Rome' : null,
      location: null,
      sortOrder,
      transportMode: 'driving',
      reservation: {},
      equipment: [],
      facilities: {},
      notes: placeholderType.id === 'overnight' ? 'Hitta boende mellan stoppen.' : 'Planerat men inte bestämt.',
      metadata: {
        source: 'planner',
        ...placeholderMetadata({
          type: placeholderType.id,
          intent: placeholderType.id === 'overnight' ? 'Övernattning mellan stopp' : placeholderType.label,
          preferredDriveTimeRange: '6-8h',
          betweenStopIds: nextStop ? [node.id, nextStop.id] : [node.id],
        }),
      },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    };

    rememberUndo('lägg till placeholder');
    setIsLoading(true);
    setStatusMessage('Lägger till placeholder...');

    try {
      const savedNode = activeTripId && userId ? await saveItineraryNodeOnline(placeholderNode) : placeholderNode;
      setItineraryNodes((current) => sortNodes([...current, savedNode]));
      setStatusMessage('Sparat');
    } catch (error) {
      setStatusMessage('Kunde inte spara. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  }

  function startSmartStopSearch(node: ItineraryNode) {
    const nodeIndex = displayedNodes.findIndex((candidate) => candidate.id === node.id);
    const previousStop = [...displayedNodes.slice(0, Math.max(0, nodeIndex))].reverse().find((candidate) => candidate.location);
    const nextStop = displayedNodes.slice(nodeIndex + 1).find((candidate) => candidate.location);
    const betweenIds = Array.isArray(node.metadata.unresolvedBetweenStopIds)
      ? node.metadata.unresolvedBetweenStopIds.filter((value): value is string => typeof value === 'string')
      : [];

    setSmartStopNodeId(node.id);
    setSmartStopFromId(betweenIds[0] ?? previousStop?.id ?? '');
    setSmartStopToId(betweenIds[1] ?? nextStop?.id ?? '');
    setSmartStopDriveTimeRange((node.metadata.preferredDriveTimeRange === '4-6h' || node.metadata.preferredDriveTimeRange === '6-8h' || node.metadata.preferredDriveTimeRange === '8-10h') ? node.metadata.preferredDriveTimeRange : '6-8h');
    setSmartStopType(node.type === 'camping' ? 'camping_lodging' : node.type === 'gastronomy' ? 'meal_break' : 'lodging');
    setSmartStopResults([]);
    setSmartStopMessage('Välj från/till och klicka Hitta mellanstopp.');
  }

  async function searchSmartStops(node: ItineraryNode) {
    const fromStop = displayedNodes.find((candidate) => candidate.id === smartStopFromId);
    const toStop = displayedNodes.find((candidate) => candidate.id === smartStopToId);
    if (!fromStop?.location || !toStop?.location) {
      setSmartStopMessage('Välj två stopp med kartposition.');
      return;
    }

    if (!hasGooglePlacesApiKey()) {
      const message = googlePlacesMissingApiKeyMessage();
      setSmartStopMessage(message);
      setStatusMessage(message);
      return;
    }

    const center = midpointBetweenStops(fromStop, toStop);
    if (!center) {
      setSmartStopMessage('Från och till behöver kartposition.');
      return;
    }

    setIsLoading(true);
    setSmartStopMessage(`Söker mellanstopp för ${node.title}...`);
    setStatusMessage('Söker smart mellanstopp...');

    try {
      const results = await searchGooglePlaces({
        query: buildSmartStopQuery({
          fromStop,
          toStop,
          driveTimeRange: smartStopDriveTimeRange,
          stopType: smartStopType,
        }),
        center,
        radiusMeters: 120_000,
        languageCode: 'sv',
        maxResultCount: 6,
      });

      setSmartStopResults(results);
      setSmartStopMessage(results.length > 0 ? `Hittade ${results.length} förslag.` : 'Inga mellanstopp hittades. Prova en annan typ eller tidsintervall.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSmartStopMessage(message);
      setStatusMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function fillPlaceholderFromSmartStop(node: ItineraryNode, place: GooglePlace) {
    const poi = activeTripId && userId ? googlePlaceToPoi(place, activeTripId, userId) : null;
    if (activeTripId && userId && !poi) {
      setSmartStopMessage('Den valda platsen saknar koordinater.');
      return;
    }

    rememberUndo('fyll placeholder');
    setIsLoading(true);
    setSmartStopMessage(null);
    setStatusMessage(`Fyller placeholder med ${place.displayName?.text ?? node.title}...`);

    try {
      const savedPoi = poi ? await upsertPoi(poi) : null;
      const filledNode = fillPlaceholderWithGooglePlace(node, place, savedPoi?.id ?? null);
      const savedNode = activeTripId && userId ? await saveItineraryNodeOnline(filledNode) : filledNode;
      if (savedPoi) {
        upsertPoiInStore(savedPoi);
      }
      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      setSmartStopNodeId(null);
      setSmartStopResults([]);
      setSmartStopMessage(null);
      setStatusMessage('Position klar');
    } catch (error) {
      const message = 'Kunde inte spara. Försök igen.';
      setSmartStopMessage(message);
      setStatusMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function searchExplorePlaces() {
    if (!exploreSearchQuery.trim()) {
      setStatusMessage('Skriv vad du vill söka efter först.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Söker idéer för ${exploreSearchQuery.trim()}...`);

    try {
      const center = selectedDayPlan?.nodes.find((node) => node.location)?.location ?? displayedNodes.find((node) => node.location)?.location ?? null;
      const input = {
        query: exploreSearchQuery.trim(),
        radiusMeters: 35_000,
        languageCode: 'sv',
        maxResultCount: 6,
        ...(center ? { center } : {}),
      };
      const results = await searchGooglePlaces(input);
      setExploreResults(results);
      setStatusMessage(`Hittade ${results.length} platser att spara i Utforska.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function searchNearbyPlaces() {
    if (!selectedNearbyContext) {
      setNearbyMessage('Välj ett stopp med kartposition först.');
      setStatusMessage('Minst ett stopp behöver kartposition innan du kan söka nära.');
      return;
    }

    if (!hasGooglePlacesApiKey()) {
      const message = googlePlacesMissingApiKeyMessage();
      setNearbyMessage(message);
      setStatusMessage(message);
      return;
    }

    setIsLoading(true);
    setNearbyMessage(`Söker ${selectedNearbyCategory.label.toLowerCase()} nära ${selectedNearbyContext.label}...`);
    setStatusMessage(`Söker nära ${selectedNearbyContext.label}...`);

    try {
      const results = await searchGooglePlaces(buildNearbySearchInput({
        category: selectedNearbyCategory,
        context: selectedNearbyContext,
      }));
      const places = results.map((place) => nearbyExplorePlaceFromGooglePlace(place, selectedNearbyContext.center));
      setNearbyResults(places);
      setNearbyMessage(places.length > 0 ? `Hittade ${places.length} platser nära ${selectedNearbyContext.label}.` : 'Inga platser hittades här just nu.');
      setStatusMessage(`Hittade ${places.length} platser nära ${selectedNearbyContext.label}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNearbyMessage(message);
      setStatusMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  function applyLoadedExploreItems(items: TripExploreItem[]) {
    const noteItem = items.find((item) => item.itemType === 'note') ?? null;
    const places = items
      .map(explorePlaceFromItem)
      .filter((place): place is ExplorePlace => Boolean(place));

    setExploreNoteItemId(noteItem?.id ?? null);
    setExploreNotes(noteItem?.description ?? '');
    setExplorePlaces(places);
  }

  async function saveExploreNotes() {
    if (!activeTripId || !userId) {
      setStatusMessage('Anteckningen sparas lokalt tills resan är ansluten.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Sparar anteckningar...');

    try {
      const savedItem = await upsertTripExploreItem(noteToExploreItem({
        ...(exploreNoteItemId ? { existingId: exploreNoteItemId } : {}),
        tripId: activeTripId,
        userId,
        description: exploreNotes,
      }));
      setExploreNoteItemId(savedItem.id);
      markOnlineSaveSuccess();
      setStatusMessage('Anteckningar sparade i Utforska.');
    } catch (error) {
      markOnlineSaveError();
      setStatusMessage(`Kunde inte spara anteckningar. Texten ligger kvar lokalt. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function saveExploreGooglePlace(place: GooglePlace) {
    const explorePlace = explorePlaceFromGooglePlace(place);
    void saveExplorePlace(explorePlace, `${explorePlace.title} sparades i Utforska.`);
  }

  async function saveExplorePlace(explorePlace: ExplorePlace, successMessage: string) {
    const duplicate = explorePlaces.find((candidate) => buildExplorePlaceDuplicateKey(candidate) === buildExplorePlaceDuplicateKey(explorePlace));
    if (duplicate) {
      setStatusMessage(`${explorePlace.title} finns redan i Utforska.`);
      return;
    }

    if (!activeTripId || !userId) {
      setExplorePlaces((current) => [
        explorePlace,
        ...current.filter((candidate) => candidate.id !== explorePlace.id),
      ]);
      setStatusMessage(`${successMessage} Idéplatser sparas lokalt tills resan är ansluten.`);
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Sparar ${explorePlace.title} i Utforska...`);

    try {
      const savedItem = await upsertTripExploreItem(explorePlaceToItem({
        place: explorePlace,
        tripId: activeTripId,
        userId,
        sortOrder: explorePlaces.length + 1,
      }));
      const savedPlace = explorePlaceFromItem(savedItem);
      if (savedPlace) {
        setExplorePlaces((current) => [
          savedPlace,
          ...current.filter((candidate) => candidate.id !== savedPlace.id && candidate.id !== explorePlace.id),
        ]);
      }
      markOnlineSaveSuccess();
      setStatusMessage(successMessage);
    } catch (error) {
      markOnlineSaveError();
      setStatusMessage(`Kunde inte spara platsen i Utforska. Platsen är inte ändrad. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function saveRecommendedExplorePlace(place: ExplorePlace) {
    const nextPlace = { ...place, id: `saved:${place.id}` };
    void saveExplorePlace(nextPlace, `${place.title} sparades i Platser att besöka.`);
  }

  async function removeExplorePlace(placeId: string) {
    if (!activeTripId) {
      setExplorePlaces((current) => current.filter((place) => place.id !== placeId));
      setStatusMessage('Platsen togs bort från Utforska.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Tar bort plats från Utforska...');

    try {
      await deleteTripExploreItem(placeId);
      setExplorePlaces((current) => current.filter((place) => place.id !== placeId));
      markOnlineSaveSuccess();
      setStatusMessage('Platsen togs bort från Utforska.');
    } catch (error) {
      markOnlineSaveError();
      setStatusMessage(`Kunde inte ta bort platsen. Den ligger kvar i Utforska. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function showExplorePlaceOnMap(place: ExplorePlace) {
    goToView('route');
    setStatusMessage(place.coordinates ? `${place.title} har kartposition. Lägg den i Dagar för att visa den som ruttstopp.` : `${place.title} saknar kartposition.`);
  }

  function addExplorePlaceToSelectedDay(place: ExplorePlace) {
    const dayKey = selectedDayPlan?.key ?? visibleDayPlans[0]?.key ?? null;
    const target = addExplorePlaceTarget(place, dayKey);
    if (!target) {
      setStatusMessage('Skapa eller välj en dag innan platsen läggs till.');
      return;
    }

    clearPlannerEditor();
    setDraftPlannerDayKey(target.dayKey);
    setSelectedDayKey(target.dayKey);
    setPlannerTitle(target.title);
    setPlannerType(target.type);
    setPlannerPlace(target.place);
    setPlannerDate(target.dayKey === 'unscheduled' ? '' : target.dayKey);
    setPlannerLatitude(target.latitude);
    setPlannerLongitude(target.longitude);
    setPlannerNotes(target.notes);
    setShowPlannerTechnicalDetails(false);
    goToView(target.view);
    setStatusMessage(`${target.title} är förifylld i Dagar. Kontrollera detaljer och tryck Spara steg.`);
  }

  async function parseAiCommand() {
    if (!activeTripId) {
      setStatusMessage('Anslut en resa innan du använder AI.');
      return;
    }

    if (!command.trim()) {
      setStatusMessage('Skriv ett AI-kommando först.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Tolkar kommandot med AI...');
    setLatestAiPlan(null);

    try {
      const plan = await parseItineraryCommand(command.trim(), {
        tripId: activeTripId,
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currentIsoTime: new Date().toISOString(),
        tripSnapshot: {
          nodes: displayedNodes.map((node) => ({
            id: node.id,
            title: node.title,
            type: node.type,
            startsAt: node.startsAt,
            endsAt: node.endsAt,
            location: node.location,
          })),
          route: {
            distanceMeters: routeSummary.distanceMeters,
            durationSeconds: routeSummary.durationSeconds,
          },
        },
      });

      setLatestAiPlan(plan);
      const warningText = plan.warnings.length > 0 ? ` Varningar: ${plan.warnings.join(' ')}` : '';
      setStatusMessage(
        `AI-plan: ${plan.reasoningSummary} (${plan.mutations.length} ändringar, ${Math.round(plan.confidence * 100)}% säkerhet).${warningText}`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmAiPlan() {
    if (!latestAiPlan) {
      setStatusMessage('Tolka ett AI-kommando innan du bekräftar.');
      return;
    }

    if (!activeTripId || !userId) {
      setStatusMessage('Anslut innan du bekräftar en AI-plan.');
      return;
    }

    if (latestAiPlan.mutations.length === 0) {
      setStatusMessage('AI-planen har inga ändringar att spara.');
      return;
    }

    rememberUndo('AI-plan');
    setIsLoading(true);
    setStatusMessage('Sparar AI-plan...');

    try {
      markOnlineSaveStart();
      const activeTripPlan: ItineraryMutationPlan = {
        ...latestAiPlan,
        mutations: latestAiPlan.mutations.map((mutation) => ({
          ...mutation,
          tripId: activeTripId,
        })),
      };
      const result = await applyConfirmedMutationPlan(activeTripPlan, userId, {
        confirmed: true,
        existingNodes: itineraryNodes,
      });

      if (result.itineraryNodes.length > 0) {
        setItineraryNodes((current) => {
          const next = [...current];
          result.itineraryNodes.forEach((node) => {
            const index = next.findIndex((candidate) => candidate.id === node.id);
            if (index >= 0) {
              next[index] = node;
            } else {
              next.push(node);
            }
          });
          return sortNodes(next);
        });
      }

      if (result.pois.length > 0) {
        result.pois.forEach(upsertPoiInStore);
      }

      markOnlineSaveSuccess();
      setLatestAiPlan(null);
      const warningText = result.warnings.length > 0 ? ` Varningar: ${result.warnings.join(' ')}` : '';
      setStatusMessage(`AI-plan sparad: ${result.itineraryNodes.length} stopp, ${result.expenses.length} kostnader, ${result.pois.length} platser.${warningText}`);
    } catch (error) {
      markOnlineSaveError();
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function removeStop(nodeId: string) {
    rememberUndo('ta bort stopp');
    setIsLoading(true);
    setStatusMessage('Tar bort stopp...');

    try {
      if (activeTripId) {
        await deleteItineraryNodeOnline(nodeId);
      }
      setItineraryNodes((current) => current.filter((node) => node.id !== nodeId));
      if (selectedPlannerNodeId === nodeId) {
        clearPlannerEditor();
      }
      setStatusMessage('Stopp borttaget.');
    } catch (error) {
      setStatusMessage('Kunde inte ta bort. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  }

  async function scheduleStop(node: ItineraryNode, hour: number) {
    if (itineraryNodes.length === 0) {
      setStatusMessage('Anslut innan du schemalägger demo-stopp.');
      return;
    }

    rememberUndo('ändra tid');
    setIsLoading(true);
    setStatusMessage(`Schemalägger ${node.title}...`);

    try {
      const scheduledAt = setNodeTime(node, hour);
      const savedNode = await saveItineraryNodeOnline({
        ...node,
        startsAt: scheduledAt,
        updatedAt: new Date().toISOString(),
        version: node.version + 1,
      });

      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      if (selectedPlannerNodeId === savedNode.id) {
        populatePlannerEditor(savedNode);
      }
      setStatusMessage(`${savedNode.title} schemalagt till ${formatTime(savedNode.startsAt)}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function moveStop(nodeId: string, direction: -1 | 1) {
    if (isLoading || movingStopIdsRef.current.has(nodeId)) {
      return;
    }

    if (itineraryNodes.length === 0) {
      setStatusMessage('Anslut innan du ändrar ordning på demo-stopp.');
      return;
    }

    const orderedNodes = sortNodes(itineraryNodes);
    const currentNode = orderedNodes.find((node) => node.id === nodeId);
    const currentDayKey = currentNode ? dayKeyForNode(currentNode) : null;
    const sameDayNodes = currentDayKey ? orderedNodes.filter((node) => dayKeyForNode(node) === currentDayKey) : [];
    const currentIndex = sameDayNodes.findIndex((node) => node.id === nodeId);
    const targetIndex = currentIndex + direction;
    const targetNode = sameDayNodes[targetIndex];

    if (!currentNode || !targetNode) {
      setStatusMessage(direction < 0 ? 'Steget ligger redan först.' : 'Steget ligger redan sist.');
      return;
    }

    movingStopIdsRef.current.add(nodeId);
    rememberUndo('flytta stopp');
    setIsLoading(true);
    setStatusMessage(`Flyttar ${currentNode.title}...`);

    try {
      if (!activeTripId) {
        const now = new Date().toISOString();
        const movedNodes = [
          { ...currentNode, sortOrder: targetNode.sortOrder, updatedAt: now, version: currentNode.version + 1 },
          { ...targetNode, sortOrder: currentNode.sortOrder, updatedAt: now, version: targetNode.version + 1 },
        ];
        const movedNodeIds = new Set(movedNodes.map((node) => node.id));
        setItineraryNodes((current) => sortNodes([
          ...current.filter((node) => !movedNodeIds.has(node.id)),
          ...movedNodes,
        ]));
        setStatusMessage('Ändringar sparade');
        return;
      }

      markOnlineSaveStart();
      const movedNodes = await moveItineraryNode(nodeId, direction);
      const movedNodeIds = new Set(movedNodes.map((node) => node.id));
      setItineraryNodes((current) => sortNodes([
        ...current.filter((node) => !movedNodeIds.has(node.id)),
        ...movedNodes,
      ]));
      markOnlineSaveSuccess();
      const movedNode = movedNodes.find((node) => node.id === nodeId) ?? currentNode;
      setStatusMessage(`Flyttade steg: ${movedNode.title}`);
    } catch (error) {
      markOnlineSaveError();
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Kunde inte flytta stoppet. Ordningen är oförändrad. ${message}`);
    } finally {
      movingStopIdsRef.current.delete(nodeId);
      setIsLoading(false);
    }
  }

  async function moveStopToDay(nodeId: string, targetDayKey: string) {
    if (isLoading || movingStopIdsRef.current.has(nodeId)) {
      return;
    }

    if (itineraryNodes.length === 0) {
      setStatusMessage('Anslut resan innan du flyttar demo-stopp.');
      return;
    }

    const currentNode = itineraryNodes.find((node) => node.id === nodeId);
    if (!currentNode) {
      setStatusMessage('Kunde inte hitta stoppet att flytta.');
      return;
    }

    const currentDayKey = dayKeyForNode(currentNode);
    if (currentDayKey === targetDayKey) {
      setStatusMessage('Stoppet ligger redan på den dagen.');
      return;
    }

    if (!dayMoveTargets.some((target) => target.key === targetDayKey)) {
      setStatusMessage('Välj en befintlig dag i resan.');
      return;
    }

    const movedNodes = moveNodeToDay(itineraryNodes, nodeId, targetDayKey);
    const movedNode = movedNodes.find((node) => node.id === nodeId);

    if (!movedNode) {
      setStatusMessage('Kunde inte förbereda flytten.');
      return;
    }

    movingStopIdsRef.current.add(nodeId);
    rememberUndo('flytta stopp till annan dag');
    setIsLoading(true);
    setStatusMessage(`Flyttar ${currentNode.title} till ${formatDayKey(targetDayKey)}...`);

    try {
      const savedNode = activeTripId && userId ? await saveItineraryNodeOnline(movedNode) : movedNode;
      setItineraryNodes((current) => sortNodes(current.map((node) => (node.id === savedNode.id ? savedNode : node))));
      if (selectedPlannerNodeId === savedNode.id) {
        populatePlannerEditor(savedNode);
      }
      setStatusMessage('Ändringar sparade');
    } catch (error) {
      setStatusMessage('Kunde inte spara. Försök igen.');
    } finally {
      movingStopIdsRef.current.delete(nodeId);
      setIsLoading(false);
    }
  }

  function selectPlannerNode(nodeId: string) {
    const node = displayedNodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return;
    }

    populatePlannerEditor(node);
  }

  function openBudgetCostEditor(nodeId: string) {
    const target = budgetCostEditorTarget(displayedNodes, nodeId);
    if (!target) {
      return;
    }

    selectPlannerNode(target.nodeId);
    goToView(target.view);

    if (isDemoMode) {
      setStatusMessage('Anslut resan innan du lägger till kostnader.');
      return;
    }

    const opened = startInlineEdit(target.nodeId, 'cost');
    setStatusMessage(opened
      ? `Öppnade kostnadsfältet för ${target.title}.`
      : 'Spara eller avbryt det öppna fältet innan du redigerar kostnad.');
  }

  function populatePlannerEditor(node: ItineraryNode) {
    setSelectedPlannerNodeId(node.id);
    setDraftPlannerDayKey(null);
    setShowPlannerTechnicalDetails(false);
    setSelectedDayKey(dayKeyForNode(node));
    setPlannerTitle(node.title);
    setPlannerType(node.type);
    setPlannerPlace(typeof node.metadata.place === 'string' ? node.metadata.place : '');
    setPlannerDate(node.startsAt ? node.startsAt.slice(0, 10) : '');
    setPlannerTime(node.startsAt ? toTimeInput(node.startsAt) : '');
    setPlannerLatitude(node.location ? String(node.location.latitude) : '');
    setPlannerLongitude(node.location ? String(node.location.longitude) : '');
    setPlannerCost(formatRawNodeCost(node));
    setPlannerHotelNote(formatReservation(node));
    setPlannerNotes(cleanImportedNoteLines(node.notes) ?? '');
    setStatusMessage(`Redigerar: ${node.title}`);
  }

  function clearPlannerEditor() {
    setSelectedPlannerNodeId(null);
    setDraftPlannerDayKey(null);
    setShowPlannerTechnicalDetails(false);
    setPlannerTitle('');
    setPlannerType('custom');
    setPlannerPlace('');
    setPlannerDate('');
    setPlannerTime('');
    setPlannerLatitude('');
    setPlannerLongitude('');
    setPlannerCost('');
    setPlannerHotelNote('');
    setPlannerNotes('');
  }

  function startNewPlannerStep(dayKey: string, prefill?: { coordinates?: Coordinates; title?: string; place?: string }) {
    clearPlannerEditor();
    setDraftPlannerDayKey(dayKey);
    setSelectedDayKey(dayKey);
    setPlannerDate(dayKey === 'unscheduled' ? '' : dayKey);
    setPlannerTitle(prefill?.title ?? '');
    setPlannerPlace(prefill?.place ?? '');
    setPlannerLatitude(prefill?.coordinates ? String(prefill.coordinates.latitude) : '');
    setPlannerLongitude(prefill?.coordinates ? String(prefill.coordinates.longitude) : '');
    setShowPlannerTechnicalDetails(Boolean(prefill?.coordinates));
    setStatusMessage('Fyll i det nya steget direkt i dagen och tryck Spara steg.');
  }

  function handleMapPress(coordinates: Coordinates) {
    if (isDemoMode) {
      setStatusMessage('Tryck Redigera innan du lägger till stopp från kartan.');
      return;
    }

    setPendingMapAddLocation(coordinates);
    setStatusMessage('Vald plats på kartan. Bekräfta för att lägga till stopp.');
  }

  function cancelPendingMapAddLocation() {
    setPendingMapAddLocation(null);
    setStatusMessage('Kartval avbrutet. Inget stopp sparades.');
  }

  function confirmPendingMapAddLocation() {
    if (!pendingMapAddLocation) {
      return;
    }

    const targetDayKey = selectedDayPlan?.key ?? selectedDayKey ?? visibleDayPlans.find((dayPlan) => dayPlan.key !== 'unscheduled')?.key ?? 'unscheduled';
    const coordinates = pendingMapAddLocation;
    setPendingMapAddLocation(null);
    setPlannerSearchText('');
    startNewPlannerStep(targetDayKey, {
      coordinates,
      title: 'Vald plats på kartan',
      place: 'Vald plats på kartan',
    });
    goToView('days');
    setStatusMessage('Vald plats är förifylld. Kontrollera dag, titel och detaljer innan du sparar.');
  }

  function addManualDay(dayKeyInput: string) {
    const dayKey = normalizeDayKey(dayKeyInput);
    if (!dayKey) {
      setStatusMessage('Ange datum som YYYY-MM-DD.');
      return;
    }

    if (dayPlans.some((dayPlan) => dayPlan.key === dayKey)) {
      setSelectedDayKey(dayKey);
      setStatusMessage(`${formatDayKey(dayKey)} finns redan i resan.`);
      return;
    }

    setManualDayKeys((current) => mergeManualDayKeys([], [...current, dayKey]));
    setPlannerSearchText('');
    startNewPlannerStep(dayKey);
    setStatusMessage(`${formatDayKey(dayKey)} lades till. Lägg till första stoppet för att spara dagen i resan.`);
  }

  function startPlaceSearch(dayKey: string, suggestedQuery?: string) {
    setActivePlaceDayKey(dayKey);
    setSelectedDayKey(dayKey);
    setPlaceResults([]);
    if (suggestedQuery) {
      setPlaceQuery(suggestedQuery);
    }
    setStatusMessage(`Sök och lägg till plats direkt i ${formatDayKey(dayKey)}.`);
  }

  function centerForDay(dayKey: string) {
    const dayNodes = displayedNodes.filter((node) => (node.startsAt ? node.startsAt.slice(0, 10) : 'unscheduled') === dayKey);
    const locatedNode = dayNodes.find((node) => node.location) ?? displayedNodes.find((node) => node.location);
    return locatedNode?.location ?? { latitude: 46.5405, longitude: 12.1357 };
  }

  function runChecklistAction(dayPlan: DayPlan, item: DayChecklistItem) {
    if (item.done || isDemoMode) {
      return;
    }

    const firstNode = dayPlan.nodes[0];
    const missingCostNode = dayPlan.nodes.find((node) => !hasKnownNodeCost(node));
    const missingTimeNode = dayPlan.nodes.find((node) => !node.startsAt);
    const missingLocationNode = dayPlan.nodes.find((node) => !node.location);
    const missingReservationNode = dayPlan.nodes.find((node) => !formatReservation(node));

    switch (item.action) {
      case 'search_lodging':
        startPlaceSearch(dayPlan.key, 'camping eller hotell');
        return;
      case 'edit_cost':
        if (missingCostNode) {
          selectPlannerNode(missingCostNode.id);
        }
        return;
      case 'set_time':
        if (missingTimeNode) {
          void scheduleStop(missingTimeNode, 9);
        }
        return;
      case 'search_location':
        startPlaceSearch(dayPlan.key, firstNode?.title ?? 'plats');
        if (missingLocationNode) {
          selectPlannerNode(missingLocationNode.id);
        }
        return;
      case 'edit_booking':
        if (missingReservationNode) {
          selectPlannerNode(missingReservationNode.id);
        }
        return;
      case 'split_drive':
        startPlaceSearch(dayPlan.key, 'camping halvvägs');
        return;
      default:
        return;
    }
  }

  async function togglePackingItem(dayPlan: DayPlan, item: string) {
    if (isDemoMode || isLoading) {
      return;
    }

    const targetNode = dayPlan.nodes[0];
    if (!targetNode) {
      setStatusMessage('Lägg till ett stopp först, så kan packlistan sparas.');
      return;
    }

    rememberUndo('packlista');
    setIsLoading(true);
    try {
      const packedItems = readPackedItems(targetNode);
      const nextPackedItems = packedItems.includes(item)
        ? packedItems.filter((candidate) => candidate !== item)
        : [...packedItems, item];
      const savedNode = await saveItineraryNodeOnline({
        ...targetNode,
        metadata: {
          ...targetNode.metadata,
          packedItems: nextPackedItems,
        },
        updatedAt: new Date().toISOString(),
      });

      setItineraryNodes((current) => sortNodes(current.map((node) => (node.id === savedNode.id ? savedNode : node))));
      setStatusMessage(nextPackedItems.includes(item) ? `Packat: ${item}` : `Markerade som ej packat: ${item}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function addPackingItem(dayPlan: DayPlan) {
    if (isDemoMode || isLoading) {
      return;
    }

    const targetNode = dayPlan.nodes[0];
    const item = (packingDraftByDay[dayPlan.key] ?? '').trim();
    if (!item) {
      setStatusMessage('Skriv vad du vill lägga till i packlistan.');
      return;
    }

    if (!targetNode) {
      setStatusMessage('Lägg till ett stopp först, så kan packlistan sparas.');
      return;
    }

    rememberUndo('packlista');
    setIsLoading(true);
    try {
      const existingEquipment = targetNode.equipment ?? [];
      if (existingEquipment.some((equipment) => equipment.name.toLowerCase() === item.toLowerCase())) {
        setStatusMessage(`${item} finns redan i packlistan.`);
        return;
      }

      const savedNode = await saveItineraryNodeOnline({
        ...targetNode,
        equipment: [...existingEquipment, { name: item, quantity: 1 }],
        updatedAt: new Date().toISOString(),
      });

      setItineraryNodes((current) => sortNodes(current.map((node) => (node.id === savedNode.id ? savedNode : node))));
      setPackingDraftByDay((current) => ({ ...current, [dayPlan.key]: '' }));
      setStatusMessage(`Lade till i packlistan: ${item}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function saveInlineField(node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) {
    if (isDemoMode || isLoading || itineraryNodes.length === 0) {
      return;
    }

    if (inlineSaveInFlightRef.current) {
      throw new Error('Ett fält sparas redan. Vänta tills sparningen är klar.');
    }

    if (String(value ?? '').trim() === inlineFieldValue(node, field)) {
      return;
    }

    inlineSaveInFlightRef.current = true;
    try {
      const nextNode = applyInlineFieldUpdate(node, field, value);
      rememberUndo(`ändra ${inlineFieldLabel(field)}`);
      setIsLoading(true);
      const savedNode = activeTripId && userId ? await saveItineraryNodeOnline(nextNode) : nextNode;

      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      if (selectedPlannerNodeId === savedNode.id) {
        populatePlannerEditor(savedNode);
      }
      setStatusMessage('Ändringar sparade');
      setActiveInlineDraftChanged(false);
      setInlineEditMessage(null);
    } catch (error) {
      const message = 'Kunde inte spara. Försök igen.';
      setStatusMessage(message);
      throw error;
    } finally {
      inlineSaveInFlightRef.current = false;
      setIsLoading(false);
    }
  }

  function startCoordinateSearch(node: ItineraryNode) {
    if (isDemoMode || isLoading) {
      return;
    }

    clearInlineEdit();
    setCoordinateSearchNodeId(node.id);
    setCoordinateSearchQuery(inlineFieldValue(node, 'place') || node.title);
    setCoordinateSearchResults([]);
    setCoordinateSearchMessage(null);
  }

  function cancelCoordinateSearch() {
    if (isLoading) {
      return;
    }

    setCoordinateSearchNodeId(null);
    setCoordinateSearchQuery('');
    setCoordinateSearchResults([]);
    setCoordinateSearchMessage(null);
  }

  async function searchCoordinatePlace(node: ItineraryNode) {
    if (!coordinateSearchQuery.trim()) {
      setCoordinateSearchMessage('Skriv en plats att söka efter.');
      return;
    }

    setIsLoading(true);
    setCoordinateSearchMessage(null);
    setStatusMessage(`Söker kartposition för ${node.title}...`);

    try {
      const searchInput = {
        query: coordinateSearchQuery.trim(),
        radiusMeters: 30_000,
        languageCode: 'sv',
        ...(node.location ? { center: node.location } : {}),
      };
      const results = await searchGooglePlaces(searchInput);

      setCoordinateSearchResults(results);
      setCoordinateSearchMessage(results.length > 0 ? null : 'Inga platser hittades. Prova en mer specifik sökning.');
      setStatusMessage(results.length > 0 ? `Hittade ${results.length} platser.` : 'Inga platser hittades.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCoordinateSearchMessage(message || 'Kunde inte söka platser.');
      setStatusMessage(message || 'Kunde inte söka platser.');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectCoordinatePlace(node: ItineraryNode, place: GooglePlace) {
    const poi = activeTripId && userId ? googlePlaceToPoi(place, activeTripId, userId) : null;
    if (activeTripId && userId && !poi) {
      setCoordinateSearchMessage('Den valda platsen saknar koordinater.');
      return;
    }

    rememberUndo('uppdatera kartposition');
    setIsLoading(true);
    setCoordinateSearchMessage(null);
    setStatusMessage(`Uppdaterar kartposition för ${node.title}...`);

    try {
      const savedPoi = poi ? await upsertPoi(poi) : null;
      const nextNode = isPlaceholderStop(node)
        ? fillPlaceholderWithGooglePlace(node, place, savedPoi?.id ?? null)
        : applyGooglePlaceCoordinateUpdate(node, place, savedPoi?.id ?? null);
      const savedNode = activeTripId && userId ? await saveItineraryNodeOnline(nextNode) : nextNode;

      if (savedPoi) {
        upsertPoiInStore(savedPoi);
      }
      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      if (selectedPlannerNodeId === savedNode.id) {
        populatePlannerEditor(savedNode);
      }
      setCoordinateSearchNodeId(null);
      setCoordinateSearchQuery('');
      setCoordinateSearchResults([]);
      setCoordinateSearchMessage(null);
      setStatusMessage('Position klar');
    } catch (error) {
      const message = 'Kunde inte spara. Försök igen.';
      setCoordinateSearchMessage(message);
      setStatusMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function calculateRouteFromSavedStops() {
    const routableStops = getRoutableStops(displayedNodes);
    const skippedStopCount = displayedNodes.length - routableStops.length;
    const skippedPlaceholderCount = unresolvedPlaceholderStops(displayedNodes).length;
    const skippedOrdinaryStopCount = Math.max(0, skippedStopCount - skippedPlaceholderCount);
    const skipMessage = formatRouteSkipMessage(skippedOrdinaryStopCount, skippedPlaceholderCount);

    if (routableStops.length < 2) {
      setRouteCalculationMessage('Minst två stopp behöver kartposition.');
      return;
    }

    setIsRouteCalculating(true);
    setRouteCalculationMessage(skipMessage ?? 'Beräknar rutt med Google Routes...');

    try {
      const result = await calculateGoogleRoute({ stops: displayedNodes });
      setCalculatedRoute({
        route: result.route,
        signature: routeStopSignature(displayedNodes),
        includedStopCount: result.includedStopCount,
        skippedStopCount: result.skippedStopCount,
      });
      const geometryMessage = result.route.geometry
        ? 'Rutt beräknad med Google Routes'
        : 'Rutt saknar vägdata – beräkna rutt igen';
      setRouteCalculationMessage(
        `${geometryMessage}: ${result.includedStopCount} stopp ingår${result.skippedStopCount > 0 ? `, ${result.skippedStopCount} hoppades över` : ''}.`,
      );
    } catch (error) {
      setRouteCalculationMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRouteCalculating(false);
    }
  }

  async function updateMissingCoordinatesForAllStops() {
    if (isDemoMode || isLoading || !activeTripId || !userId) {
      setStatusMessage('Anslut resan innan du uppdaterar kartpositioner.');
      return;
    }

    const candidates = getBulkCoordinateCandidates(itineraryNodes);
    if (candidates.length === 0) {
      setStatusMessage(formatBulkCoordinateSummary({ attempted: 0, updated: 0, notFound: 0, failed: 0 }));
      return;
    }

    if (!hasGooglePlacesApiKey()) {
      setStatusMessage(googlePlacesMissingApiKeyMessage());
      return;
    }

    rememberUndo('uppdatera kartpositioner');
    setIsLoading(true);
    const outcomes: BulkCoordinateOutcome[] = [];

    try {
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index]!;
        setStatusMessage(`Uppdaterar ${index + 1} av ${candidates.length} stopp...`);

        let place: GooglePlace | undefined;
        try {
          const results = await searchGooglePlaces({
            query: candidate.query,
            languageCode: 'sv',
            maxResultCount: 1,
          });
          place = results.find((result) => {
            const latitude = result.location?.latitude;
            const longitude = result.location?.longitude;
            return typeof latitude === 'number' && typeof longitude === 'number';
          });
        } catch (error) {
          outcomes.push({
            nodeId: candidate.node.id,
            title: candidate.node.title,
            status: 'failed',
            step: 'search',
            message: error instanceof Error ? error.message : String(error),
          });
          continue;
        }

        if (!place) {
          outcomes.push({ nodeId: candidate.node.id, title: candidate.node.title, status: 'not_found' });
          continue;
        }

        try {
          const savedCoordinateNode = await saveItineraryNodeOnline(applyGooglePlaceCoordinateUpdate(candidate.node, place));
          let savedNode = savedCoordinateNode;

          const poi = googlePlaceToPoi(place, activeTripId, userId);
          if (poi) {
            try {
              const savedPoi = await upsertPoi(poi);
              savedNode = await saveItineraryNodeOnline({
                ...savedCoordinateNode,
                poiId: savedPoi.id,
                updatedAt: new Date().toISOString(),
                version: savedCoordinateNode.version + 1,
              });
              upsertPoiInStore(savedPoi);
            } catch {
              savedNode = savedCoordinateNode;
            }
          }

          setItineraryNodes((current) => sortNodes(current.map((node) => (node.id === savedNode.id ? savedNode : node))));
          if (selectedPlannerNodeId === savedNode.id) {
            populatePlannerEditor(savedNode);
          }
          outcomes.push({ nodeId: candidate.node.id, title: candidate.node.title, status: 'updated' });
        } catch (error) {
          outcomes.push({
            nodeId: candidate.node.id,
            title: candidate.node.title,
            status: 'failed',
            step: 'save',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const summary = formatBulkCoordinateSummary(summarizeBulkCoordinateOutcomes(candidates.length, outcomes));
      const diagnostics = formatBulkCoordinateDiagnostics(outcomes);
      setStatusMessage(diagnostics ? `${summary} ${diagnostics}` : summary);
    } finally {
      setIsLoading(false);
    }
  }

  function startInlineEdit(nodeId: string, field: InlineFieldKey): boolean {
    if (isDemoMode || isLoading || inlineSaveInFlightRef.current) {
      return false;
    }

    const isSameEditor = activeInlineEdit?.nodeId === nodeId && activeInlineEdit.field === field;
    if (!isSameEditor && activeInlineEdit && activeInlineDraftChanged) {
      setInlineEditMessage('Spara eller avbryt det öppna fältet innan du redigerar ett annat.');
      return false;
    }

    setActiveInlineEdit({ nodeId, field });
    setActiveInlineDraftChanged(false);
    setInlineEditMessage(null);
    return true;
  }

  function clearInlineEdit() {
    if (inlineSaveInFlightRef.current) {
      return;
    }

    setActiveInlineEdit(null);
    setActiveInlineDraftChanged(false);
    setInlineEditMessage(null);
  }

  async function savePlannerEdit() {
    if (!selectedPlannerNodeId) {
      setStatusMessage('Välj en rad i planeringen först.');
      return;
    }

    if (itineraryNodes.length === 0) {
      setStatusMessage('Anslut innan du redigerar demo-rader.');
      return;
    }

    const node = itineraryNodes.find((candidate) => candidate.id === selectedPlannerNodeId);
    if (!node) {
      setStatusMessage('Den valda raden finns inte längre.');
      return;
    }

    const validation = validatePlannerDraft({
      title: plannerTitle,
      type: plannerType,
      date: plannerDate,
      startTime: plannerTime,
      cost: plannerCost,
      latitude: plannerLatitude,
      longitude: plannerLongitude,
    });

    if (!validation.valid) {
      setStatusMessage(validation.errors[0] ?? 'Kontrollera formuläret.');
      return;
    }

    rememberUndo('redigera stopp');
    setIsLoading(true);
    setStatusMessage('Sparar steg...');

    try {
      const latitude = plannerLatitude.trim() ? Number(plannerLatitude.replace(',', '.')) : null;
      const longitude = plannerLongitude.trim() ? Number(plannerLongitude.replace(',', '.')) : null;

      const nextReservation = { ...node.reservation };
      if (plannerHotelNote.trim()) {
        nextReservation.provider = plannerHotelNote.trim();
      } else {
        delete nextReservation.provider;
      }

      const nextMetadata = { ...node.metadata };
      if (plannerCost.trim()) {
        nextMetadata.cost = plannerCost.trim();
      } else {
        delete nextMetadata.cost;
        delete nextMetadata.costSek;
        delete nextMetadata.price;
      }

      if (plannerPlace.trim()) {
        nextMetadata.place = plannerPlace.trim();
      } else {
        delete nextMetadata.place;
      }

      const nextNode: ItineraryNode = {
        ...node,
        type: plannerType,
        title: plannerTitle.trim(),
        startsAt: buildIsoFromInputs(plannerDate, plannerTime),
        location: latitude !== null && longitude !== null ? { latitude, longitude } : null,
        notes: cleanImportedNoteLines(plannerNotes) ?? null,
        reservation: nextReservation,
        metadata: nextMetadata,
        updatedAt: new Date().toISOString(),
        version: node.version + 1,
      };
      const savedNode = activeTripId && userId ? await saveItineraryNodeOnline(nextNode) : nextNode;

      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      populatePlannerEditor(savedNode);
      setStatusMessage('Ändringar sparade');
    } catch (error) {
      setStatusMessage('Kunde inte spara. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  }

  async function addPlannerStep() {
    const validation = validatePlannerDraft({
      title: plannerTitle,
      type: plannerType,
      date: plannerDate,
      startTime: plannerTime,
      cost: plannerCost,
      latitude: plannerLatitude,
      longitude: plannerLongitude,
    });

    if (!validation.valid) {
      setStatusMessage(validation.errors[0] ?? 'Kontrollera formuläret.');
      return;
    }

    rememberUndo('lägg till stopp');
    setIsLoading(true);
    setStatusMessage('Lägger till steg...');

    try {
      const latitude = plannerLatitude.trim() ? Number(plannerLatitude.replace(',', '.')) : null;
      const longitude = plannerLongitude.trim() ? Number(plannerLongitude.replace(',', '.')) : null;

      const now = new Date().toISOString();
      const nextNode: ItineraryNode = {
        id: cryptoRandomId(),
        tripId: activeTripId || 'local-current-roadtrip',
        createdBy: userId ?? 'local-import',
        type: plannerType,
        title: plannerTitle.trim(),
        startsAt: buildIsoFromInputs(plannerDate, plannerTime),
        endsAt: null,
        timezone: plannerDate.trim() ? 'Europe/Rome' : null,
        location: latitude !== null && longitude !== null ? { latitude, longitude } : null,
        notes: plannerNotes.trim() || null,
        sortOrder: nextSortOrder(itineraryNodes),
        transportMode: 'driving',
        reservation: plannerHotelNote.trim() ? { provider: plannerHotelNote.trim() } : {},
        equipment: [],
        facilities: {},
        metadata: {
          source: 'planner',
          place: plannerPlace.trim() || null,
          cost: plannerCost.trim() ? plannerCost.trim() : null,
        },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1,
      };
      const savedNode = activeTripId && userId ? await saveItineraryNodeOnline(nextNode) : nextNode;

      setItineraryNodes((current) => sortNodes([...current, savedNode]));
      populatePlannerEditor(savedNode);
      setStatusMessage('Sparat');
    } catch (error) {
      setStatusMessage('Kunde inte spara. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  }

  function renderPlannerInlineEditor(mode: 'edit' | 'new') {
    return (
      <View testID={mode === 'new' ? 'day-new-stop-editor' : 'day-stop-edit-editor'} style={[styles.dayInlineEditor, isDark && styles.innerPanelDark]}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.dayTitle, isDark && styles.textDark]}>{mode === 'new' ? 'Lägg till stopp i denna dag' : 'Redigera valt stopp'}</Text>
            <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{onlineSaveState === 'saving' ? 'Sparar...' : onlineSaveLabel}</Text>
          </View>
          <Pressable style={styles.secondarySmallButton} onPress={clearPlannerEditor} disabled={isLoading}>
            <Text style={styles.secondarySmallButtonText}>Avbryt</Text>
          </Pressable>
        </View>
        <View style={styles.typeChipRow}>
          {inlineNodeTypes.map((type) => (
            <Pressable
              key={type}
              style={[styles.typeChip, plannerType === type && styles.typeChipActive]}
              onPress={() => setPlannerType(type)}
              disabled={isLoading}
            >
              <Text style={[styles.typeChipText, plannerType === type && styles.typeChipTextActive]}>{formatNodeType(type)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.actionRow}>
          <TextInput value={plannerDate} onChangeText={setPlannerDate} placeholder="ÅÅÅÅ-MM-DD" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
          <TextInput value={plannerTime} onChangeText={setPlannerTime} placeholder="TT:MM" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
        </View>
        <TextInput value={plannerTitle} onChangeText={setPlannerTitle} placeholder="Titel *" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
        <View style={styles.actionRow}>
          <TextInput value={plannerPlace} onChangeText={setPlannerPlace} placeholder="Plats eller adress" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
          <TextInput value={plannerCost} onChangeText={setPlannerCost} placeholder="Kostnad" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
        </View>
        <TextInput value={plannerHotelNote} onChangeText={setPlannerHotelNote} placeholder="Bokningsstatus eller referens" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
        <TextInput value={plannerNotes} onChangeText={setPlannerNotes} placeholder="Anteckningar" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.commandInput, isDark && styles.inputDark]} multiline />
        <Pressable style={styles.secondarySmallButton} onPress={() => setShowPlannerTechnicalDetails((current) => !current)}>
          <Text style={styles.secondarySmallButtonText}>{showPlannerTechnicalDetails ? 'Dölj detaljer' : 'Visa detaljer'}</Text>
        </Pressable>
        {showPlannerTechnicalDetails ? (
          <View style={styles.advancedEditorGrid}>
            <TextInput value={plannerLatitude} onChangeText={setPlannerLatitude} placeholder="Latitud" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} inputMode="decimal" />
            <TextInput value={plannerLongitude} onChangeText={setPlannerLongitude} placeholder="Longitud" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} inputMode="decimal" />
          </View>
        ) : null}
        <View style={styles.editorActionRow}>
          <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={clearPlannerEditor} disabled={isLoading}>
            <Text style={styles.secondaryButtonText}>Avbryt</Text>
          </Pressable>
          <Pressable
            style={[styles.commandButton, isLoading && styles.disabledButton]}
            onPress={mode === 'new' ? addPlannerStep : savePlannerEdit}
            disabled={isLoading || (mode === 'edit' && !selectedPlannerNodeId)}
          >
            <Text style={styles.commandButtonText}>{isLoading ? 'Sparar...' : 'Spara steg'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderSmartStopPanel(node: ItineraryNode) {
    if (smartStopNodeId !== node.id) {
      return null;
    }

    const locatedStops = displayedNodes.filter((candidate) => candidate.id !== node.id && candidate.location);
    const fromStop = locatedStops.find((candidate) => candidate.id === smartStopFromId) ?? locatedStops[0] ?? null;
    const toStop = locatedStops.find((candidate) => candidate.id === smartStopToId) ?? locatedStops.find((candidate) => candidate.id !== fromStop?.id) ?? null;
    const center = fromStop && toStop ? midpointBetweenStops(fromStop, toStop) : fromStop?.location ?? null;

    return (
      <View style={[styles.coordinateSearchPanel, isDark && styles.innerPanelDark]}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.itemTitle, isDark && styles.textDark]}>Smart Mellanstopp</Text>
            <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Sök förslag först när du klickar Hitta mellanstopp.</Text>
          </View>
          <Pressable style={styles.secondarySmallButton} onPress={() => setSmartStopNodeId(null)} disabled={isLoading}>
            <Text style={styles.secondarySmallButtonText}>Stäng</Text>
          </Pressable>
        </View>
        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Från stopp</Text>
        <View style={styles.exploreChipRow}>
          {locatedStops.slice(0, 8).map((stop) => {
            const selected = smartStopFromId === stop.id;
            return (
              <Pressable key={`from-${stop.id}`} style={selected ? styles.smallButton : styles.secondarySmallButton} onPress={() => setSmartStopFromId(stop.id)} disabled={isLoading}>
                <Text style={selected ? styles.smallButtonText : styles.secondarySmallButtonText} numberOfLines={1}>{stop.title}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Till stopp</Text>
        <View style={styles.exploreChipRow}>
          {locatedStops.slice(0, 8).map((stop) => {
            const selected = smartStopToId === stop.id;
            return (
              <Pressable key={`to-${stop.id}`} style={selected ? styles.smallButton : styles.secondarySmallButton} onPress={() => setSmartStopToId(stop.id)} disabled={isLoading}>
                <Text style={selected ? styles.smallButtonText : styles.secondarySmallButtonText} numberOfLines={1}>{stop.title}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Körning före stopp</Text>
        <View style={styles.exploreChipRow}>
          {SMART_DRIVE_TIME_OPTIONS.map((option) => {
            const selected = smartStopDriveTimeRange === option.id;
            return (
              <Pressable key={option.id} style={selected ? styles.smallButton : styles.secondarySmallButton} onPress={() => setSmartStopDriveTimeRange(option.id)} disabled={isLoading}>
                <Text style={selected ? styles.smallButtonText : styles.secondarySmallButtonText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Typ</Text>
        <View style={styles.exploreChipRow}>
          {SMART_STOP_OPTIONS.map((option) => {
            const selected = smartStopType === option.id;
            return (
              <Pressable key={option.id} style={selected ? styles.smallButton : styles.secondarySmallButton} onPress={() => setSmartStopType(option.id)} disabled={isLoading}>
                <Text style={selected ? styles.smallButtonText : styles.secondarySmallButtonText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.editorActionRow}>
          <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={() => void searchSmartStops(node)} disabled={isLoading || locatedStops.length < 2}>
            <Text style={styles.commandButtonText}>Hitta mellanstopp</Text>
          </Pressable>
        </View>
        {smartStopMessage ? <Text style={styles.validationText}>{smartStopMessage}</Text> : null}
        {smartStopResults.length > 0 ? (
          <View style={styles.placeResultList}>
            {smartStopResults.map((place) => {
              const explorePlace = center ? nearbyExplorePlaceFromGooglePlace(place, center) : explorePlaceFromGooglePlace(place);
              return (
                <View key={place.id} style={[styles.placeItem, isDark && styles.innerPanelDark]}>
                  <View style={styles.timelineCopy}>
                    <Text style={[styles.itemTitle, isDark && styles.textDark]}>{explorePlace.title}</Text>
                    <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                      {[explorePlace.place, explorePlace.rating ? `${explorePlace.rating} i betyg` : null, explorePlace.category].filter(Boolean).join(' / ')}
                    </Text>
                    <View style={styles.exploreChipRow}>
                      {explorePlace.statusChips.slice(0, 2).map((chip) => <Text key={chip} style={styles.exploreStatusChip}>{chip}</Text>)}
                    </View>
                  </View>
                  <View style={styles.stopActions}>
                    <Pressable style={[styles.smallButton, isLoading && styles.disabledButton]} onPress={() => void fillPlaceholderFromSmartStop(node, place)} disabled={isLoading}>
                      <Text style={styles.smallButtonText}>Fyll placeholder</Text>
                    </Pressable>
                    <Pressable style={[styles.secondarySmallButton, isLoading && styles.disabledButton]} onPress={() => saveExploreGooglePlace(place)} disabled={isLoading}>
                      <Text style={styles.secondarySmallButtonText}>Spara i Utforska</Text>
                    </Pressable>
                    <Pressable style={styles.secondarySmallButton} onPress={() => showExplorePlaceOnMap(explorePlace)}>
                      <Text style={styles.secondarySmallButtonText}>Visa på karta</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }

  function renderDayPlaceSearch(dayKey: string) {
    if (activePlaceDayKey !== dayKey) {
      return null;
    }

    return (
      <View style={[styles.dayPlaceSearch, isDark && styles.innerPanelDark]}>
        <View style={styles.actionRow}>
          <TextInput
            value={placeQuery}
            onChangeText={setPlaceQuery}
            placeholder="Sök camping, restaurang, utsikt, aktivitet..."
            placeholderTextColor={isDark ? '#737373' : '#78716c'}
            style={[styles.singleLineInput, isDark && styles.inputDark]}
          />
          <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={searchPlaces} disabled={isLoading}>
            <Text style={styles.commandButtonText}>Sök</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={() => setActivePlaceDayKey(null)} disabled={isLoading}>
            <Text style={styles.secondaryButtonText}>Stäng</Text>
          </Pressable>
        </View>
        {placeResults.length > 0 ? (
          <View style={styles.placeResultList}>
            {placeResults.map((place) => (
              <View key={place.id} style={[styles.placeItem, isDark && styles.innerPanelDark]}>
                <View style={styles.timelineCopy}>
                  <Text style={[styles.itemTitle, isDark && styles.textDark]}>{place.displayName?.text ?? 'Namnlös plats'}</Text>
                  <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                    {[place.formattedAddress, place.rating ? `${place.rating} i betyg` : null, place.primaryType].filter(Boolean).join(' / ')}
                  </Text>
                </View>
                <Pressable style={styles.smallButton} onPress={() => void savePlace(place, dayKey)} disabled={isLoading}>
                  <Text style={styles.smallButtonText}>Lägg till</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Sökningen använder stopp i samma dag som kartcentrum när det finns.</Text>
        )}
      </View>
    );
  }

  async function importReseplanrarePlan() {
    rememberUndo('importera aktuell resa');
    setIsLoading(true);
    setStatusMessage(activeTripId && userId ? 'Importerar aktuell resa till den anslutna resan...' : 'Importerar aktuell resa lokalt...');

    try {
      const importPlan = planReseplanrareImport(itineraryNodes, reseplanrareSeedRows);
      if (reseplanrareSeedRows.length === 0) {
        setStatusMessage('Resplanen är redan laddad.');
        return;
      }

      const importedNodes: ItineraryNode[] = [];
      for (const row of reseplanrareSeedRows) {
        const existingNode = importPlan.existingNodesBySourceRow.get(row.sourceRow);
        const nextNode = existingNode
          ? applySeedRowToExistingNode(existingNode, row)
          : buildNodeFromSeedRow(row, activeTripId || 'local-current-roadtrip', userId ?? 'local-import');
        importedNodes.push(activeTripId && userId ? await saveItineraryNodeOnline(nextNode) : nextNode);
      }

      const importedNodeIds = new Set(importedNodes.map((node) => node.id));
      const nextNodes = sortNodes([
        ...itineraryNodes.filter((node) => !importedNodeIds.has(node.id)),
        ...importedNodes,
      ]);

      setItineraryNodes(nextNodes);
      setHasStartedBlankPlan(true);
      setIsEditMode(true);
      setSelectedDayKey('2026-07-12');
      setCalculatedRoute(null);
      setRouteCalculationMessage(null);
      if (!(activeTripId && userId)) {
        savePersistedAppState({
          itineraryNodes: nextNodes,
          travelerCountText,
          isEditMode: true,
          exploreNotes,
          explorePlaces,
          fuelConsumptionText,
          fuelPriceText,
        });
      }
      setStatusMessage(
        activeTripId && userId
          ? `Importerade ${importedNodes.length} steg till den anslutna resan. Inga befintliga stopp togs bort.`
          : `Importerade ${importedNodes.length} steg lokalt för granskning. Tryck Synka till molnet när du vill spara resan i Supabase.`,
      );
      goToView('days');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function createNodeFromPoi(poi: Poi, dayKey: string): Promise<ItineraryNode> {
    if (!activeTripId || !userId) {
      throw new Error('Anslut innan du sparar ett stopp.');
    }

    const now = new Date().toISOString();
    const startsAt = dayKey === 'unscheduled' ? null : buildIsoFromInputs(dayKey, '');

    return saveItineraryNodeOnline({
      id: cryptoRandomId(),
      tripId: activeTripId,
      poiId: poi.id,
      createdBy: userId,
      type: poi.category.includes('camp') ? 'camping' : 'custom',
      title: poi.name,
      notes: poi.address ?? null,
      startsAt,
      endsAt: null,
      timezone: startsAt ? 'Europe/Rome' : null,
      location: poi.location,
      sortOrder: nextSortOrder(itineraryNodes),
      transportMode: 'driving',
      reservation: {},
      equipment: [],
      facilities: {},
      metadata: { source: 'google_places', externalRef: poi.externalRef },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.header, isMobile && styles.headerMobile, isDark && styles.headerDark]}>
          <View style={[styles.brandLockup, isMobile && styles.brandLockupMobile]}>
            <Text style={[styles.kicker, isDark && styles.textMutedDark]}>Roadtrip Pro</Text>
            <Text style={[styles.title, isDark && styles.textDark]}>Alpine Roadtrip</Text>
          </View>
          <View style={[styles.navLinks, isMobile && styles.navLinksMobile]}>
            {appTabs.map((tab) => (
              <Pressable
                key={tab.key}
                testID={`top-nav-${tab.key}`}
                style={[styles.navTab, isMobile && styles.navTabMobile, activeView === tab.key && styles.navTabActive]}
                onPress={() => goToView(tab.key)}
              >
                <Text style={[styles.navLink, activeView === tab.key && styles.navLinkActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
            <View style={[styles.headerStatusSummary, isMobile && styles.headerStatusSummaryMobile, isDark && styles.headerStatusSummaryDark]}>
              <Text style={[styles.headerStatusTitle, isDark && styles.textDark]}>
                {activeTripId ? 'Molnresa aktiv' : hasLocalTripData ? 'Lokal resa ej synkad' : 'Anslut för molnsparning'}
              </Text>
              <Text style={[styles.headerStatusMeta, isDark && styles.textMutedDark]} numberOfLines={1}>{visibleStatusMessage}</Text>
              {sharedTripStatusText ? (
                <Text testID="shared-trip-status" style={[styles.headerStatusMeta, isDark && styles.textMutedDark]} numberOfLines={1}>
                  {sharedTripStatusText}
                </Text>
              ) : null}
            </View>
            <Pressable testID="edit-mode-toggle" style={[styles.modeButton, isEditMode && styles.modeButtonActive]} onPress={toggleEditMode}>
              <Text style={[styles.modeButtonText, isEditMode && styles.modeButtonTextActive]}>{isEditMode ? 'Redigerar' : 'Redigera'}</Text>
            </Pressable>
            <Pressable
              testID="new-trip-button"
              style={[styles.newTripButton, isLoading && styles.disabledButton]}
              onPress={startNewBlankTrip}
              disabled={isLoading}
            >
              <Text style={styles.newTripButtonText}>Ny reseplan</Text>
            </Pressable>
            <Pressable
              style={[styles.syncButton, isLoading && styles.disabledButton]}
              onPress={activeTripId ? () => void refreshActiveCloudTrip('manual') : hasLocalTripData ? syncCurrentTripToCloud : () => void connectSupabaseTrip()}
              disabled={isLoading}
            >
              <Text style={styles.syncButtonText}>{isLoading ? 'Vänta' : activeTripId ? 'Uppdatera' : hasLocalTripData ? 'Synka' : 'Anslut'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView ref={contentScrollRef} style={styles.content} contentContainerStyle={[styles.contentInner, isMobile && styles.contentInnerMobile]}>
          <View pointerEvents="none" style={styles.backgroundWash}>
            <View style={styles.backgroundTopBand} />
            <View style={styles.backgroundWarmBand} />
          </View>
          {isMobile ? <MobileFlowNav activeView={activeView} appTabs={appTabs} styles={styles} onGoToView={goToView} /> : null}

          <View style={[styles.dashboardGrid, isMobile && styles.dashboardGridMobile]}>
            {!isMobile ? (
              <SidebarNav
                activeView={activeView}
                appTabs={appTabs}
                dayPlans={dayPlans}
                selectedDayKey={selectedDayPlan?.key ?? null}
                statusLabel={activeTripId ? 'Molnresa aktiv' : 'Endast lokalt sparat'}
                statusMeta={visibleStatusMessage}
                styles={styles}
                tripName={demoTrip.name}
                onGoToView={goToView}
                onSelectDay={(dayKey) => {
                  const target = dayShortcutTarget(dayKey);
                  setSelectedDayKey(target.selectedDayKey);
                  goToView(target.view);
                }}
              />
            ) : null}
            {!isDemoMode && activeView === 'tools' ? (
            <View style={styles.sidebarColumn}>
              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Arbetsläge" dark={isDark} styles={styles} />
                <View style={styles.actionRow}>
                  <Pressable style={[styles.undoButton, (!undoSnapshot || isLoading) && styles.disabledButton]} onPress={() => void undoLastChange()} disabled={!undoSnapshot || isLoading}>
                    <Text style={styles.undoButtonText}>Ångra</Text>
                  </Pressable>
                  <Pressable style={[styles.saveAppButton, isLoading && styles.disabledButton]} onPress={saveAppSnapshot} disabled={isLoading}>
                    <Text style={styles.saveAppButtonText}>Spara app</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Konto" dark={isDark} styles={styles} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={isDark ? '#737373' : '#78716c'}
                  style={[styles.singleLineInput, isDark && styles.inputDark]}
                  autoCapitalize="none"
                  inputMode="email"
                />
                <View style={styles.actionRow}>
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={sendLoginLink} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Skicka länk</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={disconnect} disabled={isLoading}>
                    <Text style={styles.secondaryButtonText}>Logga ut</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Dela resa" dark={isDark} styles={styles} />
                <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                  Skapa en privat inbjudningslänk. Den som öppnar länken och är identifierad i Supabase blir editor på samma resa.
                </Text>
                <View style={styles.actionRow}>
                  <Pressable testID="create-share-link" style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={createShareCode} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Skapa inbjudningslänk</Text>
                  </Pressable>
                  <View style={[styles.shareCodeBox, isDark && styles.shareCodeBoxDark]}>
                    <Text style={[styles.codeText, isDark && styles.textDark]} selectable>{generatedShareCode || 'Ingen kod än'}</Text>
                  </View>
                  <Pressable testID="copy-share-link" style={[styles.secondaryButton, ((!generatedShareLink && !generatedShareCode) || isLoading) && styles.disabledButton]} onPress={copyShareCode} disabled={(!generatedShareLink && !generatedShareCode) || isLoading}>
                    <Text style={styles.secondaryButtonText}>Kopiera länk</Text>
                  </Pressable>
                </View>
                {generatedShareLink ? (
                  <Text testID="share-invite-link" style={[styles.shareLinkText, isDark && styles.textMutedDark]} selectable numberOfLines={2}>
                    {generatedShareLink}
                  </Text>
                ) : null}
                <TextInput
                  value={shareCode}
                  onChangeText={(value) => setShareCode(normalizeShareCode(value))}
                  placeholder="Klistra in kod eller inbjudningslänk"
                  placeholderTextColor={isDark ? '#737373' : '#78716c'}
                  style={[styles.singleLineInput, isDark && styles.inputDark]}
                  autoCapitalize="characters"
                  testID="share-code-input"
                />
                <Pressable testID="join-shared-trip" style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={joinSharedTrip} disabled={isLoading}>
                  <Text style={styles.commandButtonText}>Gå med i delad resa</Text>
                </Pressable>
                <View style={styles.memberList}>
                  <Text style={[styles.itemMetaStrong, isDark && styles.textDark]}>Medlemmar</Text>
                  {sharedTripStatusText ? (
                    <Text testID="shared-trip-debug" style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                      {sharedTripStatusText}
                    </Text>
                  ) : null}
                  {(tripMembers.length > 0 ? tripMembers : activeTripId && userId ? [{ tripId: activeTripId, userId, role: 'owner' as const, joinedAt: '' }] : []).map((member) => (
                    <View key={`${member.tripId}:${member.userId}`} style={styles.memberRow}>
                      <Text style={[styles.memberName, isDark && styles.textDark]} numberOfLines={1}>{member.userId === userId ? 'Du' : member.userId}</Text>
                      <Text style={styles.memberRole}>{member.role === 'owner' ? 'Ägare' : member.role === 'editor' ? 'Kan redigera' : 'Kan visa'}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Resplan" dark={isDark} styles={styles} />
                <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={importReseplanrarePlan} disabled={isLoading}>
                  <Text style={styles.commandButtonText}>Importera aktuell resa</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, (isLoading || !activeTripId || missingCoordinateCount === 0) && styles.disabledButton]}
                  onPress={() => void updateMissingCoordinatesForAllStops()}
                  disabled={isLoading || !activeTripId || missingCoordinateCount === 0}
                >
                  <Text style={styles.secondaryButtonText}>Fyll i saknade kartpositioner</Text>
                </Pressable>
                <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                  {missingCoordinateCount > 0 ? `${missingCoordinateCount} aktiva stopp saknar kartposition.` : 'Alla aktiva stopp har kartpositioner.'}
                </Text>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="AI-reseassistent" dark={isDark} styles={styles} />
                <TextInput
                  value={command}
                  onChangeText={setCommand}
                  placeholder="Be om camping, ruttändring, budgetvarning..."
                  placeholderTextColor={isDark ? '#737373' : '#78716c'}
                  style={[styles.commandInput, isDark && styles.inputDark]}
                  multiline
                />
                <View style={styles.actionRow}>
                  {latestAiPlan?.mutations.length ? (
                    <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={confirmAiPlan} disabled={isLoading}>
                      <Text style={styles.secondaryButtonText}>Bekräfta plan</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={parseAiCommand} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Tolka kommando</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            ) : null}

            <View style={[styles.mainColumn, isMobile && styles.mainColumnMobile]}>
              <TripHero
                compact={activeView !== 'overview'}
                copy={activeHeroCopy}
                drivingLabel={formatDuration(routeSummary.durationSeconds)}
                isMobile={isMobile}
                routeLabel={formatDistance(routeSummary.distanceMeters)}
                startTitle={firstRouteStop?.title ?? 'Start'}
                stopCount={displayedNodes.length}
                styles={styles}
                targetTitle={lastRouteStop?.title ?? 'Mål'}
              />
              {localTripImportOffer ? (
                <View testID="local-cloud-import-card" style={[styles.localImportCard, isDark && styles.panelDark]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.flexOne}>
                      <Text style={[styles.localImportTitle, isDark && styles.textDark]}>
                        Lokal resa kan synkas till molnet
                      </Text>
                      <Text style={[styles.localImportText, isDark && styles.textMutedDark]}>
                        {localTripImportOffer.cloudNodeCount === 0
                          ? 'Molnresan är tom än så länge.'
                          : `Molnresan har ${localTripImportOffer.cloudNodeCount} stopp.`}
                      </Text>
                      <Text style={[styles.localImportText, isDark && styles.textMutedDark]}>
                        Välj själv. Molnresan skrivs inte över och inget tas bort automatiskt.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                    Lokal data: {localTripImportOffer.nodes.length} stopp
                    {localTripImportOffer.explorePlaces.length > 0 ? `, ${localTripImportOffer.explorePlaces.length} idéplatser` : ''}
                    {localTripImportOffer.exploreNotes.trim() ? ', anteckningar' : ''}. Lokal data tas inte bort automatiskt.
                  </Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      testID="copy-local-trip-to-supabase"
                      style={[styles.commandButton, isLoading && styles.disabledButton]}
                      onPress={() => void importLocalTripToSupabase()}
                      disabled={isLoading}
                    >
                      <Text style={styles.commandButtonText}>Synka lokal resa till molnet</Text>
                    </Pressable>
                    <Pressable
                      testID="continue-empty-cloud-trip"
                      style={[styles.secondaryButton, isLoading && styles.disabledButton]}
                      onPress={continueWithEmptyCloudTrip}
                      disabled={isLoading}
                    >
                      <Text style={styles.secondaryButtonText}>Fortsätt med molnresan</Text>
                    </Pressable>
                    <Pressable
                      testID="show-local-trip"
                      style={[styles.secondaryButton, isLoading && styles.disabledButton]}
                      onPress={showLocalTripPreview}
                      disabled={isLoading}
                    >
                      <Text style={styles.secondaryButtonText}>Visa lokal resa först</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {activeView === 'tools' ? (
                <ToolsWorkspace
                  activeTripId={activeTripId ?? null}
                  isDark={isDark}
                  isDemoMode={isDemoMode}
                  isLoading={isLoading}
                  isMobile={isMobile}
                  missingCoordinateCount={missingCoordinateCount}
                  onlineSaveLabel={onlineSaveLabel}
                  styles={styles}
                  hasLocalTripData={hasLocalTripData}
                  onImportCurrentTrip={() => void importReseplanrarePlan()}
                  onRefreshFromCloud={() => void refreshActiveCloudTrip('manual')}
                  onSyncCurrentTripToCloud={() => void syncCurrentTripToCloud()}
                />
              ) : null}
              {activeView === 'explore' ? (
              <ExploreWorkspace
                activeTripId={activeTripId ?? null}
                exploreEmptyState={exploreEmptyState}
                exploreGroups={exploreGroups}
                exploreNotes={exploreNotes}
                exploreResults={exploreResults}
                exploreSearchQuery={exploreSearchQuery}
                isDark={isDark}
                isLoading={isLoading}
                nearbyCategories={NEARBY_CATEGORIES}
                nearbyCategoryId={nearbyCategoryId}
                nearbyContexts={nearbyContexts}
                nearbyContextId={selectedNearbyContext?.id ?? ''}
                nearbyMessage={nearbyMessage}
                nearbyResults={nearbyResults}
                recommendedPlaces={recommendedPlaces}
                styles={styles}
                onAddExplorePlaceToSelectedDay={addExplorePlaceToSelectedDay}
                onRemoveExplorePlace={(placeId) => void removeExplorePlace(placeId)}
                onSaveNearbyPlace={(place) => void saveExplorePlace(place, `${place.title} sparades i Utforska.`)}
                onSaveExploreGooglePlace={saveExploreGooglePlace}
                onSaveExploreNotes={() => void saveExploreNotes()}
                onSaveRecommendedExplorePlace={saveRecommendedExplorePlace}
                onSearchExplorePlaces={() => void searchExplorePlaces()}
                onSearchNearbyPlaces={() => void searchNearbyPlaces()}
                onSetNearbyCategoryId={setNearbyCategoryId}
                onSetNearbyContextId={setNearbyContextId}
                onSetExploreNotes={setExploreNotes}
                onSetExploreSearchQuery={setExploreSearchQuery}
                onShowExplorePlaceOnMap={showExplorePlaceOnMap}
              />
              ) : null}
              {activeView === 'route' ? (
              <RouteWorkspace
                activeRoute={routeSummary}
                displayedNodes={displayedNodes}
                formatDateLabel={formatDateLabel}
                formatDistance={formatDistance}
                formatDuration={formatDuration}
                formatTime={formatTime}
                fuelConsumptionText={fuelConsumptionText}
                fuelEstimate={fuelEstimate}
                fuelPriceText={fuelPriceText}
                isDark={isDark}
                isLoading={isLoading}
                isRouteCalculating={isRouteCalculating}
                isMobile={isMobile}
                pendingAddLocation={pendingMapAddLocation}
                placeholderSkippedCount={unresolvedPlaceholderCount}
                routeCalculationMessage={routeCalculationMessage}
                routeIncludedStopCount={activeCalculatedRoute?.includedStopCount ?? routableStopCount}
                routeIsCalculated={Boolean(activeCalculatedRoute)}
                routeSkippedStopCount={activeCalculatedRoute?.skippedStopCount ?? routeSkippedStopCount}
                missingCoordinateCount={missingCoordinateCount}
                styles={styles}
                tripName={demoTrip.name}
                onCalculateRoute={() => void calculateRouteFromSavedStops()}
                onCancelPendingAddLocation={cancelPendingMapAddLocation}
                onConfirmPendingAddLocation={confirmPendingMapAddLocation}
                onSetFuelConsumptionText={setFuelConsumptionText}
                onSetFuelPriceText={setFuelPriceText}
                onGoToDays={() => goToView('days')}
                onMapPress={handleMapPress}
              />
              ) : null}

              {activeView === 'overview' ? (
              <OverviewWorkspace
                activeRoute={routeSummary}
                budgetSummary={budgetSummary}
                costPerTraveler={costPerTraveler}
                dayCount={dayPlans.length}
                displayedNodes={displayedNodes}
                firstRouteStop={firstRouteStop}
                formatDistance={formatDistance}
                formatDuration={formatDuration}
                formatSek={formatSek}
                isDark={isDark}
                isMobile={isMobile}
                lastRouteStop={lastRouteStop}
                missingCoordinateCount={missingCoordinateCount}
                pendingAddLocation={pendingMapAddLocation}
                styles={styles}
                totalSpend={totalSpend}
                tripReadiness={tripReadiness}
                onCancelPendingAddLocation={cancelPendingMapAddLocation}
                onConfirmPendingAddLocation={confirmPendingMapAddLocation}
                onGoToView={goToView}
                onMapPress={handleMapPress}
              />
              ) : null}

              {activeView === 'budget' ? (
              <BudgetWorkspace
                budgetCenter={budgetCenter}
                displayedNodes={displayedNodes}
                formatPercentage={formatPercentage}
                formatSek={formatSek}
                isDark={isDark}
                isMobile={isMobile}
                styles={styles}
                travelerCountText={travelerCountText}
                onOpenBudgetCostEditor={openBudgetCostEditor}
                onSetTravelerCountText={setTravelerCountText}
              />
              ) : null}

              {activeView === 'days' ? (
              <DaysWorkspace
                activeInlineEdit={activeInlineEdit}
                activeRoute={routeSummary}
                availableDayTargets={dayMoveTargets}
                coordinateSearchMessage={coordinateSearchMessage}
                coordinateSearchNodeId={coordinateSearchNodeId}
                coordinateSearchQuery={coordinateSearchQuery}
                coordinateSearchResults={coordinateSearchResults}
                dayPlans={dayPlans}
                displayedNodesLength={displayedNodes.length}
                draftPlannerDayKey={draftPlannerDayKey}
                filteredStopCount={filteredStopCount}
                formatDayKey={formatDayKey}
                inlineEditMessage={inlineEditMessage}
                isDark={isDark}
                isDemoMode={isDemoMode}
                isLoading={isLoading}
                isMobile={isMobile}
                itineraryNodesLength={itineraryNodes.length}
                packingDraft={selectedDayPlan ? packingDraftByDay[selectedDayPlan.key] ?? '' : ''}
                pendingAddLocation={pendingMapAddLocation}
                plannerSearchText={plannerSearchText}
                renderDayPlaceSearch={renderDayPlaceSearch}
                renderPlannerInlineEditor={renderPlannerInlineEditor}
                renderSmartStopPanel={renderSmartStopPanel}
                routeIsCalculated={Boolean(activeCalculatedRoute)}
                routeSkippedStopCount={activeCalculatedRoute?.skippedStopCount ?? routeSkippedStopCount}
                selectedDayPlan={selectedDayPlan}
                selectedPlannerNodeId={selectedPlannerNodeId}
                styles={styles}
                suggestedNewDayKey={suggestedNewDayKey}
                visibleDayPlans={visibleDayPlans}
                onAddManualDay={addManualDay}
                onAddPlaceholderAfterStop={(node) => void addPlaceholderAfterStop(node)}
                onAddPackingItem={addPackingItem}
                onCalculateRoute={() => void calculateRouteFromSavedStops()}
                onCancelPendingAddLocation={cancelPendingMapAddLocation}
                onCancelCoordinateSearch={cancelCoordinateSearch}
                onChangeCoordinateSearchQuery={setCoordinateSearchQuery}
                onClearInlineEdit={clearInlineEdit}
                onConfirmPendingAddLocation={confirmPendingMapAddLocation}
                onGoToRoute={() => goToView('route')}
                onGoToTools={() => goToView('tools')}
                onInlineDraftChange={setActiveInlineDraftChanged}
                onMoveStop={moveStop}
                onMoveStopToDay={moveStopToDay}
                onMapPress={handleMapPress}
                onRemoveStop={removeStop}
                onRunChecklistAction={runChecklistAction}
                onSaveInlineField={saveInlineField}
                onSearchCoordinatePlace={searchCoordinatePlace}
                onSelectCoordinatePlace={selectCoordinatePlace}
                onSelectDay={setSelectedDayKey}
                onSelectPlannerNode={selectPlannerNode}
                onSetPackingDraft={(dayKey: string, text: string) => setPackingDraftByDay((current) => ({ ...current, [dayKey]: text }))}
                onSetPlannerSearchText={setPlannerSearchText}
                onStartCoordinateSearch={startCoordinateSearch}
                onStartInlineEdit={startInlineEdit}
                onStartSmartStopSearch={startSmartStopSearch}
                onStartNewPlannerStep={startNewPlannerStep}
                onStartPlaceSearch={startPlaceSearch}
                onTogglePackingItem={togglePackingItem}
              />
              ) : null}
            </View>
            {!isMobile ? (
              <MapRail
                activeRoute={routeSummary.provider === 'google_routes' && routeSummary.geometry ? routeSummary : null}
                activeView={activeView}
                displayedNodes={displayedNodes}
                formatDistance={formatDistance}
                formatDuration={formatDuration}
                missingCoordinateCount={missingCoordinateCount}
                mapExpanded={mapExpanded}
                pendingAddLocation={pendingMapAddLocation}
                selectedDayPlan={selectedDayPlan}
                styles={styles}
                onCancelPendingAddLocation={cancelPendingMapAddLocation}
                onConfirmPendingAddLocation={confirmPendingMapAddLocation}
                onGoToView={goToView}
                onMapPress={handleMapPress}
                onToggleMapExpanded={() => setMapExpanded((current) => !current)}
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function formatNodeType(type: ItineraryNode['type']): string {
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

function buildNodeInfoPills(node: ItineraryNode): string[] {
  const pills: string[] = [];
  const place = typeof node.metadata.place === 'string' ? node.metadata.place : null;
  const cost = formatRawNodeCost(node);
  const reservation = formatReservation(node);

  if (place) {
    pills.push(place);
  } else if (node.location) {
    pills.push(`${node.location.latitude.toFixed(2)}, ${node.location.longitude.toFixed(2)}`);
  }

  pills.push(cost || 'Fyll i kostnad');

  if (reservation) {
    pills.push(reservation);
  }

  if (node.notes) {
    pills.push(node.notes);
  }

  return pills.slice(0, 4);
}

function sortNodes(nodes: ItineraryNode[]): ItineraryNode[] {
  return [...nodes].sort((a, b) => {
    const dayA = a.startsAt ? a.startsAt.slice(0, 10) : '9999-12-31';
    const dayB = b.startsAt ? b.startsAt.slice(0, 10) : '9999-12-31';

    if (dayA !== dayB) {
      return dayA.localeCompare(dayB);
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    const timeA = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY;
    const timeB = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY;

    return timeA - timeB;
  });
}

function dayKeyForNode(node: ItineraryNode): string {
  return node.startsAt ? node.startsAt.slice(0, 10) : 'unscheduled';
}

function nextSortOrder(nodes: ItineraryNode[]): number {
  const maxSortOrder = nodes.reduce((max, node) => Math.max(max, node.sortOrder), 0);
  return maxSortOrder + 100;
}

function buildDayPlans(nodes: ItineraryNode[], manualDayKeys: string[] = []): DayPlan[] {
  const sortedNodes = sortNodes(nodes);
  const groups = new Map<string, ItineraryNode[]>();

  sortedNodes.forEach((node) => {
    const key = itineraryDayKeyForNode(node);
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });

  const mergedDayKeys = mergeManualDayKeys(Array.from(groups.keys()), manualDayKeys);

  return mergedDayKeys.map((key, index) => {
    const groupNodes = groups.get(key) ?? [];
    const route = estimateRouteSummary(groupNodes);
    const budget = buildBudgetSummary(groupNodes);
    const insight = buildDayInsight(groupNodes, route, budget);
    const title = key === 'unscheduled' ? 'Ej schemalagda poster' : `Dag ${index + 1} / ${formatDateLabel(key)}`;
    const summary = summarizeDay(groupNodes, key, index + 1);

    return {
      key,
      title,
      shortTitle: key === 'unscheduled' ? 'Generella poster' : `Dag ${index + 1}`,
      nodes: groupNodes,
      route,
      budget,
      summary,
      smartFlags: buildDaySmartFlags(groupNodes, route, budget),
      insight,
    };
  });
}

function filterDayPlans(dayPlans: DayPlan[], searchText: string): DayPlan[] {
  const normalizedSearch = normalizeSearchText(searchText);
  if (!normalizedSearch) {
    return dayPlans;
  }

  return dayPlans
    .map((dayPlan) => {
      const filteredNodes = dayPlan.nodes.filter((node) => nodeMatchesSearch(node, dayPlan, normalizedSearch));
      const route = estimateRouteSummary(filteredNodes);
      const budget = buildBudgetSummary(filteredNodes);
      return {
        ...dayPlan,
        nodes: filteredNodes,
        route,
        budget,
        summary: summarizeDay(filteredNodes, dayPlan.key, dayPlan.summary.dayNumber),
        smartFlags: buildDaySmartFlags(filteredNodes, route, budget),
        insight: buildDayInsight(filteredNodes, route, budget),
      };
    })
    .filter((dayPlan) => dayPlan.nodes.length > 0);
}

function nodeMatchesSearch(node: ItineraryNode, dayPlan: DayPlan, normalizedSearch: string): boolean {
  const searchableParts = [
    node.title,
    formatNodeType(node.type),
    dayPlan.title,
    dayPlan.shortTitle,
    node.startsAt ? node.startsAt.slice(0, 10) : null,
    node.startsAt ? formatTime(node.startsAt) : null,
    typeof node.metadata.place === 'string' ? node.metadata.place : null,
    formatRawNodeCost(node),
    formatReservation(node),
    cleanImportedNoteLines(node.notes),
    node.timezone,
  ];

  return normalizeSearchText(searchableParts.filter(Boolean).join(' ')).includes(normalizedSearch);
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buildLocalTripSnapshot(nodes: ItineraryNode[], exploreNotes: string, explorePlaces: ExplorePlace[]) {
  return {
    nodes: sortNodes(nodes.filter((node) => !node.deletedAt).map(cloneItineraryNode)),
    exploreNotes,
    explorePlaces: explorePlaces.map((place) => ({ ...place, statusChips: [...place.statusChips] })),
  };
}

function buildLocalTripImportOffer(input: {
  tripId: string;
  userId: string;
  localNodes: ItineraryNode[];
  localExploreNotes: string;
  localExplorePlaces: ExplorePlace[];
  cloudNodes: ItineraryNode[];
  cloudExploreItems: TripExploreItem[];
}): LocalTripImportOffer | null {
  const hasLocalData = input.localNodes.length > 0
    || input.localExplorePlaces.length > 0
    || input.localExploreNotes.trim().length > 0;
  if (!hasLocalData) {
    return null;
  }

  const cloudExplorePlaces = input.cloudExploreItems
    .map(explorePlaceFromItem)
    .filter((place): place is ExplorePlace => Boolean(place));
  const cloudNodeKeys = new Set(input.cloudNodes.map(buildItineraryNodeDuplicateKey));
  const cloudExploreKeys = new Set(cloudExplorePlaces.map(buildExplorePlaceDuplicateKey));
  const hasImportableNode = input.localNodes.some((node) => !cloudNodeKeys.has(buildItineraryNodeDuplicateKey(node)));
  const hasImportableExplorePlace = input.localExplorePlaces.some((place) => !cloudExploreKeys.has(buildExplorePlaceDuplicateKey(place)));
  const cloudNote = input.cloudExploreItems.find((item) => item.itemType === 'note')?.description?.trim() ?? '';
  const hasImportableNote = input.localExploreNotes.trim().length > 0 && cloudNote.length === 0;
  const cloudLooksSparse = input.cloudNodes.length === 0
    || (input.cloudNodes.length <= 1 && input.localNodes.length > input.cloudNodes.length);

  if (!cloudLooksSparse && !hasImportableNode && !hasImportableExplorePlace && !hasImportableNote) {
    return null;
  }

  if (!hasImportableNode && !hasImportableExplorePlace && !hasImportableNote) {
    return null;
  }

  return {
    tripId: input.tripId,
    userId: input.userId,
    nodes: input.localNodes,
    exploreNotes: input.localExploreNotes,
    explorePlaces: input.localExplorePlaces,
    cloudNodeCount: input.cloudNodes.length,
    cloudExploreCount: input.cloudExploreItems.length,
  };
}

function formatRouteSkipMessage(stopCount: number, placeholderCount: number): string | null {
  const parts: string[] = [];
  if (stopCount > 0) {
    parts.push(`${stopCount} stopp saknar position och hoppas över.`);
  }
  if (placeholderCount > 0) {
    parts.push(`${placeholderCount} placeholder saknar exakt plats och hoppas över i ruttberäkningen.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

function buildDayInsight(nodes: ItineraryNode[], route: RouteSummary, budget: BudgetSummary): DayInsightSummary {
  const lodgingNode = nodes.find((node) => node.type === 'lodging' || node.type === 'camping');
  const activityNodes = nodes.filter((node) => node.type === 'activity' || node.type === 'gastronomy' || node.type === 'custom');
  const hasTimedStop = nodes.some((node) => Boolean(node.startsAt));
  const isLongDrive = route.durationSeconds / 3600 >= 5;

  let nextAction = 'Ser planerad ut';
  if (nodes.length === 0) {
    nextAction = 'Lägg till dagens första stopp';
  } else if (!lodgingNode) {
    nextAction = 'Lägg till eller bekräfta boende';
  } else if (budget.missingCostCount > 0) {
    nextAction = 'Fyll i saknade kostnader';
  } else if (!hasTimedStop) {
    nextAction = 'Sätt tider på dagens stopp';
  } else if (isLongDrive) {
    nextAction = 'Kontrollera om körningen bör delas upp';
  }

  return {
    lodgingLabel: lodgingNode ? lodgingNode.title : 'Saknas',
    activitiesLabel: activityNodes.length > 0 ? `${activityNodes.length} planerade` : 'Inga än',
    driveLabel: route.distanceMeters > 0 ? `${formatDistance(route.distanceMeters)} / ${formatDuration(route.durationSeconds)}` : 'Ingen rutt',
    costLabel: budget.missingCostCount > 0 ? `${formatSek(budget.total)} + saknas` : formatSek(budget.total),
    nextAction,
    hasLodging: Boolean(lodgingNode),
    activityCount: activityNodes.length,
    isLongDrive,
    checklist: buildDayChecklist(nodes, route, budget),
    packingItems: buildDayPackingList(nodes, route),
    packedItems: buildPackedItems(nodes),
  };
}

function buildDayChecklist(nodes: ItineraryNode[], route: RouteSummary, budget: BudgetSummary): DayChecklistItem[] {
  const hasLodging = nodes.some((node) => node.type === 'lodging' || node.type === 'camping');
  const allCostsKnown = nodes.length > 0 && budget.missingCostCount === 0;
  const allTimesSet = nodes.length > 0 && nodes.every((node) => Boolean(node.startsAt));
  const allLocationsKnown = nodes.length > 0 && nodes.every((node) => Boolean(node.location));
  const hasReservationInfo = nodes.some((node) => Boolean(formatReservation(node)));
  const driveLooksOk = route.durationSeconds / 3600 < 5;

  return [
    { label: 'Boende eller camping finns', done: hasLodging, action: 'search_lodging' },
    { label: 'Alla kostnader ifyllda', done: allCostsKnown, action: 'edit_cost' },
    { label: 'Tider satta på stoppen', done: allTimesSet, action: 'set_time' },
    { label: 'Adresser/koordinater finns', done: allLocationsKnown, action: 'search_location' },
    { label: 'Bokningsnotis finns', done: hasReservationInfo, action: 'edit_booking' },
    { label: 'Körningen ser rimlig ut', done: driveLooksOk, action: 'split_drive' },
  ];
}

function buildDayPackingList(nodes: ItineraryNode[], route: RouteSummary): string[] {
  const items = new Set<string>(['Vatten', 'Mobilladdare']);
  const combinedText = nodes
    .map((node) => [
      node.type,
      node.title,
      node.notes,
      Array.isArray(node.equipment) ? node.equipment.map((item) => item.name).join(' ') : '',
      JSON.stringify(node.reservation ?? {}),
      JSON.stringify(node.facilities ?? {}),
      JSON.stringify(node.metadata ?? {}),
    ].join(' '))
    .join(' ')
    .toLowerCase();

  const hasNodeType = (type: ItineraryNode['type']) => nodes.some((node) => node.type === type);
  const textIncludes = (...needles: string[]) => needles.some((needle) => combinedText.includes(needle));

  if (hasNodeType('camping') || textIncludes('camping', 'camp', 'talt', 'tält', 'stuga')) {
    ['Tält', 'Sovsäck', 'Pannlampa', 'Kök/matlåda'].forEach((item) => items.add(item));
  }

  if (hasNodeType('lodging') || textIncludes('hotell', 'boende', 'bnb', 'lägenhet', 'lagenhet')) {
    ['Bokningsbekräftelse', 'ID/pass'].forEach((item) => items.add(item));
  }

  if (hasNodeType('activity') || textIncludes('vandring', 'hike', 'trail', 'aktivitet', 'bad', 'strand')) {
    ['Bekväma skor', 'Regnjacka', 'Extra tröja'].forEach((item) => items.add(item));
  }

  if (textIncludes('mtb', 'cykel', 'bike', 'e-bike', 'emtb')) {
    ['Hjälm', 'Cykelladdare', 'Reparationskit'].forEach((item) => items.add(item));
  }

  if (hasNodeType('gastronomy') || textIncludes('restaurang', 'middag', 'lunch', 'frukost')) {
    items.add('Bordsbokning');
  }

  if (route.durationSeconds / 3600 >= 2 || route.distanceMeters >= 100000) {
    ['Snacks', 'Offlinekarta', 'Billaddare'].forEach((item) => items.add(item));
  }

  nodes.forEach((node) => {
    node.equipment?.forEach((equipment) => {
      if (equipment.name.trim()) {
        items.add(equipment.name.trim());
      }
    });
  });

  return Array.from(items).slice(0, 10);
}

function buildPackedItems(nodes: ItineraryNode[]): string[] {
  const packedItems = new Set<string>();
  nodes.forEach((node) => {
    readPackedItems(node).forEach((item) => packedItems.add(item));
  });
  return Array.from(packedItems);
}

function readPackedItems(node: ItineraryNode): string[] {
  const value = node.metadata.packedItems;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function buildDaySmartFlags(nodes: ItineraryNode[], route: RouteSummary, budget: BudgetSummary): string[] {
  const warningCount = analyzeDayWarnings(nodes, route).length;

  if (nodes.length === 0) {
    return ['Tom dag'];
  }


  if (warningCount === 0 && budget.total > 0) {
    return ['Ser planerad ut'];
  }

  return [`Att komplettera (${warningCount})`];
}

function buildBudgetSummary(nodes: ItineraryNode[]): BudgetSummary {
  const categories: BudgetCategories = {
    lodging: 0,
    activity: 0,
    transport: 0,
    food: 0,
    other: 0,
  };
  let missingCostCount = 0;

  nodes.forEach((node) => {
    const breakdown = nodeCostBreakdown(node);
    const nodeTotal = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

    if (!hasKnownNodeCost(node)) {
      missingCostCount += 1;
    }

    categories.lodging += breakdown.lodging;
    categories.activity += breakdown.activity;
    categories.transport += breakdown.transport;
    categories.food += breakdown.food;
    categories.other += breakdown.other;
  });

  const total = Object.values(categories).reduce((sum, value) => sum + value, 0);
  const warnings = buildBudgetWarnings(nodes, total, missingCostCount);

  return {
    total,
    categories,
    missingCostCount,
    warnings,
  };
}

function buildBudgetWarnings(nodes: ItineraryNode[], total: number, missingCostCount: number): string[] {
  const warnings: string[] = [];
  const dayTotals = new Map<string, number>();

  nodes.forEach((node) => {
    const key = node.startsAt ? node.startsAt.slice(0, 10) : 'unscheduled';
    const current = dayTotals.get(key) ?? 0;
    dayTotals.set(key, current + nodeCostTotal(node));
  });

  const mostExpensiveEntry = Array.from(dayTotals.entries()).sort((a, b) => b[1] - a[1])[0];

  if (mostExpensiveEntry && mostExpensiveEntry[1] > 0) {
    const [mostExpensiveDay, mostExpensiveTotal] = mostExpensiveEntry;
    warnings.push(`Dyraste dagen: ${mostExpensiveDay === 'unscheduled' ? 'Generella budgetposter' : formatDateLabel(mostExpensiveDay)} med ${formatSek(mostExpensiveTotal)}.`);
  }

  if (missingCostCount > 0) {
    warnings.push(`${missingCostCount} steg saknar kostnad.`);
  }

  if (total === 0 && !nodes.some(hasKnownNodeCost)) {
    warnings.push('Ingen budget inlagd än. Lägg till kostnader i planeringen för att få totalsummor.');
  }

  return warnings;
}

function nodeCostBreakdown(node: ItineraryNode): BudgetCategories {
  const lodgingCost = parseCostValue(node.metadata.lodgingCostSek);
  const activityCost = parseCostValue(node.metadata.activityCostSek);

  if (hasKnownDetailedNodeCost(node)) {
    return {
      lodging: lodgingCost,
      activity: activityCost,
      transport: 0,
      food: 0,
      other: 0,
    };
  }

  const rawCost = parseCostValue(node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price);
  const empty: BudgetCategories = {
    lodging: 0,
    activity: 0,
    transport: 0,
    food: 0,
    other: 0,
  };

  if (!hasKnownRawNodeCost(node)) {
    return empty;
  }

  const category = budgetCategoryForNode(node);
  return {
    ...empty,
    [category]: rawCost,
  };
}

function nodeCostTotal(node: ItineraryNode): number {
  return Object.values(nodeCostBreakdown(node)).reduce((sum, value) => sum + value, 0);
}

function budgetCategoryForNode(node: ItineraryNode): keyof BudgetCategories {
  switch (node.type) {
    case 'lodging':
    case 'camping':
      return 'lodging';
    case 'activity':
      return 'activity';
    case 'gastronomy':
      return 'food';
    case 'transport':
    case 'fuel':
      return 'transport';
    default:
      return 'other';
  }
}

function formatSek(value: number): string {
  return `${Math.round(value).toLocaleString('sv-SE')} SEK`;
}

function parseTravelerCount(value: string): number {
  const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.min(parsed, 20);
}

function formatPercentage(value: number): string {
  if (value <= 0) {
    return '0 %';
  }

  return `${Math.round(value * 100)} %`;
}

function formatRawNodeCost(node: ItineraryNode): string {
  const cost = node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price;
  if (typeof cost === 'number') {
    return formatKnownCostLabel(String(cost));
  }

  if (typeof cost === 'string') {
    return cost.trim() ? formatKnownCostLabel(cost) : '';
  }

  return '';
}

function formatReservation(node: ItineraryNode): string {
  const details = [
    node.reservation.provider,
    node.reservation.reference,
    node.reservation.siteNumber ? `Site ${node.reservation.siteNumber}` : null,
    node.reservation.accessDetails,
    cleanImportedNoteLines(node.notes),
  ].filter(Boolean);

  return details.join(' / ');
}

function cleanImportedNoteLines(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleanedLines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isImportedNoteLine(line));

  return cleanedLines.length > 0 ? cleanedLines.join('\n') : null;
}

function isImportedNoteLine(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('imported from')
    || normalized.includes('cost from')
    || normalized.includes('excel')
    || normalized.includes('reseplanrare')
    || normalized.includes('laddad fr')
    || normalized.includes('kostnad fr')
  );
}

function cleanItineraryNodeImportNotes(node: ItineraryNode): ItineraryNode {
  const cleanedNotes = cleanImportedNoteLines(node.notes);
  if ((node.notes ?? null) === cleanedNotes) {
    return node;
  }

  return {
    ...node,
    notes: cleanedNotes,
  };
}

function formatDateLabel(dateKey: string): string {
  return formatSafeDateLabel(dateKey);
}

function formatDayKey(dayKey: string): string {
  return dayKey === 'unscheduled' ? 'ej schemalagt' : formatDateLabel(dayKey);
}

function buildNodeFromSeedRow(row: ReseplanrareSeedRow, tripId: string, userId: string): ItineraryNode {
  const now = new Date().toISOString();
  const title = titleFromSeedRow(row);
  const startsAt = row.date ? new Date(`${row.date}T09:00:00`).toISOString() : null;
  const costParts = [row.lodgingCost, row.activityCost, row.cost].filter(Boolean);
  const notes = notesFromSeedRow(row);
  const placeholder = row.placeholderType
    ? placeholderMetadata({
      type: row.placeholderType,
      ...(row.placeholderIntent ? { intent: row.placeholderIntent } : {}),
      ...(row.preferredDriveTimeRange ? { preferredDriveTimeRange: row.preferredDriveTimeRange } : {}),
    })
    : {};

  return {
    id: cryptoRandomId(),
    tripId,
    createdBy: userId,
    type: row.type,
    title,
    notes,
    startsAt,
    endsAt: null,
    timezone: row.date ? 'Europe/Rome' : null,
    location: row.location ?? null,
    sortOrder: row.sourceRow * 100,
    transportMode: 'driving',
    reservation: row.hotel ? { provider: row.hotel } : {},
    equipment: [],
    facilities: {},
    metadata: {
      source: 'current-roadtrip-plan',
      sourceRow: row.sourceRow,
      place: row.place,
      externalRef: row.googlePlaceId ?? null,
      website: row.website ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      hotel: row.hotel ?? null,
      activityName: row.activity ?? null,
      lodgingCostSek: row.lodgingCost ?? null,
      activityCostSek: row.activityCost ?? null,
      costSek: row.cost ?? null,
      cost: costParts.join(' + '),
      ...placeholder,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  };
}

function applySeedRowToExistingNode(node: ItineraryNode, row: ReseplanrareSeedRow): ItineraryNode {
  const seedNode = buildNodeFromSeedRow(row, node.tripId, node.createdBy);
  const nextMetadata = {
    ...node.metadata,
    ...seedNode.metadata,
  };

  return {
    ...node,
    type: seedNode.type,
    title: seedNode.title,
    notes: seedNode.notes ?? node.notes ?? null,
    startsAt: node.startsAt ?? seedNode.startsAt ?? null,
    endsAt: node.endsAt ?? seedNode.endsAt ?? null,
    timezone: node.timezone ?? seedNode.timezone ?? null,
    location: seedNode.location ?? null,
    sortOrder: seedNode.sortOrder,
    transportMode: node.transportMode ?? seedNode.transportMode ?? null,
    reservation: {
      ...node.reservation,
      ...seedNode.reservation,
    },
    metadata: nextMetadata,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    version: node.version + 1,
  };
}

function buildDemoNodeFromSeedRow(row: ReseplanrareSeedRow): ItineraryNode {
  const createdAt = '2026-06-01T00:00:00.000Z';
  return {
    ...buildNodeFromSeedRow(row, demoTrip.id, demoTrip.ownerId),
    id: `00000000-0000-4000-8000-${String(row.sourceRow).padStart(12, '0')}`,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  };
}

function titleFromSeedRow(row: ReseplanrareSeedRow): string {
  return row.title ?? row.activity ?? row.hotel ?? row.place;
}

function notesFromSeedRow(row: ReseplanrareSeedRow): string | null {
  const lines: string[] = [];

  if (row.place && row.place !== titleFromSeedRow(row)) {
    lines.push(row.place);
  }

  if (row.hotel) {
    lines.push(`Hotel: ${row.hotel}`);
  }

  if (row.activity && row.activity !== titleFromSeedRow(row)) {
    lines.push(`Aktivitet: ${row.activity}`);
  }

  if (row.notes) {
    lines.push(row.notes);
  }

  if (row.placeholderIntent) {
    lines.push(`Placeholder: ${row.placeholderIntent}`);
  }

  return lines.length > 0 ? Array.from(new Set(lines)).join('\n') : null;
}

function formatTime(value?: string | null): string {
  return formatTimeLabel(value);
}

function toTimeInput(value: string): string {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildIsoFromInputs(dateValue: string, timeValue: string): string | null {
  if (!dateValue.trim()) {
    return null;
  }

  const time = timeValue.trim() || '09:00';
  const candidate = new Date(`${dateValue.trim()}T${time}:00`);
  if (Number.isNaN(candidate.getTime())) {
    throw new Error('Use date YYYY-MM-DD and time HH:MM.');
  }

  return candidate.toISOString();
}

function setNodeTime(node: ItineraryNode, hour: number): string {
  const baseDate = node.startsAt ? new Date(node.startsAt) : new Date();
  baseDate.setHours(hour, 0, 0, 0);
  return baseDate.toISOString();
}

function cloneItineraryNode(node: ItineraryNode): ItineraryNode {
  return JSON.parse(JSON.stringify(node)) as ItineraryNode;
}

function cryptoRandomId(): string {
  if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f2f6f2',
  },
  screenDark: {
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8e2eb',
    shadowColor: '#0a2540',
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerMobile: {
    alignItems: 'stretch',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'column',
  },
  headerDark: {
    backgroundColor: '#0b0b0b',
    borderBottomColor: '#242424',
  },
  kicker: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#1f2933',
    fontSize: 18,
    fontWeight: '900',
  },
  brandLockup: {
    minWidth: 210,
    flexShrink: 1,
  },
  brandLockupMobile: {
    minWidth: 0,
    width: '100%',
  },
  navLinks: {
    display: 'none',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  navLinksMobile: {
    display: 'flex',
    flex: 0,
    justifyContent: 'flex-start',
    width: '100%',
    gap: 6,
  },
  navTab: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  navTabMobile: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  navTabActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  navLink: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '900',
  },
  navLinkActive: {
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    flexShrink: 1,
    maxWidth: 680,
  },
  headerActionsMobile: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    maxWidth: '100%',
    width: '100%',
    flexWrap: 'wrap',
  },
  headerStatusSummary: {
    minHeight: 36,
    minWidth: 176,
    maxWidth: 230,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  headerStatusSummaryMobile: {
    minWidth: 0,
    maxWidth: '100%',
    width: '100%',
  },
  headerStatusSummaryDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  headerStatusTitle: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '900',
  },
  headerStatusMeta: {
    color: '#425466',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tripStatePill: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 14,
  },
  tripStatePillActive: {
    borderColor: '#8bd8c3',
    backgroundColor: '#ecfdf5',
  },
  tripStateText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tripStateTextActive: {
    color: '#0f766e',
  },
  saveStatePill: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
  },
  saveStatePillSaving: {
    borderColor: '#f59e0b',
    backgroundColor: '#fff7ed',
  },
  saveStatePillSaved: {
    borderColor: '#22c55e',
    backgroundColor: '#ecfdf3',
  },
  saveStatePillError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff1f2',
  },
  saveStateText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '800',
  },
  saveStateTextSaving: {
    color: '#92400e',
  },
  saveStateTextSaved: {
    color: '#166534',
  },
  saveStateTextError: {
    color: '#b91c1c',
  },
  syncButton: {
    backgroundColor: '#0f766e',
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modeButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  modeButtonActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  modeButtonText: {
    color: '#0a2540',
    fontSize: 13,
    fontWeight: '900',
  },
  modeButtonTextActive: {
    color: '#0f766e',
  },
  newTripButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ead29a',
    backgroundColor: 'rgba(255,247,223,0.62)',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  newTripButtonText: {
    color: '#8a4b00',
    fontSize: 13,
    fontWeight: '900',
  },
  undoButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  undoButtonText: {
    color: '#0a2540',
    fontSize: 13,
    fontWeight: '900',
  },
  saveAppButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#0f766e',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveAppButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  mapShell: {
    height: 560,
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#0f2233',
    backgroundColor: '#0f2233',
  },
  mapShellMobile: {
    height: 430,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    width: '100%',
    maxWidth: 1900,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    position: 'relative',
  },
  contentInnerMobile: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backgroundWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 640,
    overflow: 'hidden',
  },
  backgroundTopBand: {
    position: 'absolute',
    left: -80,
    right: -80,
    top: -180,
    height: 420,
    backgroundColor: '#dfeee7',
    transform: [{ rotate: '-4deg' }],
  },
  backgroundWarmBand: {
    position: 'absolute',
    right: -120,
    top: 120,
    width: 520,
    height: 130,
    backgroundColor: 'rgba(245,158,11,0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  tripHero: {
    minHeight: 178,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 20,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#fbf8f0',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5dccd',
    padding: 24,
    shadowColor: '#5f4b32',
    shadowOpacity: 0.06,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  tripHeroCompact: {
    minHeight: 118,
    gap: 14,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowOpacity: 0.035,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  tripHeroMobile: {
    minHeight: 0,
    gap: 12,
    padding: 14,
  },
  heroPlaneOne: {
    position: 'absolute',
    right: -180,
    top: -120,
    width: 560,
    height: 190,
    backgroundColor: 'rgba(15,118,110,0.1)',
    transform: [{ rotate: '-12deg' }],
  },
  heroPlaneTwo: {
    position: 'absolute',
    right: -20,
    bottom: -94,
    width: 520,
    height: 180,
    backgroundColor: 'rgba(245,158,11,0.13)',
    transform: [{ rotate: '-12deg' }],
  },
  heroPlaneThree: {
    position: 'absolute',
    right: 230,
    bottom: -118,
    width: 380,
    height: 160,
    backgroundColor: 'rgba(56,189,248,0.08)',
    transform: [{ rotate: '-12deg' }],
  },
  heroScenicPanel: {
    width: 260,
    minHeight: 130,
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(95,75,50,0.16)',
    backgroundColor: '#d8edf0',
    zIndex: 1,
  },
  heroScenicPanelCompact: {
    width: 156,
    minHeight: 92,
    borderRadius: 14,
  },
  heroScenicSky: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '62%',
    backgroundColor: '#cae5e8',
  },
  heroScenicSun: {
    position: 'absolute',
    right: 26,
    top: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f5b95b',
  },
  heroScenicRidgeBack: {
    position: 'absolute',
    left: -24,
    right: -24,
    bottom: 42,
    height: 72,
    backgroundColor: '#8bb8a8',
    transform: [{ rotate: '-8deg' }],
  },
  heroScenicRidgeFront: {
    position: 'absolute',
    left: -36,
    right: -36,
    bottom: 18,
    height: 70,
    backgroundColor: '#527f69',
    transform: [{ rotate: '7deg' }],
  },
  heroScenicRoad: {
    position: 'absolute',
    left: 96,
    bottom: -14,
    width: 58,
    height: 92,
    borderRadius: 34,
    backgroundColor: 'rgba(42,48,54,0.74)',
    transform: [{ rotate: '8deg' }],
  },
  tripHeroCopy: {
    flex: 1,
    minWidth: 320,
    justifyContent: 'center',
    gap: 10,
    zIndex: 1,
  },
  tripHeroCopyCompact: {
    minWidth: 260,
    gap: 7,
  },
  tripHeroCopyMobile: {
    minWidth: 0,
    width: '100%',
  },
  heroEyebrow: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    maxWidth: 760,
    color: '#1f2933',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  heroTitleCompact: {
    maxWidth: 620,
    fontSize: 24,
    lineHeight: 29,
  },
  heroBody: {
    maxWidth: 660,
    color: '#52616f',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  heroBodyCompact: {
    maxWidth: 560,
    fontSize: 13,
    lineHeight: 19,
  },
  tripRouteLine: {
    alignSelf: 'flex-start',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e1ddd4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  tripRouteText: {
    color: '#1f2933',
    fontSize: 13,
    fontWeight: '900',
  },
  tripRouteArrow: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: '900',
  },
  heroStats: {
    width: 292,
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
    justifyContent: 'center',
    zIndex: 1,
  },
  heroStatsCompact: {
    width: 220,
    gap: 8,
  },
  heroStatsMobile: {
    width: '100%',
  },
  heroStat: {
    flex: 1,
    minWidth: 105,
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e1ddd4',
    padding: 12,
  },
  flowRail: {
    display: 'none',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 10,
    shadowColor: '#0a2540',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  flowRailMobile: {
    display: 'flex',
    alignItems: 'stretch',
  },
  flowStep: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  flowStepActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  flowStepNumber: {
    minWidth: 22,
    minHeight: 22,
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 11,
    color: '#425466',
    backgroundColor: '#edf2f7',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
  },
  flowStepNumberActive: {
    color: '#0a2540',
    backgroundColor: '#ffffff',
  },
  flowStepText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '900',
  },
  flowStepTextActive: {
    color: '#ffffff',
  },
  flowStepConnector: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 2,
  },
  flowCurrentText: {
    marginLeft: 'auto',
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroStatValue: {
    color: '#1f2933',
    fontSize: 19,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dashboardGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    flexWrap: 'nowrap',
    minHeight: 760,
  },
  dashboardGridMobile: {
    flexDirection: 'column',
    gap: 12,
    minHeight: 0,
  },
  workspaceSidebar: {
    width: 220,
    flexShrink: 0,
    gap: 14,
    borderRadius: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,253,248,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 16,
    shadowColor: '#5f4b32',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  workspaceSidebarKicker: {
    color: '#a16207',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  workspaceSidebarTitle: {
    color: '#1f2933',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  workspaceNavList: {
    gap: 5,
  },
  workspaceNavItem: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  workspaceNavItemActive: {
    backgroundColor: '#e2f1eb',
  },
  workspaceNavMarker: {
    width: 4,
    height: 18,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  workspaceNavMarkerActive: {
    backgroundColor: '#0f766e',
  },
  workspaceNavText: {
    color: '#5e6b77',
    fontSize: 13,
    fontWeight: '800',
  },
  workspaceNavTextActive: {
    color: '#0b5f59',
    fontWeight: '900',
  },
  workspaceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(95,75,50,0.14)',
  },
  dayShortcutList: {
    gap: 5,
  },
  dayShortcut: {
    gap: 3,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dayShortcutActive: {
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  dayShortcutTitle: {
    color: '#1f2933',
    fontSize: 12,
    fontWeight: '900',
  },
  dayShortcutTitleActive: {
    color: '#0f766e',
  },
  dayShortcutMeta: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
  },
  dayShortcutMetaActive: {
    color: '#1f2933',
  },
  sidebarStatusCard: {
    marginTop: 'auto',
    gap: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e8df',
    backgroundColor: 'rgba(244,251,247,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sidebarStatusLabel: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sidebarStatusMeta: {
    color: '#52616f',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  sidebarColumn: {
    width: 320,
    flexShrink: 0,
    gap: 12,
  },
  mainColumn: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 12,
  },
  mainColumnMobile: {
    minWidth: 0,
    width: '100%',
    flex: 0,
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  localImportCard: {
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#b9d9d5',
    backgroundColor: '#f3fbf9',
    padding: 18,
  },
  localImportTitle: {
    color: '#0a2540',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  localImportText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  routeView: {
    gap: 14,
    width: '100%',
  },
  workspaceMapContext: {
    width: '45%',
    minWidth: 420,
    maxWidth: 980,
    flexShrink: 0,
    gap: 0,
  },
  workspaceMapContextRoute: {
    width: '50%',
    minWidth: 480,
    maxWidth: 1100,
  },
  workspaceMapContextExpanded: {
    width: '58%',
    minWidth: 560,
    maxWidth: 1240,
  },
  contextMapCard: {
    flex: 1,
    minHeight: 780,
    gap: 10,
    borderRadius: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,253,248,0.7)',
    padding: 10,
    shadowColor: '#5f4b32',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  contextMapHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  mapRailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  contextMapTitle: {
    color: '#0a2540',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  contextMapShell: {
    flex: 1,
    minHeight: 700,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,211,200,0.72)',
    backgroundColor: '#fbfdff',
  },
  contextMapShellExpanded: {
    minHeight: 780,
  },
  contextPanel: {
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(210,199,184,0.5)',
    backgroundColor: 'rgba(255,253,248,0.55)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  contextPanelTitle: {
    color: '#0a2540',
    fontSize: 16,
    fontWeight: '900',
  },
  contextPanelText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  mobileMapContext: {
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 12,
  },
  mobileMapContextTall: {
    minHeight: 340,
  },
  exploreSaveHint: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#fff7df',
    paddingHorizontal: 12,
  },
  exploreSaveHintText: {
    color: '#8a4b00',
    fontSize: 12,
    fontWeight: '900',
  },
  exploreNotesCard: {
    gap: 12,
    borderRadius: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.56)',
    padding: 16,
  },
  exploreSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  exploreSectionTitle: {
    color: '#1f2933',
    fontSize: 18,
    fontWeight: '900',
  },
  exploreSectionMeta: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  exploreNotesInput: {
    minHeight: 110,
    color: '#1f2933',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlignVertical: 'top',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e1ddd4',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exploreNoteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  exploreLocalHint: {
    flex: 1,
    minWidth: 180,
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
  },
  exploreSearchCard: {
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(225,221,212,0.7)',
    backgroundColor: 'rgba(248,250,247,0.72)',
    padding: 16,
  },
  exploreSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  exploreSearchInput: {
    flex: 1,
    minWidth: 220,
    minHeight: 44,
    color: '#1f2933',
    fontSize: 14,
    fontWeight: '800',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e1ddd4',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
  },
  exploreResultGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  exploreBoardSection: {
    gap: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(225,221,212,0.65)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    padding: 16,
  },
  exploreEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    backgroundColor: '#f8faf7',
    padding: 14,
    flexWrap: 'wrap',
  },
  exploreEmptyCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  exploreCategoryBlock: {
    gap: 10,
  },
  exploreCategoryTitle: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  explorePlaceGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  explorePlaceCard: {
    flex: 1,
    minWidth: 240,
    maxWidth: 360,
    gap: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ebe7df',
    backgroundColor: '#fffefa',
    padding: 12,
    shadowColor: '#5f4b32',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  travelPlaceholder: {
    height: 132,
    overflow: 'hidden',
    borderRadius: 16,
    justifyContent: 'space-between',
    padding: 12,
    position: 'relative',
  },
  travelPlaceholderCompact: {
    width: 72,
    height: 72,
    flexShrink: 0,
  },
  travelPlaceholderShape: {
    position: 'absolute',
    right: -22,
    top: -18,
    width: 92,
    height: 92,
    borderRadius: 46,
    opacity: 0.16,
  },
  travelPlaceholderIcon: {
    fontSize: 24,
    fontWeight: '900',
  },
  travelPlaceholderLabel: {
    color: '#52616f',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  explorePlaceBody: {
    gap: 7,
  },
  explorePlaceTitle: {
    color: '#1f2933',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  explorePlaceSubtitle: {
    color: '#52616f',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  explorePlaceDescription: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  exploreChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  exploreTypeChip: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    borderRadius: 999,
    backgroundColor: '#e8f3ee',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  exploreStatusChip: {
    color: '#7a4b00',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    borderRadius: 999,
    backgroundColor: '#fff7df',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  exploreActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  recommendedPlaceRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  recommendedPlaceCard: {
    width: 220,
    maxWidth: '100%',
    gap: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ebe7df',
    backgroundColor: '#fffefa',
    padding: 10,
  },
  recommendedPlaceCopy: {
    gap: 3,
  },
  recommendedPlaceTitle: {
    color: '#1f2933',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  recommendedPlaceMeta: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
  },
  plusButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  plusButtonText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 22,
  },
  routeStage: {
    gap: 12,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 16,
    shadowColor: '#5f4b32',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  routeStageHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    paddingHorizontal: 6,
  },
  routeHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  routeActionButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#e8f3ee',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  routeActionButtonText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
  },
  routeStageKicker: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  routeStageTitle: {
    color: '#1f2933',
    fontSize: 24,
    fontWeight: '900',
  },
  routeBadge: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#f8faf7',
    paddingHorizontal: 14,
  },
  routeBadgeText: {
    color: '#102a43',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  routeStageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    paddingHorizontal: 6,
    paddingBottom: 2,
  },
  routeMapSummaryCard: {
    gap: 10,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(216,226,235,0.72)',
    backgroundColor: 'rgba(248,251,249,0.7)',
    padding: 16,
  },
  routeStageMeta: {
    color: '#52616f',
    fontSize: 13,
    fontWeight: '800',
  },
  routeStopList: {
    gap: 8,
  },
  routeStopItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,229,238,0.75)',
    backgroundColor: 'rgba(251,253,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  routeStopNumber: {
    width: 28,
    height: 28,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a2540',
  },
  routeStopNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  routeStopCopy: {
    flex: 1,
    minWidth: 0,
  },
  routeStopTitle: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
  },
  routeStopMeta: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  mapOverlayPanel: {
    position: 'absolute',
    left: 18,
    top: 18,
    minWidth: 240,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(215,225,234,0.9)',
    padding: 16,
  },
  mapOverlayPanelMobile: {
    left: 10,
    right: 10,
    top: 10,
    minWidth: 0,
    padding: 12,
  },
  mapOverlayKicker: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  mapOverlayTitle: {
    color: '#0a2540',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  mapOverlayMeta: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  mapLayerControls: {
    position: 'absolute',
    right: 18,
    top: 18,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(16,42,67,0.86)',
    padding: 6,
  },
  mapLayerControlsMobile: {
    display: 'none',
  },
  mapLayerChip: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 13,
  },
  mapLayerChipActive: {
    backgroundColor: '#ffffff',
  },
  mapLayerText: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '900',
  },
  mapLayerTextActive: {
    color: '#0a2540',
  },
  mapLegend: {
    position: 'absolute',
    left: 18,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(215,225,234,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mapLegendMobile: {
    left: 10,
    right: 10,
    bottom: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  panelSection: {
    flex: 1,
    minWidth: 300,
    gap: 14,
    backgroundColor: 'rgba(255,253,248,0.72)',
    borderRadius: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 16,
    shadowColor: '#5f4b32',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  overviewFocusGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  overviewFocusCard: {
    flex: 1,
    minWidth: 190,
    minHeight: 116,
    justifyContent: 'space-between',
    borderRadius: 14,
    borderTopWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(235,231,223,0.72)',
    backgroundColor: 'rgba(248,251,249,0.74)',
    padding: 16,
  },
  overviewFocusLabel: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  overviewFocusTitle: {
    color: '#0a2540',
    fontSize: 19,
    fontWeight: '900',
  },
  overviewFocusDetail: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  readinessPanel: {
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(235,231,223,0.7)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    padding: 16,
  },
  readinessPanelReady: {
    borderColor: '#b8ead1',
    backgroundColor: '#f0fbf5',
  },
  readinessHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  readinessNextText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 4,
  },
  readinessTitle: {
    color: '#0a2540',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  readinessNextAction: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  readinessNextLabel: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  readinessNextDetail: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  readinessGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  readinessItem: {
    flex: 1,
    minWidth: 150,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    backgroundColor: '#fff7df',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readinessItemReady: {
    borderColor: '#b8ead1',
    backgroundColor: '#e7f8ef',
  },
  readinessLabel: {
    color: '#7a4b00',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  readinessLabelReady: {
    color: '#076b4d',
  },
  readinessDetail: {
    color: '#0a2540',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 4,
  },
  readinessIssueGroups: {
    gap: 12,
  },
  readinessIssueGroup: {
    gap: 8,
  },
  readinessGroupTitle: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
  },
  readinessIssueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    backgroundColor: '#fffaf0',
    padding: 12,
  },
  readinessIssueCopy: {
    flex: 1,
    minWidth: 160,
    gap: 4,
  },
  readinessIssueLabel: {
    color: '#4f2e00',
    fontSize: 14,
    fontWeight: '900',
  },
  readinessIssueDetail: {
    color: '#7a4b00',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  readinessReadyText: {
    color: '#076b4d',
    fontSize: 13,
    fontWeight: '900',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#b8ead1',
    backgroundColor: '#e7f8ef',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toolSummaryGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  toolSummaryItem: {
    flex: 1,
    minWidth: 210,
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(235,231,223,0.7)',
    backgroundColor: 'rgba(255,254,250,0.68)',
    padding: 14,
  },
  toolSummaryLabel: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  toolSummaryTitle: {
    color: '#0a2540',
    fontSize: 15,
    fontWeight: '900',
  },
  toolSummaryText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  overviewMapCard: {
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,229,238,0.68)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    padding: 14,
  },
  overviewMapHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  overviewMapKicker: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  overviewMapTitle: {
    color: '#0a2540',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
  },
  overviewMapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  overviewMapShell: {
    height: 240,
    minHeight: 220,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: '#fbfdff',
  },
  overviewRouteSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metric: {
    flex: 1,
    minWidth: 150,
    minHeight: 78,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderTopWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dce5ee',
    padding: 16,
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#0a2540',
    fontSize: 18,
    fontWeight: '800',
  },
  budgetTotal: {
    color: '#0a2540',
    fontSize: 24,
    fontWeight: '900',
  },
  budgetHeaderTools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  travelerControl: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  travelerLabel: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  travelerInput: {
    width: 48,
    minHeight: 30,
    color: '#0a2540',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    borderRadius: 999,
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 8,
  },
  budgetGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  singleColumnGrid: {
    flexDirection: 'column',
    width: '100%',
  },
  budgetCard: {
    flex: 1,
    minWidth: 170,
    minHeight: 78,
    justifyContent: 'space-between',
    borderRadius: 12,
    borderTopWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,229,238,0.72)',
    backgroundColor: 'rgba(251,253,255,0.68)',
    padding: 14,
  },
  budgetLabel: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  budgetValue: {
    color: '#0a2540',
    fontSize: 18,
    fontWeight: '900',
  },
  budgetDetail: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  budgetMissingText: {
    color: '#7a4b00',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
    borderRadius: 12,
    backgroundColor: '#fff7df',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  budgetEmptyState: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ebe7df',
    backgroundColor: '#f8faf7',
    padding: 18,
    gap: 6,
  },
  budgetSection: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(235,231,223,0.64)',
    backgroundColor: 'rgba(255,254,250,0.62)',
    padding: 16,
    gap: 14,
  },
  budgetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  budgetSectionTitle: {
    color: '#0a2540',
    fontSize: 16,
    fontWeight: '900',
  },
  budgetSectionMeta: {
    color: '#60758a',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  budgetCategoryList: {
    gap: 10,
  },
  budgetCategoryRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(248,251,253,0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(227,237,245,0.72)',
    padding: 12,
  },
  budgetCategoryText: {
    flex: 1,
    minWidth: 140,
    gap: 4,
  },
  budgetCategoryLabel: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
  },
  budgetCategoryMeta: {
    color: '#60758a',
    fontSize: 12,
    fontWeight: '800',
  },
  budgetCategoryAmountWrap: {
    minWidth: 120,
    alignItems: 'flex-end',
    gap: 8,
  },
  budgetCategoryAmount: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
  },
  budgetProgressTrack: {
    width: 108,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#dce5ee',
  },
  budgetProgressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#f6b35f',
  },
  budgetDayList: {
    gap: 10,
  },
  budgetDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(227,237,245,0.72)',
    backgroundColor: 'rgba(251,253,255,0.62)',
    padding: 12,
  },
  budgetDayCopy: {
    flex: 1,
    minWidth: 160,
    gap: 4,
  },
  budgetDayTitle: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
  },
  budgetDayMeta: {
    color: '#60758a',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  budgetDayStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  budgetDayTotal: {
    color: '#0a2540',
    fontSize: 15,
    fontWeight: '900',
  },
  missingCostList: {
    gap: 10,
  },
  missingCostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    backgroundColor: '#fffaf0',
    padding: 12,
  },
  missingCostCopy: {
    flex: 1,
    minWidth: 160,
    gap: 4,
  },
  missingCostTitle: {
    color: '#4f2e00',
    fontSize: 14,
    fontWeight: '900',
  },
  missingCostMeta: {
    color: '#7a4b00',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  budgetReadyText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#b9eee7',
    backgroundColor: '#ecfdf9',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  overviewMeta: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '900',
  },
  warningList: {
    gap: 8,
  },
  warningText: {
    color: '#7a4b00',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    backgroundColor: '#fff7df',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  validationText: {
    color: '#b42318',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 6,
  },
  editorActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  typeChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeChip: {
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
  },
  typeChipActive: {
    borderColor: '#102a43',
    backgroundColor: '#102a43',
  },
  typeChipText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  typeChipTextActive: {
    color: '#ffffff',
  },
  sectionTitle: {
    color: '#0a2540',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionHeaderRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  plannerSearchWrap: {
    flex: 1,
    minWidth: 260,
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plannerSearchInput: {
    flex: 1,
    minHeight: 40,
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '700',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  clearSearchButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 13,
  },
  clearSearchText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
  },
  searchResultText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  emptySearchState: {
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: '#fbfdff',
    padding: 16,
  },
  emptySearchTitle: {
    color: '#0a2540',
    fontSize: 15,
    fontWeight: '900',
  },
  emptySearchText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  emptyTripState: {
    gap: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f0d9a3',
    backgroundColor: '#fff8e8',
    padding: 22,
  },
  emptyTripTitle: {
    color: '#1f2933',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  emptyTripText: {
    maxWidth: 720,
    color: '#5f5142',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  dayTripSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  planningStatusCard: {
    gap: 9,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(207,232,223,0.72)',
    backgroundColor: 'rgba(244,251,247,0.58)',
    padding: 12,
  },
  planningStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  planningStatusTitle: {
    color: '#0a2540',
    fontSize: 15,
    fontWeight: '900',
  },
  planningStatusSubtitle: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 3,
  },
  planningStatusList: {
    gap: 8,
  },
  planningStatusRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(219,233,226,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  planningStatusItemText: {
    flex: 1,
    minWidth: 220,
    color: '#1f2933',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  planningStatusReadyText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  daySelectorRail: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  unscheduledDaySection: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(95,75,50,0.14)',
    paddingTop: 12,
  },
  unscheduledDayLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  addDayPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(207,232,223,0.72)',
    backgroundColor: 'rgba(246,251,248,0.62)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addDayCopy: {
    flex: 1,
    minWidth: 220,
  },
  addDayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  daySelectorCard: {
    flex: 1,
    minWidth: 170,
    gap: 6,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(225,221,212,0.68)',
    backgroundColor: 'rgba(255,255,255,0.54)',
    padding: 13,
    shadowColor: '#5f4b32',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  daySelectorCardActive: {
    borderColor: '#0f766e',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  unscheduledDayCard: {
    maxWidth: 420,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  daySelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  daySelectorTitle: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
  },
  daySelectorTitleActive: {
    color: '#0f766e',
  },
  daySelectorCount: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  daySelectorCountActive: {
    color: '#0f766e',
  },
  daySelectorDate: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '800',
  },
  daySelectorDateActive: {
    color: '#0f766e',
  },
  daySelectorRoute: {
    color: '#0a2540',
    fontSize: 13,
    fontWeight: '800',
  },
  daySelectorRouteActive: {
    color: '#1f2933',
  },
  daySelectorMissing: {
    alignSelf: 'flex-start',
    color: '#8a4b00',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    borderRadius: 999,
    backgroundColor: '#fff7df',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  daySelectorReady: {
    color: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  selectedDaySummary: {
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(207,232,223,0.72)',
    backgroundColor: 'rgba(243,251,248,0.58)',
    padding: 14,
  },
  selectedDayMetricRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  dayGroup: {
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(235,231,223,0.66)',
    padding: 14,
    overflow: 'visible',
  },
  dayInlineEditor: {
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 12,
  },
  dayPlaceSearch: {
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 12,
  },
  placeResultList: {
    gap: 8,
  },
  coordinateWarningBox: {
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    backgroundColor: '#fff9eb',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  coordinateSearchPanel: {
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: '#ffffff',
    padding: 10,
  },
  coordinateSearchInput: {
    minHeight: 40,
    minWidth: 180,
    flex: 1,
    color: '#0a2540',
    fontSize: 13,
    backgroundColor: '#fbfdff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    paddingHorizontal: 12,
  },
  dayNextStepPanel: {
    alignSelf: 'flex-start',
    gap: 7,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e8d5a5',
    backgroundColor: '#fff9eb',
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginTop: 8,
  },
  dayNextStepLabel: {
    color: '#8a4b00',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dayInsightGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  dayInsightCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(216,226,235,0.72)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayInsightGood: {
    borderColor: '#b8ead1',
    backgroundColor: '#f0fbf5',
  },
  dayInsightWarn: {
    borderColor: '#ffe3a3',
    backgroundColor: '#fff9eb',
  },
  dayInsightLabel: {
    color: '#425466',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dayInsightValue: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
  },
  dayNextAction: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#b8ead1',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dayChecklist: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    backgroundColor: '#fff9eb',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  checkItemDone: {
    borderColor: '#b8ead1',
    backgroundColor: '#f0fbf5',
  },
  checkItemStatic: {
    opacity: 0.85,
  },
  checkMark: {
    color: '#7a4b00',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  checkMarkDone: {
    color: '#076b4d',
  },
  checkLabel: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '800',
  },
  checkActionText: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  packingPanel: {
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e5f2',
    backgroundColor: '#f7fbff',
    padding: 12,
  },
  packingTitle: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  packingList: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  packingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e5f2',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  packingChipDone: {
    backgroundColor: '#f0fbf5',
    borderColor: '#b8ead1',
  },
  packingChipText: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  packingChipTextDone: {
    color: '#076b4d',
  },
  packingChipLabel: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '800',
  },
  packingAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  packingInput: {
    flex: 1,
    minWidth: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e5f2',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    color: '#0a2540',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  advancedEditorGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  dayHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    gap: 12,
    flexWrap: 'wrap',
  },
  dayHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayTitle: {
    color: '#0a2540',
    fontSize: 16,
    fontWeight: '900',
  },
  timelineItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(225,221,212,0.7)',
    padding: 14,
    overflow: 'visible',
    shadowColor: '#5f4b32',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  timelineItemMenuOpen: {
    zIndex: 1000,
    elevation: 20,
  },
  timelineItemEditing: {
    borderColor: '#0f766e',
    backgroundColor: '#f3fbf7',
  },
  timeRail: {
    width: 62,
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '900',
  },
  nodeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  timelineCopy: {
    flex: 1,
  },
  stopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemTitle: {
    color: '#0a2540',
    fontSize: 16,
    fontWeight: '900',
  },
  itemMeta: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  itemMetaStrong: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  nodeInfoPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  quickCellGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 7,
  },
  quickCell: {
    minWidth: 150,
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e5f2',
    borderRadius: 12,
    backgroundColor: '#fbfdff',
    color: '#0a2540',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '800',
  },
  quickCellTitle: {
    minWidth: 220,
    fontSize: 15,
    backgroundColor: '#ffffff',
  },
  quickCellSmall: {
    minWidth: 90,
    maxWidth: 130,
    flexGrow: 0,
  },
  quickCellDate: {
    minWidth: 130,
    maxWidth: 155,
    flexGrow: 0,
  },
  quickTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  quickTypeChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e5f2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  quickTypeChipActive: {
    borderColor: '#102a43',
    backgroundColor: '#eef3f6',
  },
  quickTypeChipText: {
    color: '#425466',
    fontSize: 11,
    fontWeight: '900',
  },
  quickTypeChipTextActive: {
    color: '#102a43',
  },
  nodeInfoPill: {
    color: '#425466',
    fontSize: 11,
    fontWeight: '800',
    borderRadius: 999,
    backgroundColor: '#fbfdff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  commandInput: {
    minHeight: 88,
    color: '#0a2540',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
    backgroundColor: '#fbfdff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  singleLineInput: {
    minHeight: 42,
    color: '#0a2540',
    fontSize: 14,
    backgroundColor: '#fbfdff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    paddingHorizontal: 12,
  },
  coordinateInput: {
    minHeight: 42,
    minWidth: 140,
    flex: 1,
    color: '#0a2540',
    fontSize: 14,
    backgroundColor: '#fbfdff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    paddingHorizontal: 12,
  },
  commandButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#0f766e',
    borderRadius: 999,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  secondaryButton: {
    backgroundColor: '#102a43',
    borderRadius: 999,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  shareCodeBox: {
    minHeight: 40,
    minWidth: 132,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8e2eb',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 12,
  },
  shareCodeBoxDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  shareLinkText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  codeText: {
    color: '#0a2540',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3ebf2',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  memberName: {
    flex: 1,
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '800',
  },
  memberRole: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  commandButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  placeItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 12,
  },
  smallButton: {
    backgroundColor: '#0f766e',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondarySmallButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e8df',
    backgroundColor: '#f3fbf8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  secondarySmallButtonText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  ghostSmallButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostSmallButtonText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '900',
  },
  dangerButton: {
    backgroundColor: '#df1b41',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  panelDark: {
    backgroundColor: '#111111',
    borderColor: '#2a2a2a',
  },
  innerPanelDark: {
    backgroundColor: '#171717',
    borderColor: '#2f2f2f',
  },
  inputDark: {
    backgroundColor: '#171717',
    borderColor: '#333333',
    color: '#f5f5f4',
  },
  textDark: {
    color: '#f5f5f4',
  },
  textMutedDark: {
    color: '#a8a29e',
  },
  disabledButton: {
    opacity: 0.62,
  },
});
