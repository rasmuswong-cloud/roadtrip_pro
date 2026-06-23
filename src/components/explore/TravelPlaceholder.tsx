import { Text, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import type { TravelPlaceholderType } from '@/services/planning/exploreBoard';

type TravelPlaceholderProps = {
  type: TravelPlaceholderType;
  styles: WorkspaceStyles;
  compact?: boolean;
  label?: string;
};

type PlaceholderVisual = {
  icon: string;
  label: string;
  backgroundColor: string;
  accentColor: string;
};

export function TravelPlaceholder({ type, styles, compact = false, label }: TravelPlaceholderProps) {
  const visual = placeholderVisual(type);
  return (
    <View style={[styles.travelPlaceholder, compact && styles.travelPlaceholderCompact, { backgroundColor: visual.backgroundColor }]}>
      <View style={[styles.travelPlaceholderShape, { backgroundColor: visual.accentColor }]} />
      <Text style={[styles.travelPlaceholderIcon, { color: visual.accentColor }]}>{visual.icon}</Text>
      <Text style={styles.travelPlaceholderLabel}>{label ?? visual.label}</Text>
    </View>
  );
}

function placeholderVisual(type: TravelPlaceholderType): PlaceholderVisual {
  switch (type) {
    case 'lodging':
      return { icon: 'H', label: 'Boende', backgroundColor: '#eef7f2', accentColor: '#0f766e' };
    case 'activity':
      return { icon: 'A', label: 'Aktivitet', backgroundColor: '#fff7df', accentColor: '#d97706' };
    case 'food':
      return { icon: 'F', label: 'Mat', backgroundColor: '#fff1f2', accentColor: '#be123c' };
    case 'fuel':
      return { icon: 'B', label: 'Bränsle', backgroundColor: '#eef2ff', accentColor: '#4f46e5' };
    case 'transport':
      return { icon: 'T', label: 'Transport', backgroundColor: '#eff6ff', accentColor: '#2563eb' };
    case 'budget':
      return { icon: 'SEK', label: 'Budget', backgroundColor: '#f8faf7', accentColor: '#475569' };
    case 'notes-explore':
      return { icon: 'i', label: 'Tips', backgroundColor: '#fffefa', accentColor: '#d97706' };
    case 'route-day':
      return { icon: 'R', label: 'Rutt', backgroundColor: '#eef7f2', accentColor: '#0f766e' };
    default:
      return { icon: 'P', label: 'Plats', backgroundColor: '#f8faf7', accentColor: '#52616f' };
  }
}
