import { Pressable, Text, View } from 'react-native';

import { NavigationMap } from '@/components/map/NavigationMap';
import type { AppView } from '@/components/layout/workspaceTypes';
import type { Coordinates, ItineraryNode, RouteSummary } from '@/models';
import type { TripReadiness } from '@/services/planning/tripReadiness';
import { DayInsight, OverviewFocusCard, SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type OverviewWorkspaceProps = {
  activeRoute: RouteSummary;
  budgetSummary: { missingCostCount: number };
  costPerTraveler: number;
  dayCount: number;
  displayedNodes: ItineraryNode[];
  firstRouteStop: ItineraryNode | null;
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
  formatSek: (value: number) => string;
  isDark: boolean;
  isMobile: boolean;
  lastRouteStop: ItineraryNode | null;
  missingCoordinateCount: number;
  pendingAddLocation: Coordinates | null;
  styles: WorkspaceStyles;
  totalSpend: number;
  tripReadiness: TripReadiness;
  onCancelPendingAddLocation: () => void;
  onConfirmPendingAddLocation: () => void;
  onGoToView: (view: AppView) => void;
  onMapPress: (coordinates: Coordinates) => void;
};

export function OverviewWorkspace({
  activeRoute,
  budgetSummary,
  costPerTraveler,
  dayCount,
  displayedNodes,
  firstRouteStop,
  formatDistance,
  formatDuration,
  formatSek,
  isDark,
  isMobile,
  lastRouteStop,
  missingCoordinateCount,
  pendingAddLocation,
  styles,
  totalSpend,
  tripReadiness,
  onCancelPendingAddLocation,
  onConfirmPendingAddLocation,
  onGoToView,
  onMapPress,
}: OverviewWorkspaceProps) {
  const routeForMap = activeRoute.provider === 'google_routes' && activeRoute.geometry ? activeRoute : null;
  const primaryActions = [
    { label: 'Redigera dagar', target: 'days' as AppView },
    { label: 'Kontrollera rutt', target: 'route' as AppView },
    { label: 'Fyll i budget', target: 'budget' as AppView },
    { label: 'Spara idéer', target: 'explore' as AppView },
  ];
  const openIssues = tripReadiness.groups.flatMap((group) => group.issues).slice(0, 3);

  return (
    <View style={[styles.panelSection, isDark && styles.panelDark]}>
      <View style={styles.sectionHeaderRow}>
        <SectionTitle title="Översikt" dark={isDark} styles={styles} />
        <Text style={styles.overviewMeta}>{firstRouteStop?.title ?? 'Start'} → {lastRouteStop?.title ?? 'destination'}</Text>
      </View>
      {displayedNodes.length === 0 ? (
        <View style={styles.emptyTripState}>
          <Text style={styles.emptyTripTitle}>Börja planera din roadtrip</Text>
          <Text style={styles.emptyTripText}>Skapa första stoppet i Dagar. När resan växer fylls översikten med rutt, körning, budget och nästa steg.</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.commandButton} onPress={() => onGoToView('days')}>
              <Text style={styles.commandButtonText}>Lägg till första stoppet</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => onGoToView('explore')}>
              <Text style={styles.secondaryButtonText}>Spara idéer först</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={[styles.overviewFocusGrid, isMobile && styles.singleColumnGrid]}>
        <OverviewFocusCard
          label="Plan"
          title={`${dayCount} dagar`}
          detail={`${displayedNodes.length} stopp / ${firstRouteStop?.title ?? 'start'} → ${lastRouteStop?.title ?? 'mål'}`}
          accent="#f6b35f"
          styles={styles}
        />
        <OverviewFocusCard
          label="Rutt"
          title={formatDistance(activeRoute.distanceMeters)}
          detail={`${formatDuration(activeRoute.durationSeconds)} körning`}
          accent="#2563eb"
          styles={styles}
        />
        <OverviewFocusCard
          label="Budget"
          title={formatSek(totalSpend)}
          detail={budgetSummary.missingCostCount > 0 ? 'Öppna Budget för detaljer' : `${formatSek(costPerTraveler)} per person`}
          accent={budgetSummary.missingCostCount > 0 ? '#d97706' : '#0f766e'}
          styles={styles}
        />
      </View>
      <View style={[styles.readinessPanel, tripReadiness.isReady && styles.readinessPanelReady]}>
        <View style={styles.readinessHeader}>
          <View>
            <Text style={styles.overviewMapKicker}>Resestatus</Text>
            <Text style={styles.readinessTitle}>{tripReadiness.title}</Text>
            <Text style={styles.readinessNextText}>{tripReadiness.subtitle}</Text>
          </View>
          <Pressable style={styles.smallButton} onPress={() => onGoToView(tripReadiness.nextStep.target)}>
            <Text style={styles.smallButtonText}>{tripReadiness.nextStep.label}</Text>
          </Pressable>
        </View>
        {openIssues.length > 0 ? (
          <View style={styles.readinessIssueGroups}>
            {openIssues.map((issue) => (
              <View key={issue.id} style={styles.readinessIssueRow}>
                <View style={styles.readinessIssueCopy}>
                  <Text style={styles.readinessIssueLabel}>{issue.label}</Text>
                  <Text style={styles.readinessIssueDetail}>{issue.detail}</Text>
                </View>
                <Pressable style={styles.secondarySmallButton} onPress={() => onGoToView(issue.target)}>
                  <Text style={styles.secondarySmallButtonText}>{issue.actionLabel}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.readinessReadyText}>Klar för nu. Fortsätt finjustera stopp, rutt och budget när resan ändras.</Text>
        )}
        <View style={[styles.readinessGrid, isMobile && styles.singleColumnGrid]}>
          {primaryActions.map((action) => (
            <Pressable key={action.label} style={styles.secondarySmallButton} onPress={() => onGoToView(action.target)}>
              <Text style={styles.secondarySmallButtonText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.overviewMapCard}>
        <View style={styles.overviewMapHeader}>
          <View>
            <Text style={styles.overviewMapKicker}>{isMobile ? 'Kartpreview' : 'Ruttöversikt'}</Text>
            <Text style={styles.overviewMapTitle}>Resan på kartan</Text>
          </View>
          <View style={styles.overviewMapActions}>
            <Pressable style={styles.smallButton} onPress={() => onGoToView('route')}>
              <Text style={styles.smallButtonText}>{isMobile ? 'Visa hela kartan' : 'Öppna Rutt'}</Text>
            </Pressable>
          </View>
        </View>
        {isMobile ? (
          <View testID="center-mobile-map" style={styles.overviewMapShell}>
            <NavigationMap
              nodes={displayedNodes}
              activeRoute={routeForMap}
              followUser={false}
              compact
              pendingAddLocation={pendingAddLocation}
              onCancelPendingAddLocation={onCancelPendingAddLocation}
              onConfirmPendingAddLocation={onConfirmPendingAddLocation}
              onMapPress={onMapPress}
            />
          </View>
        ) : (
          <View testID="overview-center-summary" style={styles.overviewRouteSummaryGrid}>
            <DayInsight label="Stopp" value={`${displayedNodes.length}`} tone="neutral" styles={styles} />
            <DayInsight label="Rutt" value={formatDistance(activeRoute.distanceMeters)} tone="neutral" styles={styles} />
            <DayInsight label="Körning" value={formatDuration(activeRoute.durationSeconds)} tone="neutral" styles={styles} />
            <DayInsight label="Positioner" value={missingCoordinateCount > 0 ? `${missingCoordinateCount} kvar` : 'Klara'} tone={missingCoordinateCount > 0 ? 'warn' : 'good'} styles={styles} />
          </View>
        )}
      </View>
    </View>
  );
}
