import { Text, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import type { DayPlan } from '@/models';

type DaySummaryProps = {
  dayPlan: DayPlan;
  styles: WorkspaceStyles;
};

export function DaySummary({ dayPlan, styles }: DaySummaryProps) {
  return (
    <>
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
    </>
  );
}
