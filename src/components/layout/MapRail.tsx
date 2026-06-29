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
  mapExpanded: boolean;
  selectedDayPlan: DayPlan | null;
  styles: any;
  onGoToView: (view: AppView) => void;
  onToggleMapExpanded: () => void;
};

export function MapRail({
  activeRoute,
  activeView,
  displayedNodes,
  formatDistance,
  formatDuration,
  missingCoordinateCount,
  mapExpanded,
  selectedDayPlan,
  styles,
  onGoToView,
  onToggleMapExpanded,
}: MapRailProps) {
  const mapNodes = activeView === 'days' && selectedDayPlan ? selectedDayPlan.nodes : displayedNodes;
  const mapTitle = activeView === 'days' && selectedDayPlan ? selectedDayPlan.shortTitle : 'Hela resan';

  return (
    <View
      testID="desktop-map-rail"
      style={[
        styles.workspaceMapContext,
        activeView === 'route' && styles.workspaceMapContextRoute,
        mapExpanded && styles.workspaceMapContextExpanded,
      ]}
    >
      <View style={styles.contextMapCard}>
        <View style={styles.contextMapHeader}>
          <View>
            <Text style={styles.overviewMapKicker}>Karta</Text>
            <Text style={styles.contextMapTitle}>{mapTitle}</Text>
          </View>
          <View style={styles.mapRailActions}>
            <Pressable style={styles.secondarySmallButton} onPress={onToggleMapExpanded}>
              <Text style={styles.secondarySmallButtonText}>{mapExpanded ? 'Minimera karta' : 'Visa större karta'}</Text>
            </Pressable>
            <Pressable style={styles.secondarySmallButton} onPress={() => onGoToView('route')}>
              <Text style={styles.secondarySmallButtonText}>Rutt</Text>
            </Pressable>
          </View>
        </View>
        <View testID="primary-map-surface" style={[styles.contextMapShell, mapExpanded && styles.contextMapShellExpanded]}>
          <NavigationMap nodes={mapNodes} activeRoute={activeRoute} followUser={false} compact />
        </View>
      </View>
      <View style={styles.contextPanel}>
        <Text style={styles.packingTitle}>Rutt</Text>
        <Text style={styles.contextPanelTitle}>{formatDistance(activeRoute.distanceMeters)}</Text>
        <Text style={styles.contextPanelText}>{formatDuration(activeRoute.durationSeconds)} / {displayedNodes.length} stopp</Text>
        {missingCoordinateCount > 0 ? (
          <>
            <Text style={styles.warningText}>Positioner behöver fixas i Dagar.</Text>
            <Pressable style={styles.secondarySmallButton} onPress={() => onGoToView('days')}>
              <Text style={styles.secondarySmallButtonText}>Fixa position i Dagar</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
