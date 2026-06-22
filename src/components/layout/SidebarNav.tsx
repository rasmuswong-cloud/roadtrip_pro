import { Pressable, Text, View } from 'react-native';

import type { DayPlan } from '@/models';
import type { AppTab, AppView } from './workspaceTypes';

type SidebarNavProps = {
  activeView: AppView;
  appTabs: AppTab[];
  dayPlans: DayPlan[];
  selectedDayKey: string | null;
  statusLabel?: string;
  statusMeta?: string;
  styles: any;
  tripName: string;
  onGoToView: (view: AppView) => void;
  onSelectDay: (dayKey: string) => void;
};

export function SidebarNav({
  activeView,
  appTabs,
  dayPlans,
  selectedDayKey,
  statusLabel,
  statusMeta,
  styles,
  tripName,
  onGoToView,
  onSelectDay,
}: SidebarNavProps) {
  return (
    <View style={styles.workspaceSidebar}>
      <Text style={styles.workspaceSidebarKicker}>Resa</Text>
      <Text style={styles.workspaceSidebarTitle}>{tripName}</Text>
      <View style={styles.workspaceNavList}>
        {appTabs.map((tab) => (
          <Pressable
            key={tab.key}
            testID={`sidebar-nav-${tab.key}`}
            style={[styles.workspaceNavItem, activeView === tab.key && styles.workspaceNavItemActive]}
            onPress={() => onGoToView(tab.key)}
          >
            <Text style={[styles.workspaceNavText, activeView === tab.key && styles.workspaceNavTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.workspaceDivider} />
      <Text style={styles.workspaceSidebarKicker}>Dagar</Text>
      <View style={styles.dayShortcutList}>
        {dayPlans.slice(0, 9).map((dayPlan) => {
          const active = selectedDayKey === dayPlan.key && activeView === 'days';
          return (
            <Pressable
              key={dayPlan.key}
              testID={`day-shortcut-${dayPlan.key}`}
              style={[styles.dayShortcut, active && styles.dayShortcutActive]}
              onPress={() => onSelectDay(dayPlan.key)}
            >
              <Text style={[styles.dayShortcutTitle, active && styles.dayShortcutTitleActive]}>{dayPlan.shortTitle}</Text>
              <Text style={[styles.dayShortcutMeta, active && styles.dayShortcutMetaActive]} numberOfLines={1}>
                {dayPlan.nodes.length} steg / {dayPlan.summary.startPlace} → {dayPlan.summary.endPlace}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {statusLabel || statusMeta ? (
        <View style={styles.sidebarStatusCard}>
          {statusLabel ? <Text style={styles.sidebarStatusLabel}>{statusLabel}</Text> : null}
          {statusMeta ? <Text style={styles.sidebarStatusMeta} numberOfLines={2}>{statusMeta}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
