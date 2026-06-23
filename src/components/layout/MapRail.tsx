import { Pressable, Text, View } from 'react-native';

import { NavigationMap } from '@/components/map/NavigationMap';
import type { DayPlan, ItineraryNode, RouteSummary } from '@/models';
import type { AppView } from './workspaceTypes';

type MapRailProps = {
  activeRoute: RouteSummary;
  activeView: AppView;
  displayedNodes: ItineraryNode[];
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
  missingCoordinateCount: number;
  selectedDayPlan: DayPlan | null;
  styles: any;
  onGoToView: (view: AppView) => void;
};

export function MapRail({
  activeRoute,
  activeView,
  displayedNodes,
  formatDistance,
  formatDuration,
  missingCoordinateCount,
  selectedDayPlan,
  styles,
  onGoToView,
}: MapRailProps) {
  const mapNodes = activeView === 'days' && selectedDayPlan ? selectedDayPlan.nodes : displayedNodes;

  return (
    <View testID="desktop-map-rail" style={styles.workspaceMapContext}>
      <View style={styles.contextMapCard}>
        <View style={styles.contextMapHeader}>
          <View>
            <Text style={styles.overviewMapKicker}>Karta</Text>
            <Text style={styles.contextMapTitle}>{activeView === 'days' && selectedDayPlan ? selectedDayPlan.shortTitle : 'Hela resan'}</Text>
          </View>
          <Pressable style={styles.secondarySmallButton} onPress={() => onGoToView('route')}>
            <Text style={styles.secondarySmallButtonText}>Rutt</Text>
          </Pressable>
        </View>
        <View testID="primary-map-surface" style={styles.contextMapShell}>
          <NavigationMap nodes={mapNodes} activeRoute={activeRoute} followUser={false} compact />
        </View>
      </View>
      <View style={styles.contextPanel}>
        <Text style={styles.packingTitle}>Rutt</Text>
        <Text style={styles.contextPanelTitle}>{formatDistance(activeRoute.distanceMeters)}</Text>
        <Text style={styles.contextPanelText}>{formatDuration(activeRoute.durationSeconds)} / {displayedNodes.length} stopp</Text>
        {missingCoordinateCount > 0 ? (
          <>
            <Text style={styles.warningText}>Vissa stopp saknar position.</Text>
            <Pressable style={styles.secondarySmallButton} onPress={() => onGoToView('days')}>
              <Text style={styles.secondarySmallButtonText}>Gå till Dagar</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
