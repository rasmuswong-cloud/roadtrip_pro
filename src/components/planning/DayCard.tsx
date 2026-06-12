import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

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
  dayPlan: DayPlan;
  isDark: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  selectedPlannerNodeId: string | null;
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
  onSelectPlannerNode: (nodeId: string) => void;
  onStartInlineEdit: (nodeId: string, field: InlineFieldKey) => boolean;
  onClearInlineEdit: () => void;
  onInlineDraftChange: (changed: boolean) => void;
  onSaveInlineField: (node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) => Promise<void>;
  onScheduleStop: (node: ItineraryNode, hour: number) => Promise<void>;
  onMoveStop: (nodeId: string, direction: -1 | 1) => Promise<void>;
  onRemoveStop: (nodeId: string) => Promise<void>;
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

function formatReservation(node: ItineraryNode): string {
  const details = [
    node.reservation.provider,
    node.reservation.reference,
    node.reservation.siteNumber ? `Site ${node.reservation.siteNumber}` : null,
    node.reservation.accessDetails,
    cleanImportedNoteLines(node.notes),
  ].filter(Boolean);

  return details.join(' / ');
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

function formatNodeCostSummary(node: ItineraryNode): string {
  const reservation = formatReservation(node);
  const fallback = cleanImportedNoteLines(node.notes) ?? node.timezone ?? 'lokal tid';
  const parts = [formatRawNodeCost(node), reservation || fallback].filter(Boolean);
  return parts.join(' / ');
}

function buildNodeInfoPills(node: ItineraryNode): string[] {
  const pills: string[] = [];
  const place = typeof node.metadata.place === 'string' ? node.metadata.place : null;
  const cost = formatRawNodeCost(node);
  const reservation = formatReservation(node);

  if (place) {
    pills.push(place);
  } else if (node.location) {
    pills.push(`${node.location.latitude.toFixed(2)}, ${node.location.longitude.toFixed(2)}`);
  }

  pills.push(cost || 'Kostnad saknas');

  if (reservation) {
    pills.push(reservation);
  }

  if (node.notes) {
    pills.push(node.notes);
  }

  return pills.slice(0, 4);
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
      setError(validation.error ?? 'Kontrollera fältet.');
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
      setError(saveError instanceof Error ? saveError.message : 'Kunde inte spara fältet.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!isActive) {
    const warning = field === 'place' && inlineFieldValue(node, 'place') && node.location
      ? 'Platsnamnet ändras, men befintliga kartkoordinater behålls. Kontrollera kartpositionen.'
      : null;
    return (
      <Pressable
        style={[styles.quickCell, inputStyle, isDark && styles.inputDark, disabled && styles.disabledButton]}
        onPress={beginEdit}
        disabled={disabled}
      >
        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{label}</Text>
        <Text style={[styles.secondarySmallButtonText, isDark && styles.textDark]}>{displayInlineFieldValue(node, field)}</Text>
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
          <Text style={styles.smallButtonText}>{isSaving ? 'Sparar...' : '✓'}</Text>
        </Pressable>
        <Pressable style={styles.secondarySmallButton} onPress={cancelEdit} disabled={isSaving}>
          <Text style={styles.secondarySmallButtonText}>×</Text>
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
      setError(validation.error ?? 'Kontrollera fältet.');
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
      setError(saveError instanceof Error ? saveError.message : 'Kunde inte spara fältet.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!isActive) {
    return (
      <Pressable
        style={[styles.quickCell, isDark && styles.inputDark, disabled && styles.disabledButton]}
        onPress={beginEdit}
        disabled={disabled}
      >
        <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{label}</Text>
        <Text style={[styles.secondarySmallButtonText, isDark && styles.textDark]}>{displayInlineFieldValue(node, field)}</Text>
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
    dayPlan,
    isDark,
    isDemoMode,
    isLoading,
    selectedPlannerNodeId,
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
    onSelectPlannerNode,
    onStartInlineEdit,
    onClearInlineEdit,
    onInlineDraftChange,
    onSaveInlineField,
    onScheduleStop,
    onMoveStop,
    onRemoveStop,
  } = props;

  return (
    <View key={dayPlan.key} style={[styles.dayGroup, isDark && styles.innerPanelDark]}>
      <View style={styles.dayHeader}>
        <View>
          <Text style={[styles.dayTitle, isDark && styles.textDark]}>{dayPlan.title}</Text>
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>
            {dayPlan.nodes.length} stopp / {formatDistance(dayPlan.route.distanceMeters)} / {formatDuration(dayPlan.route.durationSeconds)} / {formatSek(dayPlan.budget.total)}
          </Text>
          <View style={styles.smartFlagList}>
            {(dayPlan.smartFlags.length > 0 ? dayPlan.smartFlags : ['Ser planerad ut']).map((flag) => (
              <Text key={flag} style={[styles.smartFlag, flag === 'Ser planerad ut' && styles.smartFlagGood]}>{flag}</Text>
            ))}
          </View>
        </View>
        {!isDemoMode ? (
          <View style={styles.dayHeaderActions}>
            <Pressable
              style={[styles.secondaryButton, isLoading && styles.disabledButton]}
              onPress={() => onStartPlaceSearch(dayPlan.key, dayPlan.insight.hasLodging ? 'restaurang eller aktivitet' : 'camping eller hotell')}
              disabled={isLoading}
            >
              <Text style={styles.secondaryButtonText}>Lägg till plats</Text>
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
          <Text style={styles.dayInsightLabel}>Körning</Text>
          <Text style={styles.dayInsightValue}>{dayPlan.insight.driveLabel}</Text>
        </View>
        <View style={[styles.dayInsightCard, dayPlan.budget.missingCostCount > 0 ? styles.dayInsightWarn : styles.dayInsightGood]}>
          <Text style={styles.dayInsightLabel}>Budget</Text>
          <Text style={styles.dayInsightValue}>{dayPlan.insight.costLabel}</Text>
        </View>
      </View>
      <Text style={styles.dayNextAction}>{dayPlan.insight.nextAction}</Text>
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
      <View style={styles.packingPanel}>
        <Text style={styles.packingTitle}>Packa / ta med</Text>
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
      </View>
      {draftPlannerDayKey === dayPlan.key ? renderPlannerInlineEditor('new') : null}
      {dayPlan.nodes.map((node, index) => (
        <View key={node.id} style={[styles.timelineItem, isDark && styles.innerPanelDark]}>
          <View style={styles.timeRail}>
            <Text style={[styles.timeText, isDark && styles.textDark]}>{formatTime(node.startsAt)}</Text>
            <View style={[styles.nodeDot, { backgroundColor: nodeColor(node.type) }]} />
          </View>
          {selectedPlannerNodeId === node.id && !isDemoMode ? (
            <View style={styles.timelineCopy}>{renderPlannerInlineEditor('edit')}</View>
          ) : (
            <>
              <View style={styles.timelineCopy}>
                <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{index + 1}. {formatNodeType(node.type)}</Text>
                {itineraryNodesLength > 0 && !isDemoMode ? (
                  <>
                  <View style={styles.quickCellGrid}>
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
                    />
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
                    />
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
                    />
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
                    />
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
                    />
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
                    />
                  </View>
                  {inlineEditMessage && activeInlineEdit?.nodeId === node.id ? <Text style={styles.validationText}>{inlineEditMessage}</Text> : null}
                  </>
                ) : (
                  <>
                    <Text style={[styles.itemTitle, isDark && styles.textDark]}>{node.title}</Text>
                    <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{formatNodeCostSummary(node)}</Text>
                  </>
                )}
                <View style={styles.nodeInfoPills}>
                  {buildNodeInfoPills(node).map((pill) => (
                    <Text key={pill} style={styles.nodeInfoPill}>{pill}</Text>
                  ))}
                </View>
              </View>
              {itineraryNodesLength > 0 && !isDemoMode ? (
                <View style={styles.stopActions}>
                  <Pressable style={styles.secondarySmallButton} onPress={() => onSelectPlannerNode(node.id)} disabled={isLoading}>
                    <Text style={styles.secondarySmallButtonText}>Redigera</Text>
                  </Pressable>
                  <Pressable style={styles.secondarySmallButton} onPress={() => void onMoveStop(node.id, -1)} disabled={isLoading}>
                    <Text style={styles.secondarySmallButtonText}>Upp</Text>
                  </Pressable>
                  <Pressable style={styles.secondarySmallButton} onPress={() => void onMoveStop(node.id, 1)} disabled={isLoading}>
                    <Text style={styles.secondarySmallButtonText}>Ner</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} onPress={() => void onScheduleStop(node, 9)} disabled={isLoading}>
                    <Text style={styles.smallButtonText}>AM</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} onPress={() => void onScheduleStop(node, 18)} disabled={isLoading}>
                    <Text style={styles.smallButtonText}>PM</Text>
                  </Pressable>
                  <Pressable style={styles.dangerButton} onPress={() => void onRemoveStop(node.id)} disabled={isLoading}>
                    <Text style={styles.smallButtonText}>Ta bort</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      ))}
    </View>
  );
}
