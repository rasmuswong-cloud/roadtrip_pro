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
  nextStep: {
    label: string;
    detail: string;
    target: AppView;
  };
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
  nextStep,
  selectedDayPlan,
  styles,
  onGoToView,
}: MapRailProps) {
  const mapNodes = activeView === 'days' && selectedDayPlan ? selectedDayPlan.nodes : displayedNodes;

  return (
    <View style={styles.workspaceMapContext}>
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
        <View style={styles.contextMapShell}>
          <NavigationMap nodes={mapNodes} activeRoute={activeRoute} followUser={false} compact />
        </View>
      </View>
      <View style={styles.contextPanel}>
        <Text style={styles.packingTitle}>Nästa steg</Text>
        <Text style={styles.contextPanelTitle}>{nextStep.label}</Text>
        <Text style={styles.contextPanelText}>{nextStep.detail}</Text>
        <Pressable style={styles.smallButton} onPress={() => onGoToView(nextStep.target)}>
          <Text style={styles.smallButtonText}>Öppna</Text>
        </Pressable>
      </View>
      <View style={styles.contextPanel}>
        <Text style={styles.packingTitle}>Rutt</Text>
        <Text style={styles.contextPanelTitle}>{formatDistance(activeRoute.distanceMeters)}</Text>
        <Text style={styles.contextPanelText}>{formatDuration(activeRoute.durationSeconds)} / {displayedNodes.length} stopp</Text>
        {missingCoordinateCount > 0 ? <Text style={styles.warningText}>{missingCoordinateCount} stopp saknar kartposition.</Text> : null}
      </View>
    </View>
  );
}
