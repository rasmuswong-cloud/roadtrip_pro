import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { dayCardStyles } from './DayCard.styles';

import type { DayChecklistItem, DayPlan } from '@/models';
import type { ItineraryNode } from '@/models';
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
  itineraryNodesLength: number;
  packingDraft: string;
  draftPlannerDayKey: string | null;
  styles: any;
  renderDayPlaceSearch: (dayKey: string) => React.ReactNode;
  renderPlannerInlineEditor: (mode: 'edit' | 'new') => React.ReactNode;
  onStartPlaceSearch: (dayKey: string, suggestedQuery?: string) => void;
  onStartNewPlannerStep: (dayKey: string) => void;
  onRunChecklistAction: (dayPlan: DayPlan, item: DayChecklistItem) => void;
  onTogglePackingItem: (dayPlan: DayPlan, item: string) => Promise<void>;
  onAddPackingItem: (dayPlan: DayPlan) => Promise<void>;
  onSetPackingDraft: (dayKey: string, text: string) => void;
  onStartInlineEdit: (nodeId: string, field: InlineFieldKey) => boolean;
  onClearInlineEdit: () => void;
  onInlineDraftChange: (changed: boolean) => void;
  onSaveInlineField: (node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) => Promise<void>;
  onMoveStop: (nodeId: string, direction: -1 | 1) => Promise<void>;
  onMoveStopToDay: (nodeId: string, targetDayKey: string) => Promise<void>;
  onRemoveStop: (nodeId: string) => Promise<void>;
};

type DayMoveTarget = {
  key: string;
  title: string;
};

