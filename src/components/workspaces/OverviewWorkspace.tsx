import { Pressable, Text, View } from 'react-native';

import { NavigationMap } from '@/components/map/NavigationMap';
import type { AppView } from '@/components/layout/workspaceTypes';
import type { ItineraryNode, RouteSummary } from '@/models';
import type { TripReadiness } from '@/services/planning/tripReadiness';
import { DayInsight, OverviewFocusCard, SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type OverviewWorkspaceProps = {
  activeRoute: RouteSummary;
  budgetSummary: { missingCostCount: number };
  costPerTraveler: number;
  dayCount: number;
  demoRoute: RouteSummary;
  displayedNodes: ItineraryNode[];
  firstRouteStop: ItineraryNode | null;
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
  formatSek: (value: number) => string;
  isDark: boolean;
  isMobile: boolean;
  lastRouteStop: ItineraryNode | null;
  missingCoordinateCount: number;
  styles: WorkspaceStyles;
  totalSpend: number;
  tripReadiness: TripReadiness;
  onGoToView: (view: AppView) => void;
};

export function OverviewWorkspace({
  activeRoute,
  budgetSummary,
  costPerTraveler,
  dayCount,
  demoRoute,
  displayedNodes,
  firstRouteStop,
  formatDistance,
  formatDuration,
  formatSek,
  isDark,
  isMobile,
  lastRouteStop,
  missingCoordinateCount,
  styles,
  totalSpend,
  tripReadiness,
  onGoToView,
}: OverviewWorkspaceProps) {
  const routeForMap = activeRoute.geometry ? activeRoute : demoRoute;
  const setupSteps = [
    {
      label: '1. Planera stopp',
      detail: displayedNodes.length > 0 ? `${displayedNodes.length} stopp ligger i Dagar.` : 'Lägg till första stoppet i Dagar.',
      action: displayedNodes.length > 0 ? 'Öppna Dagar' : 'Lägg till stopp',
      target: 'days' as AppView,
      ready: displayedNodes.length > 0,
    },
    {
      label: '2. Kontrollera rutt',
      detail: missingCoordinateCount > 0 ? `${missingCoordinateCount} stopp saknar kartposition.` : 'Kartpositioner och rutt är redo att granskas.',
      action: missingCoordinateCount > 0 ? 'Fyll i positioner' : 'Öppna Rutt',
      target: 'route' as AppView,
      ready: displayedNodes.length > 0 && missingCoordinateCount === 0,
    },
    {
      label: '3. Fyll i budget',
      detail: budgetSummary.missingCostCount > 0 ? `${budgetSummary.missingCostCount} stopp saknar kostnad.` : 'Budgeten har inga saknade kostnader.',
      action: budgetSummary.missingCostCount > 0 ? 'Fyll i kostnad' : 'Öppna Budget',
      target: 'budget' as AppView,
      ready: displayedNodes.length > 0 && budgetSummary.missingCostCount === 0,
    },
    {
      label: '4. Samla idéer',
      detail: 'Spara restauranger, sevärdheter och lösa tips i Utforska innan du bestämmer dag.',
      action: 'Öppna Utforska',
      target: 'explore' as AppView,
      ready: false,
    },
  ];

  return (
    <View style={[styles.panelSection, isDark && styles.panelDark]}>
      <View style={styles.sectionHeaderRow}>
        <SectionTitle title="Översikt" dark={isDark} styles={styles} />
        <Text style={styles.overviewMeta}>{firstRouteStop?.title ?? 'Start'} → {lastRouteStop?.title ?? 'destination'}</Text>
      </View>
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
          detail={budgetSummary.missingCostCount > 0 ? `${budgetSummary.missingCostCount} stopp saknar kostnad` : `${formatSek(costPerTraveler)} per person`}
          accent={budgetSummary.missingCostCount > 0 ? '#d97706' : '#0f766e'}
          styles={styles}
        />
      </View>
      <View style={styles.readinessPanel}>
        <View style={styles.readinessHeader}>
          <View>
            <Text style={styles.overviewMapKicker}>Kom igång</Text>
            <Text style={styles.readinessTitle}>Bygg resan i fyra steg</Text>
            <Text style={styles.readinessNextText}>Börja i Dagar, kontrollera kartan i Rutt och fyll sedan i kostnaderna.</Text>
          </View>
          <Pressable style={styles.smallButton} onPress={() => onGoToView(tripReadiness.nextStep.target)}>
            <Text style={styles.smallButtonText}>{tripReadiness.nextStep.label}</Text>
          </Pressable>
        </View>
        <View style={[styles.readinessGrid, isMobile && styles.singleColumnGrid]}>
          {setupSteps.map((step) => (
            <View key={step.label} style={[styles.readinessItem, step.ready && styles.readinessItemReady]}>
              <Text style={[styles.readinessLabel, step.ready && styles.readinessLabelReady]}>{step.label}</Text>
              <Text style={styles.readinessDetail}>{step.detail}</Text>
              <Pressable style={styles.secondarySmallButton} onPress={() => onGoToView(step.target)}>
                <Text style={styles.secondarySmallButtonText}>{step.action}</Text>
              </Pressable>
            </View>
          ))}
        </View>
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
        <View style={styles.readinessNextAction}>
          <Text style={styles.readinessNextLabel}>Nästa bästa steg</Text>
          <Text style={styles.readinessNextDetail}>{tripReadiness.nextStep.detail}</Text>
        </View>
        <View style={[styles.readinessGrid, isMobile && styles.singleColumnGrid]}>
          {tripReadiness.items.map((item) => (
            <View key={item.label} style={[styles.readinessItem, item.status === 'ready' && styles.readinessItemReady]}>
              <Text style={[styles.readinessLabel, item.status === 'ready' && styles.readinessLabelReady]}>{item.label}</Text>
              <Text style={styles.readinessDetail}>{item.detail}</Text>
            </View>
          ))}
        </View>
        {tripReadiness.groups.length > 0 ? (
          <View style={styles.readinessIssueGroups}>
            {tripReadiness.groups.map((group) => (
              <View key={group.key} style={styles.readinessIssueGroup}>
                <Text style={styles.readinessGroupTitle}>{group.label}</Text>
                {group.issues.map((issue) => (
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
            ))}
          </View>
        ) : (
          <Text style={styles.readinessReadyText}>{tripReadiness.completedCheckCount} av {tripReadiness.totalCheckCount} kontroller klara. Klar för avresa.</Text>
        )}
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
            <NavigationMap nodes={displayedNodes} activeRoute={routeForMap} followUser={false} compact />
          </View>
        ) : (
          <View testID="overview-center-summary" style={styles.overviewRouteSummaryGrid}>
            <DayInsight label="Stopp" value={`${displayedNodes.length}`} tone="neutral" styles={styles} />
            <DayInsight label="Rutt" value={formatDistance(activeRoute.distanceMeters)} tone="neutral" styles={styles} />
            <DayInsight label="Körning" value={formatDuration(activeRoute.durationSeconds)} tone="neutral" styles={styles} />
            <DayInsight label="Saknar position" value={`${missingCoordinateCount}`} tone={missingCoordinateCount > 0 ? 'warn' : 'good'} styles={styles} />
          </View>
        )}
      </View>
    </View>
  );
}
