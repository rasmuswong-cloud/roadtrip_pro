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
import type { Expense, ItineraryNode, Poi, RouteSummary, Trip } from '@/models';
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
  name: 'Alpine Roadtrip',
  description: 'Munich to Dolomites with hiking, camping, and MTB stops.',
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
    title: 'Munich overnight',
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
    title: 'Cortina campsite',
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: null,
    timezone: 'Europe/Rome',
    location: { latitude: 46.5405, longitude: 12.1357 },
    sortOrder: 20,
    transportMode: 'driving',
    reservation: { siteNumber: 'TBD', accessDetails: 'Confirm arrival window before departure.' },
    equipment: [{ name: 'E-MTB rental', quantity: 2 }],
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
    category: 'Lodging',
    description: 'Munich hotel deposit',
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
  const [statusMessage, setStatusMessage] = useState('Ready to connect Supabase.');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [generatedShareCode, setGeneratedShareCode] = useState('');
  const [placeQuery, setPlaceQuery] = useState('campsite near Cortina');
  const [placeResults, setPlaceResults] = useState<GooglePlace[]>([]);
  const [savedPois, setSavedPois] = useState<Poi[]>([]);
  const [itineraryNodes, setItineraryNodes] = useState<ItineraryNode[]>([]);
  const [latestAiPlan, setLatestAiPlan] = useState<ItineraryMutationPlan | null>(null);
  const [selectedPlannerNodeId, setSelectedPlannerNodeId] = useState<string | null>(null);
  const [plannerTitle, setPlannerTitle] = useState('');
  const [plannerDate, setPlannerDate] = useState('');
  const [plannerTime, setPlannerTime] = useState('');
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
  const routeSummary = useMemo(() => estimateRouteSummary(displayedNodes), [displayedNodes]);
  const dayPlans = useMemo(() => buildDayPlans(displayedNodes), [displayedNodes]);
  const plannerRows = useMemo(() => buildPlannerRows(displayedNodes), [displayedNodes]);

  const totalSpend = useMemo(
    () => demoExpenses.reduce((sum, expense) => sum + (expense.baseAmount ?? expense.amount), 0),
    [],
  );

  async function connectSupabaseTrip() {
    setIsLoading(true);
    setStatusMessage('Connecting to Supabase...');

    try {
      const existingUser = await getCurrentUser();
      const user = existingUser ?? (await getOrCreateAnonymousUser());

      setUserId(user.id);
      await ensureUserProfile(user.id, user.email ?? 'Roadtrip Planner');
      const trip = await ensureFirstTrip(user.id);
      const nodes = await listItineraryNodes(trip.id);

      upsertTrip(trip);
      setActiveTrip(trip.id);
      setItineraryNodes(nodes);
      setStatusMessage(`Connected: ${trip.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function sendLoginLink() {
    if (!email.trim()) {
      setStatusMessage('Type your email first.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Sending magic link...');

    try {
      await sendMagicLink(email.trim());
      setStatusMessage('Magic link sent. Open it in this browser, then press Connect.');
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
      setStatusMessage('Signed out.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function createShareCode() {
    if (!activeTripId) {
      setStatusMessage('Connect to a trip first.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Creating share code...');

    try {
      const code = await createTripShareCode(activeTripId);
      setGeneratedShareCode(code);
      setStatusMessage(`Share code created: ${code}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function joinSharedTrip() {
    if (!shareCode.trim()) {
      setStatusMessage('Paste a share code first.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Joining shared trip...');

    try {
      const user = await getCurrentUser();
      if (!user) {
        setStatusMessage('Sign in with email before joining a trip.');
        return;
      }

      await ensureUserProfile(user.id, user.email ?? 'Roadtrip Planner');
      const trip = await joinTripByShareCode(shareCode);
      const nodes = await listItineraryNodes(trip.id);
      setUserId(user.id);
      upsertTrip(trip);
      setActiveTrip(trip.id);
      setItineraryNodes(nodes);
      setStatusMessage(`Joined: ${trip.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function searchPlaces() {
    if (!placeQuery.trim()) {
      setStatusMessage('Type a place search first.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Searching Google Places...');

    try {
      const results = await searchGooglePlaces({
        query: placeQuery.trim(),
        center: { latitude: 46.5405, longitude: 12.1357 },
        radiusMeters: 30_000,
      });

      setPlaceResults(results);
      setStatusMessage(`Found ${results.length} places.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function savePlace(place: GooglePlace) {
    if (!activeTripId || !userId) {
      setStatusMessage('Press Connect before saving a place.');
      return;
    }

    const poi = googlePlaceToPoi(place, activeTripId, userId);
    if (!poi) {
      setStatusMessage('This place has no coordinates.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Saving ${poi.name}...`);

    try {
      const savedPoi = await upsertPoi(poi);
      const node = await createNodeFromPoi(savedPoi);
      upsertPoiInStore(savedPoi);
      setItineraryNodes((current) => sortNodes([...current.filter((candidate) => candidate.id !== node.id), node]));
      setSavedPois((current) => [savedPoi, ...current.filter((candidate) => candidate.id !== savedPoi.id)]);
      setStatusMessage(`Saved stop: ${savedPoi.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function createManualStop() {
    if (!activeTripId || !userId) {
      setStatusMessage('Connect before adding a stop.');
      return;
    }

    const latitude = Number(stopLatitude.replace(',', '.'));
    const longitude = Number(stopLongitude.replace(',', '.'));

    if (!stopName.trim() || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setStatusMessage('Stop needs a name plus valid latitude and longitude.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Saving stop...');

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
      setStatusMessage(`Added stop: ${node.title}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function parseAiCommand() {
    if (!activeTripId) {
      setStatusMessage('Connect to a trip before using AI.');
      return;
    }

    if (!command.trim()) {
      setStatusMessage('Type an AI command first.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Parsing command with AI...');
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
      const warningText = plan.warnings.length > 0 ? ` Warnings: ${plan.warnings.join(' ')}` : '';
      setStatusMessage(
        `AI plan: ${plan.reasoningSummary} (${plan.mutations.length} mutations, ${Math.round(plan.confidence * 100)}% confidence).${warningText}`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmAiPlan() {
    if (!latestAiPlan) {
      setStatusMessage('Parse an AI command before confirming.');
      return;
    }

    if (!userId) {
      setStatusMessage('Connect before confirming an AI plan.');
      return;
    }

    if (latestAiPlan.mutations.length === 0) {
      setStatusMessage('AI plan has no changes to apply.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Applying AI plan...');

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
      const warningText = result.warnings.length > 0 ? ` Warnings: ${result.warnings.join(' ')}` : '';
      setStatusMessage(`Applied AI plan: ${result.itineraryNodes.length} stops, ${result.expenses.length} expenses, ${result.pois.length} places.${warningText}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function removeStop(nodeId: string) {
    setIsLoading(true);
    setStatusMessage('Removing stop...');

    try {
      await deleteItineraryNode(nodeId);
      setItineraryNodes((current) => current.filter((node) => node.id !== nodeId));
      setStatusMessage('Stop removed.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function scheduleStop(node: ItineraryNode, hour: number) {
    if (itineraryNodes.length === 0) {
      setStatusMessage('Connect before scheduling demo stops.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Scheduling ${node.title}...`);

    try {
      const scheduledAt = setNodeTime(node, hour);
      const savedNode = await upsertItineraryNode({
        ...node,
        startsAt: scheduledAt,
        updatedAt: new Date().toISOString(),
        version: node.version + 1,
      });

      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      setStatusMessage(`${savedNode.title} scheduled for ${formatTime(savedNode.startsAt)}.`);
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
    setPlannerTitle(node.title);
    setPlannerDate(node.startsAt ? node.startsAt.slice(0, 10) : '');
    setPlannerTime(node.startsAt ? toTimeInput(node.startsAt) : '');
    setPlannerCost(formatRawNodeCost(node));
    setPlannerHotelNote(formatReservation(node));
    setPlannerNotes(node.notes ?? '');
  }

  async function savePlannerEdit() {
    if (!selectedPlannerNodeId) {
      setStatusMessage('Select a planner row first.');
      return;
    }

    if (itineraryNodes.length === 0) {
      setStatusMessage('Connect before editing demo rows.');
      return;
    }

    const node = itineraryNodes.find((candidate) => candidate.id === selectedPlannerNodeId);
    if (!node) {
      setStatusMessage('Selected planner row is no longer available.');
      return;
    }

    if (!plannerTitle.trim()) {
      setStatusMessage('Planner row needs a title.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Saving planner row...');

    try {
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

      const savedNode = await upsertItineraryNode({
        ...node,
        title: plannerTitle.trim(),
        startsAt: buildIsoFromInputs(plannerDate, plannerTime),
        notes: plannerNotes.trim() || null,
        reservation: nextReservation,
        metadata: nextMetadata,
        updatedAt: new Date().toISOString(),
        version: node.version + 1,
      });

      setItineraryNodes((current) => sortNodes(current.map((candidate) => (candidate.id === savedNode.id ? savedNode : candidate))));
      populatePlannerEditor(savedNode);
      setStatusMessage(`Saved planner row: ${savedNode.title}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function createNodeFromPoi(poi: Poi): Promise<ItineraryNode> {
    if (!activeTripId || !userId) {
      throw new Error('Connect before saving a stop.');
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
            {['Plan', 'Route', 'Budget', 'Share'].map((item) => (
              <Text key={item} style={styles.navLink}>{item}</Text>
            ))}
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.tripStatePill, activeTripId ? styles.tripStatePillActive : null]}>
              <Text style={[styles.tripStateText, activeTripId ? styles.tripStateTextActive : null]}>{activeTripId ? 'Synced' : 'Local'}</Text>
            </View>
            <Pressable style={[styles.syncButton, isLoading && styles.disabledButton]} onPress={connectSupabaseTrip} disabled={isLoading}>
              <Text style={styles.syncButtonText}>{isLoading ? 'Wait' : activeTripId ? 'Refresh' : 'Connect'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.tripHero}>
            <View style={styles.heroPlaneOne} />
            <View style={styles.heroPlaneTwo} />
            <View style={styles.heroPlaneThree} />
            <View style={styles.tripHeroCopy}>
              <Text style={styles.heroEyebrow}>Route OS for roadtrips</Text>
              <Text style={styles.heroTitle}>Plan the trip, route, budget, and campsite flow in one place.</Text>
              <Text style={styles.heroBody}>
                A collaborative workspace for stops, lodging, activities, AI changes, and spreadsheet-style planning.
              </Text>
              <View style={styles.heroCtas}>
                <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={connectSupabaseTrip} disabled={isLoading}>
                  <Text style={styles.commandButtonText}>{activeTripId ? 'Sync trip' : 'Connect trip'}</Text>
                </Pressable>
                <Pressable style={styles.heroSecondaryButton} onPress={parseAiCommand} disabled={isLoading}>
                  <Text style={styles.heroSecondaryText}>Ask AI</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{displayedNodes.length}</Text>
                <Text style={styles.heroStatLabel}>Stops</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatDistance(routeSummary.distanceMeters)}</Text>
                <Text style={styles.heroStatLabel}>Route</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatDuration(routeSummary.durationSeconds)}</Text>
                <Text style={styles.heroStatLabel}>Drive</Text>
              </View>
            </View>
          </View>

          <View style={[styles.statusPanel, isDark && styles.panelDark]}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, isDark && styles.textMutedDark]}>{statusMessage}</Text>
          </View>

          <View style={styles.dashboardGrid}>
            <View style={styles.sidebarColumn}>
              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Account" dark={isDark} />
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
                    <Text style={styles.commandButtonText}>Send link</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={disconnect} disabled={isLoading}>
                    <Text style={styles.secondaryButtonText}>Sign out</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Share" dark={isDark} />
                <View style={styles.actionRow}>
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={createShareCode} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Create code</Text>
                  </Pressable>
                  <Text style={[styles.codeText, isDark && styles.textDark]}>{generatedShareCode || 'No code yet'}</Text>
                </View>
                <TextInput
                  value={shareCode}
                  onChangeText={setShareCode}
                  placeholder="Paste partner code"
                  placeholderTextColor={isDark ? '#737373' : '#78716c'}
                  style={[styles.singleLineInput, isDark && styles.inputDark]}
                  autoCapitalize="characters"
                />
                <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={joinSharedTrip} disabled={isLoading}>
                  <Text style={styles.commandButtonText}>Join trip</Text>
                </Pressable>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="AI Co-Pilot" dark={isDark} />
                <TextInput
                  value={command}
                  onChangeText={setCommand}
                  placeholder="Ask for a campsite, route change, budget warning..."
                  placeholderTextColor={isDark ? '#737373' : '#78716c'}
                  style={[styles.commandInput, isDark && styles.inputDark]}
                  multiline
                />
                <View style={styles.actionRow}>
                  {latestAiPlan?.mutations.length ? (
                    <Pressable style={[styles.secondaryButton, isLoading && styles.disabledButton]} onPress={confirmAiPlan} disabled={isLoading}>
                      <Text style={styles.secondaryButtonText}>Confirm plan</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={parseAiCommand} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Parse command</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.mainColumn}>
              <View style={styles.routeStage}>
                <View style={styles.routeStageHeader}>
                  <View>
                    <Text style={styles.routeStageKicker}>Interactive route map</Text>
                    <Text style={styles.routeStageTitle}>Practice Google Maps</Text>
                  </View>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>{displayedNodes.length} stops</Text>
                  </View>
                </View>
                <View style={styles.mapShell}>
                  <NavigationMap nodes={displayedNodes} activeRoute={routeSummary.geometry ? routeSummary : demoRoute} followUser={false} />
                  <View style={styles.mapOverlayPanel}>
                    <Text style={styles.mapOverlayKicker}>Roadtrip layer</Text>
                    <Text style={styles.mapOverlayTitle}>{demoTrip.name}</Text>
                    <Text style={styles.mapOverlayMeta}>{formatDistance(routeSummary.distanceMeters)} / {formatDuration(routeSummary.durationSeconds)}</Text>
                  </View>
                  <View style={styles.mapLayerControls}>
                    {['Map', 'Stops', 'Costs'].map((label, index) => (
                      <View key={label} style={[styles.mapLayerChip, index === 0 && styles.mapLayerChipActive]}>
                        <Text style={[styles.mapLayerText, index === 0 && styles.mapLayerTextActive]}>{label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.mapLegend}>
                    <View style={[styles.legendDot, { backgroundColor: '#635bff' }]} />
                    <Text style={styles.legendText}>planned stop</Text>
                    <View style={[styles.legendDot, { backgroundColor: '#00d4ff' }]} />
                    <Text style={styles.legendText}>route</Text>
                  </View>
                </View>
                <View style={styles.routeStageFooter}>
                  <Text style={styles.routeStageMeta}>{formatDistance(routeSummary.distanceMeters)} route</Text>
                  <Text style={styles.routeStageMeta}>{formatDuration(routeSummary.durationSeconds)} drive</Text>
                  <Text style={styles.routeStageMeta}>{totalSpend} SEK spend</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <Metric label="Stops" value={`${displayedNodes.length}`} accent="#0f766e" dark={isDark} />
                <Metric label="Route" value={formatDistance(routeSummary.distanceMeters)} accent="#2563eb" dark={isDark} />
                <Metric label="Drive" value={formatDuration(routeSummary.durationSeconds)} accent="#d97706" dark={isDark} />
                <Metric label="Spend" value={`${totalSpend} SEK`} accent="#7c3aed" dark={isDark} />
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Planner Sheet" dark={isDark} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.sheetTable}>
                    <View style={[styles.sheetRow, styles.sheetHeaderRow]}>
                      {['Date', 'Place', 'Lodging', 'Activity', 'Cost', 'Hotel / note'].map((header) => (
                        <Text key={header} style={[styles.sheetHeaderCell, isDark && styles.textDark]}>{header}</Text>
                      ))}
                    </View>
                    {plannerRows.map((row) => (
                      <Pressable
                        key={row.id}
                        style={[
                          styles.sheetRow,
                          selectedPlannerNodeId === row.id && styles.sheetRowSelected,
                          isDark && styles.innerPanelDark,
                        ]}
                        onPress={() => selectPlannerNode(row.id)}
                      >
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.date}</Text>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.place}</Text>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.lodging}</Text>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.activity}</Text>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.cost}</Text>
                        <Text style={[styles.sheetWideCell, isDark && styles.textDark]}>{row.hotel}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                <View style={[styles.plannerEditor, isDark && styles.innerPanelDark]}>
                  <View style={styles.actionRow}>
                    <TextInput value={plannerDate} onChangeText={setPlannerDate} placeholder="YYYY-MM-DD" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
                    <TextInput value={plannerTime} onChangeText={setPlannerTime} placeholder="HH:MM" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
                  </View>
                  <TextInput value={plannerTitle} onChangeText={setPlannerTitle} placeholder="Place, lodging, or activity" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
                  <View style={styles.actionRow}>
                    <TextInput value={plannerCost} onChangeText={setPlannerCost} placeholder="Cost" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
                    <TextInput value={plannerHotelNote} onChangeText={setPlannerHotelNote} placeholder="Hotel / note" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} />
                  </View>
                  <TextInput value={plannerNotes} onChangeText={setPlannerNotes} placeholder="Notes" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.commandInput, isDark && styles.inputDark]} multiline />
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={savePlannerEdit} disabled={isLoading || !selectedPlannerNodeId}>
                    <Text style={styles.commandButtonText}>Save row</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.twoColumnGrid}>
                <View style={[styles.panelSection, isDark && styles.panelDark]}>
                  <SectionTitle title="Places" dark={isDark} />
                  <TextInput
                    value={placeQuery}
                    onChangeText={setPlaceQuery}
                    placeholder="Search campsites, restaurants, activities..."
                    placeholderTextColor={isDark ? '#737373' : '#78716c'}
                    style={[styles.singleLineInput, isDark && styles.inputDark]}
                  />
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={searchPlaces} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Search places</Text>
                  </Pressable>
                  {placeResults.map((place) => (
                    <View key={place.id} style={[styles.placeItem, isDark && styles.innerPanelDark]}>
                      <View style={styles.timelineCopy}>
                        <Text style={[styles.itemTitle, isDark && styles.textDark]}>{place.displayName?.text ?? 'Unnamed place'}</Text>
                        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                          {place.formattedAddress ?? place.primaryType ?? 'Google Places'}
                        </Text>
                      </View>
                      <Pressable style={styles.smallButton} onPress={() => void savePlace(place)} disabled={isLoading}>
                        <Text style={styles.smallButtonText}>Save</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>

                <View style={[styles.panelSection, isDark && styles.panelDark]}>
                  <SectionTitle title="Manual Stop" dark={isDark} />
                  <TextInput value={stopName} onChangeText={setStopName} placeholder="Stop name" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
                  <TextInput value={stopAddress} onChangeText={setStopAddress} placeholder="Address or short description" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.singleLineInput, isDark && styles.inputDark]} />
                  <View style={styles.actionRow}>
                    <TextInput value={stopLatitude} onChangeText={setStopLatitude} placeholder="Latitude" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} inputMode="decimal" />
                    <TextInput value={stopLongitude} onChangeText={setStopLongitude} placeholder="Longitude" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.coordinateInput, isDark && styles.inputDark]} inputMode="decimal" />
                  </View>
                  <TextInput value={stopNotes} onChangeText={setStopNotes} placeholder="Notes" placeholderTextColor={isDark ? '#737373' : '#78716c'} style={[styles.commandInput, isDark && styles.inputDark]} multiline />
                  <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={createManualStop} disabled={isLoading}>
                    <Text style={styles.commandButtonText}>Add stop</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.panelSection, isDark && styles.panelDark]}>
                <SectionTitle title="Day Planner" dark={isDark} />
                {dayPlans.map((dayPlan) => (
                  <View key={dayPlan.key} style={[styles.dayGroup, isDark && styles.innerPanelDark]}>
                    <View style={styles.dayHeader}>
                      <View>
                        <Text style={[styles.dayTitle, isDark && styles.textDark]}>{dayPlan.title}</Text>
                        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                          {dayPlan.nodes.length} stops / {formatDistance(dayPlan.route.distanceMeters)} / {formatDuration(dayPlan.route.durationSeconds)}
                        </Text>
                      </View>
                    </View>
                    {dayPlan.nodes.map((node, index) => (
                      <View key={node.id} style={[styles.timelineItem, isDark && styles.innerPanelDark]}>
                        <View style={styles.timeRail}>
                          <Text style={[styles.timeText, isDark && styles.textDark]}>{formatTime(node.startsAt)}</Text>
                          <View style={[styles.nodeDot, { backgroundColor: nodeColor(node.type) }]} />
                        </View>
                        <View style={styles.timelineCopy}>
                          <Text style={[styles.itemTitle, isDark && styles.textDark]}>{index + 1}. {node.title}</Text>
                          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                            {node.type.toUpperCase()} / {node.notes ?? node.timezone ?? 'local time'}
                          </Text>
                        </View>
                        {itineraryNodes.length > 0 ? (
                          <View style={styles.stopActions}>
                            <Pressable style={styles.smallButton} onPress={() => void scheduleStop(node, 9)} disabled={isLoading}>
                              <Text style={styles.smallButtonText}>AM</Text>
                            </Pressable>
                            <Pressable style={styles.smallButton} onPress={() => void scheduleStop(node, 18)} disabled={isLoading}>
                              <Text style={styles.smallButtonText}>PM</Text>
                            </Pressable>
                            <Pressable style={styles.dangerButton} onPress={() => void removeStop(node.id)} disabled={isLoading}>
                              <Text style={styles.smallButtonText}>Delete</Text>
                            </Pressable>
                          </View>
                        ) : null}
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

type DayPlan = {
  key: string;
  title: string;
  nodes: ItineraryNode[];
  route: RouteSummary;
};

type PlannerRow = {
  id: string;
  date: string;
  place: string;
  lodging: string;
  activity: string;
  cost: string;
  hotel: string;
};

function buildDayPlans(nodes: ItineraryNode[]): DayPlan[] {
  const sortedNodes = sortNodes(nodes);
  const groups = new Map<string, ItineraryNode[]>();

  sortedNodes.forEach((node) => {
    const key = node.startsAt ? node.startsAt.slice(0, 10) : 'unscheduled';
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });

  return Array.from(groups.entries()).map(([key, groupNodes], index) => ({
    key,
    title: key === 'unscheduled' ? 'Unscheduled' : `Day ${index + 1} / ${formatDateLabel(key)}`,
    nodes: groupNodes,
    route: estimateRouteSummary(groupNodes),
  }));
}

function buildPlannerRows(nodes: ItineraryNode[]): PlannerRow[] {
  return sortNodes(nodes).map((node) => {
    const isStay = node.type === 'lodging' || node.type === 'camping';
    return {
      id: node.id,
      date: node.startsAt ? formatDateLabel(node.startsAt.slice(0, 10)) : '',
      place: node.location ? `${node.location.latitude.toFixed(2)}, ${node.location.longitude.toFixed(2)}` : node.timezone ?? '',
      lodging: isStay ? node.title : '',
      activity: isStay ? '' : node.title,
      cost: formatNodeCost(node),
      hotel: formatReservation(node),
    };
  });
}

function formatNodeCost(node: ItineraryNode): string {
  return formatRawNodeCost(node);
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
  sheetTable: {
    minWidth: 860,
    gap: 4,
  },
  sheetRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sheetRowSelected: {
    borderColor: '#635bff',
    borderWidth: 2,
    backgroundColor: '#f2f4ff',
  },
  sheetHeaderRow: {
    minHeight: 36,
    backgroundColor: '#f6f9fc',
  },
  sheetHeaderCell: {
    width: 120,
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sheetCell: {
    width: 120,
    color: '#0a2540',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetWideCell: {
    width: 220,
    color: '#0a2540',
    fontSize: 13,
    fontWeight: '700',
  },
  plannerEditor: {
    gap: 10,
    backgroundColor: '#f6f9fc',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 12,
  },
  sectionTitle: {
    color: '#0a2540',
    fontSize: 18,
    fontWeight: '900',
  },
  dayGroup: {
    gap: 10,
    backgroundColor: '#f6f9fc',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6edf5',
    padding: 12,
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
