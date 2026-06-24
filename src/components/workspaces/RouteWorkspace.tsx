import { Pressable, Text, TextInput, View } from 'react-native';

import { NavigationMap } from '@/components/map/NavigationMap';
import type { ItineraryNode, RouteSummary } from '@/models';
import type { FuelEstimate } from '@/services/routing/fuelEstimate';
import { Metric, SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type RouteWorkspaceProps = {
  activeRoute: RouteSummary;
  demoRoute: RouteSummary;
  displayedNodes: ItineraryNode[];
  fuelConsumptionText: string;
  fuelEstimate: FuelEstimate;
  fuelPriceText: string;
  formatDateLabel: (dateKey: string) => string;
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
  formatTime: (value?: string | null) => string;
  isDark: boolean;
  isLoading: boolean;
  isRouteCalculating: boolean;
  isMobile: boolean;
  missingCoordinateCount: number;
  routeCalculationMessage: string | null;
  routeIncludedStopCount: number;
  routeIsCalculated: boolean;
  routeSkippedStopCount: number;
  styles: WorkspaceStyles;
  tripName: string;
  onCalculateRoute: () => void;
  onGoToDays: () => void;
  onSetFuelConsumptionText: (value: string) => void;
  onSetFuelPriceText: (value: string) => void;
};

export function RouteWorkspace({
  activeRoute,
  demoRoute,
  displayedNodes,
  fuelConsumptionText,
  fuelEstimate,
  fuelPriceText,
  formatDateLabel,
  formatDistance,
  formatDuration,
  formatTime,
  isDark,
  isLoading,
  isRouteCalculating,
  isMobile,
  missingCoordinateCount,
  routeCalculationMessage,
  routeIncludedStopCount,
  routeIsCalculated,
  routeSkippedStopCount,
  styles,
  tripName,
  onCalculateRoute,
  onGoToDays,
  onSetFuelConsumptionText,
  onSetFuelPriceText,
}: RouteWorkspaceProps) {
  const routeForMap = activeRoute.geometry ? activeRoute : demoRoute;
  const routeSourceLabel = routeIsCalculated ? 'Google Routes' : 'Offline uppskattning';
  const routeActionLabel = routeIsCalculated ? 'Uppdatera rutt' : 'Beräkna rutt';
  const tooFewStopsWithPosition = routeIncludedStopCount < 2;
  const routeLegs = routeIsCalculated ? (activeRoute.legs ?? []) : [];
  const roundedFuelLiters = Math.round(fuelEstimate.liters).toLocaleString('sv-SE');
  const roundedFuelCost = Math.round(fuelEstimate.totalCost).toLocaleString('sv-SE');
  const roundedFuelCostPerPerson = fuelEstimate.perPersonCost === null
    ? null
    : Math.round(fuelEstimate.perPersonCost).toLocaleString('sv-SE');

  return (
    <View style={styles.routeView}>
      <View style={styles.routeStage}>
        <View style={styles.routeStageHeader}>
          <View>
            <Text style={styles.routeStageKicker}>{isMobile ? 'Interaktiv ruttkarta' : 'Rutt och stopp'}</Text>
            <Text style={styles.routeStageTitle}>{isMobile ? 'Ruttkarta' : 'Ordna resans stopp'}</Text>
          </View>
          <View style={styles.routeHeaderActions}>
            <Pressable
              style={[styles.routeActionButton, (isLoading || isRouteCalculating) && styles.disabledButton]}
              onPress={onCalculateRoute}
              disabled={isLoading || isRouteCalculating}
            >
              <Text style={styles.routeActionButtonText}>{isRouteCalculating ? 'Beräknar...' : routeActionLabel}</Text>
            </Pressable>
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
              <Text style={styles.routeBadgeText}>{routeSourceLabel}</Text>
            </View>
          </View>
        </View>
        <View style={styles.routeStageFooter}>
          <Text style={styles.routeStageMeta}>
            {tooFewStopsWithPosition ? 'Minst två stopp behöver kartposition.' : `${routeIncludedStopCount} stopp ingår`}
          </Text>
          {routeSkippedStopCount > 0 ? <Text style={styles.routeStageMeta}>{routeSkippedStopCount} stopp saknar position och hoppas över.</Text> : null}
          {routeCalculationMessage ? <Text style={styles.routeStageMeta}>{routeCalculationMessage}</Text> : null}
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
          <Text style={styles.routeStageMeta}>{routeSourceLabel}</Text>
        </View>
      </View>

      <View style={[styles.statsRow, isMobile && styles.singleColumnGrid]}>
        <Metric label="Stopp i rutt" value={`${routeIncludedStopCount}`} accent="#0f766e" dark={isDark} styles={styles} />
        <Metric label="Rutt" value={formatDistance(activeRoute.distanceMeters)} accent="#2563eb" dark={isDark} styles={styles} />
        <Metric label="Körning" value={formatDuration(activeRoute.durationSeconds)} accent="#d97706" dark={isDark} styles={styles} />
      </View>

      {routeLegs.length > 0 ? (
        <View style={[styles.panelSection, isDark && styles.panelDark]}>
          <View style={styles.sectionHeaderRow}>
            <SectionTitle title="Delsträckor" dark={isDark} styles={styles} />
            <Text style={styles.overviewMeta}>{routeLegs.length} delsträckor</Text>
          </View>
          <View style={styles.routeStopList}>
            {routeLegs.map((leg, index) => (
              <View key={`${leg.fromTitle}-${leg.toTitle}-${index}`} style={styles.routeStopItem}>
                <View style={styles.routeStopNumber}>
                  <Text style={styles.routeStopNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.routeStopCopy}>
                  <Text style={styles.routeStopTitle}>{leg.fromTitle} → {leg.toTitle}</Text>
                  <Text style={styles.routeStopMeta}>{formatDistance(leg.distanceMeters)} · {formatDuration(leg.durationSeconds)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.panelSection, isDark && styles.panelDark]}>
        <View style={styles.sectionHeaderRow}>
          <SectionTitle title="Bränsleberäkning" dark={isDark} styles={styles} />
          <Text style={styles.overviewMeta}>{routeSourceLabel}</Text>
        </View>
        <View style={[styles.actionRow, isMobile && styles.singleColumnGrid]}>
          <View style={styles.coordinateInputGroup}>
            <Text style={styles.inputLabel}>Förbrukning</Text>
            <TextInput
              value={fuelConsumptionText}
              onChangeText={onSetFuelConsumptionText}
              placeholder="6.5"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={[styles.coordinateInput, isDark && styles.inputDark]}
            />
            <Text style={styles.routeStopMeta}>liter/100 km</Text>
          </View>
          <View style={styles.coordinateInputGroup}>
            <Text style={styles.inputLabel}>Bränslepris</Text>
            <TextInput
              value={fuelPriceText}
              onChangeText={onSetFuelPriceText}
              placeholder="20"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={[styles.coordinateInput, isDark && styles.inputDark]}
            />
            <Text style={styles.routeStopMeta}>kr/liter</Text>
          </View>
        </View>
        <View style={[styles.statsRow, isMobile && styles.singleColumnGrid]}>
          <Metric label="Beräknad bensin" value={`${roundedFuelLiters} liter`} accent="#0f766e" dark={isDark} styles={styles} />
          <Metric label="Bränslekostnad" value={`ca ${roundedFuelCost} kr`} accent="#d97706" dark={isDark} styles={styles} />
          <Metric label="Per person" value={roundedFuelCostPerPerson ? `ca ${roundedFuelCostPerPerson} kr` : 'Saknas'} accent="#2563eb" dark={isDark} styles={styles} />
        </View>
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
