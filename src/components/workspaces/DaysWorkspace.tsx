import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { NavigationMap } from '@/components/map/NavigationMap';
import DayCard from '@/components/planning/DayCard';
import type { DayChecklistItem, DayPlan, ItineraryNode, RouteSummary } from '@/models';
import type { GooglePlace } from '@/services/google/googlePlaces';
import type { ActiveInlineEdit, InlineFieldKey, InlineFieldValue } from '@/services/planning/inlineEdit';
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
  demoRoute: RouteSummary;
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
  plannerSearchText: string;
  renderDayPlaceSearch: (dayKey: string) => React.ReactNode;
  renderPlannerInlineEditor: (mode: 'edit' | 'new') => React.ReactNode;
  renderSmartStopPanel: (node: ItineraryNode) => React.ReactNode;
  selectedDayPlan: DayPlan | null;
  selectedPlannerNodeId: string | null;
  styles: WorkspaceStyles;
  visibleDayPlans: DayPlan[];
  onAddPackingItem: (dayPlan: DayPlan) => Promise<void>;
  onAddPlaceholderAfterStop: (node: ItineraryNode) => void;
  onCancelCoordinateSearch: () => void;
  onChangeCoordinateSearchQuery: (text: string) => void;
  onClearInlineEdit: () => void;
  onGoToRoute: () => void;
  onInlineDraftChange: (changed: boolean) => void;
  onMoveStop: (nodeId: string, direction: -1 | 1) => Promise<void>;
  onMoveStopToDay: (nodeId: string, targetDayKey: string) => Promise<void>;
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
    demoRoute,
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
    plannerSearchText,
    renderDayPlaceSearch,
    renderPlannerInlineEditor,
    renderSmartStopPanel,
    selectedDayPlan,
    selectedPlannerNodeId,
    styles,
    visibleDayPlans,
    onAddPackingItem,
    onAddPlaceholderAfterStop,
    onCancelCoordinateSearch,
    onChangeCoordinateSearchQuery,
    onClearInlineEdit,
    onGoToRoute,
    onInlineDraftChange,
    onMoveStop,
    onMoveStopToDay,
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

  const routeForMap = activeRoute.geometry ? activeRoute : demoRoute;

  return (
    <View style={[styles.panelSection, isDark && styles.panelDark]}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <SectionTitle title="Vad händer varje dag?" dark={isDark} styles={styles} />
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
            {isDemoMode ? 'Tryck Redigera för att ändra tider, platser, kostnader och stopp.' : 'Välj dag, följ tidslinjen och lägg till eller redigera stopp.'}
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
            <Pressable style={styles.secondaryButton} onPress={() => onStartNewPlannerStep('unscheduled')}>
              <Text style={styles.secondaryButtonText}>Lägg till oschemalagt</Text>
            </Pressable>
            <Pressable testID="add-to-selected-day" style={[styles.commandButton, !selectedDayPlan && styles.disabledButton]} onPress={() => selectedDayPlan && onStartNewPlannerStep(selectedDayPlan.key)} disabled={!selectedDayPlan}>
              <Text style={styles.commandButtonText}>Lägg till stopp</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {plannerSearchText.trim() ? (
        <Text style={styles.searchResultText}>{filteredStopCount} av {displayedNodesLength} stopp matchar sökningen.</Text>
      ) : null}
      {visibleDayPlans.length > 0 ? (
        <View style={styles.daySelectorRail}>
          {visibleDayPlans.map((dayPlan) => {
            const isSelected = selectedDayPlan?.key === dayPlan.key;
            const missingInfoCount = dayPlan.smartFlags.filter((flag) => flag !== 'Ser planerad ut').length;
            const routeText = dayPlan.summary.startPlace === dayPlan.summary.endPlace
              ? dayPlan.summary.startPlace
              : `${dayPlan.summary.startPlace} → ${dayPlan.summary.endPlace}`;

            return (
              <Pressable key={dayPlan.key} style={[styles.daySelectorCard, isSelected && styles.daySelectorCardActive]} onPress={() => onSelectDay(dayPlan.key)}>
                <View style={styles.daySelectorHeader}>
                  <Text style={[styles.daySelectorTitle, isSelected && styles.daySelectorTitleActive]}>{dayPlan.shortTitle}</Text>
                  <Text style={[styles.daySelectorCount, isSelected && styles.daySelectorCountActive]}>{dayPlan.nodes.length} steg</Text>
                </View>
                <Text style={[styles.daySelectorDate, isSelected && styles.daySelectorDateActive]}>{formatDayKey(dayPlan.key)}</Text>
                <Text style={[styles.daySelectorRoute, isSelected && styles.daySelectorRouteActive]} numberOfLines={1}>{routeText}</Text>
                <Text style={[styles.daySelectorMissing, missingInfoCount === 0 && styles.daySelectorReady]}>{missingInfoCount > 0 ? 'Att komplettera' : 'Klar för nu'}</Text>
              </Pressable>
            );
          })}
        </View>
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
        <View style={styles.emptySearchState}>
          <Text style={styles.emptySearchTitle}>Inga stopp hittades</Text>
          <Text style={styles.emptySearchText}>Testa ett annat sökord eller rensa sökningen. För att bygga vidare kan du lägga till ett oschemalagt stopp eller välja en dag och lägga till stopp där.</Text>
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
          <View testID="center-mobile-map" style={styles.contextMapShell}>
            <NavigationMap nodes={selectedDayPlan.nodes} activeRoute={routeForMap} followUser={false} compact />
          </View>
        </View>
      ) : null}
    </View>
  );
}
