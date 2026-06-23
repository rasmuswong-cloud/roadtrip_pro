import { Pressable, Text, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import type { DayChecklistItem, DayPlan } from '@/models';
import { dayCardStyles } from './DayCard.styles';

type DayChecklistPanelProps = {
  dayPlan: DayPlan;
  expanded: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  styles: WorkspaceStyles;
  onToggleExpanded: () => void;
  onRunChecklistAction: (dayPlan: DayPlan, item: DayChecklistItem) => void;
};

export function DayChecklistPanel({
  dayPlan,
  expanded,
  isDemoMode,
  isLoading,
  styles,
  onToggleExpanded,
  onRunChecklistAction,
}: DayChecklistPanelProps) {
  return (
    <View style={dayCardStyles.collapsiblePanel}>
      <Pressable style={dayCardStyles.collapsibleHeader} onPress={onToggleExpanded}>
        <Text style={styles.packingTitle}>Checklista</Text>
        <Text style={styles.secondarySmallButtonText}>{expanded ? 'Dölj' : `Visa ${dayPlan.insight.checklist.length}`}</Text>
      </Pressable>
      {expanded ? (
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
  );
}
