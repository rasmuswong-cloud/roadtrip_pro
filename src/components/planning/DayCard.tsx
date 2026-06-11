import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { DayChecklistItem, DayPlan } from '@/models';
import type { ItineraryNode, ItineraryNodeType } from '@/models';

type QuickCellField = 'title' | 'date' | 'time' | 'place' | 'cost' | 'type';

type DayCardProps = {
  dayPlan: DayPlan;
  isDark: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  selectedPlannerNodeId: string | null;
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
  onSaveQuickCell: (node: ItineraryNode, field: QuickCellField, value: string) => Promise<void>;
  onScheduleStop: (node: ItineraryNode, hour: number) => Promise<void>;
  onMoveStop: (nodeId: string, direction: -1 | 1) => Promise<void>;
  onRemoveStop: (nodeId: string) => Promise<void>;
};

const inlineNodeTypes: ItineraryNodeType[] = ['lodging', 'camping', 'activity', 'gastronomy', 'transport', 'custom'];

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

function formatNodeType(type: ItineraryNode['type']): string {
  switch (type) {
    case 'lodging':
      return 'Boende';
    case 'camping':
      return 'Camping';
    case 'activity':
      return 'Aktivitet';
    case 'gastronomy':
      return 'Mat';
    case 'fuel':
      return 'Bränsle';
    case 'transport':
      return 'Transport';
    case 'note':
      return 'Notis';
    default:
      return 'Övrigt';
  }
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

function quickCellValue(node: ItineraryNode, field: QuickCellField): string {
  switch (field) {
    case 'title':
      return node.title;
    case 'date':
      return node.startsAt ? node.startsAt.slice(0, 10) : '';
    case 'time':
      return node.startsAt ? toTimeInput(node.startsAt) : '';
    case 'place':
      return typeof node.metadata.place === 'string' ? node.metadata.place : '';
    case 'cost':
      return formatRawNodeCost(node);
    case 'type':
      return node.type;
    default:
      return '';
  }
}

function toTimeInput(value: string): string {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function DayCard(props: DayCardProps) {
  const {
    dayPlan,
    isDark,
    isDemoMode,
    isLoading,
    selectedPlannerNodeId,
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
    onSaveQuickCell,
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
                  <View style={styles.quickCellGrid}>
                    <TextInput
                      key={`${node.id}-${node.updatedAt}-title`}
                      defaultValue={node.title}
                      onEndEditing={(event) => void onSaveQuickCell(node, 'title', event.nativeEvent.text)}
                      placeholder="Titel"
                      placeholderTextColor={isDark ? '#737373' : '#78716c'}
                      style={[styles.quickCell, styles.quickCellTitle, isDark && styles.inputDark]}
                    />
                    <TextInput
                      key={`${node.id}-${node.updatedAt}-time`}
                      defaultValue={quickCellValue(node, 'time')}
                      onEndEditing={(event) => void onSaveQuickCell(node, 'time', event.nativeEvent.text)}
                      placeholder="TT:MM"
                      placeholderTextColor={isDark ? '#737373' : '#78716c'}
                      style={[styles.quickCell, styles.quickCellSmall, isDark && styles.inputDark]}
                    />
                    <TextInput
                      key={`${node.id}-${node.updatedAt}-date`}
                      defaultValue={quickCellValue(node, 'date')}
                      onEndEditing={(event) => void onSaveQuickCell(node, 'date', event.nativeEvent.text)}
                      placeholder="ÅÅÅÅ-MM-DD"
                      placeholderTextColor={isDark ? '#737373' : '#78716c'}
                      style={[styles.quickCell, styles.quickCellDate, isDark && styles.inputDark]}
                    />
                    <TextInput
                      key={`${node.id}-${node.updatedAt}-place`}
                      defaultValue={quickCellValue(node, 'place')}
                      onEndEditing={(event) => void onSaveQuickCell(node, 'place', event.nativeEvent.text)}
                      placeholder="Plats"
                      placeholderTextColor={isDark ? '#737373' : '#78716c'}
                      style={[styles.quickCell, isDark && styles.inputDark]}
                    />
                    <TextInput
                      key={`${node.id}-${node.updatedAt}-cost`}
                      defaultValue={quickCellValue(node, 'cost')}
                      onEndEditing={(event) => void onSaveQuickCell(node, 'cost', event.nativeEvent.text)}
                      placeholder="Kostnad"
                      placeholderTextColor={isDark ? '#737373' : '#78716c'}
                      style={[styles.quickCell, styles.quickCellSmall, isDark && styles.inputDark]}
                    />
                    <View style={styles.quickTypeRow}>
                      {inlineNodeTypes.map((type) => (
                        <Pressable
                          key={type}
                          style={[styles.quickTypeChip, node.type === type && styles.quickTypeChipActive]}
                          onPress={() => void onSaveQuickCell(node, 'type', type)}
                          disabled={isLoading}
                        >
                          <Text style={[styles.quickTypeChipText, node.type === type && styles.quickTypeChipTextActive]}>
                            {formatNodeType(type)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
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
