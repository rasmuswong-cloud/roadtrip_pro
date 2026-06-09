import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationMap } from '@/components/map/NavigationMap';
import { reseplanrareIdeaPlaces, reseplanrareSeedRows, type ReseplanrareSeedRow } from '@/data/reseplanrareSeed';
import type { Expense, ItineraryNode, ItineraryNodeType, Poi, RouteSummary, Trip } from '@/models';
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
  upsertItineraryNode,
} from '@/services/database/tripRepository';
import { googlePlaceToPoi, searchGooglePlaces, type GooglePlace } from '@/services/google/googlePlaces';
import { estimateRouteSummary } from '@/services/routing/routeEstimate';
import { useTripStore } from '@/store/tripStore';
import { formatDistance, formatDuration } from '@/utils/formatters';

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

const demoNodes: ItineraryNode[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    tripId: demoTrip.id,
    createdBy: demoTrip.ownerId,
    type: 'lodging',
    title: 'Natt i München',
    startsAt: new Date().toISOString(),
    endsAt: null,
    timezone: 'Europe/Berlin',
    location: { latitude: 48.1374, longitude: 11.5755 },
    sortOrder: 10,
    transportMode: 'driving',
    reservation: { provider: 'Hotel', reference: 'DEMO-001' },
    equipment: [],
    facilities: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    version: 1,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    tripId: demoTrip.id,
    createdBy: demoTrip.ownerId,
    type: 'camping',
    title: 'Camping i Cortina',
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: null,
    timezone: 'Europe/Rome',
    location: { latitude: 46.5405, longitude: 12.1357 },
    sortOrder: 20,
    transportMode: 'driving',
    reservation: { siteNumber: 'Ej klart', accessDetails: 'Bekräfta ankomsttid före avresa.' },
    equipment: [{ name: 'E-MTB-hyra', quantity: 2 }],
    facilities: { showers: true, electricity: true, water: true },
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    version: 1,
  },
];

