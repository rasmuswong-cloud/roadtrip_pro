import { Pressable, Text, TextInput, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import type { DayPlan } from '@/models';
import { dayCardStyles } from './DayCard.styles';

type DayPackingPanelProps = {
  dayPlan: DayPlan;
  expanded: boolean;
  isDark: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  packingDraft: string;
  styles: WorkspaceStyles;
  onToggleExpanded: () => void;
  onTogglePackingItem: (dayPlan: DayPlan, item: string) => Promise<void>;
  onAddPackingItem: (dayPlan: DayPlan) => Promise<void>;
  onSetPackingDraft: (dayKey: string, text: string) => void;
};

export function DayPackingPanel({
  dayPlan,
  expanded,
  isDark,
  isDemoMode,
  isLoading,
  packingDraft,
  styles,
  onToggleExpanded,
  onTogglePackingItem,
  onAddPackingItem,
  onSetPackingDraft,
}: DayPackingPanelProps) {
  return (
    <View style={styles.packingPanel}>
      <Pressable style={dayCardStyles.collapsibleHeader} onPress={onToggleExpanded}>
        <Text style={styles.packingTitle}>Packa / ta med</Text>
        <Text style={styles.secondarySmallButtonText}>{expanded ? 'Dölj' : `Visa ${dayPlan.insight.packingItems.length}`}</Text>
      </Pressable>
      {expanded ? (
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
  );
}
