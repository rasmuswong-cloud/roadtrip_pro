import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { NavigationMap } from '@/components/map/NavigationMap';
import { routeMapStatusText } from '@/components/map/mapData';
import DayCard from '@/components/planning/DayCard';
import type { Coordinates, DayChecklistItem, DayPlan, ItineraryNode, RouteSummary } from '@/models';
import type { GooglePlace } from '@/services/google/googlePlaces';
import type { ActiveInlineEdit, InlineFieldKey, InlineFieldValue } from '@/services/planning/inlineEdit';
import { buildPlanningStatus, type PlanningStatusItem } from '@/services/planning/planningStatus';
import { formatDistance, formatDuration } from '@/utils/formatters';
import { DayInsight, SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type DaysWorkspaceProps = {
  activeInlineEdit: ActiveInlineEdit;
  activeRoute: RouteSummary;
  availableDayTargets: Array<{ key: string; title: string }>;
  coordinateSearchMessage: string | null;
  coordinateSearchNodeId: string | null;
  coordinateSearchQuery: string;
  coordinateSearchResults: GooglePlace[];
  dayPlans: DayPlan[];
  draftPlannerDayKey: string | null;
  displayedNodesLength: number;
  filteredStopCount: number;
  formatDayKey: (dayKey: string) => string;
  inlineEditMessage: string | null;
  isDark: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  isMobile: boolean;
  itineraryNodesLength: number;
  packingDraft: string;
  pendingAddLocation: Coordinates | null;
  plannerSearchText: string;
  renderDayPlaceSearch: (dayKey: string) => React.ReactNode;
  renderPlannerInlineEditor: (mode: 'edit' | 'new') => React.ReactNode;
  renderSmartStopPanel: (node: ItineraryNode) => React.ReactNode;
  routeIsCalculated: boolean;
  routeSkippedStopCount: number;
  selectedDayPlan: DayPlan | null;
  selectedPlannerNodeId: string | null;
  styles: WorkspaceStyles;
  suggestedNewDayKey: string;
  visibleDayPlans: DayPlan[];
  onAddManualDay: (dayKey: string) => void;
  onAddPackingItem: (dayPlan: DayPlan) => Promise<void>;
  onAddPlaceholderAfterStop: (node: ItineraryNode) => void;
  onCalculateRoute: () => void;
  onCancelPendingAddLocation: () => void;
  onCancelCoordinateSearch: () => void;
  onChangeCoordinateSearchQuery: (text: string) => void;
  onClearInlineEdit: () => void;
  onConfirmPendingAddLocation: () => void;
  onGoToRoute: () => void;
  onGoToTools: () => void;
  onInlineDraftChange: (changed: boolean) => void;
  onMoveStop: (nodeId: string, direction: -1 | 1) => Promise<void>;
  onMoveStopToDay: (nodeId: string, targetDayKey: string) => Promise<void>;
  onMapPress: (coordinates: Coordinates) => void;
  onRemoveStop: (nodeId: string) => Promise<void>;
  onRunChecklistAction: (dayPlan: DayPlan, item: DayChecklistItem) => void;
  onSaveInlineField: (node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) => Promise<void>;
  onSearchCoordinatePlace: (node: ItineraryNode) => Promise<void>;
  onSelectCoordinatePlace: (node: ItineraryNode, place: GooglePlace) => Promise<void>;
  onSelectDay: (dayKey: string) => void;
  onSelectPlannerNode: (nodeId: string) => void;
  onStartSmartStopSearch: (node: ItineraryNode) => void;
  onSetPackingDraft: (dayKey: string, text: string) => void;
  onSetPlannerSearchText: (text: string) => void;
  onStartCoordinateSearch: (node: ItineraryNode) => void;
  onStartInlineEdit: (nodeId: string, field: InlineFieldKey) => boolean;
  onStartNewPlannerStep: (dayKey: string) => void;
  onStartPlaceSearch: (dayKey: string, suggestedQuery?: string) => void;
  onTogglePackingItem: (dayPlan: DayPlan, item: string) => Promise<void>;
};

export function DaysWorkspace(props: DaysWorkspaceProps) {
  const {
    activeInlineEdit,
    activeRoute,
    availableDayTargets,
    coordinateSearchMessage,
    coordinateSearchNodeId,
    coordinateSearchQuery,
    coordinateSearchResults,
    dayPlans,
    draftPlannerDayKey,
    displayedNodesLength,
    filteredStopCount,
    formatDayKey,
    inlineEditMessage,
    isDark,
    isDemoMode,
    isLoading,
    isMobile,
    itineraryNodesLength,
    packingDraft,
    pendingAddLocation,
    plannerSearchText,
    renderDayPlaceSearch,
    renderPlannerInlineEditor,
    renderSmartStopPanel,
    routeIsCalculated,
    routeSkippedStopCount,
    selectedDayPlan,
    selectedPlannerNodeId,
    styles,
    suggestedNewDayKey,
    visibleDayPlans,
    onAddManualDay,
    onAddPackingItem,
    onAddPlaceholderAfterStop,
    onCalculateRoute,
    onCancelPendingAddLocation,
    onCancelCoordinateSearch,
    onChangeCoordinateSearchQuery,
    onClearInlineEdit,
    onConfirmPendingAddLocation,
    onGoToRoute,
    onGoToTools,
    onInlineDraftChange,
    onMoveStop,
    onMoveStopToDay,
    onMapPress,
    onRemoveStop,
    onRunChecklistAction,
    onSaveInlineField,
    onSearchCoordinatePlace,
    onSelectCoordinatePlace,
    onSelectDay,
    onSelectPlannerNode,
    onStartSmartStopSearch,
    onSetPackingDraft,
    onSetPlannerSearchText,
    onStartCoordinateSearch,
    onStartInlineEdit,
    onStartNewPlannerStep,
    onStartPlaceSearch,
    onTogglePackingItem,
  } = props;
  const [newDayDate, setNewDayDate] = React.useState(suggestedNewDayKey);

  React.useEffect(() => {
    setNewDayDate(suggestedNewDayKey);
  }, [suggestedNewDayKey]);

  const routeForMap = activeRoute.provider === 'google_routes' && activeRoute.geometry ? activeRoute : null;
  const routeStatusText = routeMapStatusText({
    route: routeForMap,
    routeIsCalculated,
    skippedStopCount: routeSkippedStopCount,
    routableStopCount: displayedNodesLength - routeSkippedStopCount,
  });
  const datedVisibleDayPlans = visibleDayPlans.filter((dayPlan) => dayPlan.key !== 'unscheduled');
  const unscheduledDayPlan = visibleDayPlans.find((dayPlan) => dayPlan.key === 'unscheduled') ?? null;
  const planningStatus = buildPlanningStatus({
    dayPlans,
    routeIsCalculated,
    routeSkippedStopCount,
    maxItems: 4,
  });
  const selectedAddLabel = selectedDayPlan?.nodes.length === 0 ? 'Lägg till första stoppet' : 'Lägg till stopp';

  function runPlanningStatusAction(item: PlanningStatusItem) {
    if (item.dayKey) {
      onSelectDay(item.dayKey);
    }

    const node = item.nodeId
      ? dayPlans.flatMap((dayPlan) => dayPlan.nodes).find((candidate) => candidate.id === item.nodeId)
      : null;

    if (item.action === 'smart_stop' && node) {
      onStartSmartStopSearch(node);
      return;
    }

    if (item.action === 'search_location' && node) {
      onStartCoordinateSearch(node);
      return;
    }

    if (item.action === 'calculate_route') {
      onCalculateRoute();
    }
  }

  return (
    <View style={[styles.panelSection, isDark && styles.panelDark]}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <SectionTitle title="Dagar" dark={isDark} styles={styles} />
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
            {isDemoMode ? 'Tryck Redigera för att ändra tider, platser, kostnader och stopp.' : 'Följ resan dag för dag och lägg till nästa stopp där det hör hemma.'}
          </Text>
        </View>
        <View style={styles.plannerSearchWrap}>
          <TextInput
            value={plannerSearchText}
            onChangeText={onSetPlannerSearchText}
            placeholder="Sök stopp, plats, datum, pris..."
            placeholderTextColor={isDark ? '#737373' : '#78716c'}
            style={[styles.plannerSearchInput, isDark && styles.inputDark]}
          />
          {plannerSearchText.trim() ? (
            <Pressable style={styles.clearSearchButton} onPress={() => onSetPlannerSearchText('')}>
              <Text style={styles.clearSearchText}>Rensa</Text>
            </Pressable>
          ) : null}
        </View>
        {!isDemoMode ? (
          <View style={styles.dayHeaderActions}>
            <Pressable testID="add-to-selected-day" style={[styles.commandButton, !selectedDayPlan && styles.disabledButton]} onPress={() => selectedDayPlan && onStartNewPlannerStep(selectedDayPlan.key)} disabled={!selectedDayPlan}>
              <Text style={styles.commandButtonText}>{selectedAddLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {!isDemoMode ? (
        <View style={styles.addDayPanel}>
          <View style={styles.addDayCopy}>
            <Text style={[styles.itemTitle, isDark && styles.textDark]}>Lägg till dag</Text>
            <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
              Förslag: {formatDayKey(suggestedNewDayKey)}. Dagen sparas i resan när du lägger till första stoppet.
            </Text>
          </View>
          <View style={styles.addDayControls}>
            <TextInput
              testID="add-day-date-input"
              value={newDayDate}
              onChangeText={setNewDayDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={isDark ? '#737373' : '#78716c'}
              style={[styles.coordinateInput, isDark && styles.inputDark]}
            />
            <Pressable
              testID="add-day-button"
              style={[styles.commandButton, isLoading && styles.disabledButton]}
              onPress={() => onAddManualDay(newDayDate)}
              disabled={isLoading}
            >
              <Text style={styles.commandButtonText}>Lägg till dag</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {plannerSearchText.trim() ? (
        <Text style={styles.searchResultText}>{filteredStopCount} av {displayedNodesLength} stopp matchar sökningen.</Text>
      ) : null}
      <View style={[styles.dayTripSummaryGrid, isMobile && styles.singleColumnGrid]}>
        <DayInsight label="Dagar" value={`${dayPlans.length}`} tone="neutral" styles={styles} />
        <DayInsight label="Stopp" value={`${displayedNodesLength}`} tone="neutral" styles={styles} />
        <DayInsight label="Rutt" value={formatDistance(activeRoute.distanceMeters)} tone="neutral" styles={styles} />
        <DayInsight label="Körning" value={formatDuration(activeRoute.durationSeconds)} tone="neutral" styles={styles} />
      </View>
      <View style={styles.planningStatusCard}>
        <View style={styles.planningStatusHeader}>
          <View style={styles.flexOne}>
            <Text style={styles.planningStatusTitle}>{planningStatus.title}</Text>
            <Text style={styles.planningStatusSubtitle}>{planningStatus.subtitle}</Text>
          </View>
        </View>
        {planningStatus.items.length > 0 ? (
          <View style={styles.planningStatusList}>
            {planningStatus.items.map((item) => (
              <View key={item.id} style={styles.planningStatusRow}>
                <Text style={styles.planningStatusItemText} numberOfLines={2}>{item.label}</Text>
                <Pressable style={[styles.secondarySmallButton, isLoading && styles.disabledButton]} onPress={() => runPlanningStatusAction(item)} disabled={isLoading}>
                  <Text style={styles.secondarySmallButtonText}>{item.actionLabel}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.planningStatusReadyText}>Inga stora luckor hittades. Finjustera detaljer när du vill.</Text>
        )}
      </View>
      {visibleDayPlans.length > 0 ? (
        <>
          <View style={styles.daySelectorRail}>
            {datedVisibleDayPlans.map((dayPlan) => {
              const isSelected = selectedDayPlan?.key === dayPlan.key;
              const missingInfoCount = dayPlan.smartFlags.filter((flag) => flag !== 'Ser planerad ut').length;
              const actionText = missingInfoCount > 0 ? `${missingInfoCount} saker kvar` : 'Öppna';
              const routeText = formatDaySelectorRoute(dayPlan);

              return (
                <Pressable key={dayPlan.key} style={[styles.daySelectorCard, isSelected && styles.daySelectorCardActive]} onPress={() => onSelectDay(dayPlan.key)}>
                  <View style={styles.daySelectorHeader}>
                    <Text style={[styles.daySelectorTitle, isSelected && styles.daySelectorTitleActive]}>{dayPlan.shortTitle}</Text>
                    <Text style={[styles.daySelectorCount, isSelected && styles.daySelectorCountActive]}>{dayPlan.nodes.length} steg</Text>
                  </View>
                  <Text style={[styles.daySelectorDate, isSelected && styles.daySelectorDateActive]}>{formatDayKey(dayPlan.key)}</Text>
                  <Text style={[styles.daySelectorRoute, isSelected && styles.daySelectorRouteActive]} numberOfLines={1}>{routeText}</Text>
                  <Text style={[styles.daySelectorMissing, missingInfoCount === 0 && styles.daySelectorReady]}>{actionText}</Text>
                </Pressable>
              );
            })}
          </View>
          {unscheduledDayPlan ? (
            <View style={styles.unscheduledDaySection}>
              <Text style={styles.unscheduledDayLabel}>Utanför dagsplanen</Text>
              <Pressable
                testID="unscheduled-day-shortcut"
                style={[styles.daySelectorCard, styles.unscheduledDayCard, selectedDayPlan?.key === unscheduledDayPlan.key && styles.daySelectorCardActive]}
                onPress={() => onSelectDay(unscheduledDayPlan.key)}
              >
                <View style={styles.daySelectorHeader}>
                  <Text style={[styles.daySelectorTitle, selectedDayPlan?.key === unscheduledDayPlan.key && styles.daySelectorTitleActive]}>{unscheduledDayPlan.shortTitle}</Text>
                  <Text style={[styles.daySelectorCount, selectedDayPlan?.key === unscheduledDayPlan.key && styles.daySelectorCountActive]}>{unscheduledDayPlan.nodes.length} poster</Text>
                </View>
                <Text style={[styles.daySelectorDate, selectedDayPlan?.key === unscheduledDayPlan.key && styles.daySelectorDateActive]}>Generella budgetposter och stopp utan datum</Text>
                <Text style={[styles.daySelectorMissing, styles.daySelectorReady]}>Öppna</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
      {selectedDayPlan ? (
        <View testID="selected-day-summary" style={styles.selectedDaySummary}>
          <View>
            <Text style={[styles.dayTitle, isDark && styles.textDark]}>{selectedDayPlan.title.replace(' / ', ' - ')}</Text>
            <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{selectedDayPlan.summary.startPlace} → {selectedDayPlan.summary.endPlace}</Text>
          </View>
          <View style={styles.selectedDayMetricRow}>
            <DayInsight label="Steg" value={`${selectedDayPlan.nodes.length}`} tone="neutral" styles={styles} />
            <DayInsight label="Körning" value={selectedDayPlan.insight.driveLabel} tone={selectedDayPlan.insight.isLongDrive ? 'warn' : 'neutral'} styles={styles} />
            <DayInsight label="Kostnad" value={selectedDayPlan.insight.costLabel} tone={selectedDayPlan.budget.missingCostCount > 0 ? 'warn' : 'good'} styles={styles} />
          </View>
        </View>
      ) : null}
      {visibleDayPlans.length === 0 ? (
        <View style={styles.emptyTripState}>
          <Text style={styles.emptyTripTitle}>{plannerSearchText.trim() ? 'Inga stopp hittades' : 'Börja planera din roadtrip'}</Text>
          <Text style={styles.emptyTripText}>
            {plannerSearchText.trim()
              ? 'Testa ett annat sökord eller rensa sökningen.'
              : 'Lägg till första stoppet, skapa en dag eller importera en plan senare. Det behöver inte vara komplett för att vara användbart.'}
          </Text>
          {!plannerSearchText.trim() && !isDemoMode ? (
            <View style={styles.actionRow}>
              <Pressable testID="empty-add-first-stop" style={styles.commandButton} onPress={() => onStartNewPlannerStep('unscheduled')}>
                <Text style={styles.commandButtonText}>Lägg till första stoppet</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => onStartNewPlannerStep(new Date().toISOString().slice(0, 10))}>
                <Text style={styles.secondaryButtonText}>Skapa dag</Text>
              </Pressable>
            </View>
          ) : null}
          {!plannerSearchText.trim() ? (
            <Pressable style={styles.secondarySmallButton} onPress={onGoToTools}>
              <Text style={styles.secondarySmallButtonText}>Importera/klistra in plan senare</Text>
            </Pressable>
          ) : null}
          {draftPlannerDayKey ? renderPlannerInlineEditor('new') : null}
        </View>
      ) : null}
      {selectedDayPlan ? (
        <DayCard
          key={selectedDayPlan.key}
          availableDayTargets={availableDayTargets}
          dayPlan={selectedDayPlan}
          isDark={isDark}
          isDemoMode={isDemoMode}
          isLoading={isLoading}
          activeInlineEdit={activeInlineEdit}
          inlineEditMessage={inlineEditMessage}
          coordinateSearchNodeId={coordinateSearchNodeId}
          coordinateSearchQuery={coordinateSearchQuery}
          coordinateSearchResults={coordinateSearchResults}
          coordinateSearchMessage={coordinateSearchMessage}
          itineraryNodesLength={itineraryNodesLength}
          packingDraft={packingDraft}
          draftPlannerDayKey={draftPlannerDayKey}
          selectedPlannerNodeId={selectedPlannerNodeId}
          styles={styles}
          renderDayPlaceSearch={renderDayPlaceSearch}
          renderPlannerInlineEditor={renderPlannerInlineEditor}
          renderSmartStopPanel={renderSmartStopPanel}
          onStartPlaceSearch={onStartPlaceSearch}
          onStartNewPlannerStep={onStartNewPlannerStep}
          onAddPlaceholderAfterStop={onAddPlaceholderAfterStop}
          onSelectPlannerNode={onSelectPlannerNode}
          onStartSmartStopSearch={onStartSmartStopSearch}
          onRunChecklistAction={onRunChecklistAction}
          onTogglePackingItem={onTogglePackingItem}
          onAddPackingItem={onAddPackingItem}
          onSetPackingDraft={onSetPackingDraft}
          onStartInlineEdit={onStartInlineEdit}
          onClearInlineEdit={onClearInlineEdit}
          onInlineDraftChange={onInlineDraftChange}
          onSaveInlineField={onSaveInlineField}
          onStartCoordinateSearch={onStartCoordinateSearch}
          onChangeCoordinateSearchQuery={onChangeCoordinateSearchQuery}
          onSearchCoordinatePlace={onSearchCoordinatePlace}
          onSelectCoordinatePlace={onSelectCoordinatePlace}
          onCancelCoordinateSearch={onCancelCoordinateSearch}
          onMoveStop={onMoveStop}
          onMoveStopToDay={onMoveStopToDay}
          onRemoveStop={onRemoveStop}
        />
      ) : null}
      {isMobile && selectedDayPlan ? (
        <View style={styles.mobileMapContext}>
          <View style={styles.contextMapHeader}>
            <View>
              <Text style={styles.overviewMapKicker}>Kartkontext</Text>
              <Text style={styles.contextMapTitle}>{selectedDayPlan.shortTitle}</Text>
            </View>
            <Pressable style={styles.secondarySmallButton} onPress={onGoToRoute}>
              <Text style={styles.secondarySmallButtonText}>Rutt</Text>
            </Pressable>
          </View>
          <View testID="center-mobile-map" style={[styles.contextMapShell, styles.mobileMapContextTall]}>
            <NavigationMap
              nodes={selectedDayPlan.nodes}
              activeRoute={routeForMap}
              followUser={false}
              compact
              pendingAddLocation={pendingAddLocation}
              onCancelPendingAddLocation={onCancelPendingAddLocation}
              onConfirmPendingAddLocation={onConfirmPendingAddLocation}
              onMapPress={onMapPress}
            />
          </View>
          <Text style={styles.routeStageMeta}>{routeStatusText}</Text>
        </View>
      ) : null}
    </View>
  );
}

function formatDaySelectorRoute(dayPlan: DayPlan): string {
  const start = shortenPlaceLabel(dayPlan.summary.startPlace);
  const end = shortenPlaceLabel(dayPlan.summary.endPlace);
  return start === end ? end : `${start} → ${end}`;
}

function shortenPlaceLabel(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 28) {
    return normalized;
  }

  const firstPart = normalized.split(/\s+[→/-]\s+|,\s+/)[0]?.trim() || normalized;
  const candidate = firstPart.length <= 28 ? firstPart : firstPart.slice(0, 28);
  const lastSpace = candidate.lastIndexOf(' ');
  return `${(lastSpace >= 12 ? candidate.slice(0, lastSpace) : candidate).trim()}...`;
}
