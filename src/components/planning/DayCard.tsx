import React, { useRef, useState } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import { dayCardStyles } from './DayCard.styles';
import {
  buildMissingInfoChips,
  compactNote,
  formatItineraryTime,
  formatRawNodeCost,
  nodeColor,
} from './dayCardViewModel';
import { DayHeader } from './DayHeader';
import { DaySummary } from './DaySummary';
import { MissingInfoChips } from './MissingInfoChips';

import type { DayChecklistItem, DayPlan } from '@/models';
import type { ItineraryNode } from '@/models';
import type { GooglePlace } from '@/services/google/googlePlaces';
import {
  displayInlineFieldValue,
  formatBookingStatus,
  formatNodeType,
  inlineBookingStatuses,
  inlineCurrencies,
  inlineFieldValue,
  inlineNodeTypes,
  shouldSaveInlineField,
  validateInlineFieldValue,
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
  onStartPlaceSearch: (dayKey: string, suggestedQuery?: string) => void;
  onStartNewPlannerStep: (dayKey: string) => void;
  onSelectPlannerNode: (nodeId: string) => void;
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

type InlineOption = {
  value: string;
  label: string;
};

type InlineEditorProps = {
  node: ItineraryNode;
  field: InlineFieldKey;
  activeInlineEdit: ActiveInlineEdit;
  label: string;
  isDark: boolean;
  loading: boolean;
  disabled: boolean;
  styles: WorkspaceStyles;
  onStart: (nodeId: string, field: InlineFieldKey) => boolean;
  onCancel: () => void;
  onSave: (node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) => Promise<void>;
  onDraftChange: (changed: boolean) => void;
  placeholder?: string;
  inputStyle?: StyleProp<ViewStyle>;
  inactiveStyle?: StyleProp<ViewStyle>;
  inactiveValueStyle?: StyleProp<TextStyle>;
  showInactiveLabel?: boolean;
};

function InlineEditableField(props: InlineEditorProps) {
  return <InlineEditableCore {...props} multiline={false} />;
}

function InlineEditableTextArea(props: InlineEditorProps) {
  return <InlineEditableCore {...props} multiline />;
}

function InlineEditableCore(props: InlineEditorProps & { multiline: boolean }) {
  const {
    node,
    field,
    activeInlineEdit,
    label,
    isDark,
    loading,
    disabled,
    styles,
    onStart,
    onCancel,
    onSave,
    onDraftChange,
    placeholder,
    inputStyle,
    inactiveStyle,
    inactiveValueStyle,
    showInactiveLabel = true,
    multiline,
  } = props;
  const isActive = activeInlineEdit?.nodeId === node.id && activeInlineEdit.field === field;
  const [draft, setDraft] = useState(inlineFieldValue(node, field));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  function beginEdit() {
    if (!onStart(node.id, field)) {
      return;
    }

    setDraft(inlineFieldValue(node, field));
    setError(null);
    onDraftChange(false);
  }

  function cancelEdit() {
    if (savingRef.current || isSaving) {
      return;
    }

    setDraft(inlineFieldValue(node, field));
    setError(null);
    onDraftChange(false);
    onCancel();
  }

  async function saveEdit() {
    if (savingRef.current || isSaving || loading) {
      return;
    }

    const validation = validateInlineFieldValue(node, field, draft);
    if (!validation.valid) {
      setError(validation.error ?? 'Kontrollera fÃ¤ltet.');
      return;
    }

    if (!shouldSaveInlineField(node, field, draft)) {
      cancelEdit();
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(node, field, draft);
      onCancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kunde inte spara fÃ¤ltet.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!isActive) {
    return (
      <Pressable
        style={[dayCardStyles.inlineDisplayField, inactiveStyle, disabled && styles.disabledButton]}
        onPress={beginEdit}
        disabled={disabled}
      >
        {showInactiveLabel ? <Text style={[dayCardStyles.inlineDisplayLabel, isDark && styles.textMutedDark]}>{label}</Text> : null}
        <Text style={[dayCardStyles.inlineDisplayValue, isDark && styles.textDark, inactiveValueStyle]}>{displayInlineFieldValue(node, field)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.quickCell, inputStyle, isDark && styles.inputDark]}>
      <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{label}</Text>
      <TextInput
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          onDraftChange(shouldSaveInlineField(node, field, text));
        }}
        placeholder={placeholder ?? label}
        placeholderTextColor={isDark ? '#737373' : '#78716c'}
        multiline={multiline}
        onKeyPress={(event) => {
          if (event.nativeEvent.key === 'Escape') {
            cancelEdit();
          }
          if (!multiline && event.nativeEvent.key === 'Enter') {
            void saveEdit();
          }
        }}
        style={[
          styles.quickCell,
          multiline && { minHeight: 84, textAlignVertical: 'top' },
          isDark && styles.inputDark,
        ]}
        editable={!isSaving && !loading}
      />
      {error ? <Text style={styles.validationText}>{error}</Text> : null}
      <View style={styles.stopActions}>
        <Pressable style={[styles.smallButton, (isSaving || loading) && styles.disabledButton]} onPress={() => void saveEdit()} disabled={isSaving || loading}>
          <Text style={styles.smallButtonText}>{isSaving ? 'Sparar...' : 'âœ“'}</Text>
        </Pressable>
        <Pressable style={styles.secondarySmallButton} onPress={cancelEdit} disabled={isSaving}>
          <Text style={styles.secondarySmallButtonText}>Ã—</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InlineEditableSelect(props: InlineEditorProps & { options: InlineOption[] }) {
  const {
    node,
    field,
    activeInlineEdit,
    label,
    isDark,
    loading,
    disabled,
    styles,
    onStart,
    onCancel,
    onSave,
    onDraftChange,
    inactiveStyle,
    inactiveValueStyle,
    showInactiveLabel = true,
    options,
  } = props;
  const isActive = activeInlineEdit?.nodeId === node.id && activeInlineEdit.field === field;
  const [draft, setDraft] = useState(inlineFieldValue(node, field));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  function beginEdit() {
    if (!onStart(node.id, field)) {
      return;
    }

    setDraft(inlineFieldValue(node, field));
    setError(null);
    onDraftChange(false);
  }

  async function saveEdit(value = draft) {
    if (savingRef.current || isSaving || loading) {
      return;
    }

    const validation = validateInlineFieldValue(node, field, value);
    if (!validation.valid) {
      setError(validation.error ?? 'Kontrollera fÃ¤ltet.');
      return;
    }

    if (!shouldSaveInlineField(node, field, value)) {
      onDraftChange(false);
      onCancel();
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(node, field, value);
      onDraftChange(false);
      onCancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kunde inte spara fÃ¤ltet.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!isActive) {
    return (
      <Pressable
        style={[dayCardStyles.inlineDisplayField, inactiveStyle, disabled && styles.disabledButton]}
        onPress={beginEdit}
        disabled={disabled}
      >
        {showInactiveLabel ? <Text style={[dayCardStyles.inlineDisplayLabel, isDark && styles.textMutedDark]}>{label}</Text> : null}
        <Text style={[dayCardStyles.inlineDisplayValue, isDark && styles.textDark, inactiveValueStyle]}>{displayInlineFieldValue(node, field)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.quickCell, isDark && styles.inputDark]}>
      <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{label}</Text>
      <View style={styles.quickTypeRow}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.quickTypeChip, draft === option.value && styles.quickTypeChipActive, (isSaving || loading) && styles.disabledButton]}
            onPress={() => {
              setDraft(option.value);
              onDraftChange(shouldSaveInlineField(node, field, option.value));
              void saveEdit(option.value);
            }}
            disabled={isSaving || loading}
          >
            <Text style={[styles.quickTypeChipText, draft === option.value && styles.quickTypeChipTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.validationText}>{error}</Text> : null}
      <View style={styles.stopActions}>
        <Pressable style={styles.secondarySmallButton} onPress={onCancel} disabled={isSaving}>
          <Text style={styles.secondarySmallButtonText}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}

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
    onStartPlaceSearch,
    onStartNewPlannerStep,
    onSelectPlannerNode,
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
      <View style={dayCardStyles.collapsiblePanel}>
        <Pressable style={dayCardStyles.collapsibleHeader} onPress={() => setChecklistExpanded((current) => !current)}>
          <Text style={styles.packingTitle}>Checklista</Text>
          <Text style={styles.secondarySmallButtonText}>{checklistExpanded ? 'Dölj' : `Visa ${dayPlan.insight.checklist.length}`}</Text>
        </Pressable>
        {checklistExpanded ? (
          <View style={styles.dayChecklist}>
            {dayPlan.insight.checklist.map((item) => (
              <Pressable
                key={item.label}
                style={[styles.checkItem, item.done && styles.checkItemDone, isDemoMode && styles.checkItemStatic]}
                onPress={() => onRunChecklistAction(dayPlan, item)}
                disabled={item.done || isDemoMode || isLoading}
              >
                <Text style={[styles.checkMark, item.done && styles.checkMarkDone]}>{item.done ? 'Klar' : 'Att fixa'}</Text>
                <Text style={styles.checkLabel}>{item.label}</Text>
                {!item.done && !isDemoMode ? <Text style={styles.checkActionText}>Öppna</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.packingPanel}>
        <Pressable style={dayCardStyles.collapsibleHeader} onPress={() => setPackingExpanded((current) => !current)}>
          <Text style={styles.packingTitle}>Packa / ta med</Text>
          <Text style={styles.secondarySmallButtonText}>{packingExpanded ? 'Dölj' : `Visa ${dayPlan.insight.packingItems.length}`}</Text>
        </Pressable>
        {packingExpanded ? (
          <>
            <View style={styles.packingList}>
              {dayPlan.insight.packingItems.map((item) => (
                <Pressable
                  key={item}
                  style={[
                    styles.packingChip,
                    dayPlan.insight.packedItems.includes(item) && styles.packingChipDone,
                    isDemoMode && styles.checkItemStatic,
                  ]}
                  onPress={() => void onTogglePackingItem(dayPlan, item)}
                  disabled={isDemoMode || isLoading}
                >
                  <Text style={[styles.packingChipText, dayPlan.insight.packedItems.includes(item) && styles.packingChipTextDone]}>
                    {dayPlan.insight.packedItems.includes(item) ? 'Packad' : 'Ta med'}
                  </Text>
                  <Text style={styles.packingChipLabel}>{item}</Text>
                </Pressable>
              ))}
            </View>
            {!isDemoMode ? (
              <View style={styles.packingAddRow}>
                <TextInput
                  value={packingDraft}
                  onChangeText={(text) => onSetPackingDraft(dayPlan.key, text)}
                  placeholder="Lägg till egen sak"
                  placeholderTextColor={isDark ? '#737373' : '#78716c'}
                  style={[styles.packingInput, isDark && styles.inputDark]}
                />
                <Pressable style={[styles.secondarySmallButton, isLoading && styles.disabledButton]} onPress={() => void onAddPackingItem(dayPlan)} disabled={isLoading}>
                  <Text style={styles.secondarySmallButtonText}>Lägg till</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      <View style={dayCardStyles.timelineHeader}>
        <Text style={styles.packingTitle}>Tidslinje</Text>
        <Text style={styles.secondarySmallButtonText}>{dayPlan.nodes.length > 0 ? `${dayPlan.nodes.length} steg` : 'Tom dag'}</Text>
      </View>
      {dayPlan.nodes.length === 0 ? (
        <View style={styles.emptySearchState}>
          <Text style={styles.emptySearchTitle}>Inget planerat än</Text>
          <Text style={styles.emptySearchText}>Lägg till dagens första stopp, aktivitet, boende eller notis.</Text>
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
        const showCoordinatePrompt = canEdit && Boolean(node.location && inlineFieldValue(node, 'place'));
        const coordinateSearchOpen = coordinateSearchNodeId === node.id;
        const missingInfoChips = buildMissingInfoChips(node);
        const fullEditorOpen = selectedPlannerNodeId === node.id;

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
                        <Text style={styles.secondarySmallButtonText}>Sök ny plats</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {coordinateSearchOpen ? (
                    <View style={[styles.coordinateSearchPanel, isDark && styles.innerPanelDark]}>
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
                    <Text style={dayCardStyles.inlineCostText}>{formatRawNodeCost(node) || 'Kostnad saknas'}</Text>
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
                            <Text style={styles.secondarySmallButtonText}>{detailsExpanded ? 'Dölj detaljer' : 'Snabbdetaljer'}</Text>
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
                            <Text style={styles.secondarySmallButtonText}>Redigera stopp</Text>
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

              {detailsExpanded && canEdit ? (
                <View style={dayCardStyles.stopDetailsGrid}>
                  <InlineEditableField
                    node={node}
                    field="date"
                    activeInlineEdit={activeInlineEdit}
                    label="Datum"
                    placeholder="ÅÅÅÅ-MM-DD"
                    isDark={isDark}
                    loading={isLoading}
                    disabled={isDemoMode || isLoading}
                    styles={styles}
                    onStart={onStartInlineEdit}
                    onCancel={onClearInlineEdit}
                    onDraftChange={onInlineDraftChange}
                    onSave={onSaveInlineField}
                    inputStyle={styles.quickCellDate}
                    inactiveStyle={dayCardStyles.inlineDetailField}
                  />
                  <InlineEditableField
                    node={node}
                    field="endTime"
                    activeInlineEdit={activeInlineEdit}
                    label="Slut"
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
                    inactiveStyle={dayCardStyles.inlineDetailField}
                  />
                  <InlineEditableSelect
                    node={node}
                    field="currency"
                    activeInlineEdit={activeInlineEdit}
                    label="Valuta"
                    options={inlineCurrencies.map((currency) => ({ value: currency, label: currency }))}
                    isDark={isDark}
                    loading={isLoading}
                    disabled={isDemoMode || isLoading}
                    styles={styles}
                    onStart={onStartInlineEdit}
                    onCancel={onClearInlineEdit}
                    onDraftChange={onInlineDraftChange}
                    onSave={onSaveInlineField}
                    inactiveStyle={dayCardStyles.inlineDetailField}
                  />
                  <InlineEditableSelect
                    node={node}
                    field="bookingStatus"
                    activeInlineEdit={activeInlineEdit}
                    label="Bokning"
                    options={inlineBookingStatuses.map((status) => ({ value: status, label: formatBookingStatus(status) }))}
                    isDark={isDark}
                    loading={isLoading}
                    disabled={isDemoMode || isLoading}
                    styles={styles}
                    onStart={onStartInlineEdit}
                    onCancel={onClearInlineEdit}
                    onDraftChange={onInlineDraftChange}
                    onSave={onSaveInlineField}
                    inactiveStyle={dayCardStyles.inlineDetailField}
                  />
                  <InlineEditableField
                    node={node}
                    field="bookingReference"
                    activeInlineEdit={activeInlineEdit}
                    label="Referens"
                    isDark={isDark}
                    loading={isLoading}
                    disabled={isDemoMode || isLoading}
                    styles={styles}
                    onStart={onStartInlineEdit}
                    onCancel={onClearInlineEdit}
                    onDraftChange={onInlineDraftChange}
                    onSave={onSaveInlineField}
                    inactiveStyle={dayCardStyles.inlineDetailFieldWide}
                  />
                  <InlineEditableTextArea
                    node={node}
                    field="notes"
                    activeInlineEdit={activeInlineEdit}
                    label="Anteckningar"
                    isDark={isDark}
                    loading={isLoading}
                    disabled={isDemoMode || isLoading}
                    styles={styles}
                    onStart={onStartInlineEdit}
                    onCancel={onClearInlineEdit}
                    onDraftChange={onInlineDraftChange}
                    onSave={onSaveInlineField}
                    inactiveStyle={dayCardStyles.inlineDetailFieldWide}
                  />
                </View>
              ) : null}

              {canEdit ? (
                <View style={dayCardStyles.stopCompactActions}>
                  <Pressable
                    testID="stop-open-full-editor"
                    style={styles.secondarySmallButton}
                    onPress={() => onSelectPlannerNode(node.id)}
                  >
                    <Text style={styles.secondarySmallButtonText}>Redigera stopp</Text>
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
