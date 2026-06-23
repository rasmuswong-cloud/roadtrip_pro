import { View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import type { ItineraryNode } from '@/models';
import {
  formatBookingStatus,
  inlineBookingStatuses,
  inlineCurrencies,
  type ActiveInlineEdit,
  type InlineFieldKey,
  type InlineFieldValue,
} from '@/services/planning/inlineEdit';
import { dayCardStyles } from './DayCard.styles';
import { InlineEditableField, InlineEditableSelect, InlineEditableTextArea } from './InlineEditableControls';

type StopDetailsGridProps = {
  node: ItineraryNode;
  activeInlineEdit: ActiveInlineEdit;
  isDark: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  styles: WorkspaceStyles;
  onStartInlineEdit: (nodeId: string, field: InlineFieldKey) => boolean;
  onClearInlineEdit: () => void;
  onInlineDraftChange: (changed: boolean) => void;
  onSaveInlineField: (node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) => Promise<void>;
};

export function StopDetailsGrid({
  node,
  activeInlineEdit,
  isDark,
  isDemoMode,
  isLoading,
  styles,
  onStartInlineEdit,
  onClearInlineEdit,
  onInlineDraftChange,
  onSaveInlineField,
}: StopDetailsGridProps) {
  return (
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
  );
}
