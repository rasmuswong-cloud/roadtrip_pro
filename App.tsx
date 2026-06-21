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
import { NavigationMap } from '@/components/map/NavigationMap';
import DayCard from '@/components/planning/DayCard';
import { reseplanrareIdeaPlaces, reseplanrareSeedRows, type ReseplanrareSeedRow } from '@/data/reseplanrareSeed';
import type { BudgetCategories, BudgetSummary, DayChecklistItem, DayInsightSummary, DayPlan, Expense, ItineraryNode, ItineraryNodeType, Poi, RouteSummary, Trip } from '@/models';
import { getCurrentUser, getOrCreateAnonymousUser, sendMagicLink, signOut } from '@/services/auth/authService';
import { applyConfirmedMutationPlan } from '@/services/ai/applyMutationPlan';
import { parseItineraryCommand } from '@/services/ai/agent';
import type { ItineraryMutationPlan } from '@/services/ai/itineraryMutationSchema';
import { upsertPoi } from '@/services/database/poiRepository';
import { ensureUserProfile } from '@/services/database/profileRepository';
import {
  createTripShareCode,
  deleteItineraryNode,
  ensureFirstTrip,
  joinTripByShareCode,
  listItineraryNodes,
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
import { analyzeDayWarnings, moveNodeToDay, summarizeDay, validatePlannerDraft, type DaySummary } from '@/services/planning/dayAnalysis';
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
import { estimateRouteSummary } from '@/services/routing/routeEstimate';
import { useTripStore } from '@/store/tripStore';
import { formatDistance, formatDuration } from '@/utils/formatters';

const PERSISTED_APP_STATE_KEY = 'roadtrip:persisted-app-state:v1';

type PersistedAppState = {
  itineraryNodes: ItineraryNode[];
  travelerCountText: string;
  isEditMode: boolean;
};

type OnlineSaveState = 'idle' | 'saving' | 'saved' | 'error';

type UndoSnapshot = {
  label: string;
  itineraryNodes: ItineraryNode[];
};

type AppView = 'overview' | 'route' | 'budget' | 'days' | 'tools';

const appTabs: { key: AppView; label: string }[] = [
  { key: 'overview', label: 'Översikt' },
  { key: 'route', label: 'Rutt' },
  { key: 'budget', label: 'Budget' },
  { key: 'days', label: 'Dagar' },
  { key: 'tools', label: 'Verktyg' },
];

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

const demoRoute: RouteSummary = {
  distanceMeters: 1_920_000,
  durationSeconds: 76_800,
  provider: 'mapbox',
  geometry: {
    type: 'LineString',
    coordinates: reseplanrareSeedRows
      .filter((row) => row.location)
      .map((row) => [row.location!.longitude, row.location!.latitude]),
  },
  instructions: [],
};

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

function isPersistedAppState(value: unknown): value is PersistedAppState {
  if (
    !isRecord(value)
    || !Array.isArray(value.itineraryNodes)
    || typeof value.travelerCountText !== 'string'
    || (value.isEditMode !== undefined && typeof value.isEditMode !== 'boolean')
  ) {
    return false;
  }

  return value.itineraryNodes.every(isPersistedItineraryNode);
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

function formatOnlineSaveLabel(state: OnlineSaveState, lastSavedAt: string | null, hasActiveTrip: boolean): string {
  if (!hasActiveTrip) {
    return 'Lokalt sparat';
  }

  if (state === 'saving') {
    return 'Sparar online...';
  }

  if (state === 'error') {
    return 'Ej sparat online';
  }

  if (state === 'saved' && lastSavedAt) {
    return `Sparat online ${formatShortTime(lastSavedAt)}`;
  }

  return 'Online redo';
}

function formatShortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
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
  const [placeQuery, setPlaceQuery] = useState('camping nära Cortina');
  const [activePlaceDayKey, setActivePlaceDayKey] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<GooglePlace[]>([]);
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [itineraryNodes, setItineraryNodes] = useState<ItineraryNode[]>(() => initialPersistedState?.itineraryNodes ?? []);
  const [latestAiPlan, setLatestAiPlan] = useState<ItineraryMutationPlan | null>(null);
  const [selectedPlannerNodeId, setSelectedPlannerNodeId] = useState<string | null>(null);
  const [draftPlannerDayKey, setDraftPlannerDayKey] = useState<string | null>(null);
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
  const [travelerCountText, setTravelerCountText] = useState(() => initialPersistedState?.travelerCountText ?? '2');
  const [packingDraftByDay, setPackingDraftByDay] = useState<Record<string, string>>({});
  const [hasLoadedPersistentState, setHasLoadedPersistentState] = useState(false);
  const [onlineSaveState, setOnlineSaveState] = useState<OnlineSaveState>('idle');
  const [lastOnlineSavedAt, setLastOnlineSavedAt] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const movingStopIdsRef = useRef<Set<string>>(new Set());
  const inlineSaveInFlightRef = useRef(false);
  const [activeInlineEdit, setActiveInlineEdit] = useState<ActiveInlineEdit>(null);
  const [activeInlineDraftChanged, setActiveInlineDraftChanged] = useState(false);
  const [inlineEditMessage, setInlineEditMessage] = useState<string | null>(null);
  const [coordinateSearchNodeId, setCoordinateSearchNodeId] = useState<string | null>(null);
  const [coordinateSearchQuery, setCoordinateSearchQuery] = useState('');
  const [coordinateSearchResults, setCoordinateSearchResults] = useState<GooglePlace[]>([]);
  const [coordinateSearchMessage, setCoordinateSearchMessage] = useState<string | null>(null);
  const { activeTripId, setActiveTrip, upsertTrip, upsertPoi: upsertPoiInStore } = useTripStore();

  const displayedNodes = itineraryNodes.length > 0 ? itineraryNodes : demoNodes;
  const isDemoMode = !isEditMode;
  const routeSummary = useMemo(() => estimateRouteSummary(displayedNodes), [displayedNodes]);
  const dayPlans = useMemo(() => buildDayPlans(displayedNodes), [displayedNodes]);
  const dayMoveTargets = useMemo(() => dayPlans
    .filter((dayPlan) => dayPlan.key !== 'unscheduled')
    .map((dayPlan) => ({ key: dayPlan.key, title: dayPlan.title })), [dayPlans]);
  const filteredDayPlans = useMemo(() => filterDayPlans(dayPlans, plannerSearchText), [dayPlans, plannerSearchText]);
  const filteredStopCount = useMemo(() => filteredDayPlans.reduce((count, dayPlan) => count + dayPlan.nodes.length, 0), [filteredDayPlans]);
  const budgetSummary = useMemo(() => buildBudgetSummary(displayedNodes), [displayedNodes]);
  const bulkCoordinateCandidates = useMemo(() => getBulkCoordinateCandidates(displayedNodes), [displayedNodes]);
  const missingCoordinateCount = bulkCoordinateCandidates.length;
  const missingBookingCount = useMemo(() => countMissingBookingReferences(displayedNodes), [displayedNodes]);
  const tripReadiness = useMemo(() => buildTripReadiness({
    stopCount: displayedNodes.length,
    missingCoordinateCount,
    missingCostCount: budgetSummary.missingCostCount,
    missingBookingCount,
  }), [displayedNodes.length, missingCoordinateCount, budgetSummary.missingCostCount, missingBookingCount]);
  const firstRouteStop = displayedNodes[0] ?? null;
  const lastRouteStop = displayedNodes[displayedNodes.length - 1] ?? null;
  const totalSpend = budgetSummary.total;
  const travelerCount = parseTravelerCount(travelerCountText);
  const costPerTraveler = travelerCount > 0 ? totalSpend / travelerCount : totalSpend;
  const costPerDay = dayPlans.length > 0 ? totalSpend / dayPlans.length : totalSpend;
  const onlineSaveLabel = formatOnlineSaveLabel(onlineSaveState, lastOnlineSavedAt, Boolean(activeTripId));

  useEffect(() => {
    setHasLoadedPersistentState(true);
    if (initialPersistedState?.itineraryNodes.length) {
      setStatusMessage(`Återställde ${initialPersistedState.itineraryNodes.length} sparade stopp från denna enhet.`);
    }
  }, [initialPersistedState]);

  useEffect(() => {
    if (!hasLoadedPersistentState) {
      return;
    }

    savePersistedAppState({
      itineraryNodes,
      travelerCountText,
      isEditMode,
    });
  }, [hasLoadedPersistentState, itineraryNodes, travelerCountText, isEditMode]);

  useEffect(() => {
    void connectSupabaseTrip();
  }, []);

  function toggleEditMode() {
    setIsEditMode((current) => {
      const next = !current;
      savePersistedAppState({
        itineraryNodes,
        travelerCountText,
        isEditMode: next,
      });
      setStatusMessage(next ? 'Redigeringsläge på. Ändringar sparas när du sparar fälten.' : 'Redigeringsläge av.');
      return next;
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
    });
    setStatusMessage('Appen sparad. Nästa gång öppnas samma plan och läge.');
  }

  function markOnlineSaveStart() {
    if (activeTripId) {
      setOnlineSaveState('saving');
    }
  }

  function markOnlineSaveSuccess() {
    setOnlineSaveState('saved');
    setLastOnlineSavedAt(new Date().toISOString());
  }

  function markOnlineSaveError() {
    setOnlineSaveState('error');
  }

  async function saveItineraryNodeOnline(node: ItineraryNode): Promise<ItineraryNode> {
    markOnlineSaveStart();

    try {
      const savedNode = await upsertItineraryNode(node);
      markOnlineSaveSuccess();
      return savedNode;
    } catch (error) {
      markOnlineSaveError();
      throw error;
    }
  }

  async function deleteItineraryNodeOnline(nodeId: string): Promise<void> {
    markOnlineSaveStart();

    try {
      await deleteItineraryNode(nodeId);
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
    if (!activeTripId) {
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
      await Promise.all([...changedRestoredNodes, ...nodesToDelete].map(upsertItineraryNode));
      markOnlineSaveSuccess();
    } catch (error) {
      markOnlineSaveError();
      throw error;
    }
  }

  async function connectSupabaseTrip() {
    setIsLoading(true);
    setStatusMessage('Ansluter resan...');

    try {
      const existingUser = await getCurrentUser();
      const user = existingUser ?? (await getOrCreateAnonymousUser());

      setUserId(user.id);
      await ensureUserProfile(user.id, user.email ?? 'Reseplanerare');
      const trip = await ensureFirstTrip(user.id);
      const nodes = await listItineraryNodes(trip.id);
      const cleanedNodes = await cleanLoadedNodesOnline(nodes);

      upsertTrip(trip);
      setActiveTrip(trip.id);
      setItineraryNodes(cleanedNodes);
      markOnlineSaveSuccess();
      setStatusMessage(`Ansluten: ${trip.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
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
      setGeneratedShareCode('');
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
    setStatusMessage('Skapar delningskod...');

    try {
      const code = await createTripShareCode(activeTripId);
      setGeneratedShareCode(code);
      setStatusMessage(`Delningskod skapad: ${code}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function copyShareCode() {
    if (!generatedShareCode) {
      setStatusMessage('Skapa en delningskod först.');
      return;
    }

    try {
      if ('navigator' in globalThis && globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(generatedShareCode);
        setStatusMessage(`Kopierade delningskod: ${generatedShareCode}`);
        return;
      }

      setStatusMessage(`Markera och kopiera koden: ${generatedShareCode}`);
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
      const nodes = await listItineraryNodes(trip.id);
      const cleanedNodes = await cleanLoadedNodesOnline(nodes);
      setUserId(user.id);
      upsertTrip(trip);
      setActiveTrip(trip.id);
      setItineraryNodes(cleanedNodes);
      setShareCode('');
      markOnlineSaveSuccess();
      setStatusMessage(`Gick med i: ${trip.name}`);
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

    if (!userId) {
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
      const result = await applyConfirmedMutationPlan(latestAiPlan, userId, {
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
      await deleteItineraryNodeOnline(nodeId);
      setItineraryNodes((current) => current.filter((node) => node.id !== nodeId));
      if (selectedPlannerNodeId === nodeId) {
        clearPlannerEditor();
      }
      setStatusMessage('Stopp borttaget.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
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
    markOnlineSaveStart();

    try {
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

    if (!activeTripId || itineraryNodes.length === 0) {
      setStatusMessage('Anslut resan innan du flyttar stopp mellan dagar.');
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
      const savedNode = await saveItineraryNodeOnline(movedNode);
      setItineraryNodes((current) => sortNodes(current.map((node) => (node.id === savedNode.id ? savedNode : node))));
      if (selectedPlannerNodeId === savedNode.id) {
        populatePlannerEditor(savedNode);
      }
      setStatusMessage(`Flyttade ${savedNode.title} till ${formatDayKey(targetDayKey)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Kunde inte flytta stoppet. Planen är oförändrad. ${message}`);
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

  function populatePlannerEditor(node: ItineraryNode) {
    setSelectedPlannerNodeId(node.id);
    setDraftPlannerDayKey(null);
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

  function startNewPlannerStep(dayKey: string) {
    clearPlannerEditor();
    setDraftPlannerDayKey(dayKey);
    setPlannerDate(dayKey === 'unscheduled' ? '' : dayKey);
    setStatusMessage('Fyll i det nya steget direkt i dagen och tryck Lägg till.');
  }

  function startPlaceSearch(dayKey: string, suggestedQuery?: string) {
    setActivePlaceDayKey(dayKey);
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
    const missingCostNode = dayPlan.nodes.find((node) => nodeCostTotal(node) <= 0);
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
      const savedNode = await saveItineraryNodeOnline(nextNode);

      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      if (selectedPlannerNodeId === savedNode.id) {
        populatePlannerEditor(savedNode);
      }
      setStatusMessage(`Sparade ${inlineFieldLabel(field)}: ${String(value ?? '').trim() || 'tomt'}`);
      setActiveInlineDraftChanged(false);
      setInlineEditMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(message || 'Kunde inte spara fältet.');
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
    if (!activeTripId || !userId) {
      setCoordinateSearchMessage('Tryck Anslut innan du uppdaterar kartpositionen.');
      return;
    }

    const poi = googlePlaceToPoi(place, activeTripId, userId);
    if (!poi) {
      setCoordinateSearchMessage('Den valda platsen saknar koordinater.');
      return;
    }

    rememberUndo('uppdatera kartposition');
    setIsLoading(true);
    setCoordinateSearchMessage(null);
    setStatusMessage(`Uppdaterar kartposition för ${node.title}...`);

    try {
      const savedPoi = await upsertPoi(poi);
      const savedNode = await saveItineraryNodeOnline(applyGooglePlaceCoordinateUpdate(node, place, savedPoi.id));

      upsertPoiInStore(savedPoi);
      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      if (selectedPlannerNodeId === savedNode.id) {
        populatePlannerEditor(savedNode);
      }
      setCoordinateSearchNodeId(null);
      setCoordinateSearchQuery('');
      setCoordinateSearchResults([]);
      setCoordinateSearchMessage(null);
      setStatusMessage(`Kartposition uppdaterad: ${savedPoi.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCoordinateSearchMessage(message || 'Kunde inte uppdatera kartpositionen.');
      setStatusMessage(message || 'Kunde inte uppdatera kartpositionen.');
    } finally {
      setIsLoading(false);
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
      }

      if (plannerPlace.trim()) {
        nextMetadata.place = plannerPlace.trim();
      } else {
        delete nextMetadata.place;
      }

      const savedNode = await saveItineraryNodeOnline({
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
      });

      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      populatePlannerEditor(savedNode);
      setStatusMessage(`Sparade steg: ${savedNode.title}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function addPlannerStep() {
    if (!activeTripId || !userId) {
      setStatusMessage('Anslut innan du lägger till ett steg.');
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

    rememberUndo('lägg till stopp');
    setIsLoading(true);
    setStatusMessage('Lägger till steg...');

    try {
      const latitude = plannerLatitude.trim() ? Number(plannerLatitude.replace(',', '.')) : null;
      const longitude = plannerLongitude.trim() ? Number(plannerLongitude.replace(',', '.')) : null;

      const now = new Date().toISOString();
      const savedNode = await saveItineraryNodeOnline({
        id: cryptoRandomId(),
        tripId: activeTripId,
        createdBy: userId,
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
          cost: plannerCost.trim() || null,
        },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1,
      });

      setItineraryNodes((current) => sortNodes([...current, savedNode]));
      populatePlannerEditor(savedNode);
      setStatusMessage(`Lade till steg: ${savedNode.title}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  function renderPlannerInlineEditor(mode: 'edit' | 'new') {
    return (
      <View style={[styles.dayInlineEditor, isDark && styles.innerPanelDark]}>
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
        <TextInput value={plannerTitle} onChangeText={setPlannerTitle} placeholder="Plats, boende eller aktivitet" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
        <View style={styles.actionRow}>
          <TextInput value={plannerPlace} onChangeText={setPlannerPlace} placeholder="Plats" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
          <TextInput value={plannerCost} onChangeText={setPlannerCost} placeholder="Kostnad" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
        </View>
        <TextInput value={plannerHotelNote} onChangeText={setPlannerHotelNote} placeholder="Hotell / bokning / notis" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
        <TextInput value={plannerNotes} onChangeText={setPlannerNotes} placeholder="Anteckningar" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.commandInput, isDark && styles.inputDark]} multiline />
        <View style={styles.advancedEditorGrid}>
          <TextInput value={plannerLatitude} onChangeText={setPlannerLatitude} placeholder="Latitud" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} inputMode="decimal" />
          <TextInput value={plannerLongitude} onChangeText={setPlannerLongitude} placeholder="Longitud" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} inputMode="decimal" />
        </View>
        <View style={styles.editorActionRow}>
          <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={clearPlannerEditor} disabled={isLoading}>
            <Text style={styles.secondaryButtonText}>Avbryt</Text>
          </Pressable>
          <Pressable
            style={[styles.commandButton, isLoading && styles.disabledButton]}
            onPress={mode === 'new' ? addPlannerStep : savePlannerEdit}
            disabled={isLoading || (mode === 'edit' && !selectedPlannerNodeId)}
          >
            <Text style={styles.commandButtonText}>{mode === 'new' ? 'Lägg till' : 'Spara'}</Text>
          </Pressable>
        </View>
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
    if (!activeTripId || !userId) {
      setStatusMessage('Anslut innan du laddar resplanen.');
      return;
    }

    rememberUndo('ladda resplan');
    setIsLoading(true);
    setStatusMessage('Laddar resplan...');

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
          : buildNodeFromSeedRow(row, activeTripId, userId);
        importedNodes.push(await saveItineraryNodeOnline(nextNode));
      }

      const now = new Date().toISOString();
      const importedNodeIds = new Set(importedNodes.map((node) => node.id));
      const obsoleteNodes = importPlan.obsoleteNodes
        .filter((node) => !importedNodeIds.has(node.id))
        .map((node) => ({
          ...node,
          deletedAt: now,
          updatedAt: now,
          version: node.version + 1,
        }));

      for (const node of obsoleteNodes) {
        await saveItineraryNodeOnline(node);
      }

      const obsoleteNodeIds = new Set(obsoleteNodes.map((node) => node.id));
      setItineraryNodes((current) => sortNodes([
        ...current.filter((node) => !importedNodeIds.has(node.id) && !obsoleteNodeIds.has(node.id)),
        ...importedNodes,
      ]));
      const cleanupText = obsoleteNodes.length > 0 ? ` Rensade ${obsoleteNodes.length} gamla importerade stopp.` : '';
      setStatusMessage(`Laddade ${importedNodes.length} steg till dagplaneringen.${cleanupText} Idéplatser sparade: ${reseplanrareIdeaPlaces.length}.`);
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
            <Text style={[styles.kicker, isDark && styles.textMutedDark]}>ReseApp</Text>
            <Text style={[styles.title, isDark && styles.textDark]}>Roadtrip-planerare</Text>
          </View>
          <View style={[styles.navLinks, isMobile && styles.navLinksMobile]}>
            {appTabs.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.navTab, isMobile && styles.navTabMobile, activeView === tab.key && styles.navTabActive]}
                onPress={() => setActiveView(tab.key)}
              >
                <Text style={[styles.navLink, activeView === tab.key && styles.navLinkActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
            <View style={[styles.headerStatusSummary, isMobile && styles.headerStatusSummaryMobile, isDark && styles.headerStatusSummaryDark]}>
              <Text style={[styles.headerStatusTitle, isDark && styles.textDark]}>{activeTripId ? 'Resan är ansluten' : 'Lokal resa'}</Text>
              <Text style={[styles.headerStatusMeta, isDark && styles.textMutedDark]} numberOfLines={1}>{statusMessage || onlineSaveLabel}</Text>
            </View>
            <Pressable style={[styles.modeButton, isEditMode && styles.modeButtonActive]} onPress={toggleEditMode}>
              <Text style={[styles.modeButtonText, isEditMode && styles.modeButtonTextActive]}>{isEditMode ? 'Redigerar' : 'Redigera'}</Text>
            </Pressable>
            <Pressable style={[styles.syncButton, isLoading && styles.disabledButton]} onPress={connectSupabaseTrip} disabled={isLoading}>
              <Text style={styles.syncButtonText}>{isLoading ? 'Vänta' : activeTripId ? 'Uppdatera' : 'Anslut'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, isMobile && styles.contentInnerMobile]}>
          <View style={[styles.tripHero, isMobile && styles.tripHeroMobile]}>
            <View style={styles.heroPlaneOne} />
            <View style={styles.heroPlaneTwo} />
            <View style={styles.heroPlaneThree} />
            <View style={[styles.tripHeroCopy, isMobile && styles.tripHeroCopyMobile]}>
              <Text style={styles.heroEyebrow}>Roadtrip 2026</Text>
              <Text style={styles.heroTitle}>{demoTrip.name}</Text>
              <Text style={styles.heroBody}>
                Planera stopp, tider, kostnader och packning i samma vy. Allt sparas när resan är ansluten.
              </Text>
            </View>
            <View style={[styles.heroStats, isMobile && styles.heroStatsMobile]}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{displayedNodes.length}</Text>
                <Text style={styles.heroStatLabel}>Stopp</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatDistance(routeSummary.distanceMeters)}</Text>
                <Text style={styles.heroStatLabel}>Rutt</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatDuration(routeSummary.durationSeconds)}</Text>
                <Text style={styles.heroStatLabel}>Körning</Text>
              </View>
            </View>
          </View>

          <View style={[styles.dashboardGrid, isMobile && styles.dashboardGridMobile]}>
            {!isDemoMode && activeView === 'tools' ? (
            <View style={styles.sidebarColumn}>
              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Arbetsläge" dark={isDark} />
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
                <SectionTitle title="Konto" dark={isDark} />
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
                <SectionTitle title="Dela" dark={isDark} />
                <View style={styles.actionRow}>
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={createShareCode} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Skapa kod</Text>
                  </Pressable>
                  <View style={[styles.shareCodeBox, isDark && styles.shareCodeBoxDark]}>
                    <Text style={[styles.codeText, isDark && styles.textDark]} selectable>{generatedShareCode || 'Ingen kod än'}</Text>
                  </View>
                  <Pressable style={[styles.secondaryButton, (!generatedShareCode || isLoading) && styles.disabledButton]} onPress={copyShareCode} disabled={!generatedShareCode || isLoading}>
                    <Text style={styles.secondaryButtonText}>Kopiera</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={shareCode}
                  onChangeText={(value) => setShareCode(normalizeShareCode(value))}
                  placeholder="Klistra in kod"
                  placeholderTextColor={isDark ? '#737373' : '#78716c'}
                  style={[styles.singleLineInput, isDark && styles.inputDark]}
                  autoCapitalize="characters"
                  maxLength={12}
                />
                <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={joinSharedTrip} disabled={isLoading}>
                  <Text style={styles.commandButtonText}>Gå med</Text>
                </Pressable>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Resplan" dark={isDark} />
                <Pressable style={[styles.commandButton, (isLoading || !activeTripId) && styles.disabledButton]} onPress={importReseplanrarePlan} disabled={isLoading || !activeTripId}>
                  <Text style={styles.commandButtonText}>Ladda resplan</Text>
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
                <SectionTitle title="AI-reseassistent" dark={isDark} />
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
              {activeView === 'tools' ? (
                <View style={[styles.panelSection, isDark && styles.panelDark]}>
                  <SectionTitle title="Verktyg" dark={isDark} />
                  <Text style={styles.emptySearchText}>Här finns konto, delning och AI-assistent när redigering är aktiv.</Text>
                </View>
              ) : null}
              {activeView === 'route' ? (
              <View style={styles.routeStage}>
                <View style={styles.routeStageHeader}>
                  <View>
                    <Text style={styles.routeStageKicker}>Interaktiv ruttkarta</Text>
                    <Text style={styles.routeStageTitle}>Ruttkarta</Text>
                  </View>
                  <View style={styles.routeHeaderActions}>
                    {!isDemoMode && missingCoordinateCount > 0 ? (
                      <Pressable
                        style={[styles.routeActionButton, isLoading && styles.disabledButton]}
                        onPress={() => void updateMissingCoordinatesForAllStops()}
                        disabled={isLoading}
                      >
                        <Text style={styles.routeActionButtonText}>Fyll i kartpositioner</Text>
                      </Pressable>
                    ) : null}
                    <View style={styles.routeBadge}>
                      <Text style={styles.routeBadgeText}>{displayedNodes.length} stopp</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.mapShell}>
                  <NavigationMap nodes={displayedNodes} activeRoute={routeSummary.geometry ? routeSummary : demoRoute} followUser={false} />
                  <View style={styles.mapOverlayPanel}>
                    <Text style={styles.mapOverlayKicker}>Aktuell plan</Text>
                    <Text style={styles.mapOverlayTitle}>{demoTrip.name}</Text>
                    <Text style={styles.mapOverlayMeta}>{formatDistance(routeSummary.distanceMeters)} / {formatDuration(routeSummary.durationSeconds)}</Text>
                  </View>
                  <View style={styles.mapLayerControls}>
                    {['Karta', 'Stopp'].map((label, index) => (
                      <View key={label} style={[styles.mapLayerChip, index === 0 && styles.mapLayerChipActive]}>
                        <Text style={[styles.mapLayerText, index === 0 && styles.mapLayerTextActive]}>{label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.mapLegend}>
                    <View style={[styles.legendDot, { backgroundColor: '#635bff' }]} />
                    <Text style={styles.legendText}>planerat stopp</Text>
                    <View style={[styles.legendDot, { backgroundColor: '#00d4ff' }]} />
                    <Text style={styles.legendText}>rutt</Text>
                  </View>
                </View>
                <View style={styles.routeStageFooter}>
                  <Text style={styles.routeStageMeta}>{formatDistance(routeSummary.distanceMeters)} rutt</Text>
                  <Text style={styles.routeStageMeta}>{formatDuration(routeSummary.durationSeconds)} körning</Text>
                  {missingCoordinateCount > 0 ? <Text style={styles.routeStageMeta}>{missingCoordinateCount} saknar kartposition</Text> : null}
                </View>
              </View>
              ) : null}

              {activeView === 'route' ? (
              <View style={[styles.statsRow, isMobile && styles.singleColumnGrid]}>
                <Metric label="Stopp" value={`${displayedNodes.length}`} accent="#0f766e" dark={isDark} />
                <Metric label="Rutt" value={formatDistance(routeSummary.distanceMeters)} accent="#2563eb" dark={isDark} />
                <Metric label="Körning" value={formatDuration(routeSummary.durationSeconds)} accent="#d97706" dark={isDark} />
              </View>
              ) : null}

              {activeView === 'route' ? (
              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <View style={styles.sectionHeaderRow}>
                  <SectionTitle title="Stopp i ordning" dark={isDark} />
                  <Text style={styles.overviewMeta}>{displayedNodes.length} stopp</Text>
                </View>
                <View style={styles.routeStopList}>
                  {displayedNodes.map((node, index) => (
                    <View key={node.id} style={styles.routeStopItem}>
                      <View style={styles.routeStopNumber}>
                        <Text style={styles.routeStopNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.routeStopCopy}>
                        <Text style={styles.routeStopTitle}>{node.title}</Text>
                        <Text style={styles.routeStopMeta}>
                          {[formatDateLabel(node.startsAt?.slice(0, 10) ?? 'unscheduled'), formatTime(node.startsAt), node.location ? 'kartposition klar' : 'saknar kartposition'].filter(Boolean).join(' / ')}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              ) : null}

              {activeView === 'overview' ? (
              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <View style={styles.sectionHeaderRow}>
                  <SectionTitle title="Översikt" dark={isDark} />
                  <Text style={styles.overviewMeta}>{firstRouteStop?.title ?? 'Start'} → {lastRouteStop?.title ?? 'destination'}</Text>
                </View>
                <View style={[styles.overviewFocusGrid, isMobile && styles.singleColumnGrid]}>
                  <OverviewFocusCard
                    label="Plan"
                    title={`${dayPlans.length} dagar`}
                    detail={`${displayedNodes.length} stopp / ${firstRouteStop?.title ?? 'start'} → ${lastRouteStop?.title ?? 'mål'}`}
                    accent="#635bff"
                  />
                  <OverviewFocusCard
                    label="Rutt"
                    title={formatDistance(routeSummary.distanceMeters)}
                    detail={`${formatDuration(routeSummary.durationSeconds)} körning`}
                    accent="#2563eb"
                  />
                  <OverviewFocusCard
                    label="Budget"
                    title={formatSek(totalSpend)}
                    detail={budgetSummary.missingCostCount > 0 ? `${budgetSummary.missingCostCount} stopp saknar kostnad` : `${formatSek(costPerTraveler)} per person`}
                    accent={budgetSummary.missingCostCount > 0 ? '#d97706' : '#0f766e'}
                  />
                </View>
                <View style={styles.readinessPanel}>
                  <View style={styles.readinessHeader}>
                    <View>
                      <Text style={styles.overviewMapKicker}>Resestatus</Text>
                      <Text style={styles.overviewMapTitle}>Planera → Kontrollera → Förfina → Res</Text>
                    </View>
                    <Pressable style={styles.smallButton} onPress={() => setActiveView(tripReadiness.nextStep.target)}>
                      <Text style={styles.smallButtonText}>{tripReadiness.nextStep.label}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.readinessNextText}>{tripReadiness.nextStep.detail}</Text>
                  <View style={[styles.readinessGrid, isMobile && styles.singleColumnGrid]}>
                    {tripReadiness.items.map((item) => (
                      <View key={item.label} style={[styles.readinessItem, item.status === 'ready' && styles.readinessItemReady]}>
                        <Text style={[styles.readinessLabel, item.status === 'ready' && styles.readinessLabelReady]}>{item.label}</Text>
                        <Text style={styles.readinessDetail}>{item.detail}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.overviewMapCard}>
                  <View style={styles.overviewMapHeader}>
                    <View>
                      <Text style={styles.overviewMapKicker}>Kartpreview</Text>
                      <Text style={styles.overviewMapTitle}>Resan på kartan</Text>
                    </View>
                    <View style={styles.overviewMapActions}>
                      <Pressable style={styles.smallButton} onPress={() => setActiveView('route')}>
                        <Text style={styles.smallButtonText}>Visa hela kartan</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.overviewMapShell}>
                    <NavigationMap nodes={displayedNodes} activeRoute={routeSummary.geometry ? routeSummary : demoRoute} followUser={false} compact />
                  </View>
                </View>
              </View>
              ) : null}

              {activeView === 'budget' ? (
              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <View style={styles.sectionHeaderRow}>
                  <SectionTitle title="Budget" dark={isDark} />
                  <View style={styles.budgetHeaderTools}>
                    <Text style={styles.budgetTotal}>{formatSek(totalSpend)}</Text>
                    <View style={styles.travelerControl}>
                      <Text style={styles.travelerLabel}>Personer</Text>
                      <TextInput
                        value={travelerCountText}
                        onChangeText={setTravelerCountText}
                        placeholder="2"
                        placeholderTextColor={isDark ? '#737373' : '#78716c'}
                        style={[styles.travelerInput, isDark && styles.inputDark]}
                        inputMode="numeric"
                      />
                    </View>
                  </View>
                </View>
                <View style={[styles.budgetGrid, isMobile && styles.singleColumnGrid]}>
                  <BudgetCard label="Totalt per person" value={costPerTraveler} detail={`${travelerCount} personer`} accent="#7c3aed" />
                  <BudgetCard label="Snitt per dag" value={costPerDay} detail={`${dayPlans.length} dagar`} accent="#0f766e" />
                  <BudgetCard label="Boende" value={budgetSummary.categories.lodging} detail={formatBudgetShare(budgetSummary.categories.lodging, totalSpend)} accent="#2563eb" />
                  <BudgetCard label="Aktiviteter" value={budgetSummary.categories.activity} detail={formatBudgetShare(budgetSummary.categories.activity, totalSpend)} accent="#d97706" />
                  <BudgetCard label="Transport" value={budgetSummary.categories.transport} detail={formatBudgetShare(budgetSummary.categories.transport, totalSpend)} accent="#00d4ff" />
                  <BudgetCard label="Mat/övrigt" value={budgetSummary.categories.food + budgetSummary.categories.other} detail={formatBudgetShare(budgetSummary.categories.food + budgetSummary.categories.other, totalSpend)} accent="#635bff" />
                </View>
                {budgetSummary.missingCostCount > 0 ? (
                  <Text style={styles.budgetMissingText}>{budgetSummary.missingCostCount} steg saknar kostnad, så totalsumman är troligen för låg.</Text>
                ) : null}
                <View style={styles.warningList}>
                  {budgetSummary.warnings.map((warning) => (
                    <Text key={warning} style={styles.warningText}>{warning}</Text>
                  ))}
                </View>
              </View>
              ) : null}

              {activeView === 'days' ? (
              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <View style={styles.sectionHeaderRow}>
                  <SectionTitle title="Planering dag för dag" dark={isDark} />
                  <View style={styles.plannerSearchWrap}>
                    <TextInput
                      value={plannerSearchText}
                      onChangeText={setPlannerSearchText}
                      placeholder="Sök stopp, plats, datum, pris..."
                      placeholderTextColor={isDark ? '#737373' : '#78716c'}
                      style={[styles.plannerSearchInput, isDark && styles.inputDark]}
                    />
                    {plannerSearchText.trim() ? (
                      <Pressable style={styles.clearSearchButton} onPress={() => setPlannerSearchText('')}>
                        <Text style={styles.clearSearchText}>Rensa</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {!isDemoMode ? (
                    <View style={styles.dayHeaderActions}>
                      <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={() => startPlaceSearch('unscheduled', 'camping')} disabled={isLoading}>
                        <Text style={styles.secondaryButtonText}>Sök plats</Text>
                      </Pressable>
                      <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={() => startNewPlannerStep('unscheduled')} disabled={isLoading}>
                        <Text style={styles.secondaryButtonText}>Nytt oschemalagt steg</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
                {renderDayPlaceSearch('unscheduled')}
                {draftPlannerDayKey === 'unscheduled' ? (
                  <View style={[styles.dayGroup, isDark && styles.innerPanelDark]}>
                    <View style={styles.dayHeader}>
                      <View>
                        <Text style={[styles.dayTitle, isDark && styles.textDark]}>Oschemalagt</Text>
                        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Nytt steg utan datum</Text>
                      </View>
                    </View>
                    {renderPlannerInlineEditor('new')}
                  </View>
                ) : null}
                {plannerSearchText.trim() ? (
                  <Text style={styles.searchResultText}>{filteredStopCount} av {displayedNodes.length} stopp matchar sökningen.</Text>
                ) : null}
                {filteredDayPlans.length === 0 ? (
                  <View style={styles.emptySearchState}>
                    <Text style={styles.emptySearchTitle}>Inga stopp hittades</Text>
                    <Text style={styles.emptySearchText}>Testa ett annat ord, datum, plats eller pris.</Text>
                  </View>
                ) : null}
                {filteredDayPlans.map((dayPlan) => (
                  <DayCard
                    key={dayPlan.key}
                    availableDayTargets={dayMoveTargets}
                    dayPlan={dayPlan}
                    isDark={isDark}
                    isDemoMode={isDemoMode}
                    isLoading={isLoading}
                    activeInlineEdit={activeInlineEdit}
                    inlineEditMessage={inlineEditMessage}
                    coordinateSearchNodeId={coordinateSearchNodeId}
                    coordinateSearchQuery={coordinateSearchQuery}
                    coordinateSearchResults={coordinateSearchResults}
                    coordinateSearchMessage={coordinateSearchMessage}
                    itineraryNodesLength={itineraryNodes.length}
                    packingDraft={packingDraftByDay[dayPlan.key] ?? ''}
                    draftPlannerDayKey={draftPlannerDayKey}
                    styles={styles}
                    renderDayPlaceSearch={renderDayPlaceSearch}
                    renderPlannerInlineEditor={renderPlannerInlineEditor}
                    onStartPlaceSearch={startPlaceSearch}
                    onStartNewPlannerStep={startNewPlannerStep}
                    onRunChecklistAction={runChecklistAction}
                    onTogglePackingItem={togglePackingItem}
                    onAddPackingItem={addPackingItem}
                    onSetPackingDraft={(dayKey: string, text: string) => setPackingDraftByDay((current) => ({ ...current, [dayKey]: text }))}
                    onStartInlineEdit={startInlineEdit}
                    onClearInlineEdit={clearInlineEdit}
                    onInlineDraftChange={setActiveInlineDraftChanged}
                    onSaveInlineField={saveInlineField}
                    onStartCoordinateSearch={startCoordinateSearch}
                    onChangeCoordinateSearchQuery={setCoordinateSearchQuery}
                    onSearchCoordinatePlace={searchCoordinatePlace}
                    onSelectCoordinatePlace={selectCoordinatePlace}
                    onCancelCoordinateSearch={cancelCoordinateSearch}
                    onMoveStop={moveStop}
                    onMoveStopToDay={moveStopToDay}
                    onRemoveStop={removeStop}
                  />
                ))}
              </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Metric({ label, value, accent, dark }: { label: string; value: string; accent: string; dark: boolean }) {
  return (
    <View style={[styles.metric, dark && styles.panelDark, { borderTopColor: accent }]}>
      <Text style={[styles.metricLabel, dark && styles.textMutedDark]}>{label}</Text>
      <Text style={[styles.metricValue, dark && styles.textDark]}>{value}</Text>
    </View>
  );
}

function BudgetCard({ label, value, detail, accent }: { label: string; value: number; detail: string; accent: string }) {
  return (
    <View style={[styles.budgetCard, { borderTopColor: accent }]}>
      <Text style={styles.budgetLabel}>{label}</Text>
      <Text style={styles.budgetValue}>{formatSek(value)}</Text>
      <Text style={styles.budgetDetail}>{detail}</Text>
    </View>
  );
}

function DayInsight({ label, value, tone }: { label: string; value: string; tone: 'good' | 'warn' | 'neutral' }) {
  return (
    <View style={[styles.dayInsightCard, tone === 'good' && styles.dayInsightGood, tone === 'warn' && styles.dayInsightWarn]}>
      <Text style={styles.dayInsightLabel}>{label}</Text>
      <Text style={styles.dayInsightValue}>{value}</Text>
    </View>
  );
}

function OverviewFocusCard({ label, title, detail, accent }: { label: string; title: string; detail: string; accent: string }) {
  return (
    <View style={[styles.overviewFocusCard, { borderTopColor: accent }]}>
      <Text style={styles.overviewFocusLabel}>{label}</Text>
      <Text style={styles.overviewFocusTitle}>{title}</Text>
      <Text style={styles.overviewFocusDetail}>{detail}</Text>
    </View>
  );
}

function SectionTitle({ title, dark }: { title: string; dark: boolean }) {
  return <Text style={[styles.sectionTitle, dark && styles.textDark]}>{title}</Text>;
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

  pills.push(cost || 'Kostnad saknas');

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

function buildDayPlans(nodes: ItineraryNode[]): DayPlan[] {
  const sortedNodes = sortNodes(nodes);
  const groups = new Map<string, ItineraryNode[]>();

  sortedNodes.forEach((node) => {
    const key = node.startsAt ? node.startsAt.slice(0, 10) : 'unscheduled';
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });

  return Array.from(groups.entries()).map(([key, groupNodes], index) => {
    const route = estimateRouteSummary(groupNodes);
    const budget = buildBudgetSummary(groupNodes);
    const insight = buildDayInsight(groupNodes, route, budget);
    const title = key === 'unscheduled' ? 'Oschemalagt' : `Dag ${index + 1} / ${formatDateLabel(key)}`;
    const summary = summarizeDay(groupNodes, key, index + 1);

    return {
      key,
      title,
      shortTitle: key === 'unscheduled' ? 'Oschemalagt' : `Dag ${index + 1}`,
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

function normalizeShareCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
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
  const warningFlags = analyzeDayWarnings(nodes, route)
    .map((warning) => warning.message)
    .slice(0, 5);

  if (nodes.length === 0) {
    return ['Tom dag'];
  }

  if (warningFlags.length === 0 && budget.total > 0) {
    return ['Ser planerad ut'];
  }

  return warningFlags;
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

    if (nodeTotal <= 0) {
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

function countMissingBookingReferences(nodes: ItineraryNode[]): number {
  return nodes.filter((node) => node.type === 'lodging' && !node.reservation.reference).length;
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
    warnings.push(`Dyraste dagen: ${mostExpensiveDay === 'unscheduled' ? 'Oschemalagt' : formatDateLabel(mostExpensiveDay)} med ${formatSek(mostExpensiveTotal)}.`);
  }

  if (missingCostCount > 0) {
    warnings.push(`${missingCostCount} steg saknar kostnad.`);
  }

  if (total === 0) {
    warnings.push('Ingen budget inlagd än. Lägg till kostnader i planeringen för att få totalsummor.');
  }

  return warnings;
}

function nodeCostBreakdown(node: ItineraryNode): BudgetCategories {
  const lodgingCost = parseCostValue(node.metadata.lodgingCostSek);
  const activityCost = parseCostValue(node.metadata.activityCostSek);

  if (lodgingCost > 0 || activityCost > 0) {
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

  if (rawCost <= 0) {
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

function parseCostValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const parts = value.split('+');
  return parts.reduce((sum, part) => sum + parseCostPart(part), 0);
}

function parseCostPart(value: string): number {
  const matches = value.replace(',', '.').match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) {
    return 0;
  }

  const numbers = matches.map(Number).filter(Number.isFinite);
  if (value.includes('-') && numbers.length >= 2) {
    const [low = 0, high = 0] = numbers;
    return (low + high) / 2;
  }

  return numbers.reduce((sum, number) => sum + number, 0);
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

function formatBudgetShare(value: number, total: number): string {
  if (total <= 0 || value <= 0) {
    return '0 % av budget';
  }

  return `${Math.round((value / total) * 100)} % av budget`;
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
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatDayKey(dayKey: string): string {
  return dayKey === 'unscheduled' ? 'oschemalagt' : formatDateLabel(dayKey);
}

function buildNodeFromSeedRow(row: ReseplanrareSeedRow, tripId: string, userId: string): ItineraryNode {
  const now = new Date().toISOString();
  const title = titleFromSeedRow(row);
  const startsAt = row.date ? new Date(`${row.date}T09:00:00`).toISOString() : null;
  const costParts = [row.lodgingCost, row.activityCost].filter(Boolean);
  const notes = notesFromSeedRow(row);

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
      source: 'reseplanrare.xlsx',
      sourceRow: row.sourceRow,
      place: row.place,
      externalRef: row.googlePlaceId ?? null,
      website: row.website ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      lodgingCostSek: row.lodgingCost ?? null,
      activityCostSek: row.activityCost ?? null,
      cost: costParts.join(' + '),
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
  const notes = row.notes ?? node.notes ?? seedNode.notes;

  return {
    ...node,
    type: seedNode.type,
    title: seedNode.title,
    notes: notes ?? null,
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
  if (row.notes) {
    return row.notes;
  }

  const title = titleFromSeedRow(row);
  return row.place !== title ? row.place : null;
}

function formatTime(value?: string | null): string {
  if (!value) {
    return '--:--';
  }

  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
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
    backgroundColor: '#f5f7fa',
  },
  screenDark: {
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e6edf5',
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
    color: '#635bff',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#0a2540',
    fontSize: 22,
    fontWeight: '900',
  },
  brandLockup: {
    minWidth: 230,
  },
  brandLockupMobile: {
    minWidth: 0,
    width: '100%',
  },
  navLinks: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  navLinksMobile: {
    flex: 0,
    justifyContent: 'flex-start',
    width: '100%',
    gap: 6,
  },
  navTab: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navTabMobile: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  navTabActive: {
    backgroundColor: '#0a2540',
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
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: 500,
  },
  headerActionsMobile: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    maxWidth: '100%',
    width: '100%',
  },
  headerStatusSummary: {
    minHeight: 38,
    minWidth: 190,
    maxWidth: 240,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    borderColor: '#00d4ff',
    backgroundColor: '#e7f8ff',
  },
  tripStateText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tripStateTextActive: {
    color: '#0073e6',
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
    backgroundColor: '#0a2540',
    borderRadius: 999,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modeButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 14,
    paddingVertical: 9,
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
    height: 460,
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#101820',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    width: '100%',
    maxWidth: 1500,
    alignSelf: 'center',
    padding: 24,
    gap: 16,
  },
  contentInnerMobile: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tripHero: {
    minHeight: 150,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 18,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 22,
  },
  tripHeroMobile: {
    minHeight: 0,
    gap: 12,
    padding: 14,
  },
  heroPlaneOne: {
    display: 'none',
    position: 'absolute',
    right: -160,
    top: -112,
    width: 560,
    height: 190,
    backgroundColor: '#7a73ff',
    transform: [{ rotate: '-12deg' }],
  },
  heroPlaneTwo: {
    display: 'none',
    position: 'absolute',
    right: 10,
    bottom: -86,
    width: 520,
    height: 180,
    backgroundColor: '#00d4ff',
    transform: [{ rotate: '-12deg' }],
  },
  heroPlaneThree: {
    display: 'none',
    position: 'absolute',
    right: 210,
    bottom: -110,
    width: 380,
    height: 160,
    backgroundColor: '#ffcf5c',
    transform: [{ rotate: '-12deg' }],
  },
  tripHeroCopy: {
    flex: 1,
    minWidth: 320,
    justifyContent: 'center',
    gap: 8,
  },
  tripHeroCopyMobile: {
    minWidth: 0,
    width: '100%',
  },
  heroEyebrow: {
    color: '#635bff',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    maxWidth: 760,
    color: '#0a2540',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  heroBody: {
    maxWidth: 660,
    color: '#425466',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  heroStats: {
    width: 360,
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  heroStatsMobile: {
    width: '100%',
  },
  heroStat: {
    flex: 1,
    minWidth: 105,
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    backgroundColor: '#f6f9fc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    padding: 16,
  },
  heroStatValue: {
    color: '#0a2540',
    fontSize: 19,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: '#425466',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dashboardGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  dashboardGridMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  sidebarColumn: {
    width: 320,
    gap: 12,
  },
  mainColumn: {
    flex: 1,
    minWidth: 520,
    gap: 14,
  },
  mainColumnMobile: {
    minWidth: 0,
    width: '100%',
  },
  routeStage: {
    gap: 12,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#0a2540',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#0a2540',
    padding: 14,
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
    backgroundColor: '#ffffff',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  routeActionButtonText: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '900',
  },
  routeStageKicker: {
    color: '#00d4ff',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  routeStageTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  routeBadge: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#00d4ff',
    paddingHorizontal: 14,
  },
  routeBadgeText: {
    color: '#04243a',
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
  routeStageMeta: {
    color: '#c7d2fe',
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
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  routeStopNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(215,225,234,0.9)',
    padding: 16,
  },
  mapOverlayKicker: {
    color: '#635bff',
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
    backgroundColor: 'rgba(10,37,64,0.82)',
    padding: 6,
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
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(215,225,234,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 16,
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
    borderRadius: 8,
    borderTopWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    backgroundColor: '#f6f9fc',
    padding: 14,
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
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    padding: 14,
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
  },
  readinessGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  readinessItem: {
    flex: 1,
    minWidth: 150,
    borderRadius: 8,
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
  overviewMapCard: {
    gap: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    padding: 12,
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
    color: '#635bff',
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
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
  },
  metric: {
    flex: 1,
    minWidth: 150,
    minHeight: 78,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderTopWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 14,
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
    borderRadius: 8,
    borderTopWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    backgroundColor: '#f6f9fc',
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
    borderColor: '#635bff',
    backgroundColor: '#635bff',
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
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  clearSearchButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
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
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
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
  dayGroup: {
    gap: 12,
    backgroundColor: '#f6f9fc',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 14,
  },
  dayInlineEditor: {
    gap: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  dayPlaceSearch: {
    gap: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  placeResultList: {
    gap: 8,
  },
  coordinateWarningBox: {
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    backgroundColor: '#fff9eb',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  coordinateSearchPanel: {
    gap: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    padding: 10,
  },
  coordinateSearchInput: {
    minHeight: 40,
    minWidth: 180,
    flex: 1,
    color: '#0a2540',
    fontSize: 13,
    backgroundColor: '#f6f9fc',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    paddingHorizontal: 12,
  },
  dayInsightGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  dayInsightCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
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
    color: '#635bff',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
    borderRadius: 8,
    backgroundColor: '#f2f4ff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dfe3ff',
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
    color: '#635bff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  packingPanel: {
    gap: 8,
    borderRadius: 8,
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
    color: '#635bff',
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
    borderRadius: 8,
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
    fontSize: 15,
    fontWeight: '900',
  },
  timelineItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 12,
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
    width: 12,
    height: 12,
    borderRadius: 6,
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
    fontWeight: '800',
  },
  itemMeta: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '700',
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
    borderRadius: 8,
    backgroundColor: '#f7fbff',
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
    borderColor: '#635bff',
    backgroundColor: '#eef4ff',
  },
  quickTypeChipText: {
    color: '#425466',
    fontSize: 11,
    fontWeight: '900',
  },
  quickTypeChipTextActive: {
    color: '#635bff',
  },
  nodeInfoPill: {
    color: '#425466',
    fontSize: 11,
    fontWeight: '800',
    borderRadius: 999,
    backgroundColor: '#f6f9fc',
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
    backgroundColor: '#f6f9fc',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  singleLineInput: {
    minHeight: 42,
    color: '#0a2540',
    fontSize: 14,
    backgroundColor: '#f6f9fc',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    paddingHorizontal: 12,
  },
  coordinateInput: {
    minHeight: 42,
    minWidth: 140,
    flex: 1,
    color: '#0a2540',
    fontSize: 14,
    backgroundColor: '#f6f9fc',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    paddingHorizontal: 12,
  },
  commandButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#635bff',
    borderRadius: 999,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  secondaryButton: {
    backgroundColor: '#0a2540',
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
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 12,
  },
  shareCodeBoxDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  codeText: {
    color: '#0a2540',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
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
    backgroundColor: '#635bff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondarySmallButton: {
    backgroundColor: '#e7ecff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondarySmallButtonText: {
    color: '#635bff',
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
