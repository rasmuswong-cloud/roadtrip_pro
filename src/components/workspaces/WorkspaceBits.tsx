import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';

type WorkspaceStyle = StyleProp<ViewStyle & TextStyle & ImageStyle>;

export type WorkspaceStyles = Record<string, WorkspaceStyle>;

type SectionTitleProps = {
  title: string;
  dark: boolean;
  styles: WorkspaceStyles;
};

type MetricProps = {
  label: string;
  value: string;
  accent: string;
  dark: boolean;
  styles: WorkspaceStyles;
};

type BudgetMetricCardProps = {
  label: string;
  value: string;
  detail: string;
  accent: string;
  styles: WorkspaceStyles;
};

type DayInsightProps = {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'neutral';
  styles: WorkspaceStyles;
};

type OverviewFocusCardProps = {
  label: string;
  title: string;
  detail: string;
  accent: string;
  styles: WorkspaceStyles;
};

export function SectionTitle({ title, dark, styles }: SectionTitleProps) {
  return <Text style={[styles.sectionTitle, dark && styles.textDark]}>{title}</Text>;
}

export function Metric({ label, value, accent, dark, styles }: MetricProps) {
  return (
    <View style={[styles.metric, dark && styles.panelDark, { borderTopColor: accent }]}>
      <Text style={[styles.metricLabel, dark && styles.textMutedDark]}>{label}</Text>
      <Text style={[styles.metricValue, dark && styles.textDark]}>{value}</Text>
    </View>
  );
}

export function BudgetMetricCard({ label, value, detail, accent, styles }: BudgetMetricCardProps) {
  return (
    <View style={[styles.budgetCard, { borderTopColor: accent }]}>
      <Text style={styles.budgetLabel}>{label}</Text>
      <Text style={styles.budgetValue}>{value}</Text>
      <Text style={styles.budgetDetail}>{detail}</Text>
    </View>
  );
}

export function DayInsight({ label, value, tone, styles }: DayInsightProps) {
  return (
    <View style={[styles.dayInsightCard, tone === 'good' && styles.dayInsightGood, tone === 'warn' && styles.dayInsightWarn]}>
      <Text style={styles.dayInsightLabel}>{label}</Text>
      <Text style={styles.dayInsightValue}>{value}</Text>
    </View>
  );
}

export function OverviewFocusCard({ label, title, detail, accent, styles }: OverviewFocusCardProps) {
  return (
    <View style={[styles.overviewFocusCard, { borderTopColor: accent }]}>
      <Text style={styles.overviewFocusLabel}>{label}</Text>
      <Text style={styles.overviewFocusTitle}>{title}</Text>
      <Text style={styles.overviewFocusDetail}>{detail}</Text>
    </View>
  );
}
