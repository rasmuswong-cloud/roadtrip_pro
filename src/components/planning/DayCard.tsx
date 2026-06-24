import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import { dayCardStyles } from './DayCard.styles';
import {
  buildMissingInfoChips,
  compactNote,
  coordinateStatusLabel,
  formatItineraryTime,
  formatRawNodeCost,
  nodeColor,
  shouldShowStaleCoordinateWarning,
} from './dayCardViewModel';
import { DayHeader } from './DayHeader';
import { DayChecklistPanel } from './DayChecklistPanel';
import { DayPackingPanel } from './DayPackingPanel';
import { DaySummary } from './DaySummary';
import { InlineEditableField, InlineEditableSelect } from './InlineEditableControls';
import { MissingInfoChips } from './MissingInfoChips';
import { StopDetailsGrid } from './StopDetailsGrid';

import type { DayChecklistItem, DayPlan } from '@/models';
import type { ItineraryNode } from '@/models';
import type { GooglePlace } from '@/services/google/googlePlaces';
import { isPlaceholderStop, placeholderIntent, placeholderStatusChips } from '@/services/planning/placeholderStops';
import {
  displayInlineFieldValue,
  formatNodeType,
  inlineFieldValue,
  inlineNodeTypes,
  type ActiveInlineEdit,
  type InlineFieldKey,
  type InlineFieldValue,
} from '@/services/planning/inlineEdit';

type DayCardProps = {
  availableDayTargets: DayMoveTarget[];
  dayPlan: DayPlan;
  isDark: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  activeInlineEdit: ActiveInlineEdit;
  inlineEditMessage: string | null;
  coordinateSearchNodeId: string | null;
  coordinateSearchQuery: string;
  coordinateSearchResults: GooglePlace[];
  coordinateSearchMessage: string | null;
  itineraryNodesLength: number;
  packingDraft: string;
  draftPlannerDayKey: string | null;
  selectedPlannerNodeId: string | null;
  styles: WorkspaceStyles;
  renderDayPlaceSearch: (dayKey: string) => React.ReactNode;
  renderPlannerInlineEditor: (mode: 'edit' | 'new') => React.ReactNode;
  renderSmartStopPanel: (node: ItineraryNode) => React.ReactNode;
  onStartPlaceSearch: (dayKey: string, suggestedQuery?: string) => void;
  onStartNewPlannerStep: (dayKey: string) => void;
  onAddPlaceholderAfterStop: (node: ItineraryNode) => void;
  onSelectPlannerNode: (nodeId: string) => void;
  onStartSmartStopSearch: (node: ItineraryNode) => void;
  onRunChecklistAction: (dayPlan: DayPlan, item: DayChecklistItem) => void;
  onTogglePackingItem: (dayPlan: DayPlan, item: string) => Promise<void>;
  onAddPackingItem: (dayPlan: DayPlan) => Promise<void>;
  onSetPackingDraft: (dayKey: string, text: string) => void;
  onStartInlineEdit: (nodeId: string, field: InlineFieldKey) => boolean;
  onClearInlineEdit: () => void;
  onInlineDraftChange: (changed: boolean) => void;
  onSaveInlineField: (node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) => Promise<void>;
  onStartCoordinateSearch: (node: ItineraryNode) => void;
  onChangeCoordinateSearchQuery: (text: string) => void;
  onSearchCoordinatePlace: (node: ItineraryNode) => Promise<void>;
  onSelectCoordinatePlace: (node: ItineraryNode, place: GooglePlace) => Promise<void>;
  onCancelCoordinateSearch: () => void;
  onMoveStop: (nodeId: string, direction: -1 | 1) => Promise<void>;
  onMoveStopToDay: (nodeId: string, targetDayKey: string) => Promise<void>;
  onRemoveStop: (nodeId: string) => Promise<void>;
};

type DayMoveTarget = {
  key: string;
  title: string;
};

