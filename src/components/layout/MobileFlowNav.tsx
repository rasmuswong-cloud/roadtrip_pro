import { Pressable, Text, View } from 'react-native';

import type { AppTab, AppView } from './workspaceTypes';

type MobileFlowNavProps = {
  activeView: AppView;
  appTabs: AppTab[];
  styles: any;
  onGoToView: (view: AppView) => void;
};

export function MobileFlowNav({ activeView, appTabs, styles, onGoToView }: MobileFlowNavProps) {
  const activeTabIndex = appTabs.findIndex((tab) => tab.key === activeView);

  return (
    <View style={[styles.flowRail, styles.flowRailMobile]}>
      {appTabs.map((tab, index) => (
        <Pressable
          key={tab.key}
          style={[styles.flowStep, activeView === tab.key && styles.flowStepActive]}
          onPress={() => onGoToView(tab.key)}
        >
          <Text style={[styles.flowStepNumber, activeView === tab.key && styles.flowStepNumberActive]}>{index + 1}</Text>
          <Text style={[styles.flowStepText, activeView === tab.key && styles.flowStepTextActive]}>{tab.label}</Text>
        </Pressable>
      ))}
      <Text style={styles.flowCurrentText}>{activeTabIndex + 1} av {appTabs.length}</Text>
    </View>
  );
}