function formatDistance(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace('.0', '')} km`;
  }

  return `${Math.round(value)} m`;
}

function formatDuration(value: number): string {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  return `${minutes} min`;
}

function formatSek(value: number): string {
  return `${Math.round(value).toLocaleString('sv-SE')} SEK`;
}

function formatTime(value?: string | null): string {
  if (!value) {
    return '--:--';
  }

  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatRawNodeCost(node: ItineraryNode): string {
  const cost = node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price;
  if (typeof cost === 'number') {
    return String(cost);
  }

  if (typeof cost === 'string') {
    return cost;
  }

  return '';
}

function cleanImportedNoteLines(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleanedLines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isImportedNoteLine(line));

  return cleanedLines.length > 0 ? cleanedLines.join('\n') : null;
}

function isImportedNoteLine(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('imported from')
    || normalized.includes('cost from')
    || normalized.includes('excel')
    || normalized.includes('reseplanrare')
    || normalized.includes('laddad fr')
    || normalized.includes('kostnad fr')
  );
}

function compactNote(value?: string | null): string | null {
  const cleaned = cleanImportedNoteLines(value);
  if (!cleaned) {
    return null;
  }

  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

function nodeColor(type: ItineraryNode['type']): string {
  switch (type) {
    case 'camping':
      return '#059669';
    case 'activity':
      return '#d97706';
    case 'lodging':
      return '#2563eb';
    default:
      return '#0f766e';
  }
}

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
  styles: any;
  onStart: (nodeId: string, field: InlineFieldKey) => boolean;
  onCancel: () => void;
  onSave: (node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) => Promise<void>;
  onDraftChange: (changed: boolean) => void;
  placeholder?: string;
  inputStyle?: unknown;
  inactiveStyle?: unknown;
  inactiveValueStyle?: unknown;
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
    const warning = field === 'place' && inlineFieldValue(node, 'place') && node.location
      ? 'Platsnamnet Ã¤ndras, men befintliga kartkoordinater behÃ¥lls. Kontrollera kartpositionen.'
      : null;
    return (
      <Pressable
        style={[dayCardStyles.inlineDisplayField, inactiveStyle, disabled && styles.disabledButton]}
        onPress={beginEdit}
        disabled={disabled}
      >
        {showInactiveLabel ? <Text style={[dayCardStyles.inlineDisplayLabel, isDark && styles.textMutedDark]}>{label}</Text> : null}
        <Text style={[dayCardStyles.inlineDisplayValue, isDark && styles.textDark, inactiveValueStyle]}>{displayInlineFieldValue(node, field)}</Text>
        {warning ? <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{warning}</Text> : null}
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
    itineraryNodesLength,
    packingDraft,
    draftPlannerDayKey,
    styles,
    renderDayPlaceSearch,
    renderPlannerInlineEditor,
    onStartPlaceSearch,
    onStartNewPlannerStep,
    onRunChecklistAction,
    onTogglePackingItem,
    onAddPackingItem,
    onSetPackingDraft,
    onStartInlineEdit,
    onClearInlineEdit,
    onInlineDraftChange,
    onSaveInlineField,
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
  const visibleFlags = dayPlan.smartFlags.length > 0 ? dayPlan.smartFlags : ['Ser planerad ut'];
  const displayedFlags = expandedFlags ? visibleFlags : visibleFlags.slice(0, 3);

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
      <View style={styles.dayHeader}>
        <View>
          <Text style={[styles.dayTitle, isDark && styles.textDark]}>{dayPlan.title}</Text>
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
            {dayPlan.nodes.length} stopp / {formatDistance(dayPlan.route.distanceMeters)} / {formatDuration(dayPlan.route.durationSeconds)} / {formatSek(dayPlan.budget.total)}
          </Text>
          <View style={styles.smartFlagList}>
            {displayedFlags.map((flag) => (
              <Text key={flag} style={[styles.smartFlag, flag === 'Ser planerad ut' && styles.smartFlagGood]}>{flag}</Text>
            ))}
            {visibleFlags.length > 3 ? (
              <Pressable style={dayCardStyles.smartFlagMore} onPress={() => setExpandedFlags((current) => !current)}>
                <Text style={dayCardStyles.smartFlagMoreText}>{expandedFlags ? 'Visa färre' : `+${visibleFlags.length - 3} fler`}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {!isDemoMode ? (
          <View style={styles.dayHeaderActions}>
            <Pressable
              style={[styles.secondaryButton, isLoading && styles.disabledButton]}
              onPress={() => onStartPlaceSearch(dayPlan.key, dayPlan.insight.hasLodging ? 'restaurang eller aktivitet' : 'camping eller hotell')}
              disabled={isLoading}
            >
              <Text style={styles.secondaryButtonText}>LÃ¤gg till plats</Text>
            </Pressable>
            <Pressable
              style={[styles.commandButton, isLoading && styles.disabledButton]}
              onPress={() => onStartNewPlannerStep(dayPlan.key)}
              disabled={isLoading}
            >
              <Text style={styles.commandButtonText}>Nytt steg</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {renderDayPlaceSearch(dayPlan.key)}
      <View style={styles.dayInsightGrid}>
        <View style={[styles.dayInsightCard, dayPlan.insight.hasLodging ? styles.dayInsightGood : styles.dayInsightWarn]}>
          <Text style={styles.dayInsightLabel}>Boende</Text>
          <Text style={styles.dayInsightValue}>{dayPlan.insight.lodgingLabel}</Text>
        </View>
        <View style={[styles.dayInsightCard, dayPlan.insight.activityCount > 0 ? styles.dayInsightGood : null]}>
          <Text style={styles.dayInsightLabel}>Aktiviteter</Text>
          <Text style={styles.dayInsightValue}>{dayPlan.insight.activitiesLabel}</Text>
        </View>
        <View style={[styles.dayInsightCard, dayPlan.insight.isLongDrive ? styles.dayInsightWarn : null]}>
          <Text style={styles.dayInsightLabel}>KÃ¶rning</Text>
          <Text style={styles.dayInsightValue}>{dayPlan.insight.driveLabel}</Text>
        </View>
        <View style={[styles.dayInsightCard, dayPlan.budget.missingCostCount > 0 ? styles.dayInsightWarn : styles.dayInsightGood]}>
          <Text style={styles.dayInsightLabel}>Budget</Text>
          <Text style={styles.dayInsightValue}>{dayPlan.insight.costLabel}</Text>
        </View>
      </View>
      <Text style={styles.dayNextAction}>{dayPlan.insight.nextAction}</Text>
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
      {draftPlannerDayKey === dayPlan.key ? renderPlannerInlineEditor('new') : null}
      {dayPlan.nodes.map((node) => {
        const detailsExpanded = expandedNodeIds.has(node.id);
        const menuOpen = openMenuNodeId === node.id;
        const movePickerOpen = movePickerNodeId === node.id;
        const notePreview = compactNote(node.notes);
        const canEdit = itineraryNodesLength > 0 && !isDemoMode;
        const targetDays = availableDayTargets.filter((target) => target.key !== dayPlan.key);

        return (
          <View key={node.id} style={[styles.timelineItem, isDark && styles.innerPanelDark]}>
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
                <Text style={[styles.timeText, isDark && styles.textDark]}>{formatTime(node.startsAt)}</Text>
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
                        style={[dayCardStyles.iconMenuButton, isLoading && styles.disabledButton]}
                        onPress={() => setOpenMenuNodeId((current) => (current === node.id ? null : node.id))}
                        disabled={isLoading}
                      >
                        <Text style={dayCardStyles.iconMenuText}>?</Text>
                      </Pressable>
                      {menuOpen ? (
                        <View style={dayCardStyles.stopMenuPanel}>
                          <Pressable
                            style={dayCardStyles.stopMenuItem}
                            onPress={() => {
                              toggleNodeDetails(node.id);
                              setOpenMenuNodeId(null);
                              setMovePickerNodeId(null);
                            }}
                          >
                            <Text style={styles.secondarySmallButtonText}>{detailsExpanded ? 'Dölj detaljer' : 'Visa/redigera alla detaljer'}</Text>
                          </Pressable>
                          <Pressable
                            style={dayCardStyles.stopMenuItem}
                            onPress={() => setMovePickerNodeId((current) => (current === node.id ? null : node.id))}
                          >
                            <Text style={styles.secondarySmallButtonText}>Flytta till annan dag</Text>
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
                              setOpenMenuNodeId(null);
                              setMovePickerNodeId(null);
                              void onRemoveStop(node.id);
                            }}
                          >
                            <Text style={styles.smallButtonText}>Ta bort</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>

              {notePreview ? <Text style={[dayCardStyles.stopNotePreview, isDark && styles.textMutedDark]}>{notePreview}</Text> : null}
              {inlineEditMessage && activeInlineEdit?.nodeId === node.id ? <Text style={styles.validationText}>{inlineEditMessage}</Text> : null}

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
