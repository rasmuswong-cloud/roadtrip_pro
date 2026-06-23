import { Pressable, Text, View } from 'react-native';

import { NavigationMap } from '@/components/map/NavigationMap';
import type { ItineraryNode, RouteSummary } from '@/models';
import { Metric, SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type RouteWorkspaceProps = {
  activeRoute: RouteSummary;
  demoRoute: RouteSummary;
  displayedNodes: ItineraryNode[];
  formatDateLabel: (dateKey: string) => string;
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
  formatTime: (value?: string | null) => string;
  isDark: boolean;
  isLoading: boolean;
  isMobile: boolean;
  missingCoordinateCount: number;
  styles: WorkspaceStyles;
  tripName: string;
  onGoToDays: () => void;
};

export function RouteWorkspace({
  activeRoute,
  demoRoute,
  displayedNodes,
  formatDateLabel,
  formatDistance,
  formatDuration,
  formatTime,
  isDark,
  isLoading,
  isMobile,
  missingCoordinateCount,
  styles,
  tripName,
  onGoToDays,
}: RouteWorkspaceProps) {
  const routeForMap = activeRoute.geometry ? activeRoute : demoRoute;

  return (
    <View style={styles.routeView}>
      <View style={styles.routeStage}>
        <View style={styles.routeStageHeader}>
          <View>
            <Text style={styles.routeStageKicker}>{isMobile ? 'Interaktiv ruttkarta' : 'Rutt och stopp'}</Text>
            <Text style={styles.routeStageTitle}>{isMobile ? 'Ruttkarta' : 'Ordna resans stopp'}</Text>
          </View>
          <View style={styles.routeHeaderActions}>
            {missingCoordinateCount > 0 ? (
              <Pressable
                style={[styles.routeActionButton, isLoading && styles.disabledButton]}
                onPress={onGoToDays}
                disabled={isLoading}
              >
                <Text style={styles.routeActionButtonText}>Fixa position i Dagar</Text>
              </Pressable>
            ) : null}
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{displayedNodes.length} stopp</Text>
            </View>
          </View>
        </View>
        {isMobile ? (
          <View testID="center-mobile-map" style={[styles.mapShell, styles.mapShellMobile]}>
            <NavigationMap nodes={displayedNodes} activeRoute={routeForMap} followUser={false} />
            <View style={styles.mapOverlayPanelMobile}>
              <Text style={styles.mapOverlayKicker}>Aktuell plan</Text>
              <Text style={styles.mapOverlayTitle}>{tripName}</Text>
              <Text style={styles.mapOverlayMeta}>{formatDistance(activeRoute.distanceMeters)} / {formatDuration(activeRoute.durationSeconds)}</Text>
            </View>
            <View style={styles.mapLegendMobile}>
              <View style={[styles.legendDot, { backgroundColor: '#0f766e' }]} />
              <Text style={styles.legendText}>planerat stopp</Text>
              <View style={[styles.legendDot, { backgroundColor: '#f6b35f' }]} />
              <Text style={styles.legendText}>rutt</Text>
            </View>
          </View>
        ) : (
          <View testID="route-center-summary" style={styles.routeMapSummaryCard}>
            <Text style={styles.overviewMapKicker}>Kartvy</Text>
            <Text style={styles.routeStageTitle}>Kartan ligger till höger</Text>
            <Text style={styles.routeStageMeta}>Använd den stora kartpanelen för markörer, rutt och kartkontext medan du arbetar med stoppordningen här.</Text>
          </View>
        )}
        <View style={styles.routeStageFooter}>
          <Text style={styles.routeStageMeta}>{formatDistance(activeRoute.distanceMeters)} rutt</Text>
          <Text style={styles.routeStageMeta}>{formatDuration(activeRoute.durationSeconds)} körning</Text>
          {missingCoordinateCount > 0 ? <Text style={styles.routeStageMeta}>{missingCoordinateCount} positioner att fixa</Text> : null}
        </View>
      </View>

      <View style={[styles.statsRow, isMobile && styles.singleColumnGrid]}>
        <Metric label="Stopp" value={`${displayedNodes.length}`} accent="#0f766e" dark={isDark} styles={styles} />
        <Metric label="Rutt" value={formatDistance(activeRoute.distanceMeters)} accent="#2563eb" dark={isDark} styles={styles} />
        <Metric label="Körning" value={formatDuration(activeRoute.durationSeconds)} accent="#d97706" dark={isDark} styles={styles} />
      </View>

      <View style={[styles.panelSection, isDark && styles.panelDark]}>
        <View style={styles.sectionHeaderRow}>
          <SectionTitle title="Stopp i ordning" dark={isDark} styles={styles} />
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
                  {[formatDateLabel(node.startsAt?.slice(0, 10) ?? 'unscheduled'), formatTime(node.startsAt), node.location ? 'kartposition klar' : 'Fixa position i Dagar'].filter(Boolean).join(' / ')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