export default function DayCard(props: DayCardProps) {
  const {
    availableDayTargets,
    dayPlan,
    isDark,
    isDemoMode,
    isLoading,
    activeInlineEdit,
    inlineEditMessage,
    coordinateSearchNodeId,
    coordinateSearchQuery,
    coordinateSearchResults,
    coordinateSearchMessage,
    itineraryNodesLength,
    packingDraft,
    draftPlannerDayKey,
    selectedPlannerNodeId,
    styles,
    renderDayPlaceSearch,
    renderPlannerInlineEditor,
    renderSmartStopPanel,
    onStartPlaceSearch,
    onStartNewPlannerStep,
    onAddPlaceholderAfterStop,
    onSelectPlannerNode,
    onStartSmartStopSearch,
    onRunChecklistAction,
    onTogglePackingItem,
    onAddPackingItem,
    onSetPackingDraft,
    onStartInlineEdit,
    onClearInlineEdit,
    onInlineDraftChange,
    onSaveInlineField,
    onStartCoordinateSearch,
    onChangeCoordinateSearchQuery,
    onSearchCoordinatePlace,
    onSelectCoordinatePlace,
    onCancelCoordinateSearch,
    onMoveStop,
    onMoveStopToDay,
    onRemoveStop,
  } = props;
  const [expandedFlags, setExpandedFlags] = useState(false);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [packingExpanded, setPackingExpanded] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const [openMenuNodeId, setOpenMenuNodeId] = useState<string | null>(null);
  const [movePickerNodeId, setMovePickerNodeId] = useState<string | null>(null);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);

  function toggleNodeDetails(nodeId: string) {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  return (
    <View key={dayPlan.key} style={[styles.dayGroup, isDark && styles.innerPanelDark]}>
      <DayHeader
        dayPlan={dayPlan}
        expandedFlags={expandedFlags}
        isDark={isDark}
        isDemoMode={isDemoMode}
        isLoading={isLoading}
        styles={styles}
        onToggleExpandedFlags={() => setExpandedFlags((current) => !current)}
        onStartPlaceSearch={onStartPlaceSearch}
        onStartNewPlannerStep={onStartNewPlannerStep}
      />
      {renderDayPlaceSearch(dayPlan.key)}
      {draftPlannerDayKey === dayPlan.key ? renderPlannerInlineEditor('new') : null}
      <DaySummary dayPlan={dayPlan} styles={styles} />
      <DayChecklistPanel
        dayPlan={dayPlan}
        expanded={checklistExpanded}
        isDemoMode={isDemoMode}
        isLoading={isLoading}
        styles={styles}
        onToggleExpanded={() => setChecklistExpanded((current) => !current)}
        onRunChecklistAction={onRunChecklistAction}
      />
      <DayPackingPanel
        dayPlan={dayPlan}
        expanded={packingExpanded}
        isDark={isDark}
        isDemoMode={isDemoMode}
        isLoading={isLoading}
        packingDraft={packingDraft}
        styles={styles}
        onToggleExpanded={() => setPackingExpanded((current) => !current)}
        onTogglePackingItem={onTogglePackingItem}
        onAddPackingItem={onAddPackingItem}
        onSetPackingDraft={onSetPackingDraft}
      />
      <View style={dayCardStyles.timelineHeader}>
        <Text style={styles.packingTitle}>Tidslinje</Text>
        <Text style={styles.secondarySmallButtonText}>{dayPlan.nodes.length > 0 ? `${dayPlan.nodes.length} steg` : 'Tom dag'}</Text>
      </View>
      {dayPlan.nodes.length === 0 ? (
        <View style={styles.emptySearchState}>
          <Text style={styles.emptySearchTitle}>Inget planerat än</Text>
          <Text style={styles.emptySearchText}>Börja med “Lägg till stopp”. När stopp finns här kan du klicka på tid, plats, kostnad eller “Redigera” för att fylla i detaljer.</Text>
        </View>
      ) : null}
      {dayPlan.nodes.map((node) => {
        const detailsExpanded = expandedNodeIds.has(node.id);
        const menuOpen = openMenuNodeId === node.id;
        const movePickerOpen = movePickerNodeId === node.id;
        const deleteConfirmOpen = pendingDeleteNodeId === node.id;
        const notePreview = compactNote(node.notes);
        const canEdit = itineraryNodesLength > 0 && !isDemoMode;
        const targetDays = availableDayTargets.filter((target) => target.key !== dayPlan.key);
        const placeholder = isPlaceholderStop(node);
        const missingMapPosition = canEdit && !node.location && !placeholder;
        const coordinateStatus = coordinateStatusLabel(node);
        const coordinateActionLabel = coordinateStatus ? 'Byt Google-plats' : inlineFieldValue(node, 'place') ? 'Fixa position' : 'Sök plats';
        const showCoordinatePrompt = canEdit && shouldShowStaleCoordinateWarning(node);
        const coordinateSearchOpen = coordinateSearchNodeId === node.id;
        const missingInfoChips = buildMissingInfoChips(node);
        const fullEditorOpen = selectedPlannerNodeId === node.id;
        const placeholderChips = placeholderStatusChips(node);

        return (
          <View
            key={node.id}
            testID="day-stop-card"
            style={[styles.timelineItem, fullEditorOpen && styles.timelineItemEditing, isDark && styles.innerPanelDark]}
          >
            <View style={dayCardStyles.timeRailCompact}>
              {canEdit ? (
                <InlineEditableField
                  node={node}
                  field="startTime"
                  activeInlineEdit={activeInlineEdit}
                  label="Start"
                  placeholder="TT:MM"
                  isDark={isDark}
                  loading={isLoading}
                  disabled={isDemoMode || isLoading}
                  styles={styles}
                  onStart={onStartInlineEdit}
                  onCancel={onClearInlineEdit}
                  onDraftChange={onInlineDraftChange}
                  onSave={onSaveInlineField}
                  inputStyle={styles.quickCellSmall}
                  inactiveStyle={dayCardStyles.inlineTimeField}
                  inactiveValueStyle={styles.timeText}
                  showInactiveLabel={false}
                />
              ) : (
                <Text style={[styles.timeText, isDark && styles.textDark]}>{formatItineraryTime(node.startsAt)}</Text>
              )}
              <View style={[styles.nodeDot, { backgroundColor: nodeColor(node.type) }]} />
            </View>

            <View style={dayCardStyles.stopCompactBody}>
              <View style={dayCardStyles.stopMainRow}>
                <View style={dayCardStyles.stopTitleBlock}>
                  {canEdit ? (
                    <InlineEditableField
                      node={node}
                      field="title"
                      activeInlineEdit={activeInlineEdit}
                      label="Titel"
                      isDark={isDark}
                      loading={isLoading}
                      disabled={isDemoMode || isLoading}
                      styles={styles}
                      onStart={onStartInlineEdit}
                      onCancel={onClearInlineEdit}
                      onDraftChange={onInlineDraftChange}
                      onSave={onSaveInlineField}
                      inputStyle={styles.quickCellTitle}
                      inactiveStyle={dayCardStyles.inlineTitleField}
                      inactiveValueStyle={styles.itemTitle}
                      showInactiveLabel={false}
                    />
                  ) : (
                    <Text style={[styles.itemTitle, isDark && styles.textDark]}>{node.title}</Text>
                  )}
                  <View style={dayCardStyles.stopMetaRow}>
                    {canEdit ? (
                      <InlineEditableSelect
                        node={node}
                        field="type"
                        activeInlineEdit={activeInlineEdit}
                        label="Typ"
                        options={inlineNodeTypes.map((type) => ({ value: type, label: formatNodeType(type) }))}
                        isDark={isDark}
                        loading={isLoading}
                        disabled={isDemoMode || isLoading}
                        styles={styles}
                        onStart={onStartInlineEdit}
                        onCancel={onClearInlineEdit}
                        onDraftChange={onInlineDraftChange}
                        onSave={onSaveInlineField}
                        inactiveStyle={dayCardStyles.inlineBadgeField}
                        inactiveValueStyle={dayCardStyles.inlineBadgeText}
                        showInactiveLabel={false}
                      />
                    ) : (
                      <Text style={styles.nodeInfoPill}>{formatNodeType(node.type)}</Text>
                    )}
                    {canEdit ? (
                      <InlineEditableField
                        node={node}
                        field="place"
                        activeInlineEdit={activeInlineEdit}
                        label="Plats"
                        isDark={isDark}
                        loading={isLoading}
                        disabled={isDemoMode || isLoading}
                        styles={styles}
                        onStart={onStartInlineEdit}
                        onCancel={onClearInlineEdit}
                        onDraftChange={onInlineDraftChange}
                        onSave={onSaveInlineField}
                        inactiveStyle={dayCardStyles.inlineMetaField}
                        inactiveValueStyle={styles.itemMeta}
                        showInactiveLabel={false}
                      />
                    ) : (
                      <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{displayInlineFieldValue(node, 'place')}</Text>
                    )}
                  </View>
                  <MissingInfoChips chips={missingInfoChips} />
                  {placeholder ? (
                    <View style={styles.coordinateWarningBox}>
                      <Text style={[styles.itemTitle, isDark && styles.textDark]}>Planerat men inte bestämt</Text>
                      <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{placeholderIntent(node)}</Text>
                      <View style={styles.exploreChipRow}>
                        {placeholderChips.map((chip) => (
                          <Text key={chip} style={styles.exploreStatusChip}>{chip}</Text>
                        ))}
                      </View>
                      <View style={styles.stopActions}>
                        <Pressable
                          style={[styles.smallButton, isLoading && styles.disabledButton]}
                          onPress={() => onStartSmartStopSearch(node)}
                          disabled={isLoading}
                        >
                          <Text style={styles.smallButtonText}>Hitta smart mellanstopp</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondarySmallButton, isLoading && styles.disabledButton]}
                          onPress={() => onStartCoordinateSearch(node)}
                          disabled={isLoading}
                        >
                          <Text style={styles.secondarySmallButtonText}>Välj Google-plats</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  {missingMapPosition ? (
                    <Pressable
                      style={[styles.secondarySmallButton, isLoading && styles.disabledButton]}
                      onPress={() => onStartCoordinateSearch(node)}
                      disabled={isLoading}
                    >
                      <Text style={styles.secondarySmallButtonText}>{coordinateActionLabel}</Text>
                    </Pressable>
                  ) : null}
                  {canEdit && coordinateStatus ? (
                    <View style={dayCardStyles.coordinateReadyRow}>
                      <Text style={styles.nodeInfoPill}>{coordinateStatus}</Text>
                      <Pressable
                        style={[styles.secondarySmallButton, isLoading && styles.disabledButton]}
                        onPress={() => onStartCoordinateSearch(node)}
                        disabled={isLoading}
                      >
                        <Text style={styles.secondarySmallButtonText}>Byt Google-plats</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {showCoordinatePrompt ? (
                    <View style={styles.coordinateWarningBox}>
                      <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                        Platsnamnet kan ha ändrats, men kartkoordinaterna behålls tills du väljer en ny plats.
                      </Text>
                      <Pressable
                        style={[styles.secondarySmallButton, isLoading && styles.disabledButton]}
                        onPress={() => onStartCoordinateSearch(node)}
                        disabled={isLoading}
                      >
                        <Text style={styles.secondarySmallButtonText}>Byt Google-plats</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {coordinateSearchOpen ? (
                    <View style={[styles.coordinateSearchPanel, isDark && styles.innerPanelDark]}>
                      <Text style={[styles.itemTitle, isDark && styles.textDark]}>Sök Google-plats</Text>
                      <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                        Välj ett Google-resultat för att spara platsnamn, adress och kartposition på stoppet.
                      </Text>
                      <View style={styles.actionRow}>
                        <TextInput
                          value={coordinateSearchQuery}
                          onChangeText={onChangeCoordinateSearchQuery}
                          placeholder="Sök kartposition"
                          placeholderTextColor={isDark ? '#737373' : '#78716c'}
                          style={[styles.coordinateSearchInput, isDark && styles.inputDark]}
                        />
                        <Pressable
                          style={[styles.smallButton, isLoading && styles.disabledButton]}
                          onPress={() => void onSearchCoordinatePlace(node)}
                          disabled={isLoading}
                        >
                          <Text style={styles.smallButtonText}>Sök</Text>
                        </Pressable>
                        <Pressable style={styles.secondarySmallButton} onPress={onCancelCoordinateSearch} disabled={isLoading}>
                          <Text style={styles.secondarySmallButtonText}>Avbryt</Text>
                        </Pressable>
                      </View>
                      {coordinateSearchMessage ? <Text style={styles.validationText}>{coordinateSearchMessage}</Text> : null}
                      {coordinateSearchResults.length > 0 ? (
                        <View style={styles.placeResultList}>
                          {coordinateSearchResults.map((place) => (
                            <View key={place.id} style={[styles.placeItem, isDark && styles.innerPanelDark]}>
                              <View style={styles.timelineCopy}>
                                <Text style={[styles.itemTitle, isDark && styles.textDark]}>{place.displayName?.text ?? 'Namnlös plats'}</Text>
                                <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
                                  {[place.formattedAddress, place.rating ? `${place.rating} i betyg` : null, place.primaryType].filter(Boolean).join(' / ')}
                                </Text>
                              </View>
                              <Pressable
                                style={[styles.smallButton, isLoading && styles.disabledButton]}
                                onPress={() => void onSelectCoordinatePlace(node, place)}
                                disabled={isLoading}
                              >
                                <Text style={styles.smallButtonText}>Välj</Text>
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                <View style={dayCardStyles.stopRightRail}>
                  {canEdit ? (
                    <InlineEditableField
                      node={node}
                      field="cost"
                      activeInlineEdit={activeInlineEdit}
                      label="Kostnad"
                      isDark={isDark}
                      loading={isLoading}
                      disabled={isDemoMode || isLoading}
                      styles={styles}
                      onStart={onStartInlineEdit}
                      onCancel={onClearInlineEdit}
                      onDraftChange={onInlineDraftChange}
                      onSave={onSaveInlineField}
                      inputStyle={styles.quickCellSmall}
                      inactiveStyle={dayCardStyles.inlineCostField}
                      inactiveValueStyle={dayCardStyles.inlineCostText}
                      showInactiveLabel={false}
                    />
                  ) : (
                    <Text style={dayCardStyles.inlineCostText}>{formatRawNodeCost(node) || 'Fyll i kostnad'}</Text>
                  )}
                  {canEdit ? (
                    <View style={dayCardStyles.stopMenuWrap}>
                      <Pressable
                        testID="stop-menu-button"
                        style={[dayCardStyles.iconMenuButton, isLoading && styles.disabledButton]}
                        onPress={() => setOpenMenuNodeId((current) => (current === node.id ? null : node.id))}
                        disabled={isLoading}
                      >
                        <Text style={dayCardStyles.iconMenuText}>Mer</Text>
                      </Pressable>
                      {menuOpen ? (
                        <View style={dayCardStyles.stopMenuPanel}>
                          <Pressable
                            testID="stop-edit-form-action"
                            style={dayCardStyles.stopMenuItem}
                            onPress={() => {
                              toggleNodeDetails(node.id);
                              setOpenMenuNodeId(null);
                              setMovePickerNodeId(null);
                            }}
                          >
                            <Text style={styles.secondarySmallButtonText}>{detailsExpanded ? 'Dölj detaljer' : 'Visa detaljer'}</Text>
                          </Pressable>
                          <Pressable
                            testID="stop-menu-full-editor"
                            style={dayCardStyles.stopMenuItem}
                            onPress={() => {
                              onSelectPlannerNode(node.id);
                              setOpenMenuNodeId(null);
                              setMovePickerNodeId(null);
                            }}
                          >
                            <Text style={styles.secondarySmallButtonText}>Redigera</Text>
                          </Pressable>
                          <Pressable
                            style={dayCardStyles.stopMenuItem}
                            onPress={() => setMovePickerNodeId((current) => (current === node.id ? null : node.id))}
                          >
                            <Text style={styles.secondarySmallButtonText}>Flytta</Text>
                          </Pressable>
                          {movePickerOpen ? (
                            <View style={dayCardStyles.stopMovePanel}>
                              {targetDays.length > 0 ? targetDays.map((target) => (
                                <Pressable
                                  key={target.key}
                                  style={[dayCardStyles.stopMenuItem, isLoading && styles.disabledButton]}
                                  onPress={() => {
                                    setOpenMenuNodeId(null);
                                    setMovePickerNodeId(null);
                                    void onMoveStopToDay(node.id, target.key);
                                  }}
                                  disabled={isLoading}
                                >
                                  <Text style={styles.secondarySmallButtonText}>{target.title}</Text>
                                </Pressable>
                              )) : (
                                <Text style={styles.itemMeta}>Ingen annan dag finns.</Text>
                              )}
                            </View>
                          ) : null}
                          <Pressable
                            style={dayCardStyles.stopMenuDangerItem}
                            onPress={() => {
                              setMovePickerNodeId(null);
                              setPendingDeleteNodeId(node.id);
                            }}
                          >
                            <Text style={styles.smallButtonText}>Ta bort</Text>
                          </Pressable>
                          {deleteConfirmOpen ? (
                            <View style={dayCardStyles.deleteConfirmPanel}>
                              <Text style={styles.itemMeta}>Ta bort steget permanent från resan?</Text>
                              <View style={styles.stopActions}>
                                <Pressable
                                  style={[styles.dangerButton, isLoading && styles.disabledButton]}
                                  onPress={() => {
                                    setOpenMenuNodeId(null);
                                    setMovePickerNodeId(null);
                                    setPendingDeleteNodeId(null);
                                    void onRemoveStop(node.id);
                                  }}
                                  disabled={isLoading}
                                >
                                  <Text style={styles.smallButtonText}>Ja, ta bort</Text>
                                </Pressable>
                                <Pressable style={styles.secondarySmallButton} onPress={() => setPendingDeleteNodeId(null)} disabled={isLoading}>
                                  <Text style={styles.secondarySmallButtonText}>Avbryt</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>

              {notePreview ? <Text style={[dayCardStyles.stopNotePreview, isDark && styles.textMutedDark]}>{notePreview}</Text> : null}
              {inlineEditMessage && activeInlineEdit?.nodeId === node.id ? <Text style={styles.validationText}>{inlineEditMessage}</Text> : null}

              {fullEditorOpen ? renderPlannerInlineEditor('edit') : null}
              {placeholder ? renderSmartStopPanel(node) : null}

              {detailsExpanded && canEdit ? (
                <StopDetailsGrid
                  node={node}
                  activeInlineEdit={activeInlineEdit}
                  isDark={isDark}
                  isDemoMode={isDemoMode}
                  isLoading={isLoading}
                  styles={styles}
                  onStartInlineEdit={onStartInlineEdit}
                  onClearInlineEdit={onClearInlineEdit}
                  onInlineDraftChange={onInlineDraftChange}
                  onSaveInlineField={onSaveInlineField}
                />
              ) : null}

              {canEdit ? (
                <View style={dayCardStyles.stopCompactActions}>
                  <Pressable
                    testID="stop-open-full-editor"
                    style={styles.secondarySmallButton}
                    onPress={() => onSelectPlannerNode(node.id)}
                  >
                    <Text style={styles.secondarySmallButtonText}>Detaljer</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondarySmallButton, isLoading && styles.disabledButton]}
                    onPress={() => onAddPlaceholderAfterStop(node)}
                    disabled={isLoading}
                  >
                    <Text style={styles.secondarySmallButtonText}>Mellanstopp efter</Text>
                  </Pressable>
                  <Pressable style={styles.secondarySmallButton} onPress={() => void onMoveStop(node.id, -1)} disabled={isLoading}>
                    <Text style={styles.secondarySmallButtonText}>Upp</Text>
                  </Pressable>
                  <Pressable style={styles.secondarySmallButton} onPress={() => void onMoveStop(node.id, 1)} disabled={isLoading}>
                    <Text style={styles.secondarySmallButtonText}>Ner</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
