import { Text, View } from 'react-native';

type Styles = Record<string, any>;

export function SectionTitle({ title, dark, styles }: { title: string; dark: boolean; styles: Styles }) {
  return <Text style={[styles.sectionTitle, dark && styles.textDark]}>{title}</Text>;
}

export function Metric({ label, value, accent, dark, styles }: { label: string; value: string; accent: string; dark: boolean; styles: Styles }) {
  return (
    <View style={[styles.metric, dark && styles.panelDark, { borderTopColor: accent }]}>
      <Text style={[styles.metricLabel, dark && styles.textMutedDark]}>{label}</Text>
      <Text style={[styles.metricValue, dark && styles.textDark]}>{value}</Text>
    </View>
  );
}

export function BudgetMetricCard({ label, value, detail, accent, styles }: { label: string; value: string; detail: string; accent: string; styles: Styles }) {
  return (
    <View style={[styles.budgetCard, { borderTopColor: accent }]}>
      <Text style={styles.budgetLabel}>{label}</Text>
      <Text style={styles.budgetValue}>{value}</Text>
      <Text style={styles.budgetDetail}>{detail}</Text>
    </View>
  );
}

export function DayInsight({ label, value, tone, styles }: { label: string; value: string; tone: 'good' | 'warn' | 'neutral'; styles: Styles }) {
  return (
    <View style={[styles.dayInsightCard, tone === 'good' && styles.dayInsightGood, tone === 'warn' && styles.dayInsightWarn]}>
      <Text style={styles.dayInsightLabel}>{label}</Text>
      <Text style={styles.dayInsightValue}>{value}</Text>
    </View>
  );
}

export function OverviewFocusCard({ label, title, detail, accent, styles }: { label: string; title: string; detail: string; accent: string; styles: Styles }) {
  return (
    <View style={[styles.overviewFocusCard, { borderTopColor: accent }]}>
      <Text style={styles.overviewFocusLabel}>{label}</Text>
      <Text style={styles.overviewFocusTitle}>{title}</Text>
      <Text style={styles.overviewFocusDetail}>{detail}</Text>
    </View>
  );
}
