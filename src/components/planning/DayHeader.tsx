import { Pressable, Text, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import type { DayPlan } from '@/models';
import { dayCardStyles } from './DayCard.styles';
import { formatDistance, formatDuration, formatSek } from './dayCardViewModel';

type DayHeaderProps = {
  dayPlan: DayPlan;
  expandedFlags: boolean;
  isDark: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  styles: WorkspaceStyles;
  onToggleExpandedFlags: () => void;
  onStartPlaceSearch: (dayKey: string, suggestedQuery?: string) => void;
  onStartNewPlannerStep: (dayKey: string) => void;
};

export function DayHeader({
  dayPlan,
  expandedFlags,
  isDark,
  isDemoMode,
  isLoading,
  styles,
  onToggleExpandedFlags,
  onStartPlaceSearch,
  onStartNewPlannerStep,
}: DayHeaderProps) {
  const visibleFlags = dayPlan.smartFlags.length > 0 ? dayPlan.smartFlags : ['Ser planerad ut'];
  const displayedFlags = expandedFlags ? visibleFlags : visibleFlags.slice(0, 3);

  return (
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
            <Pressable style={dayCardStyles.smartFlagMore} onPress={onToggleExpandedFlags}>
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
            <Text style={styles.secondaryButtonText}>Sök plats</Text>
          </Pressable>
          <Pressable
            testID="day-card-add-stop"
            style={styles.commandButton}
            onPress={() => onStartNewPlannerStep(dayPlan.key)}
          >
            <Text style={styles.commandButtonText}>Lägg till stopp</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