const demoRoute: RouteSummary = {
  distanceMeters: 304_000,
  durationSeconds: 12_600,
  provider: 'mapbox',
  geometry: {
    type: 'LineString',
    coordinates: [
      [11.5755, 48.1374],
      [11.7041, 47.8824],
      [11.3922, 47.2692],
      [12.1357, 46.5405],
    ],
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

export default function App() {
  const isDark = false;
  const [command, setCommand] = useState('');
  const [statusMessage, setStatusMessage] = useState('Redo att ansluta resan.');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [generatedShareCode, setGeneratedShareCode] = useState('');
  const [placeQuery, setPlaceQuery] = useState('camping nära Cortina');
  const [placeResults, setPlaceResults] = useState<GooglePlace[]>([]);
  const [savedPois, setSavedPois] = useState<Poi[]>([]);
  const [itineraryNodes, setItineraryNodes] = useState<ItineraryNode[]>([]);
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
  const [stopName, setStopName] = useState('');
  const [stopAddress, setStopAddress] = useState('');
  const [stopLatitude, setStopLatitude] = useState('');
  const [stopLongitude, setStopLongitude] = useState('');
  const [stopNotes, setStopNotes] = useState('');
  const { activeTripId, setActiveTrip, upsertTrip, upsertPoi: upsertPoiInStore } = useTripStore();

  const displayedNodes = itineraryNodes.length > 0 ? itineraryNodes : demoNodes;
  const isDemoMode = !isEditMode;
  const routeSummary = useMemo(() => estimateRouteSummary(displayedNodes), [displayedNodes]);
  const dayPlans = useMemo(() => buildDayPlans(displayedNodes), [displayedNodes]);
  const budgetSummary = useMemo(() => buildBudgetSummary(displayedNodes), [displayedNodes]);
  const totalSpend = budgetSummary.total;

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

      upsertTrip(trip);
      setActiveTrip(trip.id);
      setItineraryNodes(nodes);
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

  async function joinSharedTrip() {
    if (!shareCode.trim()) {
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
      const trip = await joinTripByShareCode(shareCode);
      const nodes = await listItineraryNodes(trip.id);
      setUserId(user.id);
      upsertTrip(trip);
      setActiveTrip(trip.id);
      setItineraryNodes(nodes);
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

    setIsLoading(true);
    setStatusMessage('Söker platser...');

    try {
      const results = await searchGooglePlaces({
        query: placeQuery.trim(),
        center: { latitude: 46.5405, longitude: 12.1357 },
        radiusMeters: 30_000,
      });

      setPlaceResults(results);
      setStatusMessage(`Hittade ${results.length} platser.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function savePlace(place: GooglePlace) {
    if (!activeTripId || !userId) {
      setStatusMessage('Tryck Anslut innan du sparar en plats.');
      return;
    }

    const poi = googlePlaceToPoi(place, activeTripId, userId);
    if (!poi) {
      setStatusMessage('Den här platsen saknar koordinater.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Sparar ${poi.name}...`);

    try {
      const savedPoi = await upsertPoi(poi);
      const node = await createNodeFromPoi(savedPoi);
      upsertPoiInStore(savedPoi);
      setItineraryNodes((current) => sortNodes([...current.filter((candidate) => candidate.id !== node.id), node]));
      setSavedPois((current) => [savedPoi, ...current.filter((candidate) => candidate.id !== savedPoi.id)]);
      setStatusMessage(`Sparade stopp: ${savedPoi.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function createManualStop() {
    if (!activeTripId || !userId) {
      setStatusMessage('Anslut innan du lägger till ett stopp.');
      return;
    }

    const latitude = Number(stopLatitude.replace(',', '.'));
    const longitude = Number(stopLongitude.replace(',', '.'));

    if (!stopName.trim() || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setStatusMessage('Stoppet behöver namn samt giltig latitud och longitud.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Sparar stopp...');

    try {
      const now = new Date().toISOString();
      const node = await upsertItineraryNode({
        id: cryptoRandomId(),
        tripId: activeTripId,
        createdBy: userId,
        type: 'custom',
        title: stopName.trim(),
        notes: [stopAddress.trim(), stopNotes.trim()].filter(Boolean).join('\n') || null,
        startsAt: null,
        endsAt: null,
        timezone: null,
        location: { latitude, longitude },
        sortOrder: Date.now(),
        transportMode: 'driving',
        reservation: {},
        equipment: [],
        facilities: {},
        metadata: { source: 'manual' },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1,
      });

      setItineraryNodes((current) => sortNodes([...current, node]));
      setStopName('');
      setStopAddress('');
      setStopLatitude('');
      setStopLongitude('');
      setStopNotes('');
      setStatusMessage(`Lade till stopp: ${node.title}`);
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

    setIsLoading(true);
    setStatusMessage('Sparar AI-plan...');

    try {
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
        setSavedPois((current) => [...result.pois, ...current.filter((poi) => !result.pois.some((savedPoi) => savedPoi.id === poi.id))]);
      }

      setLatestAiPlan(null);
      const warningText = result.warnings.length > 0 ? ` Varningar: ${result.warnings.join(' ')}` : '';
      setStatusMessage(`AI-plan sparad: ${result.itineraryNodes.length} stopp, ${result.expenses.length} kostnader, ${result.pois.length} platser.${warningText}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function removeStop(nodeId: string) {
    setIsLoading(true);
    setStatusMessage('Tar bort stopp...');

    try {
      await deleteItineraryNode(nodeId);
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

    setIsLoading(true);
    setStatusMessage(`Schemalägger ${node.title}...`);

    try {
      const scheduledAt = setNodeTime(node, hour);
      const savedNode = await upsertItineraryNode({
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
    if (itineraryNodes.length === 0) {
      setStatusMessage('Anslut innan du ändrar ordning på demo-stopp.');
      return;
    }

    const orderedNodes = sortNodes(itineraryNodes);
    const currentIndex = orderedNodes.findIndex((node) => node.id === nodeId);
    const targetIndex = currentIndex + direction;
    const currentNode = orderedNodes[currentIndex];
    const targetNode = orderedNodes[targetIndex];

    if (!currentNode || !targetNode) {
      setStatusMessage(direction < 0 ? 'Steget ligger redan först.' : 'Steget ligger redan sist.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Flyttar ${currentNode.title}...`);

    try {
      const now = new Date().toISOString();
      const updatedCurrent = await upsertItineraryNode({
        ...currentNode,
        sortOrder: targetNode.sortOrder,
        updatedAt: now,
        version: currentNode.version + 1,
      });
      const updatedTarget = await upsertItineraryNode({
        ...targetNode,
        sortOrder: currentNode.sortOrder,
        updatedAt: now,
        version: targetNode.version + 1,
      });

      setItineraryNodes((current) => sortNodes(current.map((node) => {
        if (node.id === updatedCurrent.id) {
          return updatedCurrent;
        }
        if (node.id === updatedTarget.id) {
          return updatedTarget;
        }
        return node;
      })));
      setStatusMessage(`Flyttade steg: ${updatedCurrent.title}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
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
    setPlannerNotes(node.notes ?? '');
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

    if (!plannerTitle.trim()) {
      setStatusMessage('Raden behöver en titel.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Sparar steg...');

    try {
      const latitude = plannerLatitude.trim() ? Number(plannerLatitude.replace(',', '.')) : null;
      const longitude = plannerLongitude.trim() ? Number(plannerLongitude.replace(',', '.')) : null;

      if ((latitude === null) !== (longitude === null) || (latitude !== null && (Number.isNaN(latitude) || Number.isNaN(longitude)))) {
        setStatusMessage('Ange både giltig latitud och longitud, eller lämna båda tomma.');
        return;
      }

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

      const savedNode = await upsertItineraryNode({
        ...node,
        type: plannerType,
        title: plannerTitle.trim(),
        startsAt: buildIsoFromInputs(plannerDate, plannerTime),
        location: latitude !== null && longitude !== null ? { latitude, longitude } : null,
        notes: plannerNotes.trim() || null,
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

    if (!plannerTitle.trim()) {
      setStatusMessage('Nytt steg behöver en titel.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Lägger till steg...');

    try {
      const latitude = plannerLatitude.trim() ? Number(plannerLatitude.replace(',', '.')) : null;
      const longitude = plannerLongitude.trim() ? Number(plannerLongitude.replace(',', '.')) : null;

      if ((latitude === null) !== (longitude === null) || (latitude !== null && (Number.isNaN(latitude) || Number.isNaN(longitude)))) {
        setStatusMessage('Ange både giltig latitud och longitud, eller lämna båda tomma.');
        return;
      }

      const now = new Date().toISOString();
      const savedNode = await upsertItineraryNode({
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

  async function importReseplanrarePlan() {
    if (!activeTripId || !userId) {
      setStatusMessage('Anslut innan du laddar resplanen.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Laddar resplan...');

    try {
      const existingRows = new Set(
        itineraryNodes
          .map((node) => (typeof node.metadata.sourceRow === 'number' ? node.metadata.sourceRow : null))
          .filter((sourceRow): sourceRow is number => sourceRow !== null),
      );
      const rowsToImport = reseplanrareSeedRows.filter((row) => !existingRows.has(row.sourceRow));

      if (rowsToImport.length === 0) {
        setStatusMessage('Resplanen är redan laddad.');
        return;
      }

      const importedNodes: ItineraryNode[] = [];
      for (const row of rowsToImport) {
        importedNodes.push(await upsertItineraryNode(buildNodeFromSeedRow(row, activeTripId, userId)));
      }

      setItineraryNodes((current) => sortNodes([...current, ...importedNodes]));
      setStatusMessage(`Laddade ${importedNodes.length} steg till dagplaneringen. Idéplatser sparade: ${reseplanrareIdeaPlaces.length}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function createNodeFromPoi(poi: Poi): Promise<ItineraryNode> {
    if (!activeTripId || !userId) {
      throw new Error('Anslut innan du sparar ett stopp.');
    }

    const now = new Date().toISOString();

    return upsertItineraryNode({
      id: cryptoRandomId(),
      tripId: activeTripId,
      poiId: poi.id,
      createdBy: userId,
      type: poi.category.includes('camp') ? 'camping' : 'custom',
      title: poi.name,
      notes: poi.address ?? null,
      startsAt: null,
      endsAt: null,
      timezone: null,
      location: poi.location,
      sortOrder: Date.now(),
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
        <View style={[styles.header, isDark && styles.headerDark]}>
          <View style={styles.brandLockup}>
            <Text style={[styles.kicker, isDark && styles.textMutedDark]}>ReseApp</Text>
            <Text style={[styles.title, isDark && styles.textDark]}>{demoTrip.name}</Text>
          </View>
          <View style={styles.navLinks}>
            {['Rutt', 'Budget', 'Dagar'].map((item) => (
              <Text key={item} style={styles.navLink}>{item}</Text>
            ))}
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.tripStatePill, activeTripId ? styles.tripStatePillActive : null]}>
              <Text style={[styles.tripStateText, activeTripId ? styles.tripStateTextActive : null]}>{activeTripId ? 'Synkad' : 'Lokal'}</Text>
            </View>
            <Pressable style={styles.modeButton} onPress={() => setIsEditMode((current) => !current)}>
              <Text style={styles.modeButtonText}>{isEditMode ? 'Demovy' : 'Redigera'}</Text>
            </Pressable>
            <Pressable style={[styles.syncButton, isLoading && styles.disabledButton]} onPress={connectSupabaseTrip} disabled={isLoading}>
              <Text style={styles.syncButtonText}>{isLoading ? 'Vänta' : activeTripId ? 'Uppdatera' : 'Anslut'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.tripHero}>
            <View style={styles.heroPlaneOne} />
            <View style={styles.heroPlaneTwo} />
            <View style={styles.heroPlaneThree} />
            <View style={styles.tripHeroCopy}>
              <Text style={styles.heroEyebrow}>Roadtrip 2026</Text>
              <Text style={styles.heroTitle}>En snygg reseplan med rutt, dagar och budget på samma plats.</Text>
              <Text style={styles.heroBody}>
                Importerad från vår planering, synkad i molnet och redo att justeras tillsammans.
              </Text>
              <View style={styles.heroCtas}>
                <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={connectSupabaseTrip} disabled={isLoading}>
                  <Text style={styles.commandButtonText}>{activeTripId ? 'Synka resa' : 'Anslut resa'}</Text>
                </Pressable>
                <Pressable style={styles.heroSecondaryButton} onPress={parseAiCommand} disabled={isLoading}>
                  <Text style={styles.heroSecondaryText}>Fråga AI</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.heroStats}>
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

          <View style={[styles.statusPanel, isDark && styles.panelDark]}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, isDark && styles.textMutedDark]}>{statusMessage}</Text>
          </View>

          <View style={styles.demoActionBar}>
            <View>
              <Text style={styles.demoActionTitle}>Redo att visa</Text>
              <Text style={styles.demoActionText}>{activeTripId ? 'Planen är ansluten. Ladda resplanen om den inte syns än.' : 'Tryck Anslut innan du laddar den riktiga resplanen.'}</Text>
            </View>
            <View style={styles.demoActionButtons}>
              <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={connectSupabaseTrip} disabled={isLoading}>
                <Text style={styles.secondaryButtonText}>{activeTripId ? 'Uppdatera' : 'Anslut'}</Text>
              </Pressable>
              <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={importReseplanrarePlan} disabled={isLoading || !activeTripId}>
                <Text style={styles.commandButtonText}>Ladda resplan</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.dashboardGrid}>
            {!isDemoMode ? (
            <View style={styles.sidebarColumn}>
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
                  <Text style={[styles.codeText, isDark && styles.textDark]}>{generatedShareCode || 'Ingen kod än'}</Text>
                </View>
                <TextInput
                  value={shareCode}
                  onChangeText={setShareCode}
                  placeholder="Klistra in kod"
                  placeholderTextColor={isDark ? '#737373' : '#78716c'}
                  style={[styles.singleLineInput, isDark && styles.inputDark]}
                  autoCapitalize="characters"
                />
                <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={joinSharedTrip} disabled={isLoading}>
                  <Text style={styles.commandButtonText}>Gå med</Text>
                </Pressable>
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

            <View style={styles.mainColumn}>
              <View style={styles.routeStage}>
                <View style={styles.routeStageHeader}>
                  <View>
                    <Text style={styles.routeStageKicker}>Interaktiv ruttkarta</Text>
                    <Text style={styles.routeStageTitle}>Övningskarta</Text>
                  </View>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>{displayedNodes.length} stopp</Text>
                  </View>
                </View>
                <View style={styles.mapShell}>
                  <NavigationMap nodes={displayedNodes} activeRoute={routeSummary.geometry ? routeSummary : demoRoute} followUser={false} />
                  <View style={styles.mapOverlayPanel}>
                    <Text style={styles.mapOverlayKicker}>Reselager</Text>
                    <Text style={styles.mapOverlayTitle}>{demoTrip.name}</Text>
                    <Text style={styles.mapOverlayMeta}>{formatDistance(routeSummary.distanceMeters)} / {formatDuration(routeSummary.durationSeconds)}</Text>
                  </View>
                  <View style={styles.mapLayerControls}>
                    {['Karta', 'Stopp', 'Kostnad'].map((label, index) => (
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
                  <Text style={styles.routeStageMeta}>{formatSek(totalSpend)} kostnad</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <Metric label="Stopp" value={`${displayedNodes.length}`} accent="#0f766e" dark={isDark} />
                <Metric label="Rutt" value={formatDistance(routeSummary.distanceMeters)} accent="#2563eb" dark={isDark} />
                <Metric label="Körning" value={formatDuration(routeSummary.durationSeconds)} accent="#d97706" dark={isDark} />
                <Metric label="Kostnad" value={formatSek(totalSpend)} accent="#7c3aed" dark={isDark} />
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <View style={styles.sectionHeaderRow}>
                  <SectionTitle title="Reseöversikt" dark={isDark} />
                  <Text style={styles.overviewMeta}>{dayPlans.length} dagar / {budgetSummary.warnings.length} smarta flaggor</Text>
                </View>
                <View style={styles.dayOverviewGrid}>
                  {dayPlans.map((dayPlan) => (
                    <DayOverviewCard key={dayPlan.key} dayPlan={dayPlan} />
                  ))}
                </View>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <View style={styles.sectionHeaderRow}>
                  <SectionTitle title="Budget" dark={isDark} />
                  <Text style={styles.budgetTotal}>{formatSek(totalSpend)}</Text>
                </View>
                <View style={styles.budgetGrid}>
                  <BudgetCard label="Boende" value={budgetSummary.categories.lodging} accent="#2563eb" />
                  <BudgetCard label="Aktiviteter" value={budgetSummary.categories.activity} accent="#d97706" />
                  <BudgetCard label="Transport" value={budgetSummary.categories.transport} accent="#00d4ff" />
                  <BudgetCard label="Mat/övrigt" value={budgetSummary.categories.food + budgetSummary.categories.other} accent="#635bff" />
                </View>
                <View style={styles.warningList}>
                  {budgetSummary.warnings.map((warning) => (
                    <Text key={warning} style={styles.warningText}>{warning}</Text>
                  ))}
                </View>
              </View>

              {!isDemoMode ? (
              <View style={styles.twoColumnGrid}>
                <View style={[styles.panelSection, isDark && styles.panelDark]}>
                  <SectionTitle title="Platser" dark={isDark} />
                  <TextInput
                    value={placeQuery}
                    onChangeText={setPlaceQuery}
                    placeholder="Sök camping, restauranger, aktiviteter..."
                    placeholderTextColor={isDark ? '#737373' : '#78716c'}
                    style={[styles.singleLineInput, isDark && styles.inputDark]}
                  />
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={searchPlaces} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Sök platser</Text>
                  </Pressable>
                  {placeResults.map((place) => (
                    <View key={place.id} style={[styles.placeItem, isDark && styles.innerPanelDark]}>
                      <View style={styles.timelineCopy}>
                        <Text style={[styles.itemTitle, isDark && styles.textDark]}>{place.displayName?.text ?? 'Namnlös plats'}</Text>
                        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                          {place.formattedAddress ?? place.primaryType ?? 'Google Places'}
                        </Text>
                      </View>
                      <Pressable style={styles.smallButton} onPress={() => void savePlace(place)} disabled={isLoading}>
                        <Text style={styles.smallButtonText}>Spara</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>

                <View style={[styles.panelSection, isDark && styles.panelDark]}>
                  <SectionTitle title="Manuellt stopp" dark={isDark} />
                  <TextInput value={stopName} onChangeText={setStopName} placeholder="Namn på stopp" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
                  <TextInput value={stopAddress} onChangeText={setStopAddress} placeholder="Adress eller kort beskrivning" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
                  <View style={styles.actionRow}>
                    <TextInput value={stopLatitude} onChangeText={setStopLatitude} placeholder="Latitud" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} inputMode="decimal" />
                    <TextInput value={stopLongitude} onChangeText={setStopLongitude} placeholder="Longitud" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} inputMode="decimal" />
                  </View>
                  <TextInput value={stopNotes} onChangeText={setStopNotes} placeholder="Anteckningar" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.commandInput, isDark && styles.inputDark]} multiline />
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={createManualStop} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Lägg till stopp</Text>
                  </Pressable>
                </View>
              </View>
              ) : null}

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <View style={styles.sectionHeaderRow}>
                  <SectionTitle title="Dagplanering" dark={isDark} />
                  {!isDemoMode ? (
                    <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={() => startNewPlannerStep('unscheduled')} disabled={isLoading}>
                      <Text style={styles.secondaryButtonText}>Nytt oschemalagt steg</Text>
                    </Pressable>
                  ) : null}
                </View>
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
                {dayPlans.map((dayPlan) => (
                  <View key={dayPlan.key} style={[styles.dayGroup, isDark && styles.innerPanelDark]}>
                    <View style={styles.dayHeader}>
                      <View>
                        <Text style={[styles.dayTitle, isDark && styles.textDark]}>{dayPlan.title}</Text>
                        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                          {dayPlan.nodes.length} stopp / {formatDistance(dayPlan.route.distanceMeters)} / {formatDuration(dayPlan.route.durationSeconds)} / {formatSek(dayPlan.budget.total)}
                        </Text>
                        <View style={styles.smartFlagList}>
                          {(dayPlan.smartFlags.length > 0 ? dayPlan.smartFlags : ['Ser planerad ut']).map((flag) => (
                            <Text key={flag} style={[styles.smartFlag, flag === 'Ser planerad ut' && styles.smartFlagGood]}>{flag}</Text>
                          ))}
                        </View>
                      </View>
                      {!isDemoMode ? (
                        <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={() => startNewPlannerStep(dayPlan.key)} disabled={isLoading}>
                          <Text style={styles.commandButtonText}>Nytt steg</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={styles.dayInsightGrid}>
                      <DayInsight label="Boende" value={dayPlan.insight.lodgingLabel} tone={dayPlan.insight.hasLodging ? 'good' : 'warn'} />
                      <DayInsight label="Aktiviteter" value={dayPlan.insight.activitiesLabel} tone={dayPlan.insight.activityCount > 0 ? 'good' : 'neutral'} />
                      <DayInsight label="Körning" value={dayPlan.insight.driveLabel} tone={dayPlan.insight.isLongDrive ? 'warn' : 'neutral'} />
                      <DayInsight label="Budget" value={dayPlan.insight.costLabel} tone={dayPlan.budget.missingCostCount > 0 ? 'warn' : 'good'} />
                    </View>
                    <Text style={styles.dayNextAction}>{dayPlan.insight.nextAction}</Text>
                    {draftPlannerDayKey === dayPlan.key ? renderPlannerInlineEditor('new') : null}
                    {dayPlan.nodes.map((node, index) => (
                      <View key={node.id} style={[styles.timelineItem, isDark && styles.innerPanelDark]}>
                        <View style={styles.timeRail}>
                          <Text style={[styles.timeText, isDark && styles.textDark]}>{formatTime(node.startsAt)}</Text>
                          <View style={[styles.nodeDot, { backgroundColor: nodeColor(node.type) }]} />
                        </View>
                        {selectedPlannerNodeId === node.id && !isDemoMode ? (
                          <View style={styles.timelineCopy}>
                            {renderPlannerInlineEditor('edit')}
                          </View>
                        ) : (
                          <>
                            <View style={styles.timelineCopy}>
                              <Text style={[styles.itemTitle, isDark && styles.textDark]}>{index + 1}. {node.title}</Text>
                              <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                                {formatNodeType(node.type)} / {formatNodeCostSummary(node)}
                              </Text>
                              <View style={styles.nodeInfoPills}>
                                {buildNodeInfoPills(node).map((pill) => (
                                  <Text key={pill} style={styles.nodeInfoPill}>{pill}</Text>
                                ))}
                              </View>
                            </View>
                            {itineraryNodes.length > 0 && !isDemoMode ? (
                              <View style={styles.stopActions}>
                                <Pressable style={styles.secondarySmallButton} onPress={() => selectPlannerNode(node.id)} disabled={isLoading}>
                                  <Text style={styles.secondarySmallButtonText}>Redigera</Text>
                                </Pressable>
                                <Pressable style={styles.secondarySmallButton} onPress={() => void moveStop(node.id, -1)} disabled={isLoading}>
                                  <Text style={styles.secondarySmallButtonText}>Upp</Text>
                                </Pressable>
                                <Pressable style={styles.secondarySmallButton} onPress={() => void moveStop(node.id, 1)} disabled={isLoading}>
                                  <Text style={styles.secondarySmallButtonText}>Ner</Text>
                                </Pressable>
                                <Pressable style={styles.smallButton} onPress={() => void scheduleStop(node, 9)} disabled={isLoading}>
                                  <Text style={styles.smallButtonText}>AM</Text>
                                </Pressable>
                                <Pressable style={styles.smallButton} onPress={() => void scheduleStop(node, 18)} disabled={isLoading}>
                                  <Text style={styles.smallButtonText}>PM</Text>
                                </Pressable>
                                <Pressable style={styles.dangerButton} onPress={() => void removeStop(node.id)} disabled={isLoading}>
                                  <Text style={styles.smallButtonText}>Ta bort</Text>
                                </Pressable>
                              </View>
                            ) : null}
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
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

function BudgetCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={[styles.budgetCard, { borderTopColor: accent }]}>
      <Text style={styles.budgetLabel}>{label}</Text>
      <Text style={styles.budgetValue}>{formatSek(value)}</Text>
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

function DayOverviewCard({ dayPlan }: { dayPlan: DayPlan }) {
  const primaryStop = dayPlan.nodes[0]?.title ?? 'Inga stopp än';
  const flags = dayPlan.smartFlags.length > 0 ? dayPlan.smartFlags : ['Ser planerad ut'];

  return (
    <View style={styles.dayOverviewCard}>
      <View style={styles.dayOverviewHeader}>
        <Text style={styles.dayOverviewTitle}>{dayPlan.shortTitle}</Text>
        <Text style={styles.dayOverviewCost}>{formatSek(dayPlan.budget.total)}</Text>
      </View>
      <Text style={styles.dayOverviewPrimary}>{primaryStop}</Text>
      <Text style={styles.dayOverviewAction}>{dayPlan.insight.nextAction}</Text>
      <View style={styles.dayOverviewStats}>
        <Text style={styles.dayOverviewStat}>{dayPlan.nodes.length} stopp</Text>
        <Text style={styles.dayOverviewStat}>{formatDistance(dayPlan.route.distanceMeters)}</Text>
        <Text style={styles.dayOverviewStat}>{formatDuration(dayPlan.route.durationSeconds)}</Text>
      </View>
      <View style={styles.smartFlagList}>
        {flags.slice(0, 3).map((flag) => (
          <Text key={flag} style={[styles.smartFlag, flag === 'Ser planerad ut' && styles.smartFlagGood]}>{flag}</Text>
        ))}
      </View>
    </View>
  );
}

function SectionTitle({ title, dark }: { title: string; dark: boolean }) {
  return <Text style={[styles.sectionTitle, dark && styles.textDark]}>{title}</Text>;
}

function nodeColor(type: ItineraryNode['type']) {
  switch (type) {
    case 'camping':
      return '#059669';
    case 'activity':
      return '#d97706';
    case 'lodging':
      return '#2563eb';
    default:
      return '#0f766e';
  }
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

function formatNodeCostSummary(node: ItineraryNode): string {
  const parts = [formatRawNodeCost(node), formatReservation(node), node.notes ?? node.timezone ?? 'lokal tid'].filter(Boolean);
  return parts.join(' / ');
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

const inlineNodeTypes: ItineraryNodeType[] = ['lodging', 'camping', 'activity', 'gastronomy', 'transport', 'custom'];

function sortNodes(nodes: ItineraryNode[]): ItineraryNode[] {
  return [...nodes].sort((a, b) => {
    const timeA = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY;
    const timeB = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return a.sortOrder - b.sortOrder;
  });
}

function nextSortOrder(nodes: ItineraryNode[]): number {
  const maxSortOrder = nodes.reduce((max, node) => Math.max(max, node.sortOrder), 0);
  return maxSortOrder + 100;
}

type DayPlan = {
  key: string;
  title: string;
  shortTitle: string;
  nodes: ItineraryNode[];
  route: RouteSummary;
  budget: BudgetSummary;
  smartFlags: string[];
  insight: DayInsightSummary;
};

type DayInsightSummary = {
  lodgingLabel: string;
  activitiesLabel: string;
  driveLabel: string;
  costLabel: string;
  nextAction: string;
  hasLodging: boolean;
  activityCount: number;
  isLongDrive: boolean;
};

type BudgetCategories = {
  lodging: number;
  activity: number;
  transport: number;
  food: number;
  other: number;
};

type BudgetSummary = {
  total: number;
  categories: BudgetCategories;
  missingCostCount: number;
  warnings: string[];
};

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

    return {
      key,
      title,
      shortTitle: key === 'unscheduled' ? 'Oschemalagt' : `Dag ${index + 1}`,
      nodes: groupNodes,
      route,
      budget,
      smartFlags: buildDaySmartFlags(groupNodes, route, budget),
      insight,
    };
  });
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
  };
}

function buildDaySmartFlags(nodes: ItineraryNode[], route: RouteSummary, budget: BudgetSummary): string[] {
  const flags: string[] = [];
  const hasLodging = nodes.some((node) => node.type === 'lodging' || node.type === 'camping');
  const hasTimedStop = nodes.some((node) => Boolean(node.startsAt));
  const driveHours = route.durationSeconds / 3600;

  if (nodes.length === 0) {
    flags.push('Tom dag');
  }

  if (!hasLodging && nodes.length > 0) {
    flags.push('Saknar boende');
  }

  if (budget.missingCostCount > 0) {
    flags.push(`${budget.missingCostCount} kostnader saknas`);
  }

  if (driveHours >= 5) {
    flags.push('Lång kördag');
  }

  if (budget.total >= 3000) {
    flags.push('Dyr dag');
  }

  if (!hasTimedStop) {
    flags.push('Saknar tider');
  }

  return flags;
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
    node.notes,
  ].filter(Boolean);

  return details.join(' / ');
}

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function buildNodeFromSeedRow(row: ReseplanrareSeedRow, tripId: string, userId: string): ItineraryNode {
  const now = new Date().toISOString();
  const title = row.activity ? row.activity : row.hotel ? row.hotel : row.place;
  const startsAt = row.date ? new Date(`${row.date}T09:00:00`).toISOString() : null;
  const costParts = [row.lodgingCost, row.activityCost].filter(Boolean);
  const notes = [
    row.activity && row.place !== row.activity ? `Plats: ${row.place}` : null,
    row.hotel ? `Hotell/notis: ${row.hotel}` : null,
    costParts.length ? `Kostnad från underlag: ${costParts.join(' + ')} SEK` : null,
    `Laddad från resplanens underlag rad ${row.sourceRow}`,
  ].filter(Boolean).join('\n');

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
    backgroundColor: '#f6f9fc',
  },
  screenDark: {
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 36,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e6edf5',
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
    fontSize: 25,
    fontWeight: '900',
  },
  brandLockup: {
    minWidth: 230,
  },
  navLinks: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    flexWrap: 'wrap',
  },
  navLink: {
    color: '#425466',
    fontSize: 14,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
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
  syncButton: {
    backgroundColor: '#0a2540',
    borderRadius: 999,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modeButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#f6f9fc',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modeButtonText: {
    color: '#0a2540',
    fontSize: 13,
    fontWeight: '900',
  },
  mapShell: {
    height: 520,
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 20,
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
    padding: 28,
    gap: 20,
  },
  tripHero: {
    minHeight: 220,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 24,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 28,
  },
  heroPlaneOne: {
    position: 'absolute',
    right: -160,
    top: -112,
    width: 560,
    height: 190,
    backgroundColor: '#7a73ff',
    transform: [{ rotate: '-12deg' }],
  },
  heroPlaneTwo: {
    position: 'absolute',
    right: 10,
    bottom: -86,
    width: 520,
    height: 180,
    backgroundColor: '#00d4ff',
    transform: [{ rotate: '-12deg' }],
  },
  heroPlaneThree: {
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
    gap: 12,
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
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '900',
  },
  heroBody: {
    maxWidth: 660,
    color: '#425466',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
  },
  heroCtas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  heroSecondaryButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#e7ecff',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  heroSecondaryText: {
    color: '#635bff',
    fontSize: 13,
    fontWeight: '900',
  },
  heroStats: {
    width: 380,
    maxWidth: '100%',
    gap: 12,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  heroStat: {
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
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
    gap: 18,
    flexWrap: 'wrap',
  },
  sidebarColumn: {
    width: 300,
    gap: 14,
  },
  mainColumn: {
    flex: 1,
    minWidth: 620,
    gap: 16,
  },
  routeStage: {
    gap: 14,
    overflow: 'hidden',
    borderRadius: 26,
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
    paddingHorizontal: 6,
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
  mapOverlayPanel: {
    position: 'absolute',
    left: 18,
    top: 18,
    minWidth: 240,
    borderRadius: 18,
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
  twoColumnGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  panelSection: {
    flex: 1,
    minWidth: 300,
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
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
  budgetGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  budgetCard: {
    flex: 1,
    minWidth: 170,
    minHeight: 78,
    justifyContent: 'space-between',
    borderRadius: 14,
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
  overviewMeta: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '900',
  },
  dayOverviewGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  dayOverviewCard: {
    flex: 1,
    minWidth: 240,
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    backgroundColor: '#f6f9fc',
    padding: 14,
  },
  dayOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dayOverviewTitle: {
    color: '#635bff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dayOverviewCost: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
  },
  dayOverviewPrimary: {
    color: '#0a2540',
    fontSize: 16,
    fontWeight: '900',
  },
  dayOverviewAction: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  dayOverviewStats: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayOverviewStat: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '800',
  },
  smartFlagList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  smartFlag: {
    color: '#7a4b00',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    borderRadius: 999,
    backgroundColor: '#fff7df',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe3a3',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smartFlagGood: {
    color: '#076b4d',
    backgroundColor: '#e7f8ef',
    borderColor: '#b8ead1',
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
  dayGroup: {
    gap: 10,
    backgroundColor: '#f6f9fc',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 12,
  },
  dayInlineEditor: {
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  dayInsightGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  dayInsightCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 12,
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
    borderRadius: 12,
    backgroundColor: '#f2f4ff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dfe3ff',
    paddingHorizontal: 12,
    paddingVertical: 9,
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
  dayTitle: {
    color: '#0a2540',
    fontSize: 15,
    fontWeight: '900',
  },
  timelineItem: {
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
  statusPanel: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    paddingHorizontal: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00d4ff',
  },
  statusText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '700',
  },
  demoActionBar: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    padding: 18,
  },
  demoActionTitle: {
    color: '#0a2540',
    fontSize: 18,
    fontWeight: '900',
  },
  demoActionText: {
    maxWidth: 720,
    color: '#425466',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  demoActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
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
