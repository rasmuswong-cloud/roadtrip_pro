import { Pressable, Text, View } from 'react-native';

import { NavigationMap } from '@/components/map/NavigationMap';
import { routeMapStatusText } from '@/components/map/mapData';
import type { Coordinates, DayPlan, ItineraryNode, RouteSummary } from '@/models';
import type { AppView } from './workspaceTypes';

type MapRailProps = {
  activeRoute: RouteSummary | null;
  activeView: AppView;
  displayedNodes: ItineraryNode[];
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
  missingCoordinateCount: number;
  mapExpanded: boolean;
  pendingAddLocation: Coordinates | null;
  routeIsCalculated: boolean;
  routeSkippedStopCount: number;
  routableStopCount: number;
  selectedDayPlan: DayPlan | null;
  styles: any;
  onCancelPendingAddLocation: () => void;
  onConfirmPendingAddLocation: () => void;
  onGoToView: (view: AppView) => void;
  onMapPress: (coordinates: Coordinates) => void;
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
  pendingAddLocation,
  routeIsCalculated,
  routeSkippedStopCount,
  routableStopCount,
  selectedDayPlan,
  styles,
  onCancelPendingAddLocation,
  onConfirmPendingAddLocation,
  onGoToView,
  onMapPress,
  onToggleMapExpanded,
}: MapRailProps) {
  const mapNodes = activeRoute ? displayedNodes : activeView === 'days' && selectedDayPlan ? selectedDayPlan.nodes : displayedNodes;
  const mapTitle = activeRoute ? 'Hela körvägen' : activeView === 'days' && selectedDayPlan ? selectedDayPlan.shortTitle : 'Hela resan';
  const hasGoogleRouteGeometry = Boolean(activeRoute?.provider === 'google_routes' && activeRoute.geometry);
  const statusText = routeMapStatusText({
    route: activeRoute,
    routeIsCalculated,
    skippedStopCount: routeSkippedStopCount,
    routableStopCount,
  });

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
          <NavigationMap
            nodes={mapNodes}
            activeRoute={activeRoute}
            followUser={false}
            compact
            pendingAddLocation={pendingAddLocation}
            onCancelPendingAddLocation={onCancelPendingAddLocation}
            onConfirmPendingAddLocation={onConfirmPendingAddLocation}
            onMapPress={onMapPress}
          />
        </View>
      </View>
      <View style={styles.contextPanel}>
        <Text style={styles.packingTitle}>Rutt</Text>
        <Text style={styles.contextPanelTitle}>{hasGoogleRouteGeometry ? formatDistance(activeRoute!.distanceMeters) : 'Ingen vägrutt'}</Text>
        <Text style={styles.contextPanelText}>
          {hasGoogleRouteGeometry ? `${formatDuration(activeRoute!.durationSeconds)} / ${displayedNodes.length} stopp` : 'Beräkna rutt för att visa Google-vägdata.'}
        </Text>
        <Text testID="map-rail-route-status" style={styles.contextPanelText}>{statusText}</Text>
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
