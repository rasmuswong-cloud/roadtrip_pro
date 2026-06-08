import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
          <View>
            <Text style={[styles.kicker, isDark && styles.textMutedDark]}>ReseApp</Text>
            <Text style={[styles.title, isDark && styles.textDark]}>{demoTrip.name}</Text>
          </View>
          <Pressable style={[styles.syncButton, isLoading && styles.disabledButton]} onPress={connectSupabaseTrip} disabled={isLoading}>
            <Text style={styles.syncButtonText}>{isLoading ? 'Wait' : activeTripId ? 'Synced' : 'Connect'}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={[styles.statusPanel, isDark && styles.panelDark]}>
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
              <View style={styles.mapShell}>
                <NavigationMap nodes={displayedNodes} activeRoute={routeSummary.geometry ? routeSummary : demoRoute} followUser={false} />
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
                      <View key={row.id} style={[styles.sheetRow, isDark && styles.innerPanelDark]}>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.date}</Text>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.place}</Text>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.lodging}</Text>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.activity}</Text>
                        <Text style={[styles.sheetCell, isDark && styles.textDark]}>{row.cost}</Text>
                        <Text style={[styles.sheetWideCell, isDark && styles.textDark]}>{row.hotel}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
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
  const cost = node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price;
  if (typeof cost === 'number') {
    return `${cost} SEK`;
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
    backgroundColor: '#eef2f3',
  },
  screenDark: {
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 18,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d6d3d1',
  },
  headerDark: {
    backgroundColor: '#0b0b0b',
    borderBottomColor: '#242424',
  },
  kicker: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#1c1917',
    fontSize: 30,
    fontWeight: '800',
  },
  syncButton: {
    backgroundColor: '#0f766e',
    borderRadius: 6,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  mapShell: {
    height: 390,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3d1',
    backgroundColor: '#101820',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    padding: 24,
    gap: 18,
  },
  dashboardGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
    flexWrap: 'wrap',
  },
  sidebarColumn: {
    width: 330,
    gap: 14,
  },
  mainColumn: {
    flex: 1,
    minWidth: 620,
    gap: 16,
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
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dedbd6',
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metric: {
    flex: 1,
    minWidth: 150,
    minHeight: 88,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderTopWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dedbd6',
    padding: 14,
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: '#57534e',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#1c1917',
    fontSize: 18,
    fontWeight: '800',
  },
  sheetTable: {
    minWidth: 860,
    gap: 6,
  },
  sheetRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8faf9',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e7e5e4',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sheetHeaderRow: {
    minHeight: 38,
    backgroundColor: '#e7f0ed',
  },
  sheetHeaderCell: {
    width: 120,
    color: '#1c1917',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sheetCell: {
    width: 120,
    color: '#1c1917',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetWideCell: {
    width: 220,
    color: '#1c1917',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#1c1917',
    fontSize: 17,
    fontWeight: '800',
  },
  dayGroup: {
    gap: 10,
    backgroundColor: '#f8faf9',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e7e5e4',
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
    color: '#1c1917',
    fontSize: 15,
    fontWeight: '900',
  },
  timelineItem: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8faf9',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e7e5e4',
    padding: 14,
  },
  timeRail: {
    width: 62,
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#1c1917',
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
    color: '#1c1917',
    fontSize: 16,
    fontWeight: '800',
  },
  itemMeta: {
    color: '#57534e',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  commandInput: {
    minHeight: 94,
    color: '#1c1917',
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
    backgroundColor: '#f8faf9',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3d1',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  singleLineInput: {
    minHeight: 44,
    color: '#1c1917',
    fontSize: 15,
    backgroundColor: '#f8faf9',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3d1',
    paddingHorizontal: 12,
  },
  coordinateInput: {
    minHeight: 44,
    minWidth: 140,
    flex: 1,
    color: '#1c1917',
    fontSize: 15,
    backgroundColor: '#f8faf9',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3d1',
    paddingHorizontal: 12,
  },
  commandButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderRadius: 6,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButton: {
    backgroundColor: '#44403c',
    borderRadius: 6,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
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
    color: '#1c1917',
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
    minHeight: 46,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dedbd6',
    paddingHorizontal: 16,
  },
  statusText: {
    color: '#57534e',
    fontSize: 13,
    fontWeight: '700',
  },
  placeItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8faf9',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e7e5e4',
    padding: 14,
  },
  smallButton: {
    backgroundColor: '#0f766e',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dangerButton: {
    backgroundColor: '#b91c1c',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
